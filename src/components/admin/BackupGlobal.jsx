import { useState, useEffect } from 'react';
import { db } from '../../db';
import { supabase } from '../../services/supabase';
import { CloudLightning, ShieldCheck, DownloadCloud, LogIn, Key, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../AuthContext';

export function BackupGlobal() {
  const [status, setStatus] = useState('');
  const [sessao, setSessao] = useState(null);
  const [lojaAtual, setLojaAtual] = useState(null); // Guarda { id, nome } da loja
  const [isLogin, setIsLogin] = useState(false);
  const { user: currentUser } = useAuth();
  
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeLoja, setNomeLoja] = useState('');
  const [chave, setChave] = useState('');

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
      // 1º Tenta ler do Dexie local (instantâneo e funciona offline)
      const configLocal = await db.sistema.get('config_loja');
      if (configLocal?.loja_id) {
        setLojaAtual({ id: configLocal.loja_id, nome: configLocal.nome_loja });
        return configLocal.loja_id;
      }

      // 2º Se não estiver no Dexie (ex: computador novo/dados apagados), busca no Supabase
      if (navigator.onLine && userId) {
        const { data: lojaNuvem, error } = await supabase
          .from('lojas')
          .select('id, nome')
          .eq('owner_id', userId)
          .single();

        if (!error && lojaNuvem) {
          // Guarda no Dexie para nunca mais precisar de perguntar
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
        if (!lojaId) {
          setStatus('⚠️ Conta autenticada, mas nenhuma loja encontrada para este utilizador.');
          return;
        }
        setStatus('✅ Login efetuado e loja identificada!');
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({ 
          email, 
          password: senha 
        });
        if (authError) throw authError;

        // O RPC no PostgreSQL devolve { sucesso: true, loja_id: uuid }
        const { data: rpcData, error: rpcError } = await supabase.rpc('registar_loja_com_chave', {
          p_nome_loja: nomeLoja,
          p_chave: chave
        });

        if (rpcError) {
          setStatus(`🚨 Erro na licença: ${rpcError.message}`);
          return;
        }

        // Guarda imediatamente o ID da loja recém-criada no Dexie
        await db.sistema.put({
          id: 'config_loja',
          loja_id: rpcData.loja_id,
          nome_loja: nomeLoja
        });
        setLojaAtual({ id: rpcData.loja_id, nome: nomeLoja });

        setStatus('✅ Loja ativada, registada localmente e conectada à Nuvem!');
      }
    } catch (err) {
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
      const lojaId = lojaAtual?.id || (await obterOuRecuperarLoja(sessao?.user?.id));
      if (!lojaId) {
        setStatus('🚨 Erro: Não foi possível identificar o ID desta loja.');
        return;
      }

      // 1. SINCRONIZAR PRODUTOS (Usando upsert para atualizar stock se o código já existir)
      const produtosPendentes = await db.produtos.filter(p => !p.sincronizado).toArray();

      if (produtosPendentes.length > 0) {
        const payloadProdutos = produtosPendentes.map(p => ({
          loja_id: lojaId,
          codigo: p.codigo,
          nome: p.nome,
          categoria: p.categoria,
          subcategoria: p.subcategoria,
          preco_venda: p.precoVenda,
          preco_custo: p.precoCusto,
          stock: p.stock,
          unidade_medida: p.unidadeMedida
        }));

        const { error: erroProdutos } = await supabase
          .from('produtos')
          .upsert(payloadProdutos, { onConflict: 'loja_id, codigo' });

        if (erroProdutos) throw erroProdutos;

        await db.transaction('rw', db.produtos, async () => {
          for (const prod of produtosPendentes) {
            await db.produtos.update(prod.id, { sincronizado: 1 });
          }
        });
      }

      // 2. SINCRONIZAR VENDAS (Incluindo o array de itens em jsonb)
      const vendasPendentes = await db.vendas.filter(v => !v.sincronizado).toArray();

      if (vendasPendentes.length > 0) {
        const payloadVendas = vendasPendentes.map(v => ({
          loja_id: lojaId,
          data_venda: v.data,
          vendedor_id: String(v.vendedorId),
          total: v.total,
          itens: v.itens || [] // Fundamental para guardar o detalhe da venda
        }));

        const { error: erroVendas } = await supabase.from('vendas').insert(payloadVendas);
        if (erroVendas) throw erroVendas;

        await db.transaction('rw', db.vendas, async () => {
          for (const venda of vendasPendentes) {
            await db.vendas.update(venda.id, { sincronizado: 1 });
          }
        });
      }

      setStatus(produtosPendentes.length === 0 && vendasPendentes.length === 0 
        ? '✅ Tudo já estava atualizado.' 
        : `✅ ${produtosPendentes.length} produtos e ${vendasPendentes.length} vendas guardados na nuvem!`);
        
    } catch (erro) {
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

      // 1. Puxar produtos do Supabase
      const { data: prodNuvem, error: errProd } = await supabase
        .from('produtos')
        .select('*')
        .eq('loja_id', lojaId);
      if (errProd) throw errProd;

      // 2. Puxar histórico de vendas do Supabase
      const { data: vendasNuvem, error: errVendas } = await supabase
        .from('vendas')
        .select('*')
        .eq('loja_id', lojaId);
      if (errVendas) throw errVendas;

      // 3. Reconstruir tabelas locais no Dexie
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
            sincronizado: 1 // Já vieram da nuvem, não precisam de subir de novo
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

      setStatus(`✅ Base reconstruída! (${prodNuvem.length} produtos e ${vendasNuvem.length} vendas recuperadas)`);
    } catch (err) {
      setStatus(`🚨 Erro ao restaurar: ${err.message}`);
    }
  };

  // Dispara automaticamente quando a internet volta
  useEffect(() => {
    const ativarSincronizacaoAutomatica = () => {
      if (sessao && lojaAtual?.id) {
        forcarSincronizacao();
      }
    };

    window.addEventListener('online', ativarSincronizacaoAutomatica);
    return () => window.removeEventListener('online', ativarSincronizacaoAutomatica);
  }, [sessao, lojaAtual]);

  // Bloqueio para vendedores
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

  // Ecrã de Login / Ativação no Supabase
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

  // Painel Principal Sincronizado
  return (
    <div className="p-6 bg-zinc-50 min-h-full text-zinc-900 font-sans">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-orange-500 uppercase tracking-wider flex items-center gap-2">
          <CloudLightning size={28} /> Sincronização Premium
        </h2>
        {lojaAtual && (
          <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
            Loja: {lojaAtual.nome}
          </span>
        )}
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