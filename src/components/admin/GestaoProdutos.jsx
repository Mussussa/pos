import { useState } from "react";
import { db } from "../../db";
import { useLiveQuery } from "dexie-react-hooks";
import { Edit, Trash2, X } from "lucide-react";

export function GestaoProdutos() {
  const produtos = useLiveQuery(() => db.produtos.toArray());
  const [erro, setErro] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const [produtoEmEdicao, setProdutoEmEdicao] = useState(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("alimentacao");
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [stock, setStock] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("unidade"); // Novo campo adicionado

  const iniciarEdicao = (produto) => {
    setErro("");
    setProdutoEmEdicao(produto.id);
    setNome(produto.nome);
    setCategoria(produto.categoria);
    setPrecoCusto(produto.precoCusto);
    setPrecoVenda(produto.precoVenda);
    setStock(produto.stock);
    setUnidadeMedida(produto.unidadeMedida || "unidade");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicao = () => {
    setProdutoEmEdicao(null);
    setNome("");
    setCategoria("alimentacao");
    setPrecoCusto("");
    setPrecoVenda("");
    setStock("");
    setUnidadeMedida("unidade");
    setErro("");
  };

  const guardarProduto = async (e) => {
    e.preventDefault();
    setErro("");

    const pNome = nome.trim();
    const pVenda = Number(precoVenda);
    const pCusto = Number(precoCusto);
    const pStock = Number(stock);

    if (!pNome) return setErro("O nome é obrigatório.");
    if (pVenda <= 0 || pCusto < 0) return setErro("Preços inválidos.");
    if (pStock < 0) return setErro("O stock não pode ser negativo.");

    try {
      if (produtoEmEdicao) {
        await db.produtos.update(produtoEmEdicao, {
          nome: pNome,
          categoria,
          precoVenda: pVenda,
          precoCusto: pCusto,
          stock: pStock,
          unidadeMedida // Atualiza a unidade de medida
        });
      } else {
        await db.produtos.add({ 
          nome: pNome, 
          categoria, 
          precoVenda: pVenda, 
          precoCusto: pCusto, 
          stock: pStock, 
          unidadeMedida // Grava a unidade de medida
        });
      }
      cancelarEdicao();
    } catch (err) {
      setErro("Erro ao guardar o produto. Verifica os dados.");
    }
  };

  const apagarProduto = async (id) => {
    const confirmar = window.confirm("Tens a certeza que queres apagar este artigo? Esta ação não pode ser desfeita.");
    if (confirmar) {
      await db.produtos.delete(id);
      if (produtoEmEdicao === id) cancelarEdicao();
    }
  };

  const produtosFiltrados = produtos?.filter((p) =>
    filtroCategoria === "todas" ? true : p.categoria === filtroCategoria,
  );

  return (
    <div className="p-6 bg-white min-h-full text-zinc-900 font-sans">
      <h2 className="text-2xl font-bold mb-6 text-orange-500 uppercase tracking-wider">
        {produtoEmEdicao ? "Editar Stock" : "Entrada de Stock"} Vulpe Mart
      </h2>

      {erro && (
        <div className="bg-orange-50 border border-orange-500 text-orange-700 p-3 mb-6 rounded shadow-sm">
          {erro}
        </div>
      )}

      {/* Formulário Controlado (Tema Claro e Laranja Vulpe) */}
      <form
        onSubmit={guardarProduto}
        className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-lg shadow-sm border transition-colors ${
          produtoEmEdicao ? "bg-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]" : "bg-white border-zinc-200"
        }`}
      >
        <input
          type="text"
          placeholder="Nome do artigo"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />

        <select
          required
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        >
          <option value="alimentacao">Alimentação</option>
          <option value="bebidas">Bebidas</option>
          <option value="limpeza">Limpeza</option>
          <option value="diversos">Diversos</option>
        </select>

        <input
          type="number"
          step="0.01"
          placeholder="Preço de Custo (MT)"
          required
          value={precoCusto}
          onChange={(e) => setPrecoCusto(e.target.value)}
          className="bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Preço de Venda (MT)"
          required
          value={precoVenda}
          onChange={(e) => setPrecoVenda(e.target.value)}
          className="bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
        
        <div className="md:col-span-2 flex gap-2">
          <input
            type="number"
            placeholder="Quantidade em Stock"
            required
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="flex-1 bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
          <select
            required
            value={unidadeMedida}
            onChange={(e) => setUnidadeMedida(e.target.value)}
            className="w-1/3 md:w-1/4 bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          >
            <option value="unidade">Un.</option>
            <option value="kg">Kg</option>
            <option value="litro">Litro</option>
            <option value="caixa">Caixa</option>
          </select>
        </div>

        <div className="md:col-span-2 flex gap-4 mt-2">
          <button
            type="submit"
            className={`flex-1 font-bold py-3 px-4 rounded transition-colors shadow-sm ${
              produtoEmEdicao 
                ? "bg-zinc-800 hover:bg-zinc-900 text-white" 
                : "bg-orange-500 hover:bg-orange-600 text-white"
            }`}
          >
            {produtoEmEdicao ? "Atualizar Produto" : "Guardar Produto"}
          </button>

          {produtoEmEdicao && (
            <button
              type="button"
              onClick={cancelarEdicao}
              className="bg-white hover:bg-zinc-50 text-zinc-700 font-bold py-3 px-4 rounded flex items-center gap-2 transition-colors border border-zinc-300"
            >
              <X size={20} /> Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Tabela de Produtos com Filtro */}
      <div className="mt-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h3 className="text-xl font-bold text-zinc-800">
            Stock Atual{" "}
            <span className="text-orange-500">
              ({produtosFiltrados?.length || 0})
            </span>
          </h3>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="bg-white border border-zinc-300 text-zinc-900 p-2 rounded focus:outline-none focus:border-orange-500"
          >
            <option value="todas">Todas as Categorias</option>
            <option value="alimentacao">Alimentação</option>
            <option value="bebidas">Bebidas</option>
            <option value="limpeza">Limpeza</option>
            <option value="diversos">Diversos</option>
          </select>
        </div>

        <ul className="space-y-3">
          {produtosFiltrados?.map((p) => (
            <li
              key={p.id}
              className="bg-white border border-zinc-200 p-4 flex flex-col md:flex-row justify-between rounded-lg shadow-sm items-start md:items-center gap-2 hover:border-orange-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-zinc-900 text-lg">
                  {p.nome}
                </span>
                <span className="text-xs font-semibold uppercase bg-orange-50 text-orange-600 border border-orange-200 px-2 py-1 rounded">
                  {p.categoria}
                </span>
              </div>
              
              <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0 border-t border-zinc-100 pt-4 md:border-0 md:pt-0">
                <div className="text-right flex items-center gap-4">
                  <span
                    className={`font-bold ${p.stock < 5 ? "text-orange-600 animate-pulse" : "text-zinc-600"}`}
                  >
                    Stock: {p.stock} {p.unidadeMedida}
                  </span>
                  <span className="text-zinc-800 font-medium">
                    Venda: {p.precoVenda.toFixed(2)} MT
                  </span>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button 
                    onClick={() => iniciarEdicao(p)}
                    className="p-2 bg-white border border-zinc-300 hover:border-orange-500 hover:text-orange-500 text-zinc-500 rounded transition-colors"
                    title="Editar Produto"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => apagarProduto(p.id)}
                    className="p-2 bg-white border border-zinc-300 hover:border-red-500 hover:text-red-500 text-zinc-500 rounded transition-colors"
                    title="Apagar Produto"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </li>
          ))}

          {produtosFiltrados?.length === 0 && (
            <div className="text-center p-8 border border-zinc-300 border-dashed rounded-lg bg-zinc-50 text-zinc-500">
              Nenhum produto encontrado nesta categoria.
            </div>
          )}
        </ul>
      </div>
    </div>
  );
}