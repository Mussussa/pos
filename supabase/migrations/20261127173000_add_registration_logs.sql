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
  raise log '[registar_loja_com_chave] Início. Sessão autenticada: %.',
    v_owner_id is not null;

  if v_owner_id is null then
    raise log '[registar_loja_com_chave] Rejeitado: auth.uid() é NULL.';
    raise exception 'É necessário iniciar sessão para registar uma loja.'
      using errcode = '28000';
  end if;

  if p_nome_loja is null or length(btrim(p_nome_loja)) = 0 then
    raise log '[registar_loja_com_chave] Rejeitado: nome da loja vazio.';
    raise exception 'O nome da loja é obrigatório.'
      using errcode = '22023';
  end if;

  raise log '[registar_loja_com_chave] A validar chave de ativação.';
  select chave
    into v_chave
    from public.chaves_ativacao
    where upper(btrim(chave)) = upper(btrim(p_chave))
      and utilizada_em is null
    for update;

  if v_chave is null then
    raise log '[registar_loja_com_chave] Rejeitado: chave inválida ou já utilizada.';
    raise exception 'Chave de ativação inválida ou já utilizada.'
      using errcode = '22023';
  end if;

  raise log '[registar_loja_com_chave] Chave validada. A criar loja.';
  insert into public.lojas (owner_id, nome)
    values (v_owner_id, btrim(p_nome_loja))
    returning id into v_loja_id;

  update public.chaves_ativacao
    set utilizada_em = now(),
        utilizada_por = v_owner_id
    where chave = v_chave;

  raise log '[registar_loja_com_chave] Registo concluído.';
  return jsonb_build_object('loja_id', v_loja_id);
exception
  when others then
    raise log '[registar_loja_com_chave] Falha SQLSTATE %, mensagem: %.',
      SQLSTATE, SQLERRM;
    raise;
end;
$$;

revoke all on function public.registar_loja_com_chave(text, text) from public, anon, authenticated;
grant execute on function public.registar_loja_com_chave(text, text) to authenticated;

notify pgrst, 'reload schema';
