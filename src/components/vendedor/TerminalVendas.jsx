import { useState } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Printer, Trash2, Plus, Minus } from 'lucide-react';

export function TerminalVendas() {
  const produtos = useLiveQuery(() => db.produtos.where('stock').above(0).toArray());
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [carrinho, setCarrinho] = useState([]);

  const produtosVitrine = produtos?.filter(p => 
    filtroCategoria === 'todas' ? true : p.categoria === filtroCategoria
  );

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
      // 1. Grava na base de dados e abate o stock
      await db.transaction('rw', db.produtos, db.vendas, async () => {
        await db.vendas.add(novaVenda);
        for (const item of carrinho) {
          const prodDB = await db.produtos.get(item.id);
          await db.produtos.update(item.id, { stock: prodDB.stock - item.quantidade });
        }
      });

      // 2. Dispara a impressão imediatamente (O navegador congela a tela enquanto o diálogo de impressão está aberto)
      window.print();

      // 3. Só limpa o carrinho depois da impressão ser concluída/cancelada
      setCarrinho([]);

    } catch (error) {
      alert("Erro ao processar a venda.");
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-screen bg-zinc-950 text-zinc-100 relative">
      
      {/* ---------------------------------------------------- */}
      {/* INTERFACE DA LOJA (Oculta na impressão: print:hidden) */}
      {/* ---------------------------------------------------- */}
      
      {/* Esquerda: Lista de Produtos */}
      <div className="w-full md:w-2/3 p-6 flex flex-col h-full border-r border-zinc-800 print:hidden">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-red-500 uppercase tracking-wider">Terminal POS</h2>
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
      <div className="w-full md:w-1/3 bg-zinc-900 p-6 flex flex-col h-full shadow-2xl z-10 print:hidden">
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
            <Printer /> Finalizar e Imprimir
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* RECIBO TÉRMICO (Mostra SÓ na impressão: hidden print:block) */}
      {/* ---------------------------------------------------- */}
      <div className="hidden print:block absolute top-0 left-0 bg-white text-black p-4 font-mono w-[80mm] text-sm mx-auto">
        <div className="text-center">
          <h2 className="font-bold text-xl uppercase mb-1">AUTO CENTER</h2>
          <h3 className="font-bold text-l uppercase mb-1">MOTO PEÇAS</h3>
          <p className="text-xs mb-4">Nuit 107917683. Contacto. 845773342.  MERCEARIA MISTO.</p>
          
          <p className="text-xs text-left mb-4">
            Data: {new Date().toLocaleString('pt-MZ')}<br/>
            Op: Vendedor #1
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
                  <td className="align-top font-bold">{item.quantidade}x</td>
                  <td className="align-top pr-1">{item.nome}</td>
                  <td className="align-top text-right">{(item.precoVenda * item.quantidade).toFixed(2)}</td>
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