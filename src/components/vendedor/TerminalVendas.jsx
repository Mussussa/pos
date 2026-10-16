import { useState, useMemo } from "react";
import { db } from "../../db";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ShoppingCart,
  Printer,
  Trash2,
  Plus,
  Minus,
  Search,
  History,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

const mapaCategorias = {
  alimentacao: {
    prefixo: "A",
    subcategorias: [
      "graus e massas",
      "Laticínios e Charcutaria",
      "Bolachas e biscoitos",
      "Carnes",
      "Mariscos ",
      "Snacks e Doces",
      "outros",
    ],
  },
  bebidas: {
    prefixo: "B",
    subcategorias: [
      "Águas",
      "Sumos e Néctares",
      "Refrigerantes e Energéticas",
      "Cervejas",
      "Vinhos e Espirituosas",
      "outros",
    ],
  },
  limpeza: {
    prefixo: "L",
    subcategorias: [
      "Limpeza do Lar",
      "Tratamento de Roupa",
      "Higiene Pessoal",
      "Papel e Descartáveis",
      "outros",
    ],
  },
  diversos: {
    prefixo: "D",
    subcategorias: [
      "Casa e Utilidades",
      "Alimentação Animal",
      "Papelaria",
      "Pilhas e Eletrónica",
      "Outros",
    ],
  },
};

export function TerminalVendas() {
  const produtos = useLiveQuery(() =>
    db.produtos.where("stock").above(0).toArray(),
  );
  const vendas = useLiveQuery(() => db.vendas.toArray());

  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroSubcategoria, setFiltroSubcategoria] = useState("todas");
  const [pesquisa, setPesquisa] = useState("");
  const [carrinho, setCarrinho] = useState([]);
  const [imprimirRecibo, setImprimirRecibo] = useState(true);

  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const itensPorPaginaHistorico = 15;

  const categorias = [
    { id: "todas", label: "Todas" },
    { id: "alimentacao", label: "Alimentação" },
    { id: "bebidas", label: "Bebidas" },
    { id: "limpeza", label: "Limpeza" },
    { id: "diversos", label: "Diversos" },
  ];

  const mudarCategoria = (catId) => {
    setFiltroCategoria(catId);
    setFiltroSubcategoria("todas");
  };

  const contagemVendas = useMemo(() => {
    const contagem = {};
    vendas?.forEach((v) => {
      if (v.itens && Array.isArray(v.itens)) {
        v.itens.forEach((item) => {
          contagem[item.produtoId] =
            (contagem[item.produtoId] || 0) + item.quantidade;
        });
      }
    });
    return contagem;
  }, [vendas]);

  const produtosVitrine = useMemo(() => {
    if (!produtos) return [];
    let filtrados = produtos;

    if (filtroCategoria !== "todas") {
      filtrados = filtrados.filter((p) => p.categoria === filtroCategoria);
      if (filtroSubcategoria !== "todas") {
        filtrados = filtrados.filter(
          (p) => p.subcategoria === filtroSubcategoria,
        );
      }
    }

    if (pesquisa.trim() !== "") {
      const termo = pesquisa.toLowerCase().trim();
      filtrados = filtrados.filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          (p.codigo && p.codigo.toLowerCase().includes(termo)),
      );
    }

    return filtrados.sort((a, b) => {
      const qtdA = contagemVendas[a.id] || 0;
      const qtdB = contagemVendas[b.id] || 0;
      if (qtdB !== qtdA) return qtdB - qtdA;
      return a.nome.localeCompare(b.nome);
    });
  }, [produtos, filtroCategoria, filtroSubcategoria, pesquisa, contagemVendas]);

  const produtosMaisVendidos = useMemo(() => {
    if (!produtos) return [];
    return [...produtos]
      .sort((a, b) => (contagemVendas[b.id] || 0) - (contagemVendas[a.id] || 0))
      .slice(0, 5);
  }, [produtos, contagemVendas]);

  const vendasOrdenadas = useMemo(() => {
    if (!vendas) return [];
    return [...vendas].sort((a, b) => new Date(b.data || b.data_venda) - new Date(a.data || a.data_venda));
  }, [vendas]);

  const totalPaginasHistorico = Math.ceil(
    vendasOrdenadas.length / itensPorPaginaHistorico,
  );
  const historicoPaginado = useMemo(() => {
    const inicio = (paginaHistorico - 1) * itensPorPaginaHistorico;
    return vendasOrdenadas.slice(inicio, inicio + itensPorPaginaHistorico);
  }, [vendasOrdenadas, paginaHistorico]);

  const adicionarAoCarrinho = (produto) => {
    setCarrinho((prev) => {
      const existe = prev.find((item) => item.id === produto.id);
      if (existe) {
        if (parseFloat(existe.quantidade) >= produto.stock) return prev;
        return prev.map((item) =>
          item.id === produto.id
            ? {
                ...item,
                quantidade: parseFloat(item.quantidade) + 1,
                valorInput: null,
              }
            : item,
        );
      }
      return [...prev, { ...produto, quantidade: 1, valorInput: null }];
    });
  };

  const alterarQuantidade = (id, delta) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const currentQtd = parseFloat(item.quantidade) || 0;
          const novaQtd = currentQtd + delta;
          if (novaQtd > 0 && novaQtd <= item.stock)
            return { ...item, quantidade: novaQtd, valorInput: null };
        }
        return item;
      }),
    );
  };

  const definirQuantidadeManual = (id, valorTexto) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          let limpo = valorTexto.replace(",", ".");
          return { ...item, quantidade: limpo, valorInput: null };
        }
        return item;
      }),
    );
  };

  const definirPorValorManual = (id, valorTexto) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          let limpo = valorTexto.replace(",", ".");
          const valorMT = parseFloat(limpo);
          let novaQtd = item.quantidade;

          if (!isNaN(valorMT) && valorMT >= 0) {
            const precoSeguro = Number(item.precoVenda || 1);
            let pesoCalculado = Number((valorMT / precoSeguro).toFixed(3));
            novaQtd = Math.min(pesoCalculado, item.stock);
          }

          return {
            ...item,
            quantidade: limpo === "" ? "" : novaQtd,
            valorInput: limpo,
          };
        }
        return item;
      }),
    );
  };

  const validarQuantidadeAoSair = (id) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          let val = parseFloat(item.quantidade);
          if (isNaN(val) || val <= 0) val = 1;

          const permiteDecimais = ["kg", "litro"].includes(
            item.unidadeMedida?.toLowerCase(),
          );
          if (!permiteDecimais) val = Math.round(val);

          const minVal = permiteDecimais ? 0.01 : 1;
          val = Math.min(Math.max(minVal, val), item.stock);

          return { ...item, quantidade: val };
        }
        return item;
      }),
    );
  };

  const validarValorAoSair = (id) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, valorInput: null };
        }
        return item;
      }),
    );
  };

  const removerDoCarrinho = (id) => {
    setCarrinho((prev) => prev.filter((item) => item.id !== id));
  };

  const totalVenda = carrinho.reduce((acc, item) => {
    const qtd = parseFloat(item.quantidade) || 0;
    const precoUnitario = Number(item.precoVenda || 0);
    return acc + precoUnitario * qtd;
  }, 0);

  const finalizarVenda = async () => {
    if (carrinho.length === 0) return;
    const lucroTotal = carrinho.reduce((acc, item) => {
      const qtd = parseFloat(item.quantidade) || 0;
      const precoV = Number(item.precoVenda || 0);
      const precoC = Number(item.precoCusto || 0);
      return acc + (precoV - precoC) * qtd;
    }, 0);

    const novaVenda = {
      data: new Date().toISOString(),
      vendedorId: 1, 
      total: totalVenda, 
      lucroTotal,
      sincronizado: 0, 
      itens: carrinho.map((item) => {
        let qtdFinal = parseFloat(item.quantidade);
        if (isNaN(qtdFinal) || qtdFinal <= 0) qtdFinal = 1;
        return {
          produtoId: item.id,
          nome: item.nome,
          codigo: item.codigo || "",
          quantidade: qtdFinal,
          preco: Number(item.precoVenda || 0),
        };
      }),
    };

    try {
      await db.transaction("rw", db.produtos, db.vendas, async () => {
        await db.vendas.add(novaVenda);
        for (const item of novaVenda.itens) {
          const prodDB = await db.produtos.get(item.produtoId);
          if (prodDB) {
            await db.produtos.update(item.produtoId, {
              stock: prodDB.stock - item.quantidade,
              sincronizado: 0 
            });
          }
        }
      });
      
      if (imprimirRecibo) {
        window.print();
      }
      setCarrinho([]);

      // O GATILHO DA NUVEM: Acorda o motor invisível se houver internet
      if (navigator.onLine) {
        window.dispatchEvent(new Event('online'));
      }
      
    } catch (error) {
      alert("Erro ao processar a venda.");
      console.error(error);
    }
  };

  const exportarHistoricoVendedorPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(249, 115, 22);
    doc.text("VULPE MART", 14, 22);

    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text("Histórico Geral de Vendas (Operador)", 14, 30);
    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${new Date().toLocaleString("pt-MZ")}`, 14, 36);
    doc.text(`Total de Registos: ${vendasOrdenadas.length}`, 14, 42);

    const tableData = vendasOrdenadas.map((v) => [
      new Date(v.data || v.data_venda).toLocaleString("pt-MZ"),
      v.itens?.map((i) => `${i.quantidade}x ${i.nome}`).join("\n") || "S/ Detalhes",
      `${Number(v.total || v.totalVenda || 0).toFixed(2)} MT`, 
    ]);

    doc.autoTable({
      startY: 50,
      head: [["Data e Hora", "Artigos Vendidos", "Total Recebido"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [249, 115, 22] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 30, halign: "right" },
      },
    });

    doc.save(`Historico_Vendas_VulpeMart.pdf`);
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-screen bg-zinc-50 text-zinc-900 font-sans relative">
      {/* MODAL DE HISTÓRICO DE VENDAS */}
      {mostrarHistorico && (
        <div className="fixed inset-0 z-50 bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 md:p-6 border-b border-zinc-200 bg-zinc-50 gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-zinc-800 flex items-center gap-2">
                <History className="text-orange-500" /> Histórico de Vendas
              </h2>
              <div className="flex gap-2 md:gap-3 w-full sm:w-auto">
                <button
                  onClick={exportarHistoricoVendedorPDF}
                  className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-zinc-800 hover:bg-zinc-900 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm md:text-base"
                >
                  <Download size={18} />{" "}
                  <span className="hidden sm:inline">Exportar PDF</span>
                </button>
                <button
                  onClick={() => setMostrarHistorico(false)}
                  className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors bg-zinc-200 sm:bg-transparent"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-6">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-100 text-zinc-600 sticky top-0 shadow-sm text-sm">
                  <tr>
                    <th className="p-3 md:p-4 font-semibold rounded-tl-lg">
                      Data
                    </th>
                    <th className="p-3 md:p-4 font-semibold">Artigos</th>
                    <th className="p-3 md:p-4 font-semibold text-right rounded-tr-lg">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs md:text-sm">
                  {historicoPaginado.map((v) => (
                    <tr
                      key={v.id}
                      className="hover:bg-orange-50/50 transition-colors"
                    >
                      <td className="p-3 md:p-4 text-zinc-700 whitespace-nowrap font-medium">
                        {new Date(v.data || v.data_venda).toLocaleString("pt-MZ", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 md:p-4 text-zinc-600">
                        <ul className="list-disc list-inside">
                          {v.itens?.map((i, idx) => (
                            <li key={idx} className="line-clamp-1">
                              {i.quantidade}x {i.nome}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-3 md:p-4 font-black text-orange-600 text-right text-base md:text-lg">
                        {Number(v.total || v.totalVenda || 0).toFixed(2)} MT
                      </td>
                    </tr>
                  ))}
                  {historicoPaginado.length === 0 && (
                    <tr>
                      <td
                        colSpan="3"
                        className="p-8 text-center text-zinc-500 text-base md:text-lg"
                      >
                        Sem histórico de vendas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPaginasHistorico > 1 && (
              <div className="flex justify-between items-center p-4 border-t border-zinc-200 bg-zinc-50">
                <span className="text-xs md:text-sm text-zinc-500 font-medium">
                  Pág. {paginaHistorico} de {totalPaginasHistorico}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setPaginaHistorico((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={paginaHistorico === 1}
                    className="p-2 border border-zinc-300 bg-white rounded text-zinc-700 hover:border-orange-500 hover:text-orange-500 disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() =>
                      setPaginaHistorico((prev) =>
                        Math.min(prev + 1, totalPaginasHistorico),
                      )
                    }
                    disabled={paginaHistorico === totalPaginasHistorico}
                    className="p-2 border border-zinc-300 bg-white rounded text-zinc-700 hover:border-orange-500 hover:text-orange-500 disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Esquerda: Vitrine e Filtros */}
      <div className="w-full md:w-3/5 lg:w-[65%] p-4 md:p-6 flex flex-col h-screen md:h-full overflow-hidden print:hidden border-b md:border-b-0 md:border-r border-zinc-200">
        
        {/* Letreiro de Giro */}
        <div className="mb-4 md:mb-6 bg-white border border-orange-200 rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-3 md:gap-4 shrink-0">
          <span className="bg-orange-500 text-white text-xs md:text-sm font-bold uppercase px-2 py-1.5 md:px-3 md:py-2 rounded shrink-0 animate-pulse">
            🔥 Top
          </span>
          <div className="flex overflow-x-auto gap-6 md:gap-8 whitespace-nowrap text-sm md:text-base text-zinc-600 no-scrollbar items-center">
            {produtosMaisVendidos.length > 0 ? (
              produtosMaisVendidos.map((p) => (
                <span
                  key={p.id}
                  className="cursor-pointer hover:text-orange-600 font-medium transition-colors"
                  onClick={() => adicionarAoCarrinho(p)}
                >
                  ⭐ <strong className="text-base md:text-lg">{p.nome}</strong>{" "}
                  <span className="text-zinc-400">
                    ({Number(p.precoVenda || 0).toFixed(2)} MT)
                  </span>
                </span>
              ))
            ) : (
              <span className="text-zinc-400">Sem registos.</span>
            )}
          </div>
        </div>

        {/* Cabeçalho e Filtros */}
        <div className="flex flex-col gap-4 md:gap-6 mb-4 md:mb-6 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl md:text-3xl font-black text-orange-500 uppercase tracking-wider">
              POS
            </h2>
            <button
              onClick={() => setMostrarHistorico(true)}
              className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-2 px-3 md:px-4 rounded-xl border border-zinc-300 transition-colors shadow-sm text-sm md:text-base"
            >
              <History size={18} />{" "}
              <span className="hidden sm:inline">Histórico Diário</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 no-scrollbar">
              {categorias.map((cat) => {
                const selecionada = filtroCategoria === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => mudarCategoria(cat.id)}
                    className={`px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl text-sm md:text-base font-bold border-2 transition-all shrink-0 shadow-sm ${
                      selecionada
                        ? "bg-orange-500 text-white border-orange-500 shadow-orange-200"
                        : "bg-white text-zinc-700 border-zinc-200 hover:border-orange-400 hover:text-orange-600"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {filtroCategoria !== "todas" && mapaCategorias[filtroCategoria] && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFiltroSubcategoria("todas")}
                  className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs font-bold border transition-all ${
                    filtroSubcategoria === "todas"
                      ? "bg-zinc-800 text-white border-zinc-800"
                      : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  Todas as Subcategorias
                </button>
                {mapaCategorias[filtroCategoria].subcategorias.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setFiltroSubcategoria(sub)}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs font-bold border transition-all ${
                      filtroSubcategoria === sub
                        ? "bg-zinc-800 text-white border-zinc-800"
                        : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex items-center">
            <Search className="absolute left-4 text-zinc-400" size={20} />
            <input
              type="text"
              placeholder="Pesquisar artigo ou código..."
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              className="w-full bg-white border-2 border-zinc-300 text-zinc-900 placeholder-zinc-400 pl-[3rem] pr-4 py-3 md:py-3.5 text-base rounded-xl md:rounded-2xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Vitrine de Produtos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 flex-1 overflow-y-auto pb-6 custom-scrollbar pr-2">
          {produtosVitrine?.map((p) => (
            <button 
              key={p.id}
              onClick={() => adicionarAoCarrinho(p)}
              className="bg-white border border-zinc-200 p-2 rounded-lg shadow-sm hover:border-orange-500 hover:shadow-md transition-all text-left flex flex-col min-h-[55px] md:min-h-[65px] active:scale-95 group"
            >
              <div className="w-full">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[8px] md:text-[9px] text-orange-700 bg-orange-100 px-1 py-0.5 rounded font-bold uppercase">{p.categoria}</span>
                  {p.codigo && (
                    <span className="text-[8px] md:text-[9px] text-zinc-500 font-mono bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200">{p.codigo}</span>
                  )}
                </div>
                <h3 className="font-bold text-zinc-800 text-xs md:text-sm leading-tight line-clamp-2 group-hover:text-orange-600 transition-colors">{p.nome}</h3>
              </div>
              
              <div className="flex flex-wrap justify-between items-end mt-auto pt-1.5 w-full gap-1">
                <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded whitespace-nowrap">Stk: {p.stock}</span>
                <span className="font-black text-orange-600 text-sm md:text-base leading-none whitespace-nowrap">{Number(p.precoVenda || 0).toFixed(2)} <span className="text-[9px] md:text-[10px] text-orange-400">MT</span></span>
              </div>
            </button>
          ))}
          {produtosVitrine?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-4 text-zinc-400 border-2 border-dashed border-zinc-300 rounded-lg bg-white min-h-[100px]">
              <Search size={24} className="mb-2 opacity-30" />
              <p className="text-sm font-medium text-center">Nenhum artigo encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Direita: Carrinho */}
      <div className="w-full md:w-2/5 lg:w-[35%] bg-white border-l border-zinc-200 p-4 md:p-6 flex flex-col h-auto md:h-screen shadow-2xl z-10 print:hidden overflow-hidden">
        <h3 className="text-xl md:text-2xl font-black text-zinc-800 mb-4 md:mb-6 flex items-center gap-3 shrink-0">
          <ShoppingCart className="text-orange-500" size={24} /> Carrinho Atual
        </h3>

        <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 pr-1 md:pr-2 custom-scrollbar min-h-[250px]">
          {carrinho.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-50 p-4 rounded-2xl border-2 border-zinc-200 flex flex-col hover:border-zinc-300 transition-colors"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-zinc-900 text-base md:text-lg leading-tight">
                  {item.nome}
                </span>
                <span className="font-black text-orange-600 text-lg md:text-xl whitespace-nowrap">
                  {(
                    Number(item.precoVenda || 0) * (parseFloat(item.quantidade) || 0)
                  ).toFixed(2)}{" "}
                  MT
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mt-3 gap-3">
                <span className="text-sm md:text-base font-bold text-zinc-500">
                  {Number(item.precoVenda || 0).toFixed(2)} / {item.unidadeMedida || "un"}
                </span>

                <div className="flex items-center gap-1 sm:gap-2 bg-white border-2 border-zinc-200 rounded-xl p-1 shadow-sm w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    type="button"
                    onClick={() => alterarQuantidade(item.id, -1)}
                    disabled={
                      parseFloat(item.quantidade) <=
                      (["kg", "litro"].includes(
                        item.unidadeMedida?.toLowerCase(),
                      )
                        ? 0.01
                        : 1)
                    }
                    className="text-zinc-600 hover:text-white hover:bg-orange-500 rounded-lg p-2 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-600"
                  >
                    <Minus size={18} strokeWidth={3} />
                  </button>

                  <input
                    type="number"
                    step={
                      ["kg", "litro"].includes(
                        item.unidadeMedida?.toLowerCase(),
                      )
                        ? "0.01"
                        : "1"
                    }
                    min={
                      ["kg", "litro"].includes(
                        item.unidadeMedida?.toLowerCase(),
                      )
                        ? "0.01"
                        : "1"
                    }
                    max={item.stock}
                    value={item.quantidade}
                    onChange={(e) =>
                      definirQuantidadeManual(item.id, e.target.value)
                    }
                    onBlur={() => validarQuantidadeAoSair(item.id)}
                    className="w-14 md:w-16 text-center text-zinc-900 font-black text-base md:text-lg bg-zinc-50 rounded-lg border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  <button
                    type="button"
                    onClick={() => alterarQuantidade(item.id, 1)}
                    disabled={parseFloat(item.quantidade) >= item.stock}
                    className="text-zinc-600 hover:text-white hover:bg-orange-500 rounded-lg p-2 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-600"
                  >
                    <Plus size={18} strokeWidth={3} />
                  </button>

                  <div className="w-px h-6 bg-zinc-300 mx-1 md:mx-2"></div>

                  <button
                    type="button"
                    onClick={() => removerDoCarrinho(item.id)}
                    className="text-red-500 hover:text-white hover:bg-red-500 rounded-lg p-2 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {item.unidadeMedida?.toLowerCase() === "kg" && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-3 bg-orange-50 p-3 rounded-xl border border-orange-200 gap-2">
                  <span className="text-xs md:text-sm font-bold text-orange-800">
                    Ou vender por valor:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={
                        item.valorInput !== null &&
                        item.valorInput !== undefined
                          ? item.valorInput
                          : item.quantidade === ""
                            ? ""
                            : Number(
                                (
                                  parseFloat(item.quantidade) * Number(item.precoVenda || 0)
                                ).toFixed(2),
                              )
                      }
                      onChange={(e) =>
                        definirPorValorManual(item.id, e.target.value)
                      }
                      onBlur={() => validarValorAoSair(item.id)}
                      className="w-full sm:w-20 text-center text-orange-700 font-black text-base md:text-lg bg-white rounded-lg border border-orange-300 focus:outline-none focus:border-orange-500 py-1"
                    />
                    <span className="font-bold text-orange-600 text-sm">
                      MT
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
          {carrinho.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-zinc-300">
              <ShoppingCart size={48} className="mb-4 opacity-30" />
              <p className="text-lg md:text-xl font-bold">Carrinho vazio.</p>
            </div>
          )}
        </div>

        <div className="mt-4 border-t-2 border-zinc-200 pt-4 bg-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-end mb-4 bg-zinc-100 p-4 rounded-2xl border-2 border-zinc-200 gap-2">
            <span className="text-sm md:text-base font-black text-zinc-500 uppercase">
              Total a Pagar
            </span>
            <span className="text-3xl md:text-4xl font-black text-zinc-900 leading-none tracking-tight">
              {totalVenda.toFixed(2)}{" "}
              <span className="text-lg md:text-xl font-bold text-zinc-500">
                MT
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 mb-3 px-2">
            <input
              type="checkbox"
              id="imprimirRecibo"
              checked={imprimirRecibo}
              onChange={(e) => setImprimirRecibo(e.target.checked)}
              className="w-4 h-4 md:w-5 md:h-5 text-orange-500 accent-orange-500 rounded border-zinc-300 focus:ring-orange-400 cursor-pointer"
            />
            <label
              htmlFor="imprimirRecibo"
              className="text-xs md:text-sm font-bold text-zinc-700 cursor-pointer select-none"
            >
              Imprimir recibo após finalizar
            </label>
          </div>

          <button
            onClick={finalizarVenda}
            disabled={carrinho.length === 0}
            className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl flex justify-center items-center gap-3 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 transition-all text-lg md:text-xl shadow-lg active:scale-95"
          >
            <Printer size={24} /> Finalizar Venda
          </button>
        </div>
      </div>

      {/* Recibo Térmico de Impressão */}
      <div className="hidden print:block absolute top-0 left-0 bg-white text-black p-4 font-mono w-[80mm] text-sm mx-auto">
        <div className="text-center">
          <h2 className="font-bold text-xl uppercase mb-1">VULPE MART</h2>
          <h3 className="font-bold text-sm uppercase mb-1">
            MERCEARIA E CONVENIÊNCIA
          </h3>
          <p className="text-xs mb-4">Chimoio, Manica. Contacto: 845773342.</p>

          <p className="text-xs text-left mb-4">
            Data: {new Date().toLocaleString("pt-MZ")}
            <br />
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
              {carrinho.map((item, idx) => {
                const itemQtd = parseFloat(item.quantidade);
                return (
                  <tr key={idx}>
                    <td className="align-top font-bold">
                      {isNaN(itemQtd) ? 1 : itemQtd}x
                    </td>
                    <td className="align-top pr-1">{item.nome}</td>
                    <td className="align-top text-right">
                      {(
                        Number(item.precoVenda || 0) * (isNaN(itemQtd) ? 1 : itemQtd)
                      ).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
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