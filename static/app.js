import { NIVEL } from "./config.js";
import {
    CATEGORIAS_INICIAIS, converterCentavos, dataDeHoje, dataValida, formatarData,
    formatarMoeda, mesValido, resumirLocalmente, rotuloSituacao,
} from "./model.js";

const CHAVE = "speed-counter-estado-v1";
const TIPOS_CONTA = {
    digital: "Conta digital", corrente: "Conta-corrente", poupanca: "Poupança", carteira: "Carteira",
};
const usouArquivo = location.protocol === "file:";
const local = NIVEL < 4 || usouArquivo || new URLSearchParams(location.search).get("modo") === "local" || location.pathname !== "/";
const pegar = id => document.getElementById(id);
const contaForm = pegar("account-form");
const lancamentoForm = pegar("transaction-form");
const categoriaForm = pegar("category-form");
const descricao = lancamentoForm.elements.descricao;
const categoria = lancamentoForm.elements.categoria;
const data = lancamentoForm.elements.data;
const situacao = lancamentoForm.elements.situacao;
const placeholders = { receita: "Ex.: Bolsa de estágio", despesa: "Ex.: Compra na farmácia" };

let estado = {
    conta: null, lancamentos: [], categorias: [...CATEGORIAS_INICIAIS], mes: dataDeHoje().slice(0, 7),
};
let ultimoGravado = null;
let persistenciaDisponivel = true;
let resumo = resumirLocalmente(0, estado.mes, []);
let alteracao = null;
let secao = "cadastro";
let editandoConta = false;
let aguardando = false;
let renderizarSaldo;
let renderizarRelatorio;
let sequencia = 0;

const botoesNav = [...pegar("app-nav").querySelectorAll("[data-view]")];
const controlesDeGravacao = [
    contaForm.querySelector("[type=submit]"), lancamentoForm.querySelector("[type=submit]"),
    categoriaForm.querySelector("[type=submit]"), pegar("load-demo"),
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
                throw new Error("Dados salvos inválidos.");
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
        const lancamentos = anteriores.map(item => {
            const nome = item.categoria;
            let categoriaMigrada = "";
            if (nome) {
                categoriaMigrada = categorias.find(atual => chaveCategoria(atual) === chaveCategoria(nome)) ?? nome;
                if (!categorias.includes(categoriaMigrada)) categorias.push(categoriaMigrada);
            }
            return {
                id: criarId(), tipo: item.tipo, descricao: item.descricao,
                categoria: categoriaMigrada, valor_centavos: item.valorCentavos,
                data: item.data, situacao: item.situacao,
            };
        });
        const mes = lancamentos.at(-1)?.data.slice(0, 7) ?? estado.mes;
        const resumoAnterior = resumirLocalmente(contaAnterior?.saldoInicialCentavos ?? 0, mes, lancamentos);
        estado = {
            conta: contaAnterior && { ...contaAnterior, tipo: contaAnterior.tipo === "dinheiro" ? "carteira" : contaAnterior.tipo },
            lancamentos, categorias, mes,
        };
        resumo = resumoAnterior;
    } catch {
        persistenciaDisponivel = false;
        feedback("app-feedback", "Não foi possível ler os dados do navegador. Os dados existentes foram preservados.", true);
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
                lancamentos: candidato.lancamentos.map(({ id, ...item }) => item),
            }),
            signal: AbortSignal.timeout(8000),
        });
    } catch {
        throw new Error("A API está indisponível. Os dados anteriores foram preservados.");
    }
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok || !corpo) {
        throw new Error(typeof corpo?.detail === "string" ? corpo.detail : "A API não aceitou a operação. Confira os dados.");
    }
    return corpo;
}

function travar(travado) {
    aguardando = travado;
    pegar("conteudo").setAttribute("aria-busy", String(travado));
    controlesDeGravacao.forEach(controle => { controle.disabled = travado; });
}

async function salvar(candidato, movimento = null) {
    if (aguardando) throw new Error("Aguarde a operação em andamento.");
    if (!persistenciaDisponivel) throw new Error("Os dados deste navegador estão indisponíveis para gravação.");

    travar(true);
    try {
        const novoResumo = await calcular(candidato);
        if (localStorage.getItem(CHAVE) !== ultimoGravado) {
            throw new Error("Os dados mudaram em outra aba. Recarregue a página antes de salvar.");
        }
        const novoGravado = JSON.stringify(candidato);
        try {
            localStorage.setItem(CHAVE, novoGravado);
        } catch {
            throw new Error("Não foi possível salvar no navegador. Os dados anteriores foram preservados.");
        }
        ultimoGravado = novoGravado;
        if (movimento) {
            alteracao = {
                anterior: resumo.saldo_centavos,
                efeito: novoResumo.saldo_centavos - resumo.saldo_centavos,
                atual: novoResumo.saldo_centavos,
                descricao: movimento.descricao || (movimento.tipo === "receita" ? "Receita" : "Despesa"),
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
    detalhe.textContent = [item.categoria, formatarData(item.data)].filter(Boolean).join(" · ");
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
        botao.disabled = !incluida || (botao.dataset.view !== "cadastro" && !temConta);
    }

    const selecionada = categoria.value;
    categoria.replaceChildren(new Option("Escolha a categoria", ""), ...estado.categorias.map(nome => new Option(nome, nome)));
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
    contaForm.elements.saldo_inicial.value = formatarMoeda(estado.conta.saldoInicialCentavos).replace(/R\$\s*/u, "").replace("−", "-");
    feedback("account-feedback");
    renderizar();
    contaForm.elements.nome.focus();
});
pegar("cancel-edit-account")?.addEventListener("click", () => {
    editandoConta = false;
    renderizar();
    pegar("edit-account").focus();
});

contaForm.addEventListener("submit", async evento => {
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

lancamentoForm.addEventListener("submit", async evento => {
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
        if (!dataValida(dia)) throw new Error("Informe uma data válida.");
        if (tipo === "despesa" && (!nome || !estado.categorias.includes(grupo))) {
            throw new Error("Informe a descrição e a categoria da despesa.");
        }
        const item = {
            id: criarId(), tipo, descricao: nome, categoria: grupo, data: dia,
            valor_centavos: valor, situacao: campos.get("situacao"),
        };
        await salvar({ ...estado, lancamentos: [...estado.lancamentos, item] }, item);
        lancamentoForm.reset();
        data.value = dia;
        atualizarTipo();
        feedback("transaction-feedback", "Lançamento salvo.");
    } catch (erro) {
        feedback("transaction-feedback", erro.message, true);
    }
});

categoriaForm.addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
        const nome = categoriaForm.elements.nova_categoria.value.trim();
        if (!nome) throw new Error("Informe o nome da categoria.");
        if (estado.categorias.some(item => chaveCategoria(item) === chaveCategoria(nome))) {
            throw new Error("Já existe uma categoria com esse nome.");
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
        { id: criarId(), tipo: "receita", descricao: "Bolsa de estágio", categoria: "", valor_centavos: 78000, data: "2026-01-01", situacao: "realizado" },
        { id: criarId(), tipo: "despesa", descricao: "Aluguel", categoria: "Moradia", valor_centavos: 36000, data: "2026-01-31", situacao: "realizado" },
        { id: criarId(), tipo: "despesa", descricao: "Internet", categoria: "Moradia", valor_centavos: 3990, data: "2026-01-25", situacao: "pendente" },
    ];
    try {
        await salvar({
            ...estado, conta: { nome: "Conta de exemplo", tipo: "digital", saldoInicialCentavos: 5000 },
            mes: "2026-01", lancamentos,
        });
        data.value = "2026-01-15";
        feedback("app-feedback", "Exemplo de janeiro carregado.");
    } catch (erro) {
        feedback("app-feedback", erro.message, true);
    }
});

async function confirmarLancamento(id, dia) {
    const atual = estado.lancamentos.find(item => item.id === id);
    if (!atual || atual.situacao !== "pendente") throw new Error("Este lançamento já foi atualizado.");
    const confirmado = { ...atual, data: dia, situacao: "realizado" };
    await salvar({ ...estado, lancamentos: estado.lancamentos.map(item => item.id === id ? confirmado : item) }, confirmado);
}

async function consultarMes(mes) {
    if (!mesValido(mes)) throw new Error("Escolha um mês válido.");
    await salvar({ ...estado, mes });
}

async function iniciar() {
    carregarDados();
    if (NIVEL >= 2) {
        const { iniciarPainel } = await import("./dashboard.js");
        renderizarSaldo = iniciarPainel({ criarItem, confirmarLancamento });
    }
    if (NIVEL >= 3) {
        const { iniciarRelatorio } = await import("./report.js");
        renderizarRelatorio = iniciarRelatorio({ consultarMes });
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

iniciar().catch(() => feedback("app-feedback", "Não foi possível iniciar o Speed Counter. Recarregue a página.", true));
