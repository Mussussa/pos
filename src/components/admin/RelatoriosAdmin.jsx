import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { Search, ChevronLeft, ChevronRight, FileText, Download, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==========================================
// MÓDULO: SIMULADOR DE PREÇO MÍNIMO (TEMA CLARO VULPE)
// ==========================================
function ModuloPrecoMinimo({ produtos }) {
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

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
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            placeholder="Pesquisar produto..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPaginaAtual(1);
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
              const precoMinimo = Number(p.precoCusto || 0) * 1.10; 
              const precoVendaAtual = Number(p.precoVenda || 0);
              const alertaPrejuizo = precoVendaAtual < precoMinimo;

              return (
                <tr key={p.id} className="hover:bg-orange-50 transition-colors">
                  <td className="p-3 text-zinc-800 font-medium">{p.nome}</td>
                  <td className="p-3 text-zinc-500">{Number(p.precoCusto || 0).toFixed(2)} MT</td>
                  <td className="p-3 font-bold text-orange-500">{precoMinimo.toFixed(2)} MT</td>
                  <td className={`p-3 font-bold ${alertaPrejuizo ? 'text-red-500' : 'text-zinc-800'}`}>
                    {precoVendaAtual.toFixed(2)} MT 
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
// MÓDULO PRINCIPAL: RELATÓRIOS E HISTÓRICO
// ==========================================
export function RelatoriosAdmin() {
  const [filtroTempo, setFiltroTempo] = useState('tudo');
  
  const vendasRaw = useLiveQuery(() => db.vendas.orderBy('data').reverse().toArray());
  const produtos = useLiveQuery(() => db.produtos.toArray());
  const dadosLotes = useLiveQuery(async () => {
    const registros = await db.lotes.toArray();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return { registros, hoje };
  });
  const lotes = dadosLotes?.registros;
  const hojeValidade = dadosLotes?.hoje;

  // 1. Lógica de Filtragem de Datas
  const vendas = useMemo(() => {
    if (!vendasRaw) return [];
    
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioOntem = new Date(inicioHoje);
    inicioOntem.setDate(inicioOntem.getDate() - 1);
    const inicio7Dias = new Date(inicioHoje);
    inicio7Dias.setDate(inicio7Dias.getDate() - 7);

    return vendasRaw.filter(v => {
      const dataVenda = new Date(v.data || v.data_venda); // Garante suporte a ambas propriedades de data
      if (filtroTempo === 'hoje') return dataVenda >= inicioHoje;
      if (filtroTempo === 'ontem') return dataVenda >= inicioOntem && dataVenda < inicioHoje;
      if (filtroTempo === '7dias') return dataVenda >= inicio7Dias;
      return true; // 'tudo'
    });
  }, [vendasRaw, filtroTempo]);

  // 2. Cálculos Gerais (CORRIGIDO com .total || .totalVenda)
  const totalReceitas = vendas.reduce((acc, venda) => acc + Number(venda.total || venda.totalVenda || 0), 0);
  const totalLucro = vendas.reduce((acc, venda) => acc + Number(venda.lucroTotal || 0), 0);
  const numeroVendas = vendas.length;

  // 3. Processamento para Gráficos
  const categoriasMap = {
    alimentacao: { name: 'Alimentação', stock: 0, vendido: 0 },
    bebidas: { name: 'Bebidas', stock: 0, vendido: 0 },
    limpeza: { name: 'Limpeza', stock: 0, vendido: 0 },
    diversos: { name: 'Diversos', stock: 0, vendido: 0 }
  };
  
  const prodCat = {};
  produtos?.forEach(p => {
    prodCat[p.id] = p.categoria;
    if (categoriasMap[p.categoria]) categoriasMap[p.categoria].stock += Number(p.stock || 0);
  });

  const contagemProdutos = {};
  vendas.forEach(v => {
    v.itens?.forEach(item => {
      const cat = prodCat[item.produtoId];
      if (cat && categoriasMap[cat]) categoriasMap[cat].vendido += Number(item.quantidade || 0);
      
      if (!contagemProdutos[item.nome]) contagemProdutos[item.nome] = 0;
      contagemProdutos[item.nome] += Number(item.quantidade || 0);
    });
  });

  const dadosCategorias = Object.values(categoriasMap);
  const dadosTopProdutos = Object.entries(contagemProdutos)
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  const vendasPorDia = {};
  [...vendas].reverse().forEach(v => {
    const dataCurta = new Date(v.data || v.data_venda).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit' });
    if (!vendasPorDia[dataCurta]) vendasPorDia[dataCurta] = { data: dataCurta, receita: 0, lucro: 0 };
    vendasPorDia[dataCurta].receita += Number(v.total || v.totalVenda || 0);
    vendasPorDia[dataCurta].lucro += Number(v.lucroTotal || 0);
  });
  const dadosEvolucao = Object.values(vendasPorDia);
  const alertasValidade = useMemo(() => {
    if (!hojeValidade) return [];
    return (lotes || [])
      .filter(lote => lote.validade && Number(lote.quantidade) > 0)
      .map(lote => {
        const dataValidade = new Date(`${lote.validade}T00:00:00`);
        const diasRestantes = Math.ceil((dataValidade - hojeValidade) / 86400000);
        return {
          ...lote,
          produto: (produtos || []).find(item => item.id === lote.produtoId),
          diasRestantes
        };
      })
      .filter(lote => lote.produto && lote.diasRestantes <= 30)
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [lotes, produtos, hojeValidade]);

  // 5. Função de Exportação para PDF (CORRIGIDO)
  const exportarPDF = () => {
    const doc = new jsPDF();
    
    // Cabeçalho Principal
    doc.setFontSize(20);
    doc.setTextColor(249, 115, 22); // Orange
    doc.text("VULPE MART", 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text("Relatório Administrativo de Vendas e Stock", 14, 30);
    
    const rotulosTempo = {
      'hoje': 'Hoje', 'ontem': 'Ontem', '7dias': 'Últimos 7 Dias', 'tudo': 'Todo o Histórico'
    };
    
    // Resumo Financeiro
    doc.setFontSize(10);
    doc.text(`Período Filtrado: ${rotulosTempo[filtroTempo]}`, 14, 40);
    doc.text(`Total de Transações: ${numeroVendas}`, 14, 46);
    doc.text(`Receita Bruta: ${totalReceitas.toFixed(2)} MT`, 14, 52);
    doc.text(`Lucro Líquido Estimado: ${totalLucro.toFixed(2)} MT`, 14, 58);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-MZ')}`, 14, 64);

    // ==========================================
    // TABELA 1: HISTÓRICO DE VENDAS
    // ==========================================
    doc.setFontSize(12);
    doc.setTextColor(249, 115, 22);
    doc.text("1. Histórico de Transações", 14, 76);

    const tableDataVendas = vendas.map(v => [
      new Date(v.data || v.data_venda).toLocaleString('pt-MZ'),
      v.itens?.map(i => `${i.quantidade}x ${i.nome}`).join('\n') || 'S/ Detalhes',
      `${Number(v.total || v.totalVenda || 0).toFixed(2)} MT`,
      `${Number(v.lucroTotal || 0).toFixed(2)} MT`
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Data e Hora', 'Artigos Vendidos', 'Total Recebido', 'Lucro']],
      body: tableDataVendas,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] }, 
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' }
      }
    });

    let finalY = doc.lastAutoTable.finalY + 15;

    if (finalY > 260) {
      doc.addPage();
      finalY = 20;
    }

    // ==========================================
    // TABELA 2: POSIÇÃO ATUAL DE STOCK
    // ==========================================
    doc.setFontSize(12);
    doc.setTextColor(249, 115, 22);
    doc.text("2. Posição Atual de Stock", 14, finalY);

    const tableDataStock = produtos?.map(p => [
      p.nome || '',
      p.categoria?.toUpperCase() || '',
      `${p.stock || 0}`,
      `${Number(p.precoCusto || 0).toFixed(2)} MT`,
      `${Number(p.precoVenda || 0).toFixed(2)} MT`
    ]) || [];

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Produto', 'Categoria', 'Quantidade em Stock', 'P. Custo', 'P. Venda']],
      body: tableDataStock,
      theme: 'grid',
      headStyles: { fillColor: [82, 82, 91] }, 
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 30 },
        2: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
      }
    });

    doc.save(`Relatorio_VulpeMart_${filtroTempo}.pdf`);
  };

  const customTooltipStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: '8px',
    color: '#18181b',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div className="p-6 bg-zinc-50 min-h-full text-zinc-900 font-sans">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-zinc-200 pb-4">
        <h2 className="text-2xl font-bold text-orange-500 uppercase tracking-wider flex items-center gap-2">
          <FileText size={28} /> Painel de Desempenho
        </h2>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-auto">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
            <select
              value={filtroTempo}
              onChange={(e) => setFiltroTempo(e.target.value)}
              className="w-full md:w-auto pl-10 pr-8 py-2 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-orange-500 text-zinc-700 font-medium"
            >
              <option value="hoje">Hoje</option>
              <option value="ontem">Ontem</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="tudo">Todo o Histórico</option>
            </select>
          </div>
          
          <button 
            onClick={exportarPDF}
            disabled={vendas.length === 0 && produtos?.length === 0}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-900 text-white py-2 px-4 rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            <Download size={18} /> <span className="hidden md:inline">Exportar PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
          <p className="text-zinc-500 text-sm font-semibold uppercase">Receita Bruta ({filtroTempo})</p>
          <p className="text-3xl font-bold text-zinc-800 mt-2">{totalReceitas.toFixed(2)} MT</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
          <p className="text-zinc-500 text-sm font-semibold uppercase">Lucro Líquido ({filtroTempo})</p>
          <p className="text-3xl font-bold text-orange-500 mt-2">{totalLucro.toFixed(2)} MT</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
          <p className="text-zinc-500 text-sm font-semibold uppercase">Total de Transações</p>
          <p className="text-3xl font-bold text-zinc-800 mt-2">{numeroVendas}</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm mb-8 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50">
          <h3 className="font-bold text-zinc-800">Histórico de Transações e Horários</h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left">
            <thead className="bg-zinc-100 text-zinc-600 sticky top-0 text-sm">
              <tr>
                <th className="p-3 font-semibold">Data e Hora</th>
                <th className="p-3 font-semibold">Artigos Comprados</th>
                <th className="p-3 font-semibold text-right">Valor Pago</th>
                <th className="p-3 font-semibold text-right">Lucro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {vendas.map(v => (
                <tr key={v.id} className="hover:bg-orange-50/50">
                  <td className="p-3 text-zinc-700 whitespace-nowrap">
                    {new Date(v.data || v.data_venda).toLocaleString('pt-MZ')}
                  </td>
                  <td className="p-3 text-zinc-600">
                    <ul className="list-disc list-inside">
                      {v.itens?.map((i, idx) => (
                        <li key={idx}>{i.quantidade}x {i.nome}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-3 font-bold text-zinc-800 text-right">
                    {Number(v.total || v.totalVenda || 0).toFixed(2)} MT
                  </td>
                  <td className="p-3 text-orange-600 font-bold text-right">
                    {Number(v.lucroTotal || 0).toFixed(2)} MT
                  </td>
                </tr>
              ))}
              {vendas.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-zinc-500">Nenhuma venda registada neste período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200 lg:col-span-2">
          <h3 className="font-bold text-zinc-800 mb-6">Evolução de Receitas e Lucro Diário</h3>
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

      <ModuloPrecoMinimo produtos={produtos} />

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm mt-8 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50">
          <h3 className="font-bold text-zinc-800">Validades: produtos vencidos ou a vencer em 30 dias</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-100 text-zinc-600 text-sm">
              <tr>
                <th className="p-3 font-semibold">Produto</th>
                <th className="p-3 font-semibold">Quantidade</th>
                <th className="p-3 font-semibold">Validade</th>
                <th className="p-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {alertasValidade.map(lote => (
                <tr key={lote.id}>
                  <td className="p-3 text-zinc-700">{lote.produto.nome}</td>
                  <td className="p-3 text-zinc-700">{lote.quantidade} {lote.produto.unidadeMedida}</td>
                  <td className="p-3 text-zinc-700">{lote.validade}</td>
                  <td className={`p-3 font-bold ${lote.diasRestantes < 0 ? "text-red-600" : "text-orange-600"}`}>
                    {lote.diasRestantes < 0
                      ? `Vencido há ${Math.abs(lote.diasRestantes)} dia(s)`
                      : lote.diasRestantes === 0
                        ? "Vence hoje"
                        : `Vence em ${lote.diasRestantes} dia(s)`}
                  </td>
                </tr>
              ))}
              {alertasValidade.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-zinc-500">Não há lotes vencidos ou próximos do vencimento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}