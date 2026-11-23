import { dataDeHoje, dataValida, formatarMoeda } from "./model.js";

export function iniciarPainel({ criarItem, confirmarLancamento }) {
    const painel = document.querySelector("#view-saldo");
    const lista = painel.querySelector("#dashboard-list");
    const vazio = painel.querySelector("#dashboard-empty");
    const tituloLista = painel.querySelector("#dashboard-list-title");
    const botoes = [...painel.querySelectorAll("[data-movement-type]")];
    const alteracao = painel.querySelector("#balance-change");
    const dialogo = document.querySelector("#confirm-dialog");
    const formulario = dialogo.querySelector("#confirm-form");
    const descricao = dialogo.querySelector("#confirm-description");
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
        descricao.textContent = `${nome} · ${formatarMoeda(lancamento.valor_centavos)}`;
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
            tituloLista.textContent = "Por tipo de lançamento";
            vazio.textContent = "Selecione Receitas ou Despesas para ver os lançamentos.";
            vazio.hidden = false;
            return;
        }

        tituloLista.textContent = tipoSelecionado === "receita" ? "Receitas" : "Despesas";
        const movimentos = lancamentos.filter(item => item.tipo === tipoSelecionado)
            .sort((a, b) => b.data.localeCompare(a.data));
        lista.replaceChildren(...movimentos.map(lancamento => {
            const item = criarItem(lancamento);
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
        else botoes.find(botao => botao.dataset.movementType === tipoSelecionado)?.focus();
        acionador = null;
    });
    dialogo.addEventListener("cancel", evento => {
        if (confirmar.disabled) evento.preventDefault();
    });
    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        const data = formulario.elements.data.value;
        if (!dataValida(data)) {
            aviso.textContent = "Informe uma data válida para a confirmação.";
            aviso.hidden = false;
            return;
        }
        aviso.textContent = "";
        aviso.hidden = true;
        confirmar.disabled = true;
        cancelar.disabled = true;
        try {
            await confirmarLancamento(formulario.elements.id.value, data);
            dialogo.close();
        } catch (erro) {
            aviso.textContent = erro.message;
            aviso.hidden = false;
        } finally {
            confirmar.disabled = false;
            cancelar.disabled = false;
        }
    });

    return estado => {
        lancamentos = estado.lancamentos;
        const resumo = estado.resumo;
        painel.querySelector("#balance-total").textContent = formatarMoeda(resumo.saldo_centavos);
        painel.querySelector("#income-total").textContent = formatarMoeda(resumo.receitas_gerais_centavos);
        painel.querySelector("#expense-total").textContent = formatarMoeda(resumo.despesas_gerais_centavos);

        const movimento = estado.alteracao;
        alteracao.hidden = !movimento;
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
