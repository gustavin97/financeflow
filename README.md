# Finance Flow

Controle financeiro **pessoal** em tabelas conectadas, com visual de planilha (Excel): bordas retas, grade fina, números alinhados e edição direto na célula.

Todo mês você lança o salário, as contas da casa, o cartão, as compras online e o lazer, cada um na sua tabela. O total de receitas define os limites das outras tabelas, o saldo é calculado sozinho e o **cofrinho** acompanha as metas de longo prazo (apartamento, carro, casa, viagem...).

## Como rodar

Requisitos: **Node 22.5 ou superior** e um projeto no **Supabase** (Postgres).

1. No Supabase, abra o **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
2. Em **Connect** (botão no topo do projeto), copie a URI do **Session pooler** e coloque no `.env` como `DATABASE_URL`, trocando `[YOUR-PASSWORD]` pela senha do banco.
3. Rode:

```bash
npm install
npm run dev
```

Já usava a versão com SQLite? `npm run migrate:sqlite` copia os dados de `data/financeflow.db` para o Supabase.

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
| `DATABASE_URL` | Conexão com o Postgres do Supabase (Connect → Session pooler). Obrigatória. |
| `DATABASE_POOL_MAX` | Máximo de conexões abertas ao mesmo tempo (padrão 5). |
| `COOKIE_SECURE` | Use `true` quando servir por HTTPS. |
| `PUBLIC_ACCESS` | `true` libera o acesso sem login (entra como o primeiro usuário). Só funciona em desenvolvimento; em produção é ignorado. |
| `APP_TIMEZONE` | Fuso que decide quando o mês vira para abrir o mês novo sozinho (padrão `America/Sao_Paulo`). |

O banco fica no Supabase. Em produção (ou com `BACKUP_DIR` definido), o app também guarda uma cópia diária em JSON em `data/backups` (os últimos `BACKUP_KEEP` dias, padrão 14).

O RLS fica ligado em todas as tabelas, sem políticas: a chave pública (`anon`) do Supabase não lê nem grava nada. Só o servidor do app acessa o banco, pela `DATABASE_URL`. Nunca coloque essa URL (nem a `service_role`) no código do navegador ou no GitHub.

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

**Fechamento e vencimento do cartão.** Na configuração de um cartão (⋯ → Configurar, ou o link no rodapé da tabela) informe o dia do fechamento e o do vencimento. A tabela do cartão de cada mês passa a ser a **fatura que vence naquele mês**: com fechamento no dia 3 e vencimento no dia 10, a fatura de outubro tem as compras de 4/set a 3/out. O rodapé mostra o período, o fechamento e o vencimento. Compras (no cartão ou pagas com ele em outra tabela) cuja data é de outra fatura ganham a etiqueta *fatura de nov*: clicando nela, ou em *Mover para a fatura certa*, elas vão para o mês certo; se ele ainda não foi iniciado, entram quando for. Parcelas não mudam de fatura. Ao copiar o mês, as compras do cartão andam um mês na data, para continuar na fatura certa. Os dias passam para os meses seguintes, e a planilha avisa quando a fatura fecha em até 2 dias e quando vence em até 3 dias ou já venceu sem ser paga. Na importação da fatura, só as compras do período dela vêm marcadas.

**Compras parceladas.** Em qualquer tabela de despesa (inclusive a do cartão), *Compra parcelada* lança a compra com o valor total ou o da parcela, o número de parcelas e em qual parcela ela está neste mês (para compras feitas antes). Cada parcela vira uma linha no mês dela, com a etiqueta "3/12": os meses já abertos recebem na hora, os próximos quando forem iniciados (se a tabela não existir naquele mês, ela é criada). Os centavos que sobram da divisão vão para a 1ª parcela. Clicando na etiqueta dá para **encerrar o parcelamento**: somem a parcela do mês e as seguintes, e as anteriores ficam.

**Mês novo sem recomeçar.** Ao abrir um mês vazio você escolhe: copiar o mês anterior (tabelas e lançamentos fixos, tudo volta como pendente e com as datas ajustadas), copiar só as tabelas, usar o modelo padrão ou começar em branco.

**Mês novo automático.** Na virada do mês, o primeiro acesso ao app (em qualquer página) já abre o mês novo copiando o último mês usado, com as parcelas do mês lançadas, e a planilha mostra um aviso até alguém clicar em *Entendi*. Em *Conta → Mês novo automático* dá para copiar só as tabelas ou desligar. Sem nenhum mês anterior, a escolha de como começar continua com vocês. O mês vira pelo horário de Brasília (`APP_TIMEZONE`).

**Importar extrato do banco.** Na planilha, *Importar extrato* lê o arquivo **OFX** (também chamado de “Money” ou “Quicken”) ou **CSV** que o banco exporta, da conta ou da fatura do cartão. O arquivo é lido no navegador; no CSV, as colunas de data, descrição e valor são reconhecidas sozinhas (Nubank, Itaú, BB, Inter e outros) e dá para corrigir. Cada lançamento aparece com a tabela sugerida:

- **Regras**: quando você troca a tabela de um lançamento, as palavras da descrição viram regra (`ifood restaurante` → *Alimentação*) e, a partir da próxima importação, ele já vem na tabela certa. Os parecidos do mesmo arquivo mudam junto. As regras ficam em *Conta → Regras da importação*, onde dá para editar as palavras ou excluir.
- **Sem duplicar**: o que já foi importado aparece marcado e fica de fora (dá para incluir mesmo assim).
- **Conta x fatura**: no extrato da conta, só entram por padrão os lançamentos do mês aberto. Na fatura do cartão entram todas as compras; as que vão para outras tabelas de despesa ficam como *pagas com o cartão*. Pagamentos da fatura e estornos ficam de fora, a menos que você escolha uma tabela.
- Saídas viram despesas e entradas viram receitas, já marcadas como pagas/recebidas. Uma entrada lançada numa tabela de despesa (um estorno) entra negativa e abate o total.

**Sobra do mês para o cofrinho.** Quando um mês fecha no azul, a sobra (saldo previsto do mês, sem passar do saldo acumulado) pode ir para uma meta: vira a linha *Sobra de setembro* numa tabela de cofrinho do conjunto naquele mês (se não houver, a tabela *Cofrinho* é criada), conta no progresso da meta e sai do saldo acumulado. Em *Conta → Sobra do mês* você escolhe **perguntar** (o mês atual mostra quanto sobrou, com a meta e a porcentagem para confirmar), **guardar sozinho** na virada do mês (com aviso e botão de desfazer) ou não fazer nada. Cada mês só é guardado uma vez.

**Visão anual.** Os 12 meses lado a lado, gráfico de receitas x despesas x cofrinho, saldo acumulado e a divisão por categoria.

## Dicas de uso na planilha

- **Fórmulas nas células de valor**: digite `=1200+350*2` ou `(300-20)/2` e pressione Enter.
- **Enter** desce para a linha de baixo (na última linha, cria uma nova). **Setas ↑ ↓** também navegam, **Esc** cancela a edição.
- O botão **⋯** de cada tabela abre limite/meta, colunas, marcar tudo como pago e excluir.
- Em *Conta* você troca nome e senha, **exporta todos os seus dados em JSON** e pode excluir a conta.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Postgres no Supabase (`pg`) · `bcryptjs` · `jose` (JWT em cookie httpOnly) · `zod`.

## Estrutura

```
src/
  app/
    (auth)/login, (auth)/cadastro   telas de acesso
    (app)/planilha, cofrinho, anual, conta   telas logadas
    api/                            rotas (auth, months, blocks, entries, installments, import, goals, annual, export, account)
  components/sheet/                 tabela editável, resumo, barra de distribuição, abas de mês
  lib/
    db.ts                           conexão com o Postgres (Supabase)
    queries.ts                      toda a regra de dados (sempre filtrada pelo usuário)
    statement.ts                    leitura de extratos OFX/CSV e regras de categorização
    summary.ts, money.ts, dates.ts  cálculos e formatação
scripts/seed.ts                     dados de demonstração
scripts/migrate-sqlite.ts           copia o banco SQLite antigo para o Supabase
supabase/schema.sql                 tabelas do banco (rodar no SQL Editor)
data/                               segredo da sessão e backups locais
```

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run start` | Build e servidor de produção |
| `npm run seed` | Cria o usuário e os dados de demonstração |
| `npm run migrate:sqlite` | Copia os dados do SQLite antigo (`data/financeflow.db`) para o Supabase |
| `npm run typecheck` | Checagem de tipos |

## Segurança

- Senhas com bcrypt; sessão em JWT (cookie `httpOnly`, `sameSite=lax`, 30 dias).
- Limite de tentativas de login por e-mail/IP (em memória, reinicia com o servidor).
- Todas as consultas ao banco são filtradas pelo usuário logado.
- Validação de entrada com zod em todas as rotas.

Se for publicar para várias pessoas, considere mover o limite de tentativas de login para um armazenamento compartilhado (Redis, por exemplo).
