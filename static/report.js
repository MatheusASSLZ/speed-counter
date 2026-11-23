import { formatarData, formatarMoeda } from './model.js';

const MES_VALIDO = /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/;

function situacaoDoItem(item) {
  if (item.situacao === 'pendente') return 'Pendente';
  return item.tipo === 'receita' ? 'Recebida' : 'Paga';
}

function decimalEmReais(centavos) {
  const valor = BigInt(centavos);
  const absoluto = valor < 0n ? -valor : valor;
  return `${valor < 0n ? '-' : ''}${absoluto / 100n},${String(absoluto % 100n).padStart(2, '0')}`;
}

function textoCSV(valor) {
  const texto = String(valor);
  const precisaProteger = /^[\t\r\n]|^\s*[=+\-@]/u.test(texto);
  const seguro = precisaProteger ? `'${texto}` : texto;
  return /[;"\r\n]/u.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

export function criarCSV(mes, resumo) {
  const cabecalho = ['Seção', 'Mês', 'Indicador', 'Data', 'Tipo', 'Descrição', 'Categoria', 'Situação', 'Valor (R$)'];
  const indicadores = [
    ['Receitas recebidas', resumo.receitas_centavos],
    ['Despesas pagas', resumo.despesas_centavos],
    ['Resultado do mês', resumo.resultado_mes_centavos],
    ['Despesas pendentes', resumo.pendencias_centavos],
  ];
  const linhas = indicadores.map(([indicador, valor]) => ['Resumo', mes, indicador, '', '', '', '', '', valor]);

  for (const { categoria, valor_centavos } of resumo.despesas_por_categoria) {
    linhas.push(['Despesas por categoria', mes, '', '', 'Despesa', '', categoria, 'Paga', valor_centavos]);
  }
  for (const item of resumo.historico) {
    linhas.push([
      'Movimentações', mes, '', formatarData(item.data), item.tipo === 'receita' ? 'Receita' : 'Despesa',
      item.descricao, item.categoria, situacaoDoItem(item), item.valor_centavos,
    ]);
  }

  return ['\uFEFF' + cabecalho.map(textoCSV).join(';'), ...linhas.map(linha => {
    const campos = linha.slice(0, -1).map(textoCSV);
    campos.push(decimalEmReais(linha.at(-1)));
    return campos.join(';');
  })].join('\r\n') + '\r\n';
}

function periodoDoMes(mes) {
  const [ano, numero] = mes.split('-');
  const data = new Date(0);
  data.setUTCFullYear(Number(ano), Number(numero), 0);
  return `01/${numero}/${ano} a ${data.getUTCDate()}/${numero}/${ano}`;
}

function itemComValor(rotulo, valor, detalhe = '') {
  const item = document.createElement('li');
  const descricao = document.createElement('span');
  descricao.textContent = rotulo;
  if (detalhe) {
    const complemento = document.createElement('small');
    complemento.textContent = detalhe;
    descricao.append(complemento);
  }
  const quantia = document.createElement('strong');
  quantia.className = 'amount';
  quantia.textContent = formatarMoeda(valor);
  item.append(descricao, quantia);
  return item;
}

function linhaDeMovimento(item) {
  const linha = document.createElement('tr');
  const data = document.createElement('time');
  data.dateTime = item.data;
  data.textContent = formatarData(item.data);
  linha.insertCell().append(data);
  linha.insertCell().textContent = item.tipo === 'receita' ? 'Receita' : 'Despesa';
  linha.insertCell().textContent = item.descricao || '—';
  linha.insertCell().textContent = item.categoria || '—';
  const situacao = document.createElement('span');
  situacao.className = 'status-pill';
  situacao.dataset.status = item.situacao === 'pendente' ? 'pendente' : item.tipo;
  situacao.textContent = situacaoDoItem(item);
  linha.insertCell().append(situacao);
  const valor = linha.insertCell();
  valor.className = 'amount';
  valor.textContent = formatarMoeda(item.valor_centavos);
  return linha;
}

export function iniciarRelatorio({ consultarMes }) {
  const buscar = id => document.getElementById(id);
  const campoMes = buscar('report-month');
  const filtro = buscar('report-category');
  const periodo = buscar('report-period');
  const ganho = buscar('report-income');
  const gasto = buscar('report-expense');
  const resultado = buscar('report-net');
  const pendencias = buscar('report-pending-total');
  const listaCategorias = buscar('report-category-list');
  const categoriasVazias = buscar('report-category-empty');
  const listaPendencias = buscar('report-pending-list');
  const pendenciasVazias = buscar('report-pending-empty');
  const tabela = buscar('report-movements');
  const tabelaVazia = buscar('report-empty');
  const exportar = buscar('export-csv');
  const feedback = buscar('report-feedback');
  let ultimoRelatorio = null;

  function mostrarMensagem(mensagem = '') {
    feedback.textContent = mensagem;
    feedback.hidden = !mensagem;
  }

  function mostrarMovimentos() {
    if (!ultimoRelatorio) return;
    const itens = ultimoRelatorio.resumo.historico.filter(item => !filtro.value || item.categoria === filtro.value);
    tabela.replaceChildren(...itens.map(linhaDeMovimento));
    tabelaVazia.hidden = itens.length > 0;
    tabelaVazia.textContent = filtro.value ? 'Nenhuma movimentação nessa categoria.' : 'Nenhuma movimentação nesse mês.';
  }

  campoMes.addEventListener('change', async () => {
    if (!ultimoRelatorio) return;
    const novoMes = campoMes.value;
    const mesAnterior = ultimoRelatorio.mes;
    mostrarMensagem();
    if (!MES_VALIDO.test(novoMes)) {
      campoMes.value = mesAnterior;
      mostrarMensagem('Escolha um mês válido.');
      return;
    }
    campoMes.disabled = true;
    exportar.disabled = true;
    try {
      if (await consultarMes(novoMes) === false) throw new Error('Consulta indisponível');
    } catch {
      campoMes.value = ultimoRelatorio.mes;
      mostrarMensagem('Não foi possível atualizar o mês. O relatório anterior continua disponível.');
    } finally {
      campoMes.disabled = false;
      exportar.disabled = false;
    }
  });

  filtro.addEventListener('change', mostrarMovimentos);

  exportar.addEventListener('click', () => {
    if (!ultimoRelatorio) return;
    const { mes, resumo } = ultimoRelatorio;
    const arquivo = new Blob([criarCSV(mes, resumo)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = url;
    link.download = `speed-counter-${mes}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    mostrarMensagem('CSV do mês gerado.');
  });

  return ({ mes, resumo, categorias }) => {
    ultimoRelatorio = { mes, resumo };
    campoMes.value = mes;
    periodo.textContent = periodoDoMes(mes);
    ganho.textContent = formatarMoeda(resumo.receitas_centavos);
    gasto.textContent = formatarMoeda(resumo.despesas_centavos);
    resultado.textContent = formatarMoeda(resumo.resultado_mes_centavos);
    resultado.dataset.negative = String(resumo.resultado_mes_centavos < 0);
    pendencias.textContent = formatarMoeda(resumo.pendencias_centavos);
    listaCategorias.replaceChildren(...resumo.despesas_por_categoria.map(item => itemComValor(item.categoria, item.valor_centavos)));
    categoriasVazias.hidden = resumo.despesas_por_categoria.length > 0;
    listaPendencias.replaceChildren(...resumo.pendencias.map(item => itemComValor(item.descricao || 'Despesa', item.valor_centavos, formatarData(item.data))));
    pendenciasVazias.hidden = resumo.pendencias.length > 0;
    const categoriaAnterior = filtro.value;
    const nomes = new Set(categorias);
    for (const item of resumo.historico) {
      if (item.categoria) nomes.add(item.categoria);
    }
    const opcoes = [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    filtro.replaceChildren(new Option('Todas as categorias', ''), ...opcoes.map(nome => new Option(nome, nome)));
    filtro.value = nomes.has(categoriaAnterior) ? categoriaAnterior : '';
    mostrarMovimentos();
    if (!campoMes.disabled) exportar.disabled = false;
  };
}
