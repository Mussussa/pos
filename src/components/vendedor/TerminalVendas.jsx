import { useState, useMemo } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Printer, Trash2, Plus, Minus, Search } from 'lucide-react';

export function TerminalVendas() {
  const produtos = useLiveQuery(() => db.produtos.where('stock').above(0).toArray());
  const vendas = useLiveQuery(() => db.vendas.toArray());
  
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [pesquisa, setPesquisa] = useState('');
  const [carrinho, setCarrinho] = useState([]);

  const categorias = [
    { id: 'todas', label: 'Todas' },
    { id: 'alimentacao', label: 'Alimentação' },
    { id: 'bebidas', label: 'Bebidas' },
    { id: 'limpeza', label: 'Limpeza' },
    { id: 'diversos', label: 'Diversos' }
  ];

// 1. Calcula a contagem de vendas (Memoizado para não recalcular a cada render)
  const contagemVendas = useMemo(() => {
    const contagem = {};
    vendas?.forEach(v => {
      // PROTEÇÃO: Verifica se 'v.itens' existe E se é realmente um Array antes de fazer o forEach
      if (v.itens && Array.isArray(v.itens)) {
        v.itens.forEach(item => {
          contagem[item.produtoId] = (contagem[item.produtoId] || 0) + item.quantidade;
        });
      }
    });
    return contagem;
  }, [vendas]);

  const produtosVitrine = useMemo(() => {
    if (!produtos) return [];

    let filtrados = produtos;

    if (filtroCategoria !== 'todas') {
      filtrados = filtrados.filter(p => p.categoria === filtroCategoria);
    }

    if (pesquisa.trim() !== '') {
      const termo = pesquisa.toLowerCase().trim();
      filtrados = filtrados.filter(p => p.nome.toLowerCase().includes(termo));
    }

    return filtrados.sort((a, b) => {
      const qtdA = contagemVendas[a.id] || 0;
      const qtdB = contagemVendas[b.id] || 0;
      
      if (qtdB !== qtdA) return qtdB - qtdA;
      return a.nome.localeCompare(b.nome);
    });
  }, [produtos, filtroCategoria, pesquisa, contagemVendas]);

  const produtosMaisVendidos = useMemo(() => {
    if (!produtos) return [];
    return [...produtos]
      .sort((a, b) => (contagemVendas[b.id] || 0) - (contagemVendas[a.id] || 0))
      .slice(0, 5);
  }, [produtos, contagemVendas]);

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

  const definirQuantidadeManual = (id, valorTexto) => {
    if (valorTexto === '') {
      setCarrinho(prev => prev.map(item => item.id === id ? { ...item, quantidade: '' } : item));
      return;
    }

    const valorNumerico = parseInt(valorTexto, 10);
    if (isNaN(valorNumerico)) return;

    setCarrinho(prev => prev.map(item => {
      if (item.id === id) {
        const quantidadeAjustada = Math.min(Math.max(1, valorNumerico), item.stock);
        return { ...item, quantidade: quantidadeAjustada };
      }
      return item;
    }));
  };

  const validarQuantidadeAoSair = (id) => {
    setCarrinho(prev => prev.map(item => {
      if (item.id === id && (item.quantidade === '' || item.quantidade < 1)) {
        return { ...item, quantidade: 1 };
      }
      return item;
    }));
  };

  const removerDoCarrinho = (id) => {
    setCarrinho(prev => prev.filter(item => item.id !== id));
  };

  const totalVenda = carrinho.reduce((acc, item) => {
    const qtd = Number(item.quantidade) || 0;
    return acc + (item.precoVenda * qtd);
  }, 0);
  
  const finalizarVenda = async () => {
    if (carrinho.length === 0) return;

    const lucroTotal = carrinho.reduce((acc, item) => {
      const qtd = Number(item.quantidade) || 0;
      return acc + ((item.precoVenda - item.precoCusto) * qtd);
    }, 0);

    const novaVenda = {
      data: new Date().toISOString(),
      vendedorId: 1,
      totalVenda,
      lucroTotal,
      itens: carrinho.map(item => ({
        produtoId: item.id,
        nome: item.nome,
        quantidade: Number(item.quantidade) || 1,
        preco: item.precoVenda
      }))
    };

    try {
      await db.transaction('rw', db.produtos, db.vendas, async () => {
        await db.vendas.add(novaVenda);
        for (const item of carrinho) {
          const qtd = Number(item.quantidade) || 1;
          const prodDB = await db.produtos.get(item.id);
          await db.produtos.update(item.id, { stock: prodDB.stock - qtd });
        }
      });

      window.print();
      setCarrinho([]);

    } catch (error) {
      alert("Erro ao processar a venda.");
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-screen bg-zinc-50 text-zinc-900 font-sans relative">
      
      {/* Esquerda: Vitrine e Filtros */}
      <div className="w-full md:w-3/5 p-6 flex flex-col h-full border-r border-zinc-200 print:hidden">
        
        {/* Letreiro de Giro */}
        <div className="mb-6 bg-white border border-orange-200 rounded-xl p-4 overflow-hidden shadow-sm flex items-center gap-4">
          <span className="bg-orange-500 text-white text-sm font-bold uppercase px-3 py-2 rounded shrink-0 animate-pulse">
            🔥 Mais Procurados
          </span>
          <div className="flex overflow-x-auto gap-8 whitespace-nowrap text-base text-zinc-600 no-scrollbar items-center">
            {produtosMaisVendidos.length > 0 ? (
              produtosMaisVendidos.map(p => (
                <span key={p.id} className="cursor-pointer hover:text-orange-600 font-medium transition-colors" onClick={() => adicionarAoCarrinho(p)}>
                  ⭐ <strong className="text-lg">{p.nome}</strong> <span className="text-zinc-400">({p.precoVenda.toFixed(2)} MT)</span>
                </span>
              ))
            ) : (
              <span className="text-zinc-400">Sem registos de vendas recentes.</span>
            )}
          </div>
        </div>

        {/* Cabeçalho */}
        <div className="flex flex-col gap-6 mb-6">
          <h2 className="text-3xl font-black text-orange-500 uppercase tracking-wider">Terminal POS - Vulpe Mart</h2>

          {/* Cards de Categorias */}
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {categorias.map(cat => {
              const selecionada = filtroCategoria === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFiltroCategoria(cat.id)}
                  className={`px-6 py-4 rounded-2xl text-lg font-bold border-2 transition-all shrink-0 shadow-sm ${
                    selecionada
                      ? 'bg-orange-500 text-white border-orange-500 shadow-orange-200'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-orange-400 hover:text-orange-600'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Barra de Pesquisa */}
          <div className="relative">
            <Search className="absolute left-4 top-4 text-zinc-400" size={24} />
            <input 
              type="text"
              placeholder="Pesquisar artigo pelo nome (Ex: Arroz)..."
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              className="w-full bg-white border-2 border-zinc-300 text-zinc-900 placeholder-zinc-400 pl-14 pr-6 py-4 text-xl rounded-2xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Vitrine de Produtos */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 overflow-y-auto pr-2 max-h-[60vh] pb-10 custom-scrollbar">
          {produtosVitrine?.map(p => (
            <button 
              key={p.id}
              onClick={() => adicionarAoCarrinho(p)}
              className="bg-white border-2 border-zinc-200 p-5 rounded-2xl shadow-sm hover:border-orange-500 hover:shadow-lg transition-all text-left flex flex-col justify-between min-h-[160px] active:scale-95 group"
            >
              <div>
                <span className="text-xs text-orange-700 bg-orange-100 px-3 py-1 rounded-md font-bold uppercase">{p.categoria}</span>
                <h3 className="font-bold text-zinc-800 text-xl leading-tight mt-4 line-clamp-2 group-hover:text-orange-600 transition-colors">{p.nome}</h3>
              </div>
              <div className="flex justify-between items-end mt-4 w-full">
                <span className="text-sm font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded">Stk: {p.stock}</span>
                <span className="font-black text-orange-600 text-2xl">{p.precoVenda.toFixed(2)} <span className="text-base text-orange-400">MT</span></span>
              </div>
            </button>
          ))}
          {produtosVitrine?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-16 text-zinc-400 border-2 border-dashed border-zinc-300 rounded-2xl bg-white">
              <Search size={48} className="mb-4 opacity-30" />
              <p className="text-xl font-medium">Nenhum artigo encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Direita: Carrinho */}
      <div className="w-full md:w-2/5 bg-white border-l-2 border-zinc-200 p-6 flex flex-col h-full shadow-2xl z-10 print:hidden">
        <h3 className="text-3xl font-black text-zinc-800 mb-6 flex items-center gap-3">
          <ShoppingCart className="text-orange-500" size={32} /> Carrinho Atual
        </h3>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {carrinho.map(item => (
            <div key={item.id} className="bg-zinc-50 p-5 rounded-2xl border-2 border-zinc-200 flex flex-col gap-4 hover:border-zinc-300 transition-colors">
              <div className="flex justify-between items-start">
                <span className="font-bold text-zinc-900 text-xl leading-tight pr-4">{item.nome}</span>
                <span className="font-black text-orange-600 text-2xl whitespace-nowrap">{(item.precoVenda * (Number(item.quantidade) || 0)).toFixed(2)} MT</span>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-lg font-bold text-zinc-500">{item.precoVenda.toFixed(2)} / un</span>
                
                {/* Controlo de Quantidade Aumentado */}
                <div className="flex items-center gap-2 bg-white border-2 border-zinc-200 rounded-xl p-1.5 shadow-sm">
                  <button 
                    type="button"
                    onClick={() => alterarQuantidade(item.id, -1)} 
                    disabled={Number(item.quantidade) <= 1}
                    className="text-zinc-600 hover:text-white hover:bg-orange-500 rounded-lg p-2 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-600"
                  >
                    <Minus size={24} strokeWidth={3} />
                  </button>
                  
                  <input
                    type="number"
                    min="1"
                    max={item.stock}
                    value={item.quantidade}
                    onChange={(e) => definirQuantidadeManual(item.id, e.target.value)}
                    onBlur={() => validarQuantidadeAoSair(item.id)}
                    className="w-16 text-center text-zinc-900 font-black text-xl bg-zinc-50 rounded-lg border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none py-1.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  <button 
                    type="button"
                    onClick={() => alterarQuantidade(item.id, 1)} 
                    disabled={Number(item.quantidade) >= item.stock}
                    className="text-zinc-600 hover:text-white hover:bg-orange-500 rounded-lg p-2 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-600"
                  >
                    <Plus size={24} strokeWidth={3} />
                  </button>

                  <div className="w-px h-8 bg-zinc-300 mx-2"></div>
                  
                  <button 
                    type="button"
                    onClick={() => removerDoCarrinho(item.id)} 
                    className="text-red-500 hover:text-white hover:bg-red-500 rounded-lg p-2 transition-colors"
                  >
                    <Trash2 size={24} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {carrinho.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-zinc-300">
              <ShoppingCart size={80} className="mb-6 opacity-30" />
              <p className="text-2xl font-bold">Carrinho vazio.</p>
            </div>
          )}
        </div>

        <div className="mt-6 border-t-2 border-zinc-200 pt-6 bg-white">
          <div className="flex justify-between items-end mb-6 bg-zinc-100 p-6 rounded-2xl border-2 border-zinc-200">
            <span className="text-lg font-black text-zinc-500 uppercase">Total a Pagar</span>
            <span className="text-5xl font-black text-zinc-900 leading-none tracking-tight">{totalVenda.toFixed(2)} <span className="text-2xl font-bold text-zinc-500">MT</span></span>
          </div>
          
          <button 
            onClick={finalizarVenda}
            disabled={carrinho.length === 0}
            className="w-full bg-orange-500 text-white font-black py-6 rounded-2xl flex justify-center items-center gap-4 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 transition-all text-2xl shadow-lg active:scale-95"
          >
            <Printer size={32} /> Finalizar e Imprimir
          </button>
        </div>
      </div>

      {/* Recibo Térmico de Impressão */}
      <div className="hidden print:block absolute top-0 left-0 bg-white text-black p-4 font-mono w-[80mm] text-sm mx-auto">
        <div className="text-center">
          <h2 className="font-bold text-xl uppercase mb-1">VULPE MART</h2>
          <h3 className="font-bold text-sm uppercase mb-1">MERCEARIA E CONVENIÊNCIA</h3>
          <p className="text-xs mb-4">Chimoio, Manica. Contacto: 845773342.</p>
          
          <p className="text-xs text-left mb-4">
            Data: {new Date().toLocaleString('pt-MZ')}<br/>
            Op: Vendedor
          </p>

          <div className="border-t border-black border-dashed my-2"></div>
          
          <table className="w-full text-left text-xs mb-2">
            <thead>
              <tr>
                <th className="pb-1 w-8">Qtd</th>
                <th className="pb-1">Artigo</th>
                <th className="pb-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {carrinho.map((item, idx) => (
                <tr key={idx}>
                  <td className="align-top font-bold">{Number(item.quantidade) || 1}x</td>
                  <td className="align-top pr-1">{item.nome}</td>
                  <td className="align-top text-right">{(item.precoVenda * (Number(item.quantidade) || 1)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-black border-dashed my-2"></div>
          
          <div className="flex justify-between font-bold text-base mb-4 mt-2">
            <span>TOTAL MT:</span>
            <span>{totalVenda.toFixed(2)}</span>
          </div>

          <p className="text-xs text-center mt-8">Obrigado pela preferência!</p>
        </div>
      </div>

    </div>
  );
}