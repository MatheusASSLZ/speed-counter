# Speed Counter

Protótipo de controle financeiro pessoal para o trabalho de Qualidade de Software. Os três MVPs usam os mesmos lançamentos.

## Como abrir

Abra [MVP Speed counter.Html](MVP%20Speed%20counter.Html) no navegador para usar os três MVPs com cálculo local. Para reproduzir o cenário do trabalho, abra a tela de conta pela primeira vez e escolha **Carregar exemplo**. O exemplo começa com R$ 470,00 de saldo e fecha janeiro de 2026 com R$ 420,00 de resultado e R$ 39,90 em despesas pendentes.

## Executar com FastAPI

No terminal do VS Code, na pasta **Código**, execute:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Abra [127.0.0.1:8000](http://127.0.0.1:8000/) para usar a API. A página envia os lançamentos a `POST /api/resumo` e só atualiza o saldo e os dados salvos depois de receber uma resposta válida. O navegador guarda os registros em `localStorage`. O arquivo aberto diretamente e o site servido pela API usam armazenamentos separados do navegador. Na origem HTTP, `/?modo=local` permite testar sem chamar a API, usando o mesmo armazenamento dessa origem.

## Os três MVPs

- **Conta e lançamentos.** Configure a conta principal, cadastre receitas e despesas e classifique os gastos. Use **Criar categoria** para adicionar uma opção ao formulário.
- **Saldo.** Abra as listas **Receitas** e **Despesas**. Cadastre um lançamento na seção de demonstração ou confirme um pendente com a data em que foi pago ou recebido. O quadro mostra o saldo anterior, o efeito da operação e o novo saldo.
- **Relatório.** Selecione o mês, consulte as movimentações e baixe o CSV. O filtro por categoria atua na lista visível. O arquivo inclui o mês inteiro, com resumo, despesas por categoria e movimentações. As despesas pendentes aparecem separadas do resultado.

## Editar e testar

O HTML define a estrutura, `static/styles.css` define o visual e os módulos em `static/` cuidam da interação e do relatório. Depois de editar os módulos JavaScript, gere novamente o arquivo que o navegador carrega:

```powershell
npx --yes esbuild@0.25.12 static/app.js --bundle --format=iife --target=es2022 --outfile=static/app.bundle.js
```

Para executar os testes da API após instalar as dependências:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_app.py -v
```
