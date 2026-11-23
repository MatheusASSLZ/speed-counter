from datetime import date
from pathlib import Path
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationInfo, field_validator


# Limite dos inteiros representados exatamente pelo JavaScript.
LIMITE_CENTAVOS = 2**53 - 1
Centavos = Annotated[int, Field(strict=True, ge=-LIMITE_CENTAVOS, le=LIMITE_CENTAVOS)]
ValorPositivo = Annotated[int, Field(strict=True, gt=0, le=LIMITE_CENTAVOS)]
Texto = Annotated[str, StringConstraints(strip_whitespace=True)]
DataISO = Annotated[str, StringConstraints(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")]
MesISO = Annotated[str, StringConstraints(pattern=r"^[0-9]{4}-[0-9]{2}$")]


class Lancamento(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tipo: Literal["receita", "despesa"]
    valor_centavos: ValorPositivo
    data: DataISO
    categoria: Texto = Field(default="", validate_default=True)
    descricao: Texto = Field(default="", validate_default=True)
    situacao: Literal["realizado", "pendente"]

    @field_validator("data")
    @classmethod
    def validar_data(cls, valor: str) -> str:
        date.fromisoformat(valor)
        return valor

    @field_validator("categoria", "descricao")
    @classmethod
    def validar_despesa(cls, valor: str, contexto: ValidationInfo) -> str:
        if contexto.data.get("tipo") == "despesa" and not valor:
            rotulo = "categoria" if contexto.field_name == "categoria" else "descrição"
            raise ValueError(f"Informe a {rotulo} da despesa.")
        return valor


class PedidoResumo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    saldo_inicial_centavos: Centavos
    mes: MesISO
    lancamentos: list[Lancamento]

    @field_validator("mes")
    @classmethod
    def validar_mes(cls, valor: str) -> str:
        date.fromisoformat(f"{valor}-01")
        return valor


class DespesasDaCategoria(BaseModel):
    categoria: str
    valor_centavos: int


class ResumoFinanceiro(BaseModel):
    saldo_centavos: int
    receitas_centavos: int
    despesas_centavos: int
    resultado_mes_centavos: int
    pendencias_centavos: int
    historico: list[Lancamento]
    pendencias: list[Lancamento]
    receitas_gerais_centavos: int
    despesas_gerais_centavos: int
    despesas_por_categoria: list[DespesasDaCategoria]


def calcular_resumo(pedido: PedidoResumo) -> ResumoFinanceiro:
    """Calcula o saldo geral e resume os lançamentos do mês escolhido."""
    receitas_gerais = 0
    despesas_gerais = 0
    receitas_mes = 0
    despesas_mes = 0
    historico = []
    pendencias = []
    despesas_por_categoria: dict[str, int] = {}

    for lancamento in pedido.lancamentos:
        do_mes = lancamento.data[:7] == pedido.mes
        if do_mes:
            historico.append(lancamento)

        if lancamento.situacao == "pendente":
            if do_mes and lancamento.tipo == "despesa":
                pendencias.append(lancamento)
            continue

        valor = lancamento.valor_centavos
        if lancamento.tipo == "receita":
            receitas_gerais += valor
            if do_mes:
                receitas_mes += valor
        else:
            despesas_gerais += valor
            if do_mes:
                despesas_mes += valor
                categoria = lancamento.categoria
                despesas_por_categoria[categoria] = despesas_por_categoria.get(categoria, 0) + valor

    saldo = pedido.saldo_inicial_centavos + receitas_gerais - despesas_gerais
    resultado_mes = receitas_mes - despesas_mes
    total_pendente = sum(lancamento.valor_centavos for lancamento in pendencias)
    if max(abs(saldo), receitas_gerais, despesas_gerais, total_pendente) > LIMITE_CENTAVOS:
        raise ValueError("Os totais ultrapassam o limite de precisão em centavos.")

    # Ordena pelo dia, mantendo a ordem de envio entre registros do mesmo dia.
    historico.sort(key=lambda lancamento: lancamento.data, reverse=True)
    pendencias.sort(key=lambda lancamento: lancamento.data, reverse=True)

    return ResumoFinanceiro(
        saldo_centavos=saldo,
        receitas_centavos=receitas_mes,
        despesas_centavos=despesas_mes,
        resultado_mes_centavos=resultado_mes,
        pendencias_centavos=total_pendente,
        historico=historico,
        pendencias=pendencias,
        receitas_gerais_centavos=receitas_gerais,
        despesas_gerais_centavos=despesas_gerais,
        despesas_por_categoria=[
            DespesasDaCategoria(categoria=categoria, valor_centavos=valor)
            for categoria, valor in despesas_por_categoria.items()
        ],
    )


PASTA_SITE = Path(__file__).resolve().parent
app = FastAPI(title="Speed Counter", description="Resumo financeiro dos três MVPs.")
app.mount("/static", StaticFiles(directory=PASTA_SITE / "static", check_dir=False), name="static")


@app.get("/", include_in_schema=False)
@app.get("/MVP Speed counter.Html", include_in_schema=False)
def pagina_inicial() -> FileResponse:
    return FileResponse(PASTA_SITE / "MVP Speed counter.Html", media_type="text/html")


@app.post("/api/resumo")
def resumo(pedido: PedidoResumo) -> ResumoFinanceiro:
    try:
        return calcular_resumo(pedido)
    except ValueError as erro:
        raise HTTPException(status_code=422, detail=str(erro)) from erro
