(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // static/model.js
  function converterCentavos(texto) {
    const valor = texto.trim();
    const formatoBrasileiro = /^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/;
    const formatoDecimal = /^-?\d+(?:\.\d{1,2})?$/;
    const agrupado = /^-?\d{1,3}(?:\.\d{3})+$/;
    let normalizado;
    if (formatoBrasileiro.test(valor)) {
      normalizado = valor.replaceAll(".", "").replace(",", ".");
    } else if (formatoDecimal.test(valor)) {
      normalizado = valor;
    } else if (agrupado.test(valor)) {
      normalizado = valor.replaceAll(".", "");
    } else {
      throw new Error("Informe um valor em reais com at\xE9 dois centavos decimais. Exemplo 32,75.");
    }
    const negativo = normalizado.startsWith("-");
    const [reais, fracao = ""] = normalizado.replace(/^-/, "").split(".");
    const centavos = BigInt(reais) * 100n + BigInt(fracao.padEnd(2, "0"));
    if (centavos > LIMITE_INTEIRO) {
      throw new Error("O valor ultrapassa o limite de precis\xE3o em centavos.");
    }
    return Number(negativo ? -centavos : centavos);
  }
  function formatarMoeda(centavos) {
    const absoluto = BigInt(Math.abs(centavos));
    const fracao = String(absoluto % 100n).padStart(2, "0");
    const valor = `${formatadorInteiro.format(absoluto / 100n)},${fracao}`;
    return formatadorMoeda.formatToParts(centavos < 0 ? -1 : 1).map((parte) => parte.type === "integer" ? valor : parte.type === "decimal" || parte.type === "fraction" ? "" : parte.value).join("");
  }
  function formatarData(data2) {
    const [ano, mes, dia] = data2.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  function dataDeHoje() {
    const hoje = /* @__PURE__ */ new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${hoje.getFullYear()}-${mes}-${dia}`;
  }
  function mesValido(texto) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(texto) && !texto.startsWith("0000-");
  }
  function dataValida(texto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || !mesValido(texto.slice(0, 7))) return false;
    const teste = /* @__PURE__ */ new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(teste.valueOf()) && teste.toISOString().slice(0, 10) === texto;
  }
  function rotuloSituacao(lancamento) {
    if (lancamento.situacao === "pendente") return "Pendente";
    return lancamento.tipo === "receita" ? "Recebida" : "Paga";
  }
  function numeroSeguro(valor) {
    if (valor < -LIMITE_INTEIRO || valor > LIMITE_INTEIRO) {
      throw new Error("Os totais ultrapassam o limite de precis\xE3o em centavos.");
    }
    return Number(valor);
  }
  function resumirLocalmente(saldoInicial, mes, lancamentos) {
    let receitasGerais = 0n;
    let despesasGerais = 0n;
    let receitasMes = 0n;
    let despesasMes = 0n;
    let totalPendente = 0n;
    const porCategoria = /* @__PURE__ */ new Map();
    const historico = [];
    const pendencias = [];
    for (const lancamento of lancamentos) {
      const noMes = lancamento.data.slice(0, 7) === mes;
      const valor = BigInt(lancamento.valor_centavos);
      if (noMes) historico.push(lancamento);
      if (lancamento.situacao === "pendente") {
        if (noMes && lancamento.tipo === "despesa") {
          pendencias.push(lancamento);
          totalPendente += valor;
        }
        continue;
      }
      if (lancamento.tipo === "receita") {
        receitasGerais += valor;
        if (noMes) receitasMes += valor;
      } else {
        despesasGerais += valor;
        if (noMes) {
          despesasMes += valor;
          const categoria2 = lancamento.categoria;
          porCategoria.set(categoria2, (porCategoria.get(categoria2) ?? 0n) + valor);
        }
      }
    }
    const despesasPorCategoria = [...porCategoria].map(([categoria2, valor]) => ({ categoria: categoria2, valor_centavos: numeroSeguro(valor) })).sort((a, b) => b.valor_centavos - a.valor_centavos || a.categoria.localeCompare(b.categoria, "pt-BR"));
    const ordenarPorData = (a, b) => b.data.localeCompare(a.data);
    return {
      saldo_centavos: numeroSeguro(BigInt(saldoInicial) + receitasGerais - despesasGerais),
      receitas_gerais_centavos: numeroSeguro(receitasGerais),
      despesas_gerais_centavos: numeroSeguro(despesasGerais),
      receitas_centavos: numeroSeguro(receitasMes),
      despesas_centavos: numeroSeguro(despesasMes),
      resultado_mes_centavos: numeroSeguro(receitasMes - despesasMes),
      pendencias_centavos: numeroSeguro(totalPendente),
      historico: historico.sort(ordenarPorData),
      pendencias: pendencias.sort(ordenarPorData),
      despesas_por_categoria: despesasPorCategoria
    };
  }
  var CATEGORIAS_INICIAIS, LIMITE_CENTAVOS, LIMITE_INTEIRO, formatadorMoeda, formatadorInteiro;
  var init_model = __esm({
    "static/model.js"() {
      CATEGORIAS_INICIAIS = ["Alimenta\xE7\xE3o", "Educa\xE7\xE3o", "Moradia", "Sa\xFAde", "Transporte", "Outros"];
      LIMITE_CENTAVOS = Number.MAX_SAFE_INTEGER;
      LIMITE_INTEIRO = BigInt(LIMITE_CENTAVOS);
      formatadorMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
      formatadorInteiro = new Intl.NumberFormat("pt-BR");
    }
  });

  // static/dashboard.js
  var dashboard_exports = {};
  __export(dashboard_exports, {
    iniciarPainel: () => iniciarPainel
  });
  function iniciarPainel({ criarItem: criarItem2, confirmarLancamento: confirmarLancamento2 }) {
    const painel = document.querySelector("#view-saldo");
    const lista = painel.querySelector("#dashboard-list");
    const vazio = painel.querySelector("#dashboard-empty");
    const tituloLista = painel.querySelector("#dashboard-list-title");
    const botoes = [...painel.querySelectorAll("[data-movement-type]")];
    const alteracao2 = painel.querySelector("#balance-change");
    const dialogo = document.querySelector("#confirm-dialog");
    const formulario = dialogo.querySelector("#confirm-form");
    const descricao2 = dialogo.querySelector("#confirm-description");
    const aviso = dialogo.querySelector("#confirm-feedback");
    const confirmar = formulario.querySelector("[type=submit]");
    const cancelar = dialogo.querySelector("#cancel-confirm");
    let lancamentos = [];
    let tipoSelecionado = null;
    let acionador = null;
    function iniciarConfirmacao(lancamento, botao) {
      acionador = botao;
      aviso.textContent = "";
      aviso.hidden = true;
      formulario.elements.id.value = lancamento.id;
      formulario.elements.data.value = dataDeHoje();
      const nome = lancamento.descricao || (lancamento.tipo === "receita" ? "Receita" : "Despesa");
      descricao2.textContent = `${nome} \xB7 ${formatarMoeda(lancamento.valor_centavos)}`;
      dialogo.showModal();
      formulario.elements.data.focus();
    }
    function renderizarLista() {
      for (const botao of botoes) {
        const ativo = String(botao.dataset.movementType === tipoSelecionado);
        botao.setAttribute("aria-expanded", ativo);
        botao.setAttribute("aria-pressed", ativo);
      }
      lista.hidden = !tipoSelecionado;
      if (!tipoSelecionado) {
        tituloLista.textContent = "Por tipo de lan\xE7amento";
        vazio.textContent = "Selecione Receitas ou Despesas para ver os lan\xE7amentos.";
        vazio.hidden = false;
        return;
      }
      tituloLista.textContent = tipoSelecionado === "receita" ? "Receitas" : "Despesas";
      const movimentos = lancamentos.filter((item) => item.tipo === tipoSelecionado).sort((a, b) => b.data.localeCompare(a.data));
      lista.replaceChildren(...movimentos.map((lancamento) => {
        const item = criarItem2(lancamento);
        if (lancamento.situacao === "pendente") {
          const botao = document.createElement("button");
          botao.type = "button";
          botao.className = "button button-secondary";
          botao.textContent = lancamento.tipo === "receita" ? "Confirmar recebimento" : "Confirmar pagamento";
          botao.addEventListener("click", () => iniciarConfirmacao(lancamento, botao));
          item.append(botao);
        }
        return item;
      }));
      vazio.textContent = tipoSelecionado === "receita" ? "Nenhuma receita cadastrada." : "Nenhuma despesa cadastrada.";
      vazio.hidden = movimentos.length > 0;
    }
    for (const botao of botoes) {
      botao.addEventListener("click", () => {
        const tipo = botao.dataset.movementType;
        tipoSelecionado = tipoSelecionado === tipo ? null : tipo;
        renderizarLista();
      });
    }
    cancelar.addEventListener("click", () => dialogo.close());
    dialogo.addEventListener("close", () => {
      if (acionador?.isConnected) acionador.focus();
      else botoes.find((botao) => botao.dataset.movementType === tipoSelecionado)?.focus();
      acionador = null;
    });
    dialogo.addEventListener("cancel", (evento) => {
      if (confirmar.disabled) evento.preventDefault();
    });
    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const data2 = formulario.elements.data.value;
      if (!dataValida(data2)) {
        aviso.textContent = "Informe uma data v\xE1lida para a confirma\xE7\xE3o.";
        aviso.hidden = false;
        return;
      }
      aviso.textContent = "";
      aviso.hidden = true;
      confirmar.disabled = true;
      cancelar.disabled = true;
      try {
        await confirmarLancamento2(formulario.elements.id.value, data2);
        dialogo.close();
      } catch (erro) {
        aviso.textContent = erro.message;
        aviso.hidden = false;
      } finally {
        confirmar.disabled = false;
        cancelar.disabled = false;
      }
    });
    return (estado2) => {
      lancamentos = estado2.lancamentos;
      const resumo2 = estado2.resumo;
      painel.querySelector("#balance-total").textContent = formatarMoeda(resumo2.saldo_centavos);
      painel.querySelector("#income-total").textContent = formatarMoeda(resumo2.receitas_gerais_centavos);
      painel.querySelector("#expense-total").textContent = formatarMoeda(resumo2.despesas_gerais_centavos);
      const movimento = estado2.alteracao;
      alteracao2.hidden = !movimento;
      if (movimento) {
        painel.querySelector("#previous-balance").textContent = formatarMoeda(movimento.anterior);
        const prefixo = movimento.efeito > 0 ? "+" : "";
        painel.querySelector("#balance-effect").textContent = `${prefixo}${formatarMoeda(movimento.efeito)}`;
        painel.querySelector("#new-balance").textContent = formatarMoeda(movimento.atual);
        painel.querySelector("#balance-effect-label").textContent = movimento.descricao;
      }
      renderizarLista();
    };
  }
  var init_dashboard = __esm({
    "static/dashboard.js"() {
      init_model();
    }
  });

  // static/report.js
  var report_exports = {};
  __export(report_exports, {
    criarCSV: () => criarCSV,
    iniciarRelatorio: () => iniciarRelatorio
  });
  function situacaoDoItem(item) {
    if (item.situacao === "pendente") return "Pendente";
    return item.tipo === "receita" ? "Recebida" : "Paga";
  }
  function decimalEmReais(centavos) {
    const valor = BigInt(centavos);
    const absoluto = valor < 0n ? -valor : valor;
    return `${valor < 0n ? "-" : ""}${absoluto / 100n},${String(absoluto % 100n).padStart(2, "0")}`;
  }
  function textoCSV(valor) {
    const texto = String(valor);
    const precisaProteger = /^[\t\r\n]|^\s*[=+\-@]/u.test(texto);
    const seguro = precisaProteger ? `'${texto}` : texto;
    return /[;"\r\n]/u.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
  }
  function criarCSV(mes, resumo2) {
    const cabecalho = ["Se\xE7\xE3o", "M\xEAs", "Indicador", "Data", "Tipo", "Descri\xE7\xE3o", "Categoria", "Situa\xE7\xE3o", "Valor (R$)"];
    const indicadores = [
      ["Receitas recebidas", resumo2.receitas_centavos],
      ["Despesas pagas", resumo2.despesas_centavos],
      ["Resultado do m\xEAs", resumo2.resultado_mes_centavos],
      ["Despesas pendentes", resumo2.pendencias_centavos]
    ];
    const linhas = indicadores.map(([indicador, valor]) => ["Resumo", mes, indicador, "", "", "", "", "", valor]);
    for (const { categoria: categoria2, valor_centavos } of resumo2.despesas_por_categoria) {
      linhas.push(["Despesas por categoria", mes, "", "", "Despesa", "", categoria2, "Paga", valor_centavos]);
    }
    for (const item of resumo2.historico) {
      linhas.push([
        "Movimenta\xE7\xF5es",
        mes,
        "",
        formatarData(item.data),
        item.tipo === "receita" ? "Receita" : "Despesa",
        item.descricao,
        item.categoria,
        situacaoDoItem(item),
        item.valor_centavos
      ]);
    }
    return ["\uFEFF" + cabecalho.map(textoCSV).join(";"), ...linhas.map((linha) => {
      const campos = linha.slice(0, -1).map(textoCSV);
      campos.push(decimalEmReais(linha.at(-1)));
      return campos.join(";");
    })].join("\r\n") + "\r\n";
  }
  function periodoDoMes(mes) {
    const [ano, numero] = mes.split("-");
    const data2 = /* @__PURE__ */ new Date(0);
    data2.setUTCFullYear(Number(ano), Number(numero), 0);
    return `01/${numero}/${ano} a ${data2.getUTCDate()}/${numero}/${ano}`;
  }
  function itemComValor(rotulo, valor, detalhe = "") {
    const item = document.createElement("li");
    const descricao2 = document.createElement("span");
    descricao2.textContent = rotulo;
    if (detalhe) {
      const complemento = document.createElement("small");
      complemento.textContent = detalhe;
      descricao2.append(complemento);
    }
    const quantia = document.createElement("strong");
    quantia.className = "amount";
    quantia.textContent = formatarMoeda(valor);
    item.append(descricao2, quantia);
    return item;
  }
  function linhaDeMovimento(item) {
    const linha = document.createElement("tr");
    const data2 = document.createElement("time");
    data2.dateTime = item.data;
    data2.textContent = formatarData(item.data);
    linha.insertCell().append(data2);
    linha.insertCell().textContent = item.tipo === "receita" ? "Receita" : "Despesa";
    linha.insertCell().textContent = item.descricao || "\u2014";
    linha.insertCell().textContent = item.categoria || "\u2014";
    const situacao2 = document.createElement("span");
    situacao2.className = "status-pill";
    situacao2.dataset.status = item.situacao === "pendente" ? "pendente" : item.tipo;
    situacao2.textContent = situacaoDoItem(item);
    linha.insertCell().append(situacao2);
    const valor = linha.insertCell();
    valor.className = "amount";
    valor.textContent = formatarMoeda(item.valor_centavos);
    return linha;
  }
  function iniciarRelatorio({ consultarMes: consultarMes2 }) {
    const buscar = (id) => document.getElementById(id);
    const campoMes = buscar("report-month");
    const filtro = buscar("report-category");
    const periodo = buscar("report-period");
    const ganho = buscar("report-income");
    const gasto = buscar("report-expense");
    const resultado = buscar("report-net");
    const pendencias = buscar("report-pending-total");
    const listaCategorias = buscar("report-category-list");
    const categoriasVazias = buscar("report-category-empty");
    const listaPendencias = buscar("report-pending-list");
    const pendenciasVazias = buscar("report-pending-empty");
    const tabela = buscar("report-movements");
    const tabelaVazia = buscar("report-empty");
    const exportar = buscar("export-csv");
    const feedback2 = buscar("report-feedback");
    let ultimoRelatorio = null;
    function mostrarMensagem(mensagem = "") {
      feedback2.textContent = mensagem;
      feedback2.hidden = !mensagem;
    }
    function mostrarMovimentos() {
      if (!ultimoRelatorio) return;
      const itens = ultimoRelatorio.resumo.historico.filter((item) => !filtro.value || item.categoria === filtro.value);
      tabela.replaceChildren(...itens.map(linhaDeMovimento));
      tabelaVazia.hidden = itens.length > 0;
      tabelaVazia.textContent = filtro.value ? "Nenhuma movimenta\xE7\xE3o nessa categoria." : "Nenhuma movimenta\xE7\xE3o nesse m\xEAs.";
    }
    campoMes.addEventListener("change", async () => {
      if (!ultimoRelatorio) return;
      const novoMes = campoMes.value;
      const mesAnterior = ultimoRelatorio.mes;
      mostrarMensagem();
      if (!MES_VALIDO.test(novoMes)) {
        campoMes.value = mesAnterior;
        mostrarMensagem("Escolha um m\xEAs v\xE1lido.");
        return;
      }
      campoMes.disabled = true;
      exportar.disabled = true;
      try {
        if (await consultarMes2(novoMes) === false) throw new Error("Consulta indispon\xEDvel");
      } catch {
        campoMes.value = ultimoRelatorio.mes;
        mostrarMensagem("N\xE3o foi poss\xEDvel atualizar o m\xEAs. O relat\xF3rio anterior continua dispon\xEDvel.");
      } finally {
        campoMes.disabled = false;
        exportar.disabled = false;
      }
    });
    filtro.addEventListener("change", mostrarMovimentos);
    exportar.addEventListener("click", () => {
      if (!ultimoRelatorio) return;
      const { mes, resumo: resumo2 } = ultimoRelatorio;
      const arquivo = new Blob([criarCSV(mes, resumo2)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement("a");
      link.href = url;
      link.download = `speed-counter-${mes}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
      mostrarMensagem("CSV do m\xEAs gerado.");
    });
    return ({ mes, resumo: resumo2, categorias }) => {
      ultimoRelatorio = { mes, resumo: resumo2 };
      campoMes.value = mes;
      periodo.textContent = periodoDoMes(mes);
      ganho.textContent = formatarMoeda(resumo2.receitas_centavos);
      gasto.textContent = formatarMoeda(resumo2.despesas_centavos);
      resultado.textContent = formatarMoeda(resumo2.resultado_mes_centavos);
      resultado.dataset.negative = String(resumo2.resultado_mes_centavos < 0);
      pendencias.textContent = formatarMoeda(resumo2.pendencias_centavos);
      listaCategorias.replaceChildren(...resumo2.despesas_por_categoria.map((item) => itemComValor(item.categoria, item.valor_centavos)));
      categoriasVazias.hidden = resumo2.despesas_por_categoria.length > 0;
      listaPendencias.replaceChildren(...resumo2.pendencias.map((item) => itemComValor(item.descricao || "Despesa", item.valor_centavos, formatarData(item.data))));
      pendenciasVazias.hidden = resumo2.pendencias.length > 0;
      const categoriaAnterior = filtro.value;
      const nomes = new Set(categorias);
      for (const item of resumo2.historico) {
        if (item.categoria) nomes.add(item.categoria);
      }
      const opcoes = [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
      filtro.replaceChildren(new Option("Todas as categorias", ""), ...opcoes.map((nome) => new Option(nome, nome)));
      filtro.value = nomes.has(categoriaAnterior) ? categoriaAnterior : "";
      mostrarMovimentos();
      if (!campoMes.disabled) exportar.disabled = false;
    };
  }
  var MES_VALIDO;
  var init_report = __esm({
    "static/report.js"() {
      init_model();
      MES_VALIDO = /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/;
    }
  });

  // static/config.js
  var NIVEL = 4;

  // static/app.js
  init_model();
  var CHAVE = "speed-counter-estado-v1";
  var TIPOS_CONTA = {
    digital: "Conta digital",
    corrente: "Conta-corrente",
    poupanca: "Poupan\xE7a",
    carteira: "Carteira"
  };
  var usouArquivo = location.protocol === "file:";
  var local = NIVEL < 4 || usouArquivo || new URLSearchParams(location.search).get("modo") === "local" || location.pathname !== "/";
  var pegar = (id) => document.getElementById(id);
  var contaForm = pegar("account-form");
  var lancamentoForm = pegar("transaction-form");
  var categoriaForm = pegar("category-form");
  var descricao = lancamentoForm.elements.descricao;
  var categoria = lancamentoForm.elements.categoria;
  var data = lancamentoForm.elements.data;
  var situacao = lancamentoForm.elements.situacao;
  var placeholders = { receita: "Ex.: Bolsa de est\xE1gio", despesa: "Ex.: Compra na farm\xE1cia" };
  var estado = {
    conta: null,
    lancamentos: [],
    categorias: [...CATEGORIAS_INICIAIS],
    mes: dataDeHoje().slice(0, 7)
  };
  var ultimoGravado = null;
  var persistenciaDisponivel = true;
  var resumo = resumirLocalmente(0, estado.mes, []);
  var alteracao = null;
  var secao = "cadastro";
  var editandoConta = false;
  var aguardando = false;
  var renderizarSaldo;
  var renderizarRelatorio;
  var sequencia = 0;
  var botoesNav = [...pegar("app-nav").querySelectorAll("[data-view]")];
  var controlesDeGravacao = [
    contaForm.querySelector("[type=submit]"),
    lancamentoForm.querySelector("[type=submit]"),
    categoriaForm.querySelector("[type=submit]"),
    pegar("load-demo")
  ].filter(Boolean);
  function feedback(id, texto = "", erro = false) {
    const elemento = pegar(id);
    elemento.textContent = texto;
    elemento.hidden = !texto;
    elemento.dataset.status = erro ? "erro" : "ok";
  }
  function criarId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++sequencia}-${Math.random()}`;
  }
  function chaveCategoria(nome) {
    return nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  }
  function carregarDados() {
    try {
      ultimoGravado = localStorage.getItem(CHAVE);
      if (ultimoGravado !== null) {
        const salvo = JSON.parse(ultimoGravado);
        if (!salvo.conta || !Array.isArray(salvo.lancamentos) || !Array.isArray(salvo.categorias) || !mesValido(salvo.mes)) {
          throw new Error("Dados salvos inv\xE1lidos.");
        }
        const resumoSalvo = resumirLocalmente(salvo.conta.saldoInicialCentavos, salvo.mes, salvo.lancamentos);
        estado = salvo;
        resumo = resumoSalvo;
        return;
      }
      const contaAnterior = JSON.parse(localStorage.getItem("speed-counter-conta") ?? "null");
      const anteriores = JSON.parse(localStorage.getItem("speed-counter-lancamentos") ?? "[]");
      if (!contaAnterior && anteriores.length === 0) return;
      const categorias = [...CATEGORIAS_INICIAIS];
      const lancamentos = anteriores.map((item) => {
        const nome = item.categoria;
        let categoriaMigrada = "";
        if (nome) {
          categoriaMigrada = categorias.find((atual) => chaveCategoria(atual) === chaveCategoria(nome)) ?? nome;
          if (!categorias.includes(categoriaMigrada)) categorias.push(categoriaMigrada);
        }
        return {
          id: criarId(),
          tipo: item.tipo,
          descricao: item.descricao,
          categoria: categoriaMigrada,
          valor_centavos: item.valorCentavos,
          data: item.data,
          situacao: item.situacao
        };
      });
      const mes = lancamentos.at(-1)?.data.slice(0, 7) ?? estado.mes;
      const resumoAnterior = resumirLocalmente(contaAnterior?.saldoInicialCentavos ?? 0, mes, lancamentos);
      estado = {
        conta: contaAnterior && { ...contaAnterior, tipo: contaAnterior.tipo === "dinheiro" ? "carteira" : contaAnterior.tipo },
        lancamentos,
        categorias,
        mes
      };
      resumo = resumoAnterior;
    } catch {
      persistenciaDisponivel = false;
      feedback("app-feedback", "N\xE3o foi poss\xEDvel ler os dados do navegador. Os dados existentes foram preservados.", true);
    }
  }
  async function calcular(candidato) {
    const saldoInicial = candidato.conta?.saldoInicialCentavos ?? 0;
    if (local) return resumirLocalmente(saldoInicial, candidato.mes, candidato.lancamentos);
    let resposta;
    try {
      resposta = await fetch("/api/resumo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saldo_inicial_centavos: saldoInicial,
          mes: candidato.mes,
          lancamentos: candidato.lancamentos.map(({ id, ...item }) => item)
        }),
        signal: AbortSignal.timeout(8e3)
      });
    } catch {
      throw new Error("A API est\xE1 indispon\xEDvel. Os dados anteriores foram preservados.");
    }
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok || !corpo) {
      throw new Error(typeof corpo?.detail === "string" ? corpo.detail : "A API n\xE3o aceitou a opera\xE7\xE3o. Confira os dados.");
    }
    return corpo;
  }
  function travar(travado) {
    aguardando = travado;
    pegar("conteudo").setAttribute("aria-busy", String(travado));
    controlesDeGravacao.forEach((controle) => {
      controle.disabled = travado;
    });
  }
  async function salvar(candidato, movimento = null) {
    if (aguardando) throw new Error("Aguarde a opera\xE7\xE3o em andamento.");
    if (!persistenciaDisponivel) throw new Error("Os dados deste navegador est\xE3o indispon\xEDveis para grava\xE7\xE3o.");
    travar(true);
    try {
      const novoResumo = await calcular(candidato);
      if (localStorage.getItem(CHAVE) !== ultimoGravado) {
        throw new Error("Os dados mudaram em outra aba. Recarregue a p\xE1gina antes de salvar.");
      }
      const novoGravado = JSON.stringify(candidato);
      try {
        localStorage.setItem(CHAVE, novoGravado);
      } catch {
        throw new Error("N\xE3o foi poss\xEDvel salvar no navegador. Os dados anteriores foram preservados.");
      }
      ultimoGravado = novoGravado;
      if (movimento) {
        alteracao = {
          anterior: resumo.saldo_centavos,
          efeito: novoResumo.saldo_centavos - resumo.saldo_centavos,
          atual: novoResumo.saldo_centavos,
          descricao: movimento.descricao || (movimento.tipo === "receita" ? "Receita" : "Despesa")
        };
      } else if (candidato.conta !== estado.conta) {
        alteracao = null;
      }
      estado = candidato;
      resumo = novoResumo;
      feedback("app-feedback");
      renderizar();
    } finally {
      travar(false);
    }
  }
  function criarItem(item) {
    const linha = document.createElement("li");
    const texto = document.createElement("span");
    const titulo = document.createElement("strong");
    titulo.textContent = item.descricao || (item.tipo === "receita" ? "Receita" : "Despesa");
    const detalhe = document.createElement("small");
    detalhe.textContent = [item.categoria, formatarData(item.data)].filter(Boolean).join(" \xB7 ");
    texto.append(titulo, detalhe);
    const valores = document.createElement("span");
    const valor = document.createElement("strong");
    valor.className = "amount";
    valor.textContent = formatarMoeda(item.valor_centavos);
    const status = document.createElement("small");
    status.className = "status-pill";
    status.dataset.status = item.situacao === "pendente" ? "pendente" : item.tipo;
    status.textContent = rotuloSituacao(item);
    valores.append(valor, status);
    linha.append(texto, valores);
    return linha;
  }
  function renderizar() {
    const temConta = Boolean(estado.conta);
    pegar("account-form-area").hidden = temConta && !editandoConta;
    pegar("account-summary").hidden = !temConta || editandoConta;
    pegar("registration-content").hidden = !temConta;
    pegar("load-demo").hidden = temConta || estado.lancamentos.length > 0;
    const cancelar = pegar("cancel-edit-account");
    if (cancelar) cancelar.hidden = !editandoConta;
    if (temConta) {
      pegar("account-name").textContent = estado.conta.nome;
      pegar("account-type").textContent = TIPOS_CONTA[estado.conta.tipo] ?? "";
    }
    for (const botao of botoesNav) {
      const incluida = botao.dataset.view === "cadastro" || (botao.dataset.view === "saldo" ? NIVEL >= 2 : NIVEL >= 3);
      botao.hidden = !incluida;
      botao.disabled = !incluida || botao.dataset.view !== "cadastro" && !temConta;
    }
    const selecionada = categoria.value;
    categoria.replaceChildren(new Option("Escolha a categoria", ""), ...estado.categorias.map((nome) => new Option(nome, nome)));
    categoria.value = estado.categorias.includes(selecionada) ? selecionada : "";
    const recentes = estado.lancamentos.slice(-5).reverse();
    pegar("recent-list").replaceChildren(...recentes.map(criarItem));
    pegar("recent-empty").hidden = recentes.length > 0;
    renderizarSaldo?.({ lancamentos: estado.lancamentos, resumo, alteracao });
    renderizarRelatorio?.({ mes: estado.mes, resumo, categorias: estado.categorias });
  }
  function mostrarSecao(novaSecao) {
    if (secao === novaSecao) return;
    secao = novaSecao;
    for (const botao of botoesNav) {
      const ativo = botao.dataset.view === secao;
      if (ativo) botao.setAttribute("aria-current", "page");
      else botao.removeAttribute("aria-current");
      pegar(botao.getAttribute("aria-controls")).hidden = !ativo;
    }
    pegar(secao === "saldo" ? "demo-slot" : "registration-slot").append(pegar("transaction-form-block"));
    pegar("conteudo").focus();
  }
  function atualizarTipo() {
    const despesa = lancamentoForm.elements.tipo.value === "despesa";
    pegar("category-field").hidden = !despesa;
    categoria.disabled = !despesa;
    descricao.required = despesa;
    descricao.placeholder = placeholders[despesa ? "despesa" : "receita"];
    situacao.options[0].textContent = despesa ? "Paga" : "Recebida";
    if (!despesa) abrirEditorCategoria(false);
  }
  function abrirEditorCategoria(aberto) {
    pegar("category-editor").hidden = !aberto;
    pegar("category-toggle").setAttribute("aria-expanded", String(aberto));
    if (aberto) categoriaForm.elements.nova_categoria.focus();
    else feedback("category-feedback");
  }
  for (const botao of botoesNav) {
    botao.addEventListener("click", () => mostrarSecao(botao.dataset.view));
  }
  pegar("category-toggle").addEventListener("click", () => abrirEditorCategoria(pegar("category-editor").hidden));
  for (const controle of lancamentoForm.elements.tipo) controle.addEventListener("change", atualizarTipo);
  pegar("edit-account").addEventListener("click", () => {
    editandoConta = true;
    contaForm.elements.nome.value = estado.conta.nome;
    contaForm.elements.tipo_conta.value = estado.conta.tipo;
    contaForm.elements.saldo_inicial.value = formatarMoeda(estado.conta.saldoInicialCentavos).replace(/R\$\s*/u, "").replace("\u2212", "-");
    feedback("account-feedback");
    renderizar();
    contaForm.elements.nome.focus();
  });
  pegar("cancel-edit-account")?.addEventListener("click", () => {
    editandoConta = false;
    renderizar();
    pegar("edit-account").focus();
  });
  contaForm.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    feedback("account-feedback");
    try {
      const campos = new FormData(contaForm);
      const nome = campos.get("nome").trim();
      const tipo = campos.get("tipo_conta");
      if (!nome) throw new Error("Informe o nome da conta.");
      if (!Object.hasOwn(TIPOS_CONTA, tipo)) throw new Error("Escolha o tipo da conta.");
      const saldoInicialCentavos = converterCentavos(campos.get("saldo_inicial"));
      await salvar({ ...estado, conta: { nome, tipo, saldoInicialCentavos } });
      editandoConta = false;
      renderizar();
      feedback("app-feedback", "Conta salva.");
    } catch (erro) {
      feedback("account-feedback", erro.message, true);
    }
  });
  lancamentoForm.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    feedback("transaction-feedback");
    try {
      if (!estado.conta) throw new Error("Configure a conta principal primeiro.");
      const campos = new FormData(lancamentoForm);
      const tipo = campos.get("tipo");
      const nome = campos.get("descricao").trim();
      const grupo = tipo === "despesa" ? campos.get("categoria") : "";
      const dia = campos.get("data");
      const valor = converterCentavos(campos.get("valor"));
      if (valor < 1) throw new Error("Informe um valor a partir de R$ 0,01.");
      if (!dataValida(dia)) throw new Error("Informe uma data v\xE1lida.");
      if (tipo === "despesa" && (!nome || !estado.categorias.includes(grupo))) {
        throw new Error("Informe a descri\xE7\xE3o e a categoria da despesa.");
      }
      const item = {
        id: criarId(),
        tipo,
        descricao: nome,
        categoria: grupo,
        data: dia,
        valor_centavos: valor,
        situacao: campos.get("situacao")
      };
      await salvar({ ...estado, lancamentos: [...estado.lancamentos, item] }, item);
      lancamentoForm.reset();
      data.value = dia;
      atualizarTipo();
      feedback("transaction-feedback", "Lan\xE7amento salvo.");
    } catch (erro) {
      feedback("transaction-feedback", erro.message, true);
    }
  });
  categoriaForm.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
      const nome = categoriaForm.elements.nova_categoria.value.trim();
      if (!nome) throw new Error("Informe o nome da categoria.");
      if (estado.categorias.some((item) => chaveCategoria(item) === chaveCategoria(nome))) {
        throw new Error("J\xE1 existe uma categoria com esse nome.");
      }
      await salvar({ ...estado, categorias: [...estado.categorias, nome] });
      categoriaForm.reset();
      abrirEditorCategoria(false);
      categoria.value = nome;
      categoria.focus();
    } catch (erro) {
      feedback("category-feedback", erro.message, true);
    }
  });
  pegar("load-demo").addEventListener("click", async () => {
    if (estado.conta || estado.lancamentos.length) return;
    const lancamentos = [
      { id: criarId(), tipo: "receita", descricao: "Bolsa de est\xE1gio", categoria: "", valor_centavos: 78e3, data: "2026-01-01", situacao: "realizado" },
      { id: criarId(), tipo: "despesa", descricao: "Aluguel", categoria: "Moradia", valor_centavos: 36e3, data: "2026-01-31", situacao: "realizado" },
      { id: criarId(), tipo: "despesa", descricao: "Internet", categoria: "Moradia", valor_centavos: 3990, data: "2026-01-25", situacao: "pendente" }
    ];
    try {
      await salvar({
        ...estado,
        conta: { nome: "Conta de exemplo", tipo: "digital", saldoInicialCentavos: 5e3 },
        mes: "2026-01",
        lancamentos
      });
      data.value = "2026-01-15";
      feedback("app-feedback", "Exemplo de janeiro carregado.");
    } catch (erro) {
      feedback("app-feedback", erro.message, true);
    }
  });
  async function confirmarLancamento(id, dia) {
    const atual = estado.lancamentos.find((item) => item.id === id);
    if (!atual || atual.situacao !== "pendente") throw new Error("Este lan\xE7amento j\xE1 foi atualizado.");
    const confirmado = { ...atual, data: dia, situacao: "realizado" };
    await salvar({ ...estado, lancamentos: estado.lancamentos.map((item) => item.id === id ? confirmado : item) }, confirmado);
  }
  async function consultarMes(mes) {
    if (!mesValido(mes)) throw new Error("Escolha um m\xEAs v\xE1lido.");
    await salvar({ ...estado, mes });
  }
  async function iniciar() {
    carregarDados();
    if (NIVEL >= 2) {
      const { iniciarPainel: iniciarPainel2 } = await Promise.resolve().then(() => (init_dashboard(), dashboard_exports));
      renderizarSaldo = iniciarPainel2({ criarItem, confirmarLancamento });
    }
    if (NIVEL >= 3) {
      const { iniciarRelatorio: iniciarRelatorio2 } = await Promise.resolve().then(() => (init_report(), report_exports));
      renderizarRelatorio = iniciarRelatorio2({ consultarMes });
    }
    data.value = estado.mes === "2026-01" ? "2026-01-15" : dataDeHoje();
    atualizarTipo();
    renderizar();
    if (estado.conta && !local) {
      travar(true);
      try {
        resumo = await calcular(estado);
        renderizar();
      } catch (erro) {
        feedback("app-feedback", erro.message, true);
      } finally {
        travar(false);
      }
    }
  }
  iniciar().catch(() => feedback("app-feedback", "N\xE3o foi poss\xEDvel iniciar o Speed Counter. Recarregue a p\xE1gina.", true));
})();
