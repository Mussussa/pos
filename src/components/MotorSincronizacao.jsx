import { useEffect } from 'react';
import { db } from '../db'; // Ajusta o caminho do import se necessário
import { supabase } from '../services/supabase'; // Ajusta o caminho do import se necessário

export function MotorSincronizacao() {
  useEffect(() => {
    const executarSincronizacaoSilenciosa = async () => {
      if (!navigator.onLine) return;

      try {
        // 1. Verifica se esta máquina já tem uma loja configurada
        const configLocal = await db.sistema.get('config_loja');
        if (!configLocal?.loja_id) return;

        // 2. Verifica se a sessão do Supabase (do Admin que ativou a máquina) continua válida no navegador
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        const lojaId = configLocal.loja_id;

        // 3. Puxa tudo o que está pendente no Dexie
        const produtosPendentes = await db.produtos.filter(p => !p.sincronizado).toArray();
        const vendasPendentes = await db.vendas.filter(v => !v.sincronizado).toArray();

        // Se não houver nada para enviar, morre aqui silenciosamente
        if (produtosPendentes.length === 0 && vendasPendentes.length === 0) return;

        console.log(`🚀 [Motor Invisível] Detetou internet! A enviar ${produtosPendentes.length} produtos e ${vendasPendentes.length} vendas...`);

        // --- SINCRONIZA PRODUTOS ---
        if (produtosPendentes.length > 0) {
          const payloadProdutos = produtosPendentes.map(p => ({
            loja_id: lojaId,
            codigo: String(p.codigo || p.id),
            nome: p.nome,
            categoria: p.categoria || 'Geral',
            subcategoria: p.subcategoria || '',
            preco_venda: Number(p.precoVenda) || 0,
            preco_custo: Number(p.precoCusto) || 0,
            stock: Number(p.stock) || 0,
            unidade_medida: p.unidadeMedida || 'Un.'
          }));

          const { error: erroProd } = await supabase.from('produtos').upsert(payloadProdutos, { onConflict: 'loja_id, codigo' });
          if (!erroProd) {
            await db.transaction('rw', db.produtos, async () => {
              for (const prod of produtosPendentes) await db.produtos.update(prod.id, { sincronizado: 1 });
            });
          }
        }

        // --- SINCRONIZA VENDAS ---
        if (vendasPendentes.length > 0) {
          const payloadVendas = vendasPendentes.map(v => {
            let valorCalculado = Number(v.total ?? v.valor ?? v.precoTotal ?? v.subtotal ?? v.valor_total ?? 0);
            if (isNaN(valorCalculado) || valorCalculado === null || valorCalculado === undefined) valorCalculado = 0;

            return {
              loja_id: lojaId,
              data_venda: v.data ? new Date(v.data).toISOString() : new Date().toISOString(),
              vendedor_id: String(v.vendedorId || v.vendedor || 'admin'),
              total: valorCalculado,
              itens: v.itens || v.produtos || v.cart || []
            };
          });

          const { error: erroVendas } = await supabase.from('vendas').insert(payloadVendas);
          if (!erroVendas) {
            await db.transaction('rw', db.vendas, async () => {
              for (const venda of vendasPendentes) await db.vendas.update(venda.id, { sincronizado: 1 });
            });
          }
        }
        
        console.log('✅ [Motor Invisível] Sincronização concluída com sucesso!');
      } catch (err) {
        console.error('🚨 [Motor Invisível] Erro oculto na sincronização:', err);
      }
    };

    // Ouve o momento exato em que a internet volta
    window.addEventListener('online', executarSincronizacaoSilenciosa);
    
    // De forma redundante, tenta enviar de 5 em 5 minutos silenciosamente se houver internet
    const intervalo = setInterval(executarSincronizacaoSilenciosa, 5 * 60 * 1000);

    
    // Tenta correr uma vez logo que a aplicação abre
    executarSincronizacaoSilenciosa();

    return () => {
      window.removeEventListener('online', executarSincronizacaoSilenciosa);
      clearInterval(intervalo);
    };
  }, []);


  // Este componente não tem ecrã, é invisível na interface!
  return null;
}