-- =====================================================================
-- Finance Flow — schema completo para o Supabase (PostgreSQL)
-- Cole tudo no SQL Editor e clique em "Run". Pode rodar de novo sem
-- problema: tudo usa IF NOT EXISTS.
--
-- Espelha o schema do antigo SQLite para a migração do código
-- ser direta: mesmos nomes de tabela/coluna, ids em texto (UUID gerado
-- pelo app ou pelo banco), valores em centavos e flags 0/1 em INTEGER.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Conta (login único do casal)
-- ---------------------------------------------------------------------
create table if not exists users (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  -- abrir o mês novo sozinho: 'copy', 'structure' ou 'off'
  auto_month    text not null default 'copy' check (auto_month in ('copy','structure','off')),
  -- sobra do mês que fechou vai para o cofrinho: 'ask', 'auto' ou 'off'
  surplus_mode  text not null default 'ask' check (surplus_mode in ('ask','auto','off')),
  surplus_goal  text,
  surplus_pct   integer not null default 100 check (surplus_pct between 0 and 100),
  -- resumo diário de alertas por e-mail (hora no APP_TIMEZONE) e o último dia verificado
  email_alerts  integer not null default 0,
  email_hour    integer not null default 8 check (email_hour between 0 and 23),
  email_last    text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pessoas da casa (ex.: marido e esposa)
-- ---------------------------------------------------------------------
create table if not exists members (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  name       text not null,
  color      text not null default '#2a78d6',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_members_user on members(user_id);

-- ---------------------------------------------------------------------
-- Meses que o usuário já iniciou
-- ---------------------------------------------------------------------
create table if not exists months (
  user_id       text not null references users(id) on delete cascade,
  ym            text not null check (ym ~ '^\d{4}-\d{2}$'),
  -- mês aberto sozinho a partir deste (aviso na planilha até ser dispensado)
  auto_from     text,
  -- sobra deste mês: NULL (não decidida), 'saved' ou 'skipped'
  surplus_state text check (surplus_state in ('saved','skipped')),
  surplus_entry text,
  -- aviso da sobra guardada sozinha já visto
  surplus_seen  integer not null default 0,
  created_at    timestamptz not null default now(),
  primary key (user_id, ym)
);

-- ---------------------------------------------------------------------
-- Metas do cofrinho (apartamento, carro, viagem...)
-- ---------------------------------------------------------------------
create table if not exists goals (
  id            text primary key default gen_random_uuid()::text,
  user_id       text not null references users(id) on delete cascade,
  name          text not null,
  target_amount integer not null default 0,
  target_month  text,
  color         text not null default '#1d5fbf',
  created_at    timestamptz not null default now()
);
create index if not exists idx_goals_user on goals(user_id);

-- ---------------------------------------------------------------------
-- Compras parceladas: cada parcela vira uma linha no mês dela
-- ---------------------------------------------------------------------
create table if not exists installments (
  id              text primary key default gen_random_uuid()::text,
  user_id         text not null references users(id) on delete cascade,
  description     text not null default '',
  total_amount    integer not null,
  count           integer not null check (count > 0),
  first_no        integer not null default 1,
  start_ym        text not null,
  day             integer,
  block_name      text not null,
  block_card      integer not null default 0,
  block_member_id text,
  pay_with_name   text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_installments_user on installments(user_id);

-- ---------------------------------------------------------------------
-- Importação de extrato: "palavras da descrição -> tabela"
-- (a tabela é guardada pelo nome e dono porque os ids mudam a cada mês)
-- ---------------------------------------------------------------------
create table if not exists import_rules (
  id              text primary key default gen_random_uuid()::text,
  user_id         text not null references users(id) on delete cascade,
  pattern         text not null,
  block_name      text not null,
  block_member_id text,
  updated_at      timestamptz not null default now(),
  unique (user_id, pattern)
);

-- lançamentos de extrato já importados (FITID do OFX ou assinatura da linha do CSV)
create table if not exists import_seen (
  user_id    text not null references users(id) on delete cascade,
  key        text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------------
-- Compras de cartão movidas para a fatura de um mês ainda não iniciado
-- ---------------------------------------------------------------------
create table if not exists deferred_entries (
  id              text primary key default gen_random_uuid()::text,
  user_id         text not null references users(id) on delete cascade,
  ym              text not null,
  description     text not null default '',
  amount          integer not null default 0,
  date            text,
  status          text not null default 'pending' check (status in ('pending','done')),
  extra           jsonb not null default '{}'::jsonb,
  block_name      text not null,
  block_card      integer not null default 0,
  block_member_id text,
  pay_with_name   text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_deferred_user_ym on deferred_entries(user_id, ym);

-- alertas já enviados por e-mail (para não repetir o mesmo aviso todo dia)
create table if not exists alert_sent (
  user_id text not null references users(id) on delete cascade,
  fp      text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, fp)
);

-- ---------------------------------------------------------------------
-- Tabelas (blocos) de cada mês: Receitas, Contas da casa, Cofrinho, Totais...
-- ---------------------------------------------------------------------
create table if not exists blocks (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  ym           text not null check (ym ~ '^\d{4}-\d{2}$'),
  name         text not null,
  kind         text not null check (kind in ('income','expense','savings','total')),
  budget_type  text not null default 'none' check (budget_type in ('none','amount','percent')),
  budget_value double precision not null default 0,
  columns      jsonb not null default '[]'::jsonb,
  position     integer not null default 0,
  -- dono da tabela; NULL = conjunto (do casal)
  member_id    text references members(id) on delete set null,
  source       text,
  -- cartão de crédito: limite em budget_value, fatura paga, fechamento e vencimento
  card         integer not null default 0,
  card_paid    integer,
  -- fatura fechada que vence no mês (centavos): compras que não estão na tabela
  card_closed  integer,
  card_close   integer check (card_close between 1 and 31),
  card_due     integer check (card_due between 1 and 31),
  created_at   timestamptz not null default now()
);
create index if not exists idx_blocks_user_ym on blocks(user_id, ym);
-- bancos criados antes da fatura fechada
alter table blocks add column if not exists card_closed integer;

-- ---------------------------------------------------------------------
-- Linhas de cada tabela
-- ---------------------------------------------------------------------
create table if not exists entries (
  id          text primary key default gen_random_uuid()::text,
  block_id    text not null references blocks(id) on delete cascade,
  user_id     text not null references users(id) on delete cascade,
  description text not null default '',
  -- centavos
  amount      integer not null default 0,
  -- YYYY-MM-DD
  date        text,
  status      text not null default 'pending' check (status in ('pending','done')),
  goal_id     text references goals(id) on delete set null,
  -- economias: meta própria da linha, em centavos (NULL = sem meta)
  target      integer,
  extra       jsonb not null default '{}'::jsonb,
  position    integer not null default 0,
  -- tabelas de total: de onde vem o valor e se soma (1) ou subtrai (-1)
  ref         text,
  sign        integer not null default 1 check (sign in (1,-1)),
  -- despesas: cartão que paga a linha (NULL = sai do saldo)
  pay_with    text references blocks(id) on delete set null,
  -- parcela de uma compra parcelada
  inst_id     text references installments(id) on delete set null,
  inst_no     integer,
  inst_count  integer,
  created_at  timestamptz not null default now()
);
-- bancos criados antes da meta por linha
alter table entries add column if not exists target integer;

create index if not exists idx_entries_block    on entries(block_id);
create index if not exists idx_entries_user     on entries(user_id);
create index if not exists idx_entries_goal     on entries(goal_id);
create index if not exists idx_entries_pay_with on entries(pay_with);
create index if not exists idx_entries_inst     on entries(inst_id);

-- ---------------------------------------------------------------------
-- Segurança: o app acessa o banco só pelo servidor (service_role / conexão
-- direta), que ignora o RLS. Ligar o RLS sem políticas bloqueia a chave
-- pública (anon) — ninguém lê nem grava direto pela API REST do Supabase.
-- ---------------------------------------------------------------------
alter table users            enable row level security;
alter table members          enable row level security;
alter table months           enable row level security;
alter table goals            enable row level security;
alter table installments     enable row level security;
alter table import_rules     enable row level security;
alter table import_seen      enable row level security;
alter table deferred_entries enable row level security;
alter table alert_sent       enable row level security;
alter table blocks           enable row level security;
alter table entries          enable row level security;
