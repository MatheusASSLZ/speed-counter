from unittest import TestCase

from fastapi import HTTPException
from pydantic import ValidationError

from app import LIMITE_CENTAVOS, Lancamento, PedidoResumo, calcular_resumo, resumo


def receita(descricao, valor, data, *, situacao="realizado"):
    return Lancamento(
        tipo="receita", descricao=descricao, valor_centavos=valor, data=data, situacao=situacao
    )


def despesa(descricao, valor, data, categoria="Moradia", *, situacao="realizado"):
    return Lancamento(
        tipo="despesa",
        descricao=descricao,
        valor_centavos=valor,
        data=data,
        categoria=categoria,
        situacao=situacao,
    )


def pedido(*lancamentos, mes="2026-01", saldo_inicial=5000):
    return PedidoResumo(saldo_inicial_centavos=saldo_inicial, mes=mes, lancamentos=list(lancamentos))


class TesteResumoFinanceiro(TestCase):
    def test_ct003_ct004_ct005_rejeita_dados_invalidos(self):
        for valor in (-5840, 0, 1.0, LIMITE_CENTAVOS + 1):
            with self.subTest(valor=valor), self.assertRaises(ValidationError):
                despesa("Recarga de transporte", valor, "2026-01-16")

        with self.assertRaises(ValidationError):
            despesa("   ", 3275, "2026-01-15", "Saúde")
        with self.assertRaises(ValidationError):
            despesa("Compra na farmácia", 3275, "2026-01-15", "")
        with self.assertRaises(ValidationError):
            despesa("Compra na farmácia", 3275, "2026-02-29", "Saúde")
        with self.assertRaises(ValidationError):
            pedido(mes="2026-13")

    def test_ct006_aceita_um_centavo(self):
        resumo_mes = calcular_resumo(pedido(despesa("Material de estudo", 1, "2026-01-15", "Educação")))
        self.assertEqual(resumo_mes.saldo_centavos, 4999)
        self.assertEqual(resumo_mes.despesas_centavos, 1)
        self.assertEqual(resumo_mes.historico[0].categoria, "Educação")

    def test_ct007_atualiza_saldo_apos_nova_despesa(self):
        bolsa = receita("Bolsa de estágio", 78000, "2026-01-01")
        aluguel = despesa("Aluguel", 36000, "2026-01-31")
        farmacia = despesa("Compra na farmácia", 3275, "2026-01-15", "Saúde")

        self.assertEqual(calcular_resumo(pedido(bolsa, aluguel)).saldo_centavos, 47000)
        resumo_mes = calcular_resumo(pedido(bolsa, aluguel, farmacia))
        self.assertEqual(resumo_mes.saldo_centavos, 43725)
        self.assertEqual(resumo_mes.despesas_gerais_centavos, 39275)

    def test_ct009_filtro_inclui_os_dois_limites_do_mes(self):
        farmacia = despesa("Compra na farmácia", 3275, "2025-12-31", "Saúde")
        bolsa = receita("Bolsa de estágio", 78000, "2026-01-01")
        aluguel = despesa("Aluguel", 36000, "2026-01-31")
        recarga = despesa("Recarga de ônibus", 5840, "2026-02-01", "Transporte")
        lancamentos = (farmacia, bolsa, aluguel, recarga)

        janeiro = calcular_resumo(pedido(*lancamentos))
        fevereiro = calcular_resumo(pedido(*lancamentos, mes="2026-02"))

        self.assertEqual(janeiro.historico, [aluguel, bolsa])
        self.assertEqual(fevereiro.historico, [recarga])
        self.assertEqual(janeiro.receitas_gerais_centavos, 78000)
        self.assertEqual(janeiro.despesas_gerais_centavos, 45115)
        self.assertEqual(janeiro.saldo_centavos, fevereiro.saldo_centavos)
        self.assertEqual(janeiro.resultado_mes_centavos, 42000)
        self.assertEqual(fevereiro.resultado_mes_centavos, -5840)

    def test_ct010_pendencia_aparece_separada_dos_valores_realizados(self):
        bolsa = receita("Bolsa de estágio", 78000, "2026-01-01")
        aluguel = despesa("Aluguel", 36000, "2026-01-31")
        internet = despesa("Internet", 3990, "2026-01-25", situacao="pendente")
        venda_prevista = receita("Venda prevista", 1000, "2026-01-12", situacao="pendente")
        resumo_mes = calcular_resumo(pedido(bolsa, aluguel, internet, venda_prevista))

        self.assertEqual(resumo_mes.receitas_centavos, 78000)
        self.assertEqual(resumo_mes.despesas_centavos, 36000)
        self.assertEqual(resumo_mes.resultado_mes_centavos, 42000)
        self.assertEqual(resumo_mes.pendencias_centavos, 3990)
        self.assertEqual(resumo_mes.pendencias, [internet])
        self.assertEqual(resumo_mes.historico, [aluguel, internet, venda_prevista, bolsa])
        self.assertEqual(
            [categoria.model_dump() for categoria in resumo_mes.despesas_por_categoria],
            [{"categoria": "Moradia", "valor_centavos": 36000}],
        )

    def test_categoria_agrega_apenas_despesas_pagas_do_mes(self):
        aluguel = despesa("Aluguel", 36000, "2026-01-31")
        internet = despesa("Internet", 3990, "2026-01-25")
        farmacia = despesa("Compra na farmácia", 3275, "2026-01-15", "Saúde")
        fora_do_mes = despesa("Internet", 3990, "2026-02-25")
        resumo_mes = calcular_resumo(pedido(aluguel, internet, farmacia, fora_do_mes))
        self.assertEqual(
            {item.categoria: item.valor_centavos for item in resumo_mes.despesas_por_categoria},
            {"Moradia": 39990, "Saúde": 3275},
        )

    def test_mes_vazio_preserva_saldo_geral(self):
        julho = calcular_resumo(pedido(receita("Receita", 100, "2026-01-01"), mes="2026-07"))
        self.assertEqual(julho.saldo_centavos, 5100)
        self.assertEqual(julho.resultado_mes_centavos, 0)
        self.assertEqual(julho.historico, [])
        self.assertEqual(julho.despesas_por_categoria, [])

    def test_rejeita_totais_que_ultrapassam_o_limite_mesmo_com_saldo_valido(self):
        grande = receita("Receita", LIMITE_CENTAVOS, "2026-01-01")
        extra = receita("Receita extra", 1, "2026-02-01")
        compensacao = despesa("Despesa", LIMITE_CENTAVOS, "2026-03-01")
        with self.assertRaises(HTTPException) as erro:
            resumo(pedido(grande, extra, compensacao, saldo_inicial=0))
        self.assertEqual(erro.exception.status_code, 422)

    def test_retorna_valor_no_limite_exato(self):
        resposta = resumo(pedido(receita("Receita", LIMITE_CENTAVOS, "2026-01-01"), saldo_inicial=0))
        self.assertEqual(resposta.saldo_centavos, LIMITE_CENTAVOS)
