# Finance Flow

Controle financeiro **pessoal** em tabelas conectadas, com visual de planilha (Excel): bordas retas, grade fina, números alinhados e edição direto na célula.

Todo mês você lança o salário, as contas da casa, o cartão, as compras online e o lazer, cada um na sua tabela. O total de receitas define os limites das outras tabelas, o saldo é calculado sozinho e o **cofrinho** acompanha as metas de longo prazo (apartamento, carro, casa, viagem...).

## Como rodar

Requisitos: **Node 22.5 ou superior** (usa o SQLite embutido do Node, `node:sqlite`). Nenhuma dependência nativa: não precisa de Python nem das Build Tools do Visual Studio.

```bash
npm install
npm run dev
```

Abra http://localhost:3000 e crie uma conta.

Quer ver o sistema já com dados? Rode antes:

```bash
npm run seed
```

Isso cria um casal de demonstração (Ana e Bruno) com 3 meses de lançamentos, tabelas de total e 3 metas:

- E-mail: `demo@financeflow.app`
- Senha: `demo12345`

## Produção

```bash
npm run build
npm run start
```

Variáveis de ambiente (copie `.env.example` para `.env`):

| Variável | Para que serve |
| --- | --- |
| `AUTH_SECRET` | Segredo que assina a sessão (JWT). Em produção use um valor longo e aleatório: `openssl rand -base64 48`. Se ficar vazio, um segredo é gerado em `data/.auth-secret`. |
| `DATABASE_PATH` | Caminho do arquivo SQLite. Padrão: `./data/financeflow.db`. |
| `COOKIE_SECURE` | Use `true` quando servir por HTTPS. |
| `PUBLIC_ACCESS` | `true` libera o acesso sem login (entra como o primeiro usuário). Só funciona em desenvolvimento; em produção é ignorado. |
| `ALLOW_SIGNUP` | A primeira conta sempre pode ser criada; depois o cadastro fecha. Use `true` para permitir novas contas. |

O banco é um único arquivo SQLite. Para fazer backup, copie `data/financeflow.db`.

## Como o sistema funciona

**Tabelas (blocos).** Cada mês tem suas tabelas, e cada uma é de um tipo:

- **Receita**: entradas de dinheiro (salário, extras).
- **Despesa**: contas da casa, cartão, compras online, lazer...
- **Cofrinho**: valores guardados, cada linha apontando para uma meta.

Você cria quantas tabelas quiser, renomeia, exclui, e adiciona **colunas próprias** (texto, número, moeda ou data) em qualquer uma.

**Tabelas que se conversam.**

- O total das receitas alimenta o resumo, a barra "Para onde vai a renda do mês" e o "% da renda" de cada tabela.
- Cada despesa pode ter um **limite** fixo ou em % da renda (ex.: lazer com 10%). A barra de progresso muda de cor conforme você se aproxima do limite.
- O cofrinho pode ter uma **meta do mês** (ex.: guardar 20% da renda).
- O **saldo acumulado** carrega o que sobrou dos meses anteriores.

**Planilha do casal.** Em *Pessoas* (na planilha ou em *Conta*) você cadastra quem divide as contas, por exemplo marido e esposa. Cada tabela pode ser de uma pessoa ou do **conjunto**. O quadro *Por pessoa* mostra receitas, despesas e saldo de cada um, e divide as contas do conjunto na proporção da renda para chegar à **sobra final** de cada pessoa. As abas acima das tabelas filtram por pessoa.

**Tabelas de total.** Um quarto tipo de tabela, que não recebe lançamentos: cada linha **soma ou subtrai** outra tabela, as receitas/despesas/economias de uma pessoa (ou da casa), o saldo do mês ou um valor digitado. Serve para juntar o montante do casal ("Renda do casal", "Despesas do casal", "Quanto sobra"). Pode apontar para outra tabela de total; referências circulares são detectadas e avisadas.

**De onde sai o dinheiro.** Toda tabela de despesa ou economia tem uma origem (por padrão, as receitas do dono ou, se for do conjunto, todas as receitas). A coluna **Saldo** começa com esse valor e vai subtraindo linha a linha. Tabelas com a mesma origem continuam a conta uma da outra, na ordem da planilha. O limite em % é calculado sobre essa origem.

**Painel.** Gastos agrupados por tabela, descrição, pessoa ou por **qualquer coluna de texto criada nas tabelas de despesa** (ex.: "Categoria"), comparação com o mês anterior, evolução dos últimos meses e **projeção do próximo mês** (média ponderada dos últimos 3 meses, com sugestão de quanto guardar).

**Sinalizadores.** Na planilha e no painel: mês fechando no vermelho, margem apertada (menos de 10% da renda), pessoa ou origem de dinheiro negativa, limite estourado ou perto (80%), contas vencidas ou vencendo em 3 dias, risco de faltar dinheiro antes de o salário cair e despesas muito acima do mês anterior.

**Cofrinho e metas.** Em *Cofrinho* você cadastra as metas (valor, prazo opcional). O sistema soma tudo que foi guardado nas planilhas, mostra o progresso, o ritmo mensal (média dos últimos 3 meses) e uma previsão de quando a meta é atingida.

**Compras parceladas.** Em qualquer tabela de despesa (inclusive a do cartão), *Compra parcelada* lança a compra com o valor total ou o da parcela, o número de parcelas e em qual parcela ela está neste mês (para compras feitas antes). Cada parcela vira uma linha no mês dela, com a etiqueta "3/12": os meses já abertos recebem na hora, os próximos quando forem iniciados (se a tabela não existir naquele mês, ela é criada). Os centavos que sobram da divisão vão para a 1ª parcela. Clicando na etiqueta dá para **encerrar o parcelamento**: somem a parcela do mês e as seguintes, e as anteriores ficam.

**Mês novo sem recomeçar.** Ao abrir um mês vazio você escolhe: copiar o mês anterior (tabelas e lançamentos fixos, tudo volta como pendente e com as datas ajustadas), copiar só as tabelas, usar o modelo padrão ou começar em branco.

**Visão anual.** Os 12 meses lado a lado, gráfico de receitas x despesas x cofrinho, saldo acumulado e a divisão por categoria.

## Dicas de uso na planilha

- **Fórmulas nas células de valor**: digite `=1200+350*2` ou `(300-20)/2` e pressione Enter.
- **Enter** desce para a linha de baixo (na última linha, cria uma nova). **Setas ↑ ↓** também navegam, **Esc** cancela a edição.
- O botão **⋯** de cada tabela abre limite/meta, colunas, marcar tudo como pago e excluir.
- Em *Conta* você troca nome e senha, **exporta todos os seus dados em JSON** e pode excluir a conta.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · SQLite embutido do Node (`node:sqlite`, sem dependência nativa) · `bcryptjs` · `jose` (JWT em cookie httpOnly) · `zod`.

## Estrutura

```
src/
  app/
    (auth)/login, (auth)/cadastro   telas de acesso
    (app)/planilha, cofrinho, anual, conta   telas logadas
    api/                            rotas (auth, months, blocks, entries, goals, annual, export, account)
  components/sheet/                 tabela editável, resumo, barra de distribuição, abas de mês
  lib/
    db.ts                           conexão e schema SQLite
    queries.ts                      toda a regra de dados (sempre filtrada pelo usuário)
    summary.ts, money.ts, dates.ts  cálculos e formatação
scripts/seed.ts                     dados de demonstração
data/                               banco SQLite (criado na primeira execução)
```

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run start` | Build e servidor de produção |
| `npm run seed` | Cria o usuário e os dados de demonstração |
| `npm run typecheck` | Checagem de tipos |

## Segurança

- Senhas com bcrypt; sessão em JWT (cookie `httpOnly`, `sameSite=lax`, 30 dias).
- Limite de tentativas de login por e-mail/IP (em memória, reinicia com o servidor).
- Todas as consultas ao banco são filtradas pelo usuário logado.
- Validação de entrada com zod em todas as rotas.

Se for publicar para várias pessoas, considere migrar o SQLite para Postgres e mover o limite de tentativas de login para um armazenamento compartilhado (Redis, por exemplo).
