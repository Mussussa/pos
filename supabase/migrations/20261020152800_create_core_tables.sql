create table if not exists public.lojas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  codigo text not null,
  nome text not null check (length(btrim(nome)) > 0),
  categoria text not null,
  subcategoria text not null default '',
  preco_venda numeric not null check (preco_venda > 0),
  preco_custo numeric not null check (preco_custo >= 0),
  stock numeric not null default 0 check (stock >= 0),
  unidade_medida text not null default 'Un.',
  created_at timestamptz not null default now(),
  constraint produtos_loja_codigo_key unique (loja_id, codigo),
  constraint produtos_preco_venda_ge_custo check (preco_venda >= preco_custo)
);

create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  data_venda timestamptz not null default now(),
  vendedor_id text not null,
  total numeric not null check (total >= 0),
  itens jsonb not null default '[]'::jsonb
    check (jsonb_typeof(itens) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists produtos_loja_idx
  on public.produtos (loja_id);

create index if not exists vendas_loja_data_idx
  on public.vendas (loja_id, data_venda desc);

alter table public.lojas enable row level security;
alter table public.produtos enable row level security;
alter table public.vendas enable row level security;

drop policy if exists "Dono pode consultar a sua loja" on public.lojas;
create policy "Dono pode consultar a sua loja"
  on public.lojas
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Dono pode gerir produtos da sua loja" on public.produtos;
create policy "Dono pode gerir produtos da sua loja"
  on public.produtos
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.lojas
      where lojas.id = produtos.loja_id
        and lojas.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.lojas
      where lojas.id = produtos.loja_id
        and lojas.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Dono pode gerir vendas da sua loja" on public.vendas;
create policy "Dono pode gerir vendas da sua loja"
  on public.vendas
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.lojas
      where lojas.id = vendas.loja_id
        and lojas.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.lojas
      where lojas.id = vendas.loja_id
        and lojas.owner_id = (select auth.uid())
    )
  );

grant select on public.lojas to authenticated;
grant select, insert, update, delete on public.produtos to authenticated;
grant select, insert, update, delete on public.vendas to authenticated;

create table if not exists public.chaves_ativacao (
  chave text primary key check (length(btrim(chave)) > 0),
  utilizada_em timestamptz,
  utilizada_por uuid references auth.users(id) on delete set null
);

create unique index if not exists chaves_ativacao_chave_normalizada_idx
  on public.chaves_ativacao (upper(btrim(chave)));

alter table public.chaves_ativacao enable row level security;

create or replace function public.verificar_chave(p_chave text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.chaves_ativacao
    where upper(btrim(chave)) = upper(btrim(p_chave))
      and utilizada_em is null
  );
$$;

revoke all on function public.verificar_chave(text) from public, anon, authenticated;
grant execute on function public.verificar_chave(text) to anon, authenticated;

create or replace function public.registar_loja_com_chave(
  p_nome_loja text,
  p_chave text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_chave text;
  v_loja_id uuid;
begin
  if v_owner_id is null then
    raise exception 'É necessário iniciar sessão para registar uma loja.'
      using errcode = '28000';
  end if;

  if p_nome_loja is null or length(btrim(p_nome_loja)) = 0 then
    raise exception 'O nome da loja é obrigatório.'
      using errcode = '22023';
  end if;

  select chave
    into v_chave
    from public.chaves_ativacao
    where upper(btrim(chave)) = upper(btrim(p_chave))
      and utilizada_em is null
    for update;

  if v_chave is null then
    raise exception 'Chave de ativação inválida ou já utilizada.'
      using errcode = '22023';
  end if;

  insert into public.lojas (owner_id, nome)
    values (v_owner_id, btrim(p_nome_loja))
    returning id into v_loja_id;

  update public.chaves_ativacao
    set utilizada_em = now(),
        utilizada_por = v_owner_id
    where chave = v_chave;

  return jsonb_build_object('loja_id', v_loja_id);
end;
$$;

revoke all on function public.registar_loja_com_chave(text, text) from public, anon, authenticated;
grant execute on function public.registar_loja_com_chave(text, text) to authenticated;

notify pgrst, 'reload schema';
