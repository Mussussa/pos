import { useState, useMemo } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Check, Trash2, Plus, Minus, History, X, ChevronLeft, ChevronRight } from 'lucide-react';

export function TerminalVendas() {
  const produtos = useLiveQuery(() => db.produtos.where('stock').above(0).toArray());
  const vendas = useLiveQuery(() => db.vendas.toArray());

  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [carrinho, setCarrinho] = useState([]);

  // Estados para o Histórico de Vendas
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const itensPorPaginaHistorico = 15;

  const produtosVitrine = produtos?.filter(p => 
    filtroCategoria === 'todas' ? true : p.categoria === filtroCategoria
  );

  // Lógica do Histórico Paginado
  const vendasOrdenadas = useMemo(() => {
    if (!vendas) return [];
    return [...vendas].sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [vendas]);

  const totalPaginasHistorico = Math.ceil(vendasOrdenadas.length / itensPorPaginaHistorico);
  const historicoPaginado = useMemo(() => {
    const inicio = (paginaHistorico - 1) * itensPorPaginaHistorico;
    return vendasOrdenadas.slice(inicio, inicio + itensPorPaginaHistorico);
  }, [vendasOrdenadas, paginaHistorico]);

  const adicionarAoCarrinho = (produto) => {
    setCarrinho(prev => {
      const existe = prev.find(item => item.id === produto.id);
      if (existe) {
        if (existe.quantidade >= produto.stock) return prev;
        return prev.map(item => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      }
      return [...prev, { ...produto, quantidade: 1 }];
    });
  };

  const alterarQuantidade = (id, delta) => {
    setCarrinho(prev => prev.map(item => {
      if (item.id === id) {
        const novaQtd = item.quantidade + delta;
        if (novaQtd > 0 && novaQtd <= item.stock) return { ...item, quantidade: novaQtd };
      }
      return item;
    }));
  };

  const removerDoCarrinho = (id) => {
    setCarrinho(prev => prev.filter(item => item.id !== id));
  };

  const totalVenda = carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0);
  
  const finalizarVenda = async () => {
    if (carrinho.length === 0) return;

    const lucroTotal = carrinho.reduce((acc, item) => {
      return acc + ((item.precoVenda - item.precoCusto) * item.quantidade);
    }, 0);

    const novaVenda = {
      data: new Date().toISOString(),
      vendedorId: 1,
      totalVenda,
      lucroTotal,
      itens: carrinho.map(item => ({
        produtoId: item.id,
        nome: item.nome,
        quantidade: item.quantidade,
        preco: item.precoVenda
      }))
    };

    try {
      // Grava na base de dados e abate o stock
      await db.transaction('rw', db.produtos, db.vendas, async () => {
        await db.vendas.add(novaVenda);
        for (const item of carrinho) {
          const prodDB = await db.produtos.get(item.id);
          await db.produtos.update(item.id, { stock: prodDB.stock - item.quantidade });
        }
      });

      // Limpa o carrinho e avisa do sucesso, sem imprimir
      setCarrinho([]);
      alert("Venda registada com sucesso!");

    } catch (error) {
      alert("Erro ao processar a venda.");
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-screen bg-zinc-950 text-zinc-100 relative">
      
      {/* ========================================= */}
      {/* MODAL DE HISTÓRICO DE VENDAS */}
      {/* ========================================= */}
      {mostrarHistorico && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900">
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <History className="text-red-500" /> Histórico de Vendas Diário
              </h2>
              <button onClick={() => setMostrarHistorico(false)} className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-950/30 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-900 text-zinc-400 sticky top-0 shadow-sm text-sm">
                  <tr>
                    <th className="p-4 font-semibold rounded-tl-lg">Data e Hora</th>
                    <th className="p-4 font-semibold">Artigos Faturados</th>
                    <th className="p-4 font-semibold text-right rounded-tr-lg">Valor Cobrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-sm">
                  {historicoPaginado.map(v => (
                    <tr key={v.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="p-4 text-zinc-300 whitespace-nowrap">
                        {new Date(v.data).toLocaleString('pt-MZ', { 
                          day: '2-digit', month: '2-digit', year: 'numeric', 
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4 text-zinc-400">
                        <ul className="list-disc list-inside">
                          {v.itens?.map((i, idx) => (
                            <li key={idx}>{i.quantidade}x {i.nome}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-4 font-bold text-red-500 text-right">{v.totalVenda.toFixed(2)} MT</td>
                    </tr>
                  ))}
                  {historicoPaginado.length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-8 text-center text-zinc-500">Sem histórico de vendas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPaginasHistorico > 1 && (
              <div className="flex justify-between items-center p-4 border-t border-zinc-800 bg-zinc-900">
                <span className="text-sm text-zinc-500">
                  Página {paginaHistorico} de {totalPaginasHistorico} ({vendasOrdenadas.length} registos totais)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaginaHistorico(prev => Math.max(prev - 1, 1))}
                    disabled={paginaHistorico === 1}
                    className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-400 hover:border-red-500 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => setPaginaHistorico(prev => Math.min(prev + 1, totalPaginasHistorico))}
                    disabled={paginaHistorico === totalPaginasHistorico}
                    className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-400 hover:border-red-500 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Esquerda: Lista de Produtos */}
      <div className="w-full md:w-2/3 p-6 flex flex-col h-full border-r border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-red-500 uppercase tracking-wider">Terminal POS</h2>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMostrarHistorico(true)}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold py-2 px-4 rounded border border-zinc-700 transition-colors"
            >
              <History size={18} /> Histórico
            </button>
            <select 
              value={filtroCategoria} 
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-zinc-300 p-2 rounded focus:border-red-500 outline-none"
            >
              <option value="todas">Todas as Categorias</option>
              <option value="peca">Peças de Mota</option>
              <option value="chinelo">Chinelos</option>
              <option value="mexa">Mexas</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2">
          {produtosVitrine?.map(p => (
            <button 
              key={p.id}
              onClick={() => adicionarAoCarrinho(p)}
              className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-red-500 hover:shadow-[0_0_15px_rgba(220,38,38,0.2)] transition-all text-left flex flex-col justify-between h-32 active:scale-95"
            >
              <div>
                <span className="text-xs text-red-500 font-bold uppercase">{p.categoria}</span>
                <h3 className="font-bold text-zinc-200 leading-tight mt-1 truncate">{p.nome}</h3>
              </div>
              <div className="flex justify-between items-end mt-2">
                <span className="text-xs text-zinc-500">Stk: {p.stock}</span>
                <span className="font-bold text-zinc-100">{p.precoVenda.toFixed(2)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Direita: Carrinho */}
      <div className="w-full md:w-1/3 bg-zinc-900 p-6 flex flex-col h-full shadow-2xl z-10">
        <h3 className="text-xl font-bold text-zinc-100 mb-6 flex items-center gap-2">
          <ShoppingCart className="text-red-500" /> Carrinho Atual
        </h3>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {carrinho.map(item => (
            <div key={item.id} className="bg-zinc-950 p-3 rounded border border-zinc-800 flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="font-bold text-zinc-200 truncate pr-2">{item.nome}</span>
                <span className="font-bold text-red-500">{(item.precoVenda * item.quantidade).toFixed(2)} MT</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">{item.precoVenda.toFixed(2)} MT / un</span>
                <div className="flex items-center gap-3 bg-zinc-900 rounded p-1">
                  <button onClick={() => alterarQuantidade(item.id, -1)} className="text-zinc-400 hover:text-red-500 p-1"><Minus size={16}/></button>
                  <span className="font-bold w-6 text-center">{item.quantidade}</span>
                  <button onClick={() => alterarQuantidade(item.id, 1)} className="text-zinc-400 hover:text-red-500 p-1"><Plus size={16}/></button>
                  <button onClick={() => removerDoCarrinho(item.id)} className="text-zinc-600 hover:text-red-500 p-1 ml-2"><Trash2 size={16}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-zinc-800 pt-6">
          <div className="flex justify-between items-center mb-6">
            <span className="text-lg text-zinc-400">Total a Pagar</span>
            <span className="text-3xl font-bold text-zinc-100">{totalVenda.toFixed(2)} MT</span>
          </div>
          
          <button 
            onClick={finalizarVenda}
            disabled={carrinho.length === 0}
            className="w-full bg-red-600 text-white font-bold py-4 rounded-lg flex justify-center items-center gap-2 hover:bg-red-700 disabled:opacity-50 transition-colors text-lg"
          >
            <Check size={20} /> Finalizar Venda
          </button>
        </div>
      </div>

    </div>
  );
}