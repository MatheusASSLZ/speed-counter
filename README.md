# Speed Counter

Protótipo de controle financeiro pessoal para o trabalho de Qualidade de Software. O MVP 01 reúne a configuração da conta principal e o cadastro de receitas e despesas por categoria.

## Como abrir

1. Abra a pasta do projeto no VS Code.
2. Para testar o salvamento de lançamentos, selecione a branch `codex/mvp-01-cadastro`.
3. Abra [MVP Speed counter.Html](MVP%20Speed%20counter.Html) no navegador. Use dados fictícios para testar.

O protótipo usa HTML e JavaScript. A conta e os lançamentos são gravados no `localStorage` do navegador usado no teste. Os valores são armazenados em centavos inteiros.

## Branches

- `main` contém o formulário da conta principal, o salvamento da conta e a estrutura do formulário de lançamentos.
- `codex/mvp-01-cadastro` acrescenta a validação e o salvamento de receitas e despesas.
