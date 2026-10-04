import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

// ==========================================
// MÓDULO: SIMULADOR DE PREÇO MÍNIMO (TEMA DARK)
// ==========================================
function ModuloPrecoMinimo({ produtos }) {
  if (!produtos || produtos.length === 0) return null;

  return (
    <div className="mt-8 p-6 bg-zinc-900 border border-red-900/30 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-red-500 mb-2">Simulador de Preço Mínimo (Margem de Segurança)</h3>
      <p className="text-sm text-zinc-400 mb-6">
        Calcula o valor mínimo a que podes vender um produto para garantir lucro, 
        aplicando uma taxa de margem mínima de segurança de 10%.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left bg-zinc-950 rounded border border-zinc-800">
          <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-300">
            <tr>
              <th className="p-3">Produto</th>
              <th className="p-3">Custo de Compra</th>
              <th className="p-3 text-red-500">Preço Mínimo (Lucro de 10%)</th>
              <th className="p-3">Preço Atual de Venda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {produtos.map(p => {
              const precoMinimo = p.precoCusto * 1.10; 
              const alertaPrejuizo = p.precoVenda < precoMinimo;

              return (
                <tr key={p.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="p-3 text-zinc-200">{p.nome}</td>
                  <td className="p-3 text-zinc-400">{p.precoCusto.toFixed(2)} MT</td>
                  <td className="p-3 font-bold text-red-500">{precoMinimo.toFixed(2)} MT</td>
                  <td className={`p-3 font-bold ${alertaPrejuizo ? 'text-orange-500 animate-pulse' : 'text-zinc-200'}`}>
                    {p.precoVenda.toFixed(2)} MT 
                    {alertaPrejuizo && <span className="ml-2 text-xs font-normal border border-orange-500/50 px-2 py-1 rounded text-orange-400">Risco</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

  // 2. Processamento de Dados para Gráfico: Categorias (Stock vs Vendido)
  const categoriasMap = {
    peca: { name: 'Peças', stock: 0, vendido: 0 },
    chinelo: { name: 'Chinelos', stock: 0, vendido: 0 },
    mexa: { name: 'Mexas', stock: 0, vendido: 0 }
  };
  
  // Mapeia qual produto pertence a que categoria para cruzar com as vendas
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

  // 3. Processamento de Dados para Gráfico: Top Produtos Mais Vendidos
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
    .slice(0, 5); // Apenas os 5 mais vendidos

  // 4. Processamento de Dados para Gráfico Extra: Evolução Diária
  const vendasPorDia = {};
  [...(vendas || [])].reverse().forEach(v => {
    const dataCurta = new Date(v.data).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit' });
    if (!vendasPorDia[dataCurta]) vendasPorDia[dataCurta] = { data: dataCurta, receita: 0, lucro: 0 };
    vendasPorDia[dataCurta].receita += v.totalVenda;
    vendasPorDia[dataCurta].lucro += v.lucroTotal;
  });
  const dadosEvolucao = Object.values(vendasPorDia);

  // Customização visual dos tooltips dos gráficos (para manter o tema Dark)
  const customTooltipStyle = {
    backgroundColor: '#09090b', // zinc-950
    border: '1px solid #27272a', // zinc-800
    borderRadius: '8px',
    color: '#f4f4f5' // zinc-100
  };

  return (
    <div className="p-6 bg-zinc-950 min-h-full text-zinc-100">
      <h2 className="text-2xl font-bold mb-6 text-red-500 uppercase tracking-wider">Painel de Desempenho</h2>

      {/* Cartões de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 p-6 rounded-lg shadow-lg border border-zinc-800">
          <p className="text-zinc-400 text-sm font-semibold uppercase">Receita Bruta (Entradas)</p>
          <p className="text-3xl font-bold text-zinc-100 mt-2">{totalReceitas.toFixed(2)} MT</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-lg shadow-lg border border-zinc-800">
          <p className="text-zinc-400 text-sm font-semibold uppercase">Lucro Líquido</p>
          <p className="text-3xl font-bold text-red-500 mt-2">{totalLucro.toFixed(2)} MT</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-lg shadow-lg border border-zinc-800">
          <p className="text-zinc-400 text-sm font-semibold uppercase">Total de Transações</p>
          <p className="text-3xl font-bold text-zinc-100 mt-2">{numeroVendas}</p>
        </div>
      </div>

      {/* Área dos Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Gráfico 1: Categorias (Stock vs Vendido) */}
        <div className="bg-zinc-900 p-6 rounded-lg shadow-lg border border-zinc-800">
          <h3 className="font-bold text-zinc-300 mb-6">Desempenho por Categoria (Stock vs Vendido)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosCategorias}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#a1a1aa" tick={{fill: '#a1a1aa'}} />
                <YAxis stroke="#a1a1aa" tick={{fill: '#a1a1aa'}} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="stock" name="Em Stock" fill="#52525b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="vendido" name="Vendido" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top Produtos */}
        <div className="bg-zinc-900 p-6 rounded-lg shadow-lg border border-zinc-800">
          <h3 className="font-bold text-zinc-300 mb-6">Top 5 Produtos Mais Vendidos</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosTopProdutos} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" stroke="#a1a1aa" tick={{fill: '#a1a1aa'}} />
                <YAxis dataKey="nome" type="category" stroke="#a1a1aa" tick={{fill: '#a1a1aa'}} width={100} />
                <Tooltip contentStyle={customTooltipStyle} cursor={{fill: '#27272a'}} />
                <Bar dataKey="quantidade" name="Unid. Vendidas" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Evolução de Vendas (Contexto Adicional) */}
        <div className="bg-zinc-900 p-6 rounded-lg shadow-lg border border-zinc-800 lg:col-span-2">
          <h3 className="font-bold text-zinc-300 mb-6">Evolução de Receitas e Lucro</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosEvolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="data" stroke="#a1a1aa" tick={{fill: '#a1a1aa'}} />
                <YAxis stroke="#a1a1aa" tick={{fill: '#a1a1aa'}} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="receita" name="Receita Bruta" stroke="#52525b" strokeWidth={3} dot={{ r: 4, fill: '#52525b' }} />
                <Line type="monotone" dataKey="lucro" name="Lucro Líquido" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <ModuloPrecoMinimo produtos={produtos} />

    </div>
  );
}