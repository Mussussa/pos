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

  // 1. GESTÃO DE SESSÃO
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      if (session) {
        obterOuRecuperarLoja(session.user.id).then(lojaId => {
          if (lojaId) executarSincronizacaoSilenciosa(lojaId); 
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
      if (session) {
        obterOuRecuperarLoja(session.user.id).then(lojaId => {
          if (lojaId) executarSincronizacaoSilenciosa(lojaId); 
        });
      } else {
        setLojaAtual(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []); 

  // 1.5. DETETOR DE INTERNET EM BACKGROUND
  useEffect(() => {
    const aoFicarOnline = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const lojaId = await obterOuRecuperarLoja(session.user.id);
        if (lojaId) executarSincronizacaoSilenciosa(lojaId);
      }
    };

    window.addEventListener('online', aoFicarOnline);
    return () => window.removeEventListener('online', aoFicarOnline);
  }, []); 

  const obterOuRecuperarLoja = async (userId) => {
    try {
      const configLocal = await db.sistema.get('config_loja');
      if (configLocal?.loja_id) {
        setLojaAtual({ id: configLocal.loja_id, nome: configLocal.nome_loja });
        return configLocal.loja_id;
      }

      if (navigator.onLine && userId) {
        const { data: lojaNuvem, error } = await supabase
          .from('lojas')
          .select('id, nome')
          .eq('owner_id', userId)
          .maybeSingle();

        if (!error && lojaNuvem) {
          await db.sistema.put({
            id: 'config_loja',
            loja_id: lojaNuvem.id,
            nome_loja: lojaNuvem.nome
          });
          setLojaAtual(lojaNuvem);
          return lojaNuvem.id;
        }
      }
    } catch (err) {
      // Falha silenciosa para não interromper a experiência do utilizador
    }
    return null;
  };

  const gerirAutenticacao = async (e) => {
    e.preventDefault();
    setStatus('A processar...');
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        const lojaId = await obterOuRecuperarLoja(data.user.id);
        if (!lojaId) return setStatus('⚠️ Conta autenticada, mas nenhuma loja encontrada.');
        setStatus('✅ Login efetuado!');
      } else {
        // Fluxo de Registo com Verificação Prévia de Chave
        const { data: chaveValida, error: erroCheck } = await supabase.rpc('verificar_chave', { p_chave: chave });
        
        if (erroCheck || !chaveValida) {
          return setStatus('🚨 Erro: A Chave de Licença é inválida ou já foi utilizada.');
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: senha });
        if (authError) throw authError;

        const { data: rpcData, error: rpcError } = await supabase.rpc('registar_loja_com_chave', {
          p_nome_loja: nomeLoja, p_chave: chave
        });
        
        if (rpcError) return setStatus(`🚨 Erro ao registar a loja: ${rpcError.message}`);

        await db.sistema.put({ id: 'config_loja', loja_id: rpcData.loja_id, nome_loja: nomeLoja });
        setLojaAtual({ id: rpcData.loja_id, nome: nomeLoja });
        setStatus('✅ Loja ativada e conectada!');
      }
    } catch (err) {
      setStatus(`🚨 Erro: ${err.message}`);
    }
  };

  // 2. MOTOR DE SINCRONIZAÇÃO 
  const executarSincronizacaoSilenciosa = async (lojaIdForcada = null) => {
    if (!navigator.onLine) return;

    try {
      const lojaId = lojaIdForcada || lojaAtual?.id || (await obterOuRecuperarLoja(sessao?.user?.id));
      if (!lojaId) return;

      const produtosPendentes = await db.produtos.filter(p => !p.sincronizado).toArray();
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

        const { error: erroProdutos } = await supabase.from('produtos').upsert(payloadProdutos, { onConflict: 'loja_id, codigo' });
        if (!erroProdutos) {
          await db.transaction('rw', db.produtos, async () => {
            for (const prod of produtosPendentes) await db.produtos.update(prod.id, { sincronizado: 1 });
          });
        }
      }

      const vendasPendentes = await db.vendas.filter(v => !v.sincronizado).toArray();
      if (vendasPendentes.length > 0) {
        const payloadVendas = vendasPendentes.map(v => {
          let valorCalculado = Number(v.total ?? v.valor ?? v.precoTotal ?? v.subtotal ?? v.valor_total ?? 0);
          if (isNaN(valorCalculado) || valorCalculado === null || valorCalculado === undefined) {
             valorCalculado = 0;
          }

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
        } else {
             throw erroVendas;
        }
      }
    } catch (err) {
      throw err; 
    }
  };

  const forcarSincronizacao = async () => {
    if (!navigator.onLine) return setStatus('⚠️ Estás offline.');
    setStatus('A sincronizar com a nuvem...');
    try {
        await executarSincronizacaoSilenciosa();
        setStatus('✅ Sincronização concluída com sucesso!');
    } catch (err) {
        setStatus(`🚨 Erro: ${err.message}`);
    }
  };

  // 3. RECUPERAÇÃO DE EMERGÊNCIA
  const restaurarDaNuvem = async () => {
    if (!navigator.onLine) return setStatus('⚠️ Precisas de internet.');
    if (!window.confirm('Substituir dados locais pela nuvem?')) return;

    setStatus('A descarregar dados...');
    try {
      const lojaId = lojaAtual?.id || (await obterOuRecuperarLoja(sessao?.user?.id));
      if (!lojaId) throw new Error('Loja não identificada.');

      const { data: prodNuvem, error: errProd } = await supabase.from('produtos').select('*').eq('loja_id', lojaId);
      if (errProd) throw errProd;

      const { data: vendasNuvem, error: errVendas } = await supabase.from('vendas').select('*').eq('loja_id', lojaId);
      if (errVendas) throw errVendas;

      await db.transaction('rw', db.produtos, db.vendas, async () => {
        await db.produtos.clear();
        await db.vendas.clear();

        if (prodNuvem && prodNuvem.length > 0) {
          await db.produtos.bulkAdd(prodNuvem.map(p => ({
            codigo: p.codigo, nome: p.nome, categoria: p.categoria, subcategoria: p.subcategoria,
            precoVenda: Number(p.preco_venda), precoCusto: Number(p.preco_custo), stock: Number(p.stock),
            unidadeMedida: p.unidade_medida, sincronizado: 1
          })));
        }
        if (vendasNuvem && vendasNuvem.length > 0) {
          await db.vendas.bulkAdd(vendasNuvem.map(v => ({
            data: v.data_venda, vendedorId: v.vendedor_id, total: Number(v.total),
            itens: v.itens || [], sincronizado: 1
          })));
        }
      });
      setStatus(`✅ Base reconstruída!`);
    } catch (err) {
      setStatus(`🚨 Erro: ${err.message}`);
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-6 bg-zinc-50 min-h-full flex flex-col items-center justify-center">
        <div className="bg-red-50 p-8 rounded-lg text-center">
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-700">Acesso Restrito</h2>
        </div>
      </div>
    );
  }

  if (!sessao) {
    return (
      <div className="p-6 bg-zinc-50 min-h-full flex flex-col items-center justify-center font-sans">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-zinc-200 w-full max-w-md text-black">
          <h2 className="text-2xl font-bold mb-6 text-blue-500 uppercase flex items-center justify-center gap-2">
            <ShieldCheck size={28} /> Vulpe Mart Premium
          </h2>
          <form onSubmit={gerirAutenticacao} className="flex flex-col gap-4">
            <input type="email" placeholder="Email do Admin" required value={email} onChange={e => setEmail(e.target.value)} className="p-3 border rounded focus:border-orange-500" />
            <input type="password" placeholder="Senha segura" required value={senha} onChange={e => setSenha(e.target.value)} className="p-3 border rounded focus:border-orange-500" />
            {!isLogin && (
              <>
                <input type="text" placeholder="Nome da Loja" required value={nomeLoja} onChange={e => setNomeLoja(e.target.value)} className="p-3 border rounded focus:border-orange-500" />
                <div className="relative">
                  <Key size={18} className="absolute left-3 top-3.5 text-zinc-400" />
                  <input type="text" placeholder="Chave Premium" required value={chave} onChange={e => setChave(e.target.value)} className="p-3 pl-10 border rounded w-full uppercase" />
                </div>
              </>
            )}
            <button type="submit" className="bg-orange-500 text-white font-bold p-3 rounded mt-2">
              {isLogin ? 'Entrar no Sistema' : 'Ativar Licença'}
            </button>
          </form>
          <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-sm text-zinc-500 mt-6 hover:text-orange-500">
            {isLogin ? 'Primeiro acesso? Ativa aqui.' : 'Já ativaste? Faz Login.'}
          </button>
        </div>
        {status && <div className="mt-4 text-sm font-bold">{status}</div>}
      </div>
    );
  }

  return (
    <div className="p-6 bg-zinc-50 min-h-full text-zinc-900 font-sans">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-orange-500 uppercase flex items-center gap-2">
          <CloudLightning size={28} /> Sincronização Premium
        </h2>
        <div className="flex items-center gap-2">
          {lojaAtual && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Loja: {lojaAtual.nome}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2 mb-4">
            <CloudLightning className={navigator.onLine ? "text-blue-500" : "text-zinc-400"} /> Estado da Conexão
          </h3>
          <p className="text-sm mb-6">Sincroniza os dados automaticamente assim que deteta internet.</p>
          <button onClick={forcarSincronizacao} disabled={!navigator.onLine} className={`w-full p-3 rounded font-bold ${navigator.onLine ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
            Forçar Sincronização Agora
          </button>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2 mb-4">
            <DownloadCloud className="text-orange-500" /> Recuperação
          </h3>
          <p className="text-sm mb-6">Substitui os dados locais pelos oficiais guardados na nuvem.</p>
          <button onClick={restaurarDaNuvem} className="w-full border-2 border-orange-500 text-orange-600 font-bold p-3 rounded">
            Reconstruir Base de Dados
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-between items-center bg-white border border-zinc-200 p-4 rounded-lg">
        <span className="text-sm font-mono">{status}</span>
        <button onClick={async () => { await db.sistema.delete('config_loja'); setLojaAtual(null); await supabase.auth.signOut(); }} className="text-sm text-red-500 font-bold flex items-center gap-1">
          <LogIn size={16} /> Terminar Sessão
        </button>
      </div>
    </div>
  );

  
}