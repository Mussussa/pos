import { useState, useEffect } from 'react';
import { db } from '../../db';
import { supabase } from '../../services/supabase';
import { CloudLightning, ShieldCheck, DownloadCloud, LogIn, Key, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../AuthContext';

export function BackupGlobal() {
  const [status, setStatus] = useState('');
  const [sessao, setSessao] = useState(null);
  const [lojaAtual, setLojaAtual] = useState(null);
  const [isLogin, setIsLogin] = useState(false);
  const { user: currentUser } = useAuth();
  
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeLoja, setNomeLoja] = useState('');
  const [chave, setChave] = useState('');

  // 🔍 FUNÇÃO DE AUDITORIA: Verifica Dexie Local e Supabase Nuvem no Console
  const auditarBancos = async (contexto = 'Auditoria') => {
    console.group(`🔍 [${contexto}] Verificação de Dados (Local vs Nuvem)`);
    try {
      // 1. Verificar Banco Local (Dexie)
      const configLocal = await db.sistema.get('config_loja');
      const produtosLocais = await db.produtos.toArray();
      const vendasLocais = await db.vendas.toArray();

      console.log('📦 [DEXIE LOCAL] config_loja:', configLocal || '⚠️ Não configurado');
      console.log(`📦 [DEXIE LOCAL] Produtos (${produtosLocais.length} total):`, produtosLocais);
      console.log(`📦 [DEXIE LOCAL] Vendas (${vendasLocais.length} total):`, vendasLocais);

      // 2. Verificar Banco na Nuvem (Supabase)
      if (navigator.onLine) {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('👤 [SUPABASE AUTH] Utilizador logado:', user ? { id: user.id, email: user.email } : 'Nenhum');

        if (user) {
          const { data: lojasNuvem, error: errLoja } = await supabase
            .from('lojas')
            .select('*')
            .eq('owner_id', user.id);
          console.log('☁️ [SUPABASE NUVEM] Tabela lojas:', errLoja ? errLoja : lojasNuvem);

          const lojaId = configLocal?.loja_id || lojasNuvem?.[0]?.id;
          if (lojaId) {
            const { data: prodNuvem, error: errProd } = await supabase
              .from('produtos')
              .select('*')
              .eq('loja_id', lojaId);
            console.log(`☁️ [SUPABASE NUVEM] Tabela produtos (${prodNuvem?.length || 0}):`, errProd ? errProd : prodNuvem);

            const { data: vendasNuvem, error: errVendas } = await supabase
              .from('vendas')
              .select('*')
              .eq('loja_id', lojaId);
            console.log(`☁️ [SUPABASE NUVEM] Tabela vendas (${vendasNuvem?.length || 0}):`, errVendas ? errVendas : vendasNuvem);
          }
        }
      } else {
        console.warn('⚠️ Sem internet para auditar o Supabase.');
      }
    } catch (err) {
      console.error('🚨 Erro durante a auditoria:', err);
    }
    console.groupEnd();
  };

  // 1. Verifica a sessão do Supabase e carrega os dados da loja
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      if (session) obterOuRecuperarLoja(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
      if (session) {
        obterOuRecuperarLoja(session.user.id);
      } else {
        setLojaAtual(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Função que garante que sabemos sempre o ID da loja (Local ou Nuvem)
  const obterOuRecuperarLoja = async (userId) => {
    try {
      const configLocal = await db.sistema.get('config_loja');
      if (configLocal?.loja_id) {
        console.log('✅ [obterOuRecuperarLoja] Loja encontrada no Dexie local:', configLocal);
        setLojaAtual({ id: configLocal.loja_id, nome: configLocal.nome_loja });
        return configLocal.loja_id;
      }

      if (navigator.onLine && userId) {
        console.log('🔄 [obterOuRecuperarLoja] A procurar loja no Supabase para owner_id:', userId);
        const { data: lojaNuvem, error } = await supabase
          .from('lojas')
          .select('id, nome')
          .eq('owner_id', userId)
          .maybeSingle();

        if (error) {
          console.error('🚨 Erro ao buscar loja no Supabase:', error);
        }

        if (lojaNuvem) {
          await db.sistema.put({
            id: 'config_loja',
            loja_id: lojaNuvem.id,
            nome_loja: lojaNuvem.nome
          });
          console.log('✅ [obterOuRecuperarLoja] Loja recuperada da nuvem e salva no Dexie:', lojaNuvem);
          setLojaAtual(lojaNuvem);
          return lojaNuvem.id;
        }
      }
    } catch (err) {
      console.error('Erro ao identificar a loja:', err);
    }
    return null;
  };

  // 2. Autenticação e Registo Inicial
  const gerirAutenticacao = async (e) => {
    e.preventDefault();
    setStatus('A processar...');

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        
        const lojaId = await obterOuRecuperarLoja(data.user.id);
        await auditarBancos('Pós-Login');

        if (!lojaId) {
          setStatus('⚠️ Conta autenticada, mas nenhuma loja encontrada para este utilizador.');
          return;
        }
        setStatus('✅ Login efetuado e loja identificada!');
      } else {
        console.log('🚀 [Registo] A criar conta no Supabase Auth...');
        const { data: authData, error: authError } = await supabase.auth.signUp({ 
          email, 
          password: senha 
        });
        if (authError) throw authError;

        console.log('🔑 [Registo] Conta criada:', authData?.user?.id, 'A validar chave RPC...');
        const { data: rpcData, error: rpcError } = await supabase.rpc('registar_loja_com_chave', {
          p_nome_loja: nomeLoja,
          p_chave: chave
        });

        console.log('📡 [Registo] Resposta do RPC registar_loja_com_chave:', { rpcData, rpcError });

        if (rpcError) {
          setStatus(`🚨 Erro na licença: ${rpcError.message}`);
          return;
        }

        await db.sistema.put({
          id: 'config_loja',
          loja_id: rpcData.loja_id,
          nome_loja: nomeLoja
        });
        setLojaAtual({ id: rpcData.loja_id, nome: nomeLoja });

        await auditarBancos('Pós-Registo');
        setStatus('✅ Loja ativada, registada localmente e conectada à Nuvem!');
      }
    } catch (err) {
      console.error('🚨 [gerirAutenticacao] Erro:', err);
      setStatus(`🚨 Erro: ${err.message}`);
    }
  };

  // 3. Sincronização (Dexie -> Supabase)
  const forcarSincronizacao = async () => {
    if (!navigator.onLine) {
      setStatus('⚠️ Estás offline. Conecta-te à internet primeiro.');
      return;
    }

    setStatus('A sincronizar com a nuvem...');

    try {
      await auditarBancos('Antes da Sincronização');

      const lojaId = lojaAtual?.id || (await obterOuRecuperarLoja(sessao?.user?.id));
      console.log('🎯 [Sincronização] ID da Loja confirmado:', lojaId);

      if (!lojaId) {
        setStatus('🚨 Erro: Não foi possível identificar o ID desta loja.');
        return;
      }

      // 1. SINCRONIZAR PRODUTOS
      const produtosPendentes = await db.produtos.filter(p => !p.sincronizado).toArray();
      console.log(`📤 [Sincronização] Produtos pendentes para enviar (${produtosPendentes.length}):`, produtosPendentes);

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

        const { data: resProd, error: erroProdutos } = await supabase
          .from('produtos')
          .upsert(payloadProdutos, { onConflict: 'loja_id, codigo' })
          .select();

        console.log('☁️ [Sincronização] Resposta Supabase Produtos:', { resProd, erroProdutos });
        if (erroProdutos) throw erroProdutos;

        await db.transaction('rw', db.produtos, async () => {
          for (const prod of produtosPendentes) {
            await db.produtos.update(prod.id, { sincronizado: 1 });
          }
        });
      }

      // 2. SINCRONIZAR VENDAS
// 2. SINCRONIZAR VENDAS
      const vendasPendentes = await db.vendas.filter(v => !v.sincronizado).toArray();
      console.log(`📤 [Sincronização] Vendas pendentes para enviar (${vendasPendentes.length}):`, vendasPendentes);

      if (vendasPendentes.length > 0) {
        const payloadVendas = vendasPendentes.map(v => {
          // Garante conversão e validação numérica para evitar nulos na coluna 'total'
          const valorTotal = Number(v.total ?? v.valorTotal ?? v.precoTotal ?? 0);
          
          return {
            loja_id: lojaId,
            data_venda: v.data ? new Date(v.data).toISOString() : new Date().toISOString(),
            vendedor_id: String(v.vendedorId || v.vendedor || 'admin'),
            total: isNaN(valorTotal) ? 0 : valorTotal,
            itens: v.itens || v.produtos || []
          };
        });

        console.log('📦 [Payload Vendas Limpo]:', payloadVendas);

        const { data: resVendas, error: erroVendas } = await supabase
          .from('vendas')
          .insert(payloadVendas)
          .select();

        console.log('☁️ [Sincronização] Resposta Supabase Vendas:', { resVendas, erroVendas });
        if (erroVendas) throw erroVendas;

        await db.transaction('rw', db.vendas, async () => {
          for (const venda of vendasPendentes) {
            await db.vendas.update(venda.id, { sincronizado: 1 });
          }
        });
      }

      await auditarBancos('Depois da Sincronização');

      setStatus(produtosPendentes.length === 0 && vendasPendentes.length === 0 
        ? '✅ Tudo já estava atualizado.' 
        : `✅ ${produtosPendentes.length} produtos e ${vendasPendentes.length} vendas guardados na nuvem!`);
        
    } catch (erro) {
      console.error('🚨 [Sincronização] Erro fatal:', erro);
      setStatus(`🚨 Erro na comunicação com a nuvem: ${erro.message}`);
    }
  };

  // 4. Recuperação de Emergência (Supabase -> Dexie)
  const restaurarDaNuvem = async () => {
    if (!navigator.onLine) {
      setStatus('⚠️ Precisas de internet para descarregar os dados da nuvem.');
      return;
    }

    const confirmar = window.confirm('Isto vai substituir os produtos e vendas locais pelos dados da nuvem. Continuar?');
    if (!confirmar) return;

    setStatus('A descarregar dados da loja...');

    try {
      const lojaId = lojaAtual?.id || (await obterOuRecuperarLoja(sessao?.user?.id));
      if (!lojaId) throw new Error('Loja não identificada para esta conta.');

      const { data: prodNuvem, error: errProd } = await supabase
        .from('produtos')
        .select('*')
        .eq('loja_id', lojaId);
      if (errProd) throw errProd;

      const { data: vendasNuvem, error: errVendas } = await supabase
        .from('vendas')
        .select('*')
        .eq('loja_id', lojaId);
      if (errVendas) throw errVendas;

      await db.transaction('rw', db.produtos, db.vendas, async () => {
        await db.produtos.clear();
        await db.vendas.clear();

        if (prodNuvem && prodNuvem.length > 0) {
          const produtosFormatados = prodNuvem.map(p => ({
            codigo: p.codigo,
            nome: p.nome,
            categoria: p.categoria,
            subcategoria: p.subcategoria,
            precoVenda: Number(p.preco_venda),
            precoCusto: Number(p.preco_custo),
            stock: Number(p.stock),
            unidadeMedida: p.unidade_medida,
            sincronizado: 1
          }));
          await db.produtos.bulkAdd(produtosFormatados);
        }

        if (vendasNuvem && vendasNuvem.length > 0) {
          const vendasFormatadas = vendasNuvem.map(v => ({
            data: v.data_venda,
            vendedorId: v.vendedor_id,
            total: Number(v.total),
            itens: v.itens || [],
            sincronizado: 1
          }));
          await db.vendas.bulkAdd(vendasFormatadas);
        }
      });

      await auditarBancos('Pós-Restauro da Nuvem');
      setStatus(`✅ Base reconstruída! (${prodNuvem.length} produtos e ${vendasNuvem.length} vendas recuperadas)`);
    } catch (err) {
      console.error('🚨 [Restauro] Erro:', err);
      setStatus(`🚨 Erro ao restaurar: ${err.message}`);
    }
  };

  useEffect(() => {
    const ativarSincronizacaoAutomatica = () => {
      if (sessao && lojaAtual?.id) {
        forcarSincronizacao();
      }
    };

    window.addEventListener('online', ativarSincronizacaoAutomatica);
    return () => window.removeEventListener('online', ativarSincronizacaoAutomatica);
  }, [sessao, lojaAtual]);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-6 bg-zinc-50 min-h-full flex flex-col items-center justify-center font-sans">
        <div className="bg-red-50 p-8 rounded-lg shadow-sm border border-red-200 text-center">
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-700 mb-2">Acesso Restrito</h2>
          <p className="text-red-600">Apenas administradores podem gerir a sincronização com a nuvem.</p>
        </div>
      </div>
    );
  }

  if (!sessao) {
    return (
      <div className="p-6 bg-zinc-50 min-h-full flex flex-col items-center justify-center font-sans">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-zinc-200 w-full max-w-md text-black">
          <h2 className="text-2xl font-bold mb-6 text-blue-500 uppercase tracking-wider flex items-center justify-center gap-2">
            <ShieldCheck size={28} /> Vulpe Mart Premium
          </h2>
          
          <form onSubmit={gerirAutenticacao} className="flex flex-col gap-4">
            <input 
              type="email" placeholder="Email do Administrador" required
              value={email} onChange={e => setEmail(e.target.value)}
              className="p-3 border border-zinc-300 rounded outline-none focus:border-orange-500"
            />
            <input 
              type="password" placeholder="Senha segura" required
              value={senha} onChange={e => setSenha(e.target.value)}
              className="p-3 border border-zinc-300 rounded outline-none focus:border-orange-500"
            />
            
            {!isLogin && (
              <>
                <input 
                  type="text" placeholder="Nome da Loja (ex: Mercearia Central)" required
                  value={nomeLoja} onChange={e => setNomeLoja(e.target.value)}
                  className="p-3 border border-zinc-300 rounded outline-none focus:border-orange-500"
                />
                <div className="relative">
                  <Key size={18} className="absolute left-3 top-3.5 text-zinc-400" />
                  <input 
                    type="text" placeholder="Chave de Licença Premium" required
                    value={chave} onChange={e => setChave(e.target.value)}
                    className="p-3 pl-10 border border-zinc-300 rounded outline-none focus:border-orange-500 w-full font-mono uppercase"
                  />
                </div>
              </>
            )}

            <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white font-bold p-3 rounded transition-colors mt-2">
              {isLogin ? 'Entrar no Sistema' : 'Ativar Licença e Registar'}
            </button>
          </form>

          <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-sm text-zinc-500 mt-6 hover:text-orange-500 transition-colors">
            {isLogin ? 'Primeiro acesso? Ativa a tua licença aqui.' : 'Já tens a loja ativada? Faz Login.'}
          </button>
        </div>
        
        {status && <div className="mt-4 text-sm font-bold text-zinc-700">{status}</div>}
      </div>
    );
  }

  return (
    <div className="p-6 bg-zinc-50 min-h-full text-zinc-900 font-sans">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-orange-500 uppercase tracking-wider flex items-center gap-2">
          <CloudLightning size={28} /> Sincronização Premium
        </h2>
        <div className="flex items-center gap-2">
          {lojaAtual && (
            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
              Loja: {lojaAtual.nome} ({lojaAtual.id.slice(0, 8)}...)
            </span>
          )}
          <button
            onClick={() => auditarBancos('Auditoria Manual')}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded text-xs font-mono"
          >
            Ver Logs no Console
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2 mb-4">
            <CloudLightning className={navigator.onLine ? "text-blue-500" : "text-zinc-400"} /> 
            Estado da Conexão
          </h3>
          <p className="text-zinc-600 text-sm mb-6">
            O sistema envia automaticamente as vendas para a nuvem. Podes forçar o envio se necessário.
          </p>
          <button 
            onClick={forcarSincronizacao}
            disabled={!navigator.onLine}
            className={`w-full p-3 rounded flex justify-center items-center gap-2 transition-all font-bold ${
              navigator.onLine ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
            }`}
          >
            Forçar Sincronização Agora
          </button>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2 mb-4">
            <DownloadCloud className="text-orange-500" /> 
            Recuperação de Emergência
          </h3>
          <p className="text-zinc-600 text-sm mb-6">
            Se este for um computador novo ou os dados locais foram apagados, descarrega a tua loja da nuvem.
          </p>
          <button 
            onClick={restaurarDaNuvem}
            className="w-full bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-bold p-3 rounded flex justify-center items-center gap-2 transition-all"
          >
            Reconstruir Base de Dados Local
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-between items-center bg-white border border-zinc-200 p-4 rounded-lg">
        <span className="text-sm font-mono">{status || 'Sistema Operacional'}</span>
        <button 
          onClick={async () => {
            await db.sistema.delete('config_loja');
            setLojaAtual(null);
            await supabase.auth.signOut();
          }}
          className="text-sm text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
        >
          <LogIn size={16} /> Terminar Sessão
        </button>
      </div>
    </div>
  );
}