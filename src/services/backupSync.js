const TAMANHO_PAGINA = 500;
const CHAVE_EXCLUSOES_PENDENTES = 'backup_exclusoes_pendentes';

export async function buscarTodosOsRegistos(supabase, tabela, colunas, lojaId) {
  const primeiraPagina = await supabase
    .from(tabela)
    .select(colunas, { count: 'exact' })
    .eq('loja_id', lojaId)
    .order('id', { ascending: true })
    .range(0, TAMANHO_PAGINA - 1);

  if (primeiraPagina.error) throw primeiraPagina.error;
  if (primeiraPagina.count === null) {
    throw new Error(`Não foi possível confirmar o total de registos de ${tabela}.`);
  }

  const registos = [...(primeiraPagina.data || [])];
  while (registos.length < primeiraPagina.count) {
    const pagina = await supabase
      .from(tabela)
      .select(colunas)
      .eq('loja_id', lojaId)
      .order('id', { ascending: true })
      .range(registos.length, registos.length + TAMANHO_PAGINA - 1);

    if (pagina.error) throw pagina.error;
    if (!pagina.data?.length) {
      throw new Error(`A paginação de ${tabela} terminou antes de carregar todos os registos.`);
    }
    registos.push(...pagina.data);
  }

  return registos;
}

function normalizarItens(itens = []) {
  return (Array.isArray(itens) ? itens : []).map((item) => ({
    codigo: String(item.codigo || ''),
    nome: String(item.nome || ''),
    quantidade: Number(item.quantidade),
    preco: Number(item.preco ?? item.precoVenda),
    produtoId: item.produtoId == null ? null : Number(item.produtoId),
  }));
}

function correspondeVendaLegada(vendaLocal, vendaNuvem) {
  const dataLocal = Date.parse(vendaLocal.data || vendaLocal.data_venda);
  const dataNuvem = Date.parse(vendaNuvem.data_venda);
  if (!Number.isFinite(dataLocal) || dataLocal !== dataNuvem) return false;
  if (String(vendaLocal.vendedorId || vendaLocal.vendedor || 'admin') !== String(vendaNuvem.vendedor_id)) return false;
  if (Number(vendaLocal.total ?? vendaLocal.valor ?? vendaLocal.precoTotal ?? vendaLocal.subtotal ?? 0) !== Number(vendaNuvem.total)) {
    return false;
  }

  return JSON.stringify(normalizarItens(vendaLocal.itens || vendaLocal.produtos || vendaLocal.cart)) ===
    JSON.stringify(normalizarItens(vendaNuvem.itens));
}

function prepararItensVenda(venda) {
  return (venda.itens || venda.produtos || venda.cart || []).map((item) => ({
    ...item,
    preco_custo: item.precoCusto != null && Number.isFinite(Number(item.precoCusto))
      ? Number(item.precoCusto)
      : item.preco_custo != null && Number.isFinite(Number(item.preco_custo))
        ? Number(item.preco_custo)
        : null,
  }));
}

async function sincronizarExclusoesPendentes(supabase, db, lojaId) {
  const registo = await db.sistema.get(CHAVE_EXCLUSOES_PENDENTES);
  const pendentes = registo?.items || [];
  const restantes = [];
  let erroSincronizacao;

  for (const exclusao of pendentes) {
    if (exclusao.loja_id !== lojaId) {
      restantes.push(exclusao);
      continue;
    }

    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('loja_id', exclusao.loja_id)
      .eq('codigo', exclusao.codigo);

    if (error) {
      restantes.push(exclusao);
      erroSincronizacao ||= error;
    }
  }

  if (pendentes.length > 0) {
    await db.sistema.put({ id: CHAVE_EXCLUSOES_PENDENTES, items: restantes });
  }
  if (erroSincronizacao) throw erroSincronizacao;
}

export async function sincronizarBackupCompleto(supabase, db, lojaId) {
  if (!navigator.onLine) throw new Error('Sem ligação à internet; o backup permanece pendente neste dispositivo.');
  if (!lojaId) throw new Error('Loja não identificada para sincronizar o backup.');

  await sincronizarExclusoesPendentes(supabase, db, lojaId);

  const produtosPendentes = await db.produtos.filter((produto) => !produto.sincronizado).toArray();
  if (produtosPendentes.length > 0) {
    const payloadProdutos = produtosPendentes.map((produto) => ({
      loja_id: lojaId,
      codigo: String(produto.codigo || produto.id),
      nome: produto.nome,
      categoria: produto.categoria || 'Geral',
      subcategoria: produto.subcategoria || '',
      preco_venda: Number(produto.precoVenda) || 0,
      preco_custo: Number(produto.precoCusto) || 0,
      stock: Number(produto.stock) || 0,
      unidade_medida: produto.unidadeMedida || 'Un.',
    }));

    const { error } = await supabase
      .from('produtos')
      .upsert(payloadProdutos, { onConflict: 'loja_id,codigo' });
    if (error) throw error;

    await db.transaction('rw', db.produtos, async () => {
      for (const produto of produtosPendentes) {
        const atual = await db.produtos.get(produto.id);
        if (
          atual &&
          atual.codigo === produto.codigo &&
          atual.nome === produto.nome &&
          atual.categoria === produto.categoria &&
          atual.subcategoria === produto.subcategoria &&
          atual.precoVenda === produto.precoVenda &&
          atual.precoCusto === produto.precoCusto &&
          atual.stock === produto.stock &&
          atual.unidadeMedida === produto.unidadeMedida
        ) {
          await db.produtos.update(produto.id, { sincronizado: 1 });
        }
      }
    });
  }

  const lotesPendentes = await db.lotes.filter((lote) => !lote.sincronizado).toArray();
  if (lotesPendentes.length > 0) {
    const payloadLotes = await Promise.all(lotesPendentes.map(async (lote) => {
      const produto = await db.produtos.get(lote.produtoId);
      if (!produto) throw new Error(`Produto local não encontrado para o lote ${lote.id}.`);
      return {
        id: lote.id,
        loja_id: lojaId,
        produto_codigo: produto.codigo,
        validade: lote.validade || null,
        quantidade: Number(lote.quantidade) || 0,
      };
    }));

    const { error } = await supabase
      .from('lotes_produtos')
      .upsert(payloadLotes, { onConflict: 'id' });
    if (error) throw error;

    await db.transaction('rw', db.lotes, async () => {
      for (const lote of lotesPendentes) {
        const atual = await db.lotes.get(lote.id);
        if (
          atual &&
          atual.produtoId === lote.produtoId &&
          atual.validade === lote.validade &&
          atual.quantidade === lote.quantidade
        ) {
          await db.lotes.update(lote.id, { sincronizado: 1 });
        }
      }
    });
  }

  const vendasPendentes = await db.vendas.filter((venda) => !venda.sincronizado || !venda.sync_id).toArray();
  if (vendasPendentes.length > 0) {
    for (const venda of vendasPendentes) {
      if (!venda.sync_id) {
        venda.sync_id = crypto.randomUUID();
        venda.sincronizado = 0;
        await db.vendas.update(venda.id, { sync_id: venda.sync_id, sincronizado: 0 });
      }
    }

    const precisaAssociarHistoricoAntigo = vendasPendentes.some((venda) => !venda.sincronizado);
    const vendasNuvem = precisaAssociarHistoricoAntigo
      ? await buscarTodosOsRegistos(supabase, 'vendas', 'id,id_local,data_venda,vendedor_id,total,itens', lojaId)
      : [];
    const vendasLegadasDisponiveis = vendasNuvem.filter((venda) => !venda.id_local);
    const vendasParaInserir = [];

    for (const venda of vendasPendentes) {
      const payload = {
        loja_id: lojaId,
        id_local: venda.sync_id,
        data_venda: venda.data ? new Date(venda.data).toISOString() : new Date().toISOString(),
        vendedor_id: String(venda.vendedorId || venda.vendedor || 'admin'),
        total: Number(venda.total ?? venda.valor ?? venda.precoTotal ?? venda.subtotal ?? venda.valor_total ?? 0),
        lucro_total: venda.lucroTotal != null && Number.isFinite(Number(venda.lucroTotal))
          ? Number(venda.lucroTotal)
          : null,
        itens: prepararItensVenda(venda),
      };

      const indiceLegado = vendasLegadasDisponiveis.findIndex((remota) => correspondeVendaLegada(venda, remota));
      if (indiceLegado >= 0) {
        const [vendaLegada] = vendasLegadasDisponiveis.splice(indiceLegado, 1);
        const { error } = await supabase
          .from('vendas')
          .update({
            id_local: payload.id_local,
            lucro_total: payload.lucro_total,
            itens: payload.itens,
          })
          .eq('loja_id', lojaId)
          .eq('id', vendaLegada.id)
          .is('id_local', null);
        if (error) throw error;
      } else {
        vendasParaInserir.push(payload);
      }
    }

    if (vendasParaInserir.length > 0) {
      const { error } = await supabase
        .from('vendas')
        .upsert(vendasParaInserir, { onConflict: 'loja_id,id_local' });
      if (error) throw error;
    }

    await db.transaction('rw', db.vendas, async () => {
      for (const venda of vendasPendentes) {
        const atual = await db.vendas.get(venda.id);
        if (atual?.sync_id === venda.sync_id) {
          await db.vendas.update(venda.id, { sincronizado: 1 });
        }
      }
    });
  }

  const perfilLoja = await db.sistema.get('perfil_loja');
  if (perfilLoja) {
    const { id: _id, sincronizado: _sincronizado, ...perfilRecibo } = perfilLoja;
    const { error } = await supabase
      .from('configuracoes_loja')
      .upsert({
        loja_id: lojaId,
        perfil_recibo: perfilRecibo,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'loja_id' });
    if (error) throw error;
    const perfilAtual = await db.sistema.get('perfil_loja');
    if (
      perfilAtual &&
      perfilAtual.nome_loja === perfilLoja.nome_loja &&
      perfilAtual.telefone === perfilLoja.telefone &&
      perfilAtual.endereco === perfilLoja.endereco
    ) {
      await db.sistema.put({ ...perfilAtual, sincronizado: 1 });
    }
  }
}
