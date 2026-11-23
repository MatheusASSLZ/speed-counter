export const CATEGORIAS_INICIAIS = ["Alimentação", "Educação", "Moradia", "Saúde", "Transporte", "Outros"];
export const LIMITE_CENTAVOS = Number.MAX_SAFE_INTEGER;

const LIMITE_INTEIRO = BigInt(LIMITE_CENTAVOS);
const formatadorMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatadorInteiro = new Intl.NumberFormat("pt-BR");

export function converterCentavos(texto) {
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
        throw new Error("Informe um valor em reais com até dois centavos decimais. Exemplo 32,75.");
    }

    const negativo = normalizado.startsWith("-");
    const [reais, fracao = ""] = normalizado.replace(/^-/, "").split(".");
    const centavos = BigInt(reais) * 100n + BigInt(fracao.padEnd(2, "0"));
    if (centavos > LIMITE_INTEIRO) {
        throw new Error("O valor ultrapassa o limite de precisão em centavos.");
    }
    return Number(negativo ? -centavos : centavos);
}

export function formatarMoeda(centavos) {
    const absoluto = BigInt(Math.abs(centavos));
    const fracao = String(absoluto % 100n).padStart(2, "0");
    const valor = `${formatadorInteiro.format(absoluto / 100n)},${fracao}`;
    return formatadorMoeda.formatToParts(centavos < 0 ? -1 : 1)
        .map(parte => parte.type === "integer" ? valor : parte.type === "decimal" || parte.type === "fraction" ? "" : parte.value)
        .join("");
}

export function formatarData(data) {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
}

export function dataDeHoje() {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${hoje.getFullYear()}-${mes}-${dia}`;
}

export function mesValido(texto) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(texto) && !texto.startsWith("0000-");
}

export function dataValida(texto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || !mesValido(texto.slice(0, 7))) return false;
    const teste = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(teste.valueOf()) && teste.toISOString().slice(0, 10) === texto;
}

export function rotuloSituacao(lancamento) {
    if (lancamento.situacao === "pendente") return "Pendente";
    return lancamento.tipo === "receita" ? "Recebida" : "Paga";
}

function numeroSeguro(valor) {
    if (valor < -LIMITE_INTEIRO || valor > LIMITE_INTEIRO) {
        throw new Error("Os totais ultrapassam o limite de precisão em centavos.");
    }
    return Number(valor);
}

export function resumirLocalmente(saldoInicial, mes, lancamentos) {
    let receitasGerais = 0n;
    let despesasGerais = 0n;
    let receitasMes = 0n;
    let despesasMes = 0n;
    let totalPendente = 0n;
    const porCategoria = new Map();
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
                const categoria = lancamento.categoria;
                porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0n) + valor);
            }
        }
    }

    const despesasPorCategoria = [...porCategoria]
        .map(([categoria, valor]) => ({ categoria, valor_centavos: numeroSeguro(valor) }))
        .sort((a, b) => b.valor_centavos - a.valor_centavos || a.categoria.localeCompare(b.categoria, "pt-BR"));
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
        despesas_por_categoria: despesasPorCategoria,
    };
}
