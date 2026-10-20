create table if not exists public.lotes_produtos (
  id uuid primary key,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_codigo text not null,
  validade date,
  quantidade numeric not null check (quantidade >= 0),
  constraint lotes_produtos_loja_produto_fkey
    foreign key (loja_id, produto_codigo)
    references public.produtos (loja_id, codigo)
    on update cascade
    on delete cascade
);

create index if not exists lotes_produtos_loja_produto_idx
  on public.lotes_produtos (loja_id, produto_codigo);

alter table public.lotes_produtos enable row level security;

drop policy if exists "Dono pode gerir lotes da sua loja" on public.lotes_produtos;
create policy "Dono pode gerir lotes da sua loja"
  on public.lotes_produtos
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.lojas
      where lojas.id = lotes_produtos.loja_id
        and lojas.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.lojas
      where lojas.id = lotes_produtos.loja_id
        and lojas.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.lotes_produtos to authenticated;

alter table public.produtos
  add constraint produtos_preco_venda_ge_custo
  check (preco_venda >= preco_custo) not valid;
