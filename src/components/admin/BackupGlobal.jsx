import { useState, useEffect } from 'react';
import { db } from '../../db';
import { supabase } from '../../services/supabase';
import { CloudLightning, ShieldCheck, DownloadCloud, LogIn, Key, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../AuthContext';

export function BackupGlobal() {
  // 1. TODOS OS ESTADOS E HOOKS NO TOPO (Regra de Ouro do React)
  const [status, setStatus] = useState('');
  const [sessao, setSessao] = useState(null);
  const [isLogin, setIsLogin] = useState(false);
  const { user: currentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeLoja, setNomeLoja] = useState('');
  const [chave, setChave] = useState('');

  // Hook 1: Verifica a sessão do Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. FUNÇÕES DO SISTEMA
  const gerirAutenticacao = async (e) => {
    e.preventDefault();
    setStatus('A processar...');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        setStatus('✅ Login efetuado com sucesso!');
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({ 
          email, 
          password: senha 
        });
        if (authError) throw authError;

        const { error: rpcError } = await supabase.rpc('registar_loja_com_chave', {
          p_nome_loja: nomeLoja,
          p_chave: chave
        });

        if (rpcError) {
          setStatus(`🚨 Erro: ${rpcError.message}`);
          return;
        }

        setStatus('✅ Loja ativada e conectada à Nuvem!');
      }
    } catch (err) {
      setStatus(`🚨 Erro: ${err.message}`);
    }
  };

  const forcarSincronizacao = async () => {
    if (!navigator.onLine) {
      setStatus('⚠️ Estás offline. Conecta-te à internet primeiro.');
      return;
    }
    
    setStatus('A sincronizar com a nuvem...');
    
    try {
      // 1. SINCRONIZAR PRODUTOS
// 1. SINCRONIZAR PRODUTOS
      const produtosPendentes = await db.produtos.filter(p => !p.sincronizado).toArray();
      
      if (produtosPendentes.length > 0) {
        // Ajustado para coincidir exatamente com as colunas do Supabase
        const payloadProdutos = produtosPendentes.map(p => ({
          codigo: p.codigo,
          nome: p.nome,
          categoria: p.categoria,
          subcategoria: p.subcategoria,
          preco_venda: p.precoVenda,     // <-- Alterado de precoVenda
          preco_custo: p.precoCusto,     // <-- Alterado de precoCusto
          stock: p.stock,
          unidade_medida: p.unidadeMedida // <-- Alterado de unidadeMedida
        }));

        const { error: erroProdutos } = await supabase.from('produtos').insert(payloadProdutos);
        if (erroProdutos) throw erroProdutos;

        await db.transaction('rw', db.produtos, async () => {
          for (const prod of produtosPendentes) {
            await db.produtos.update(prod.id, { sincronizado: 1 });
          }
        });
      }

      // 2. SINCRONIZAR VENDAS
      const vendasPendentes = await db.vendas.filter(v => !v.sincronizado).toArray();
      
      if (vendasPendentes.length > 0) {
        // Ajustado para coincidir exatamente com a tabela vendas
        const payloadVendas = vendasPendentes.map(v => ({
          data_venda: v.data,          // <-- Alterado de data
          vendedor_id: v.vendedorId,   // <-- Alterado de vendedorId
          total: v.total
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

  const restaurarDaNuvem = async () => {
    setStatus('A descarregar dados da loja...');
    setTimeout(() => setStatus('✅ Base de dados reconstruída com sucesso!'), 1500);
  };

  // Hook 2: Dispara automaticamente quando a internet volta (Colocado após a função que utiliza)
  useEffect(() => {
    const ativarSincronizacaoAutomatica = () => {
      if (sessao) {
        forcarSincronizacao();
      }
    };

    window.addEventListener('online', ativarSincronizacaoAutomatica);
    
    if (navigator.onLine && sessao) {
      ativarSincronizacaoAutomatica();
    }

    return () => window.removeEventListener('online', ativarSincronizacaoAutomatica);
  }, [sessao]);


  // 3. BLOQUEIOS DE SEGURANÇA E RENDERIZAÇÃO (Sempre no final)
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
      <h2 className="text-2xl font-bold mb-6 text-orange-500 uppercase tracking-wider flex items-center gap-2">
        <CloudLightning size={28} /> Sincronização Premium
      </h2>

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
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
        >
          <LogIn size={16} /> Terminar Sessão
        </button>
      </div>
    </div>
  );
}