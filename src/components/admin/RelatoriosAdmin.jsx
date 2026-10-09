import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

// ==========================================
// MÓDULO: SIMULADOR DE PREÇO MÍNIMO (TEMA CLARO VULPE)
// ==========================================
function ModuloPrecoMinimo({ produtos }) {
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  // Filtra produtos pela pesquisa e calcula as páginas (useMemo para performance com centenas de itens)
  const { produtosFiltrados, totalPaginas, produtosPaginados } = useMemo(() => {
    if (!produtos) return { produtosFiltrados: [], totalPaginas: 0, produtosPaginados: [] };
    
    const filtrados = produtos.filter(p => 
      p.nome.toLowerCase().includes(busca.toLowerCase())
    );
    
    const paginas = Math.ceil(filtrados.length / itensPorPagina);
    const paginados = filtrados.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);
    
    return { produtosFiltrados: filtrados, totalPaginas: paginas, produtosPaginados: paginados };
  }, [produtos, busca, paginaAtual]);

  if (!produtos || produtos.length === 0) return null;

  return (
    <div className="mt-8 p-6 bg-white border border-zinc-200 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-orange-500 mb-2">Simulador de Preço Mínimo</h3>
          <p className="text-sm text-zinc-500">
            Margem de segurança de 10%. (Mostrando {produtosFiltrados.length} produtos)
          </p>
        </div>
        
        {/* Barra de Pesquisa */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            placeholder="Pesquisar produto..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPaginaAtual(1); // Volta à primeira página ao pesquisar
            }}
            className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-zinc-50 text-zinc-900"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left bg-white rounded border border-zinc-200">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700">
            <tr>
              <th className="p-3 font-semibold">Produto</th>
              <th className="p-3 font-semibold">Custo de Compra</th>
              <th className="p-3 font-semibold text-orange-600">Preço Mínimo (+10%)</th>
              <th className="p-3 font-semibold">Preço Atual de Venda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {produtosPaginados.map(p => {
              const precoMinimo = p.precoCusto * 1.10; 
              const alertaPrejuizo = p.precoVenda < precoMinimo;

              return (
                <tr key={p.id} className="hover:bg-orange-50 transition-colors">
                  <td className="p-3 text-zinc-800 font-medium">{p.nome}</td>
                  <td className="p-3 text-zinc-500">{p.precoCusto.toFixed(2)} MT</td>
                  <td className="p-3 font-bold text-orange-500">{precoMinimo.toFixed(2)} MT</td>
                  <td className={`p-3 font-bold ${alertaPrejuizo ? 'text-red-500' : 'text-zinc-800'}`}>
                    {p.precoVenda.toFixed(2)} MT 
                    {alertaPrejuizo && (
                      <span className="ml-2 text-xs font-normal border border-red-200 bg-red-50 px-2 py-1 rounded text-red-600">
                        Risco de Prejuízo
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {produtosPaginados.length === 0 && (
              <tr>
                <td colSpan="4" className="p-6 text-center text-zinc-500">Nenhum produto encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Controlos de Paginação */}
      {totalPaginas > 1 && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-100">
          <span className="text-sm text-zinc-500">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
              disabled={paginaAtual === 1}
              className="p-2 border border-zinc-200 rounded text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
              disabled={paginaAtual === totalPaginas}
              className="p-2 border border-zinc-200 rounded text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ==========================================

export function RelatoriosAdmin() {
  const vendas = useLiveQuery(() => db.vendas.orderBy('data').reverse().toArray());
  const produtos = useLiveQuery(() => db.produtos.toArray());

  // 1. Cálculos Gerais dos Cartões
  const totalReceitas = vendas?.reduce((acc, venda) => acc + (venda.totalVenda || 0), 0) || 0;
  const totalLucro = vendas?.reduce((acc, venda) => acc + (venda.lucroTotal || 0), 0) || 0;
  const numeroVendas = vendas?.length || 0;

  // 2. Processamento de Dados para Gráfico: Categorias
  const categoriasMap = {
    alimentacao: { name: 'Alimentação', stock: 0, vendido: 0 },
    bebidas: { name: 'Bebidas', stock: 0, vendido: 0 },
    limpeza: { name: 'Limpeza', stock: 0, vendido: 0 },
    diversos: { name: 'Diversos', stock: 0, vendido: 0 }
  };
  
  const prodCat = {};
  produtos?.forEach(p => {
    prodCat[p.id] = p.categoria;
    if (categoriasMap[p.categoria]) {
      categoriasMap[p.categoria].stock += p.stock;
    }
  });

  vendas?.forEach(v => {
    v.itens?.forEach(item => {
      const cat = prodCat[item.produtoId];
      if (cat && categoriasMap[cat]) {
        categoriasMap[cat].vendido += item.quantidade;
      }
    });
  });
  const dadosCategorias = Object.values(categoriasMap);

  // 3. Processamento de Dados para Gráfico: Top Produtos
  const contagemProdutos = {};
  vendas?.forEach(v => {
    v.itens?.forEach(item => {
      if (!contagemProdutos[item.nome]) contagemProdutos[item.nome] = 0;
      contagemProdutos[item.nome] += item.quantidade;
    });
  });
  const dadosTopProdutos = Object.entries(contagemProdutos)
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5); // Mantém os top 5 para o gráfico não ficar ilegível

  // 4. Processamento de Dados para Gráfico Extra: Evolução Diária
  const vendasPorDia = {};
   [...(vendas || [])].reverse().forEach(v => {
    const dataCurta = new Date(v.data).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit' });
    if (!vendasPorDia[dataCurta]) vendasPorDia[dataCurta] = { data: dataCurta, receita: 0, lucro: 0 };
    vendasPorDia[dataCurta].receita += v.totalVenda;
    vendasPorDia[dataCurta].lucro += v.lucroTotal;
  });
  const dadosEvolucao = Object.values(vendasPorDia);

  // Estilo do Tooltip adaptado para tema claro
  const customTooltipStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: '8px',
    color: '#18181b',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div className="p-6 bg-zinc-50 min-h-full text-zinc-900 font-sans">
      <h2 className="text-2xl font-bold mb-6 text-orange-500 uppercase tracking-wider">Painel de Desempenho - Vulpe Mart</h2>

      {/* Cartões de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
          <p className="text-zinc-500 text-sm font-semibold uppercase">Receita Bruta (Entradas)</p>
          <p className="text-3xl font-bold text-zinc-800 mt-2">{totalReceitas.toFixed(2)} MT</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
          <p className="text-zinc-500 text-sm font-semibold uppercase">Lucro Líquido</p>
          <p className="text-3xl font-bold text-orange-500 mt-2">{totalLucro.toFixed(2)} MT</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
          <p className="text-zinc-500 text-sm font-semibold uppercase">Total de Transações</p>
          <p className="text-3xl font-bold text-zinc-800 mt-2">{numeroVendas}</p>
        </div>
      </div>

      {/* Área dos Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Gráfico 1: Categorias */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
          <h3 className="font-bold text-zinc-800 mb-6">Desempenho por Categoria</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosCategorias}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" tick={{fill: '#71717a'}} />
                <YAxis stroke="#71717a" tick={{fill: '#71717a'}} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="stock" name="Em Stock" fill="#52525b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="vendido" name="Vendido" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top Produtos */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
          <h3 className="font-bold text-zinc-800 mb-6">Top 5 Produtos Mais Vendidos</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosTopProdutos} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" stroke="#71717a" tick={{fill: '#71717a'}} />
                <YAxis dataKey="nome" type="category" stroke="#71717a" tick={{fill: '#71717a'}} width={100} />
                <Tooltip contentStyle={customTooltipStyle} cursor={{fill: '#f4f4f5'}} />
                <Bar dataKey="quantidade" name="Unid. Vendidas" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Evolução de Vendas */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200 lg:col-span-2">
          <h3 className="font-bold text-zinc-800 mb-6">Evolução de Receitas e Lucro</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosEvolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="data" stroke="#71717a" tick={{fill: '#71717a'}} />
                <YAxis stroke="#71717a" tick={{fill: '#71717a'}} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="receita" name="Receita Bruta" stroke="#52525b" strokeWidth={3} dot={{ r: 4, fill: '#52525b' }} />
                <Line type="monotone" dataKey="lucro" name="Lucro Líquido" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Simulador de Preços com Paginação e Pesquisa */}
      <ModuloPrecoMinimo produtos={produtos} />

    </div>
  );
}