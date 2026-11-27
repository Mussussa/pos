alter table public.vendas
  add column if not exists id_local text,
  add column if not exists lucro_total numeric;

create unique index if not exists vendas_loja_id_local_key
  on public.vendas (loja_id, id_local);

update public.vendas as venda
set lucro_total = custos.lucro_total
from (
  select
    venda_itens.id,
    sum(
      (
        (item ->> 'preco')::numeric
        - (item ->> 'preco_custo')::numeric
      ) * (item ->> 'quantidade')::numeric
    ) as lucro_total
  from public.vendas as venda_itens
  cross join lateral jsonb_array_elements(venda_itens.itens) as itens_venda(item)
  where jsonb_typeof(venda_itens.itens) = 'array'
    and jsonb_array_length(venda_itens.itens) > 0
    and not exists (
      select 1
      from jsonb_array_elements(venda_itens.itens) as itens_sem_custo(item_sem_custo)
      where coalesce(item_sem_custo ->> 'preco', '') !~ '^[0-9]+([.][0-9]+)?$'
        or coalesce(item_sem_custo ->> 'preco_custo', '') !~ '^[0-9]+([.][0-9]+)?$'
        or coalesce(item_sem_custo ->> 'quantidade', '') !~ '^[0-9]+([.][0-9]+)?$'
    )
  group by venda_itens.id
) as custos
where venda.id = custos.id
  and venda.lucro_total is null;

create table if not exists public.configuracoes_loja (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  perfil_recibo jsonb not null default '{}'::jsonb
    check (jsonb_typeof(perfil_recibo) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.configuracoes_loja enable row level security;

drop policy if exists "Dono pode gerir configurações da sua loja" on public.configuracoes_loja;
create policy "Dono pode gerir configurações da sua loja"
  on public.configuracoes_loja
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.lojas
      where lojas.id = configuracoes_loja.loja_id
        and lojas.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.lojas
      where lojas.id = configuracoes_loja.loja_id
        and lojas.owner_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.configuracoes_loja to authenticated;

notify pgrst, 'reload schema';
