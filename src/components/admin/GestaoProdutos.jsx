import { useState } from "react";
import { db } from "../../db";
import { useLiveQuery } from "dexie-react-hooks";
import { Edit, Trash2, X } from "lucide-react";

export function GestaoProdutos() {
  const produtos = useLiveQuery(() => db.produtos.toArray());
  const [erro, setErro] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  // Estados controlados para o formulário (necessário para a edição funcionar bem)
  const [produtoEmEdicao, setProdutoEmEdicao] = useState(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("peca");
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [stock, setStock] = useState("");

  // Preenche o formulário com os dados do produto escolhido
  const iniciarEdicao = (produto) => {
    setErro("");
    setProdutoEmEdicao(produto.id);
    setNome(produto.nome);
    setCategoria(produto.categoria);
    setPrecoCusto(produto.precoCusto);
    setPrecoVenda(produto.precoVenda);
    setStock(produto.stock);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Sobe a página para o formulário
  };

  // Limpa o formulário e sai do modo de edição
  const cancelarEdicao = () => {
    setProdutoEmEdicao(null);
    setNome("");
    setCategoria("peca");
    setPrecoCusto("");
    setPrecoVenda("");
    setStock("");
    setErro("");
  };

  // Função única que decide se vai Adicionar ou Atualizar
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
        // ATUALIZA O PRODUTO EXISTENTE
        await db.produtos.update(produtoEmEdicao, {
          nome: pNome,
          categoria,
          precoVenda: pVenda,
          precoCusto: pCusto,
          stock: pStock
          // Não atualizamos a dataCriacao para manter o registo original
        });
      } else {
        // CRIA UM PRODUTO NOVO
        await db.produtos.add({ 
          nome: pNome, 
          categoria, 
          precoVenda: pVenda, 
          precoCusto: pCusto, 
          stock: pStock, 
          dataCriacao: new Date().toISOString() 
        });
      }
      cancelarEdicao(); // Limpa os campos depois de gravar
    } catch (err) {
      setErro("Erro ao guardar o produto. Verifica os dados.");
    }
  };

  // Função para apagar definitivamente
  const apagarProduto = async (id) => {
    const confirmar = window.confirm("Tens a certeza que queres apagar este artigo? Esta ação não pode ser desfeita.");
    if (confirmar) {
      await db.produtos.delete(id);
      if (produtoEmEdicao === id) cancelarEdicao(); // Se estava a ser editado, limpa o formulário
    }
  };

  const produtosFiltrados = produtos?.filter((p) =>
    filtroCategoria === "todas" ? true : p.categoria === filtroCategoria,
  );

  return (
    <div className="p-6 bg-zinc-950 min-h-full text-zinc-100">
      <h2 className="text-2xl font-bold mb-6 text-red-500 uppercase tracking-wider">
        {produtoEmEdicao ? "Editar Stock" : "Entrada de Stock"}
      </h2>

      {erro && (
        <div className="bg-red-950 border border-red-700 text-red-200 p-3 mb-6 rounded shadow-lg">
          {erro}
        </div>
      )}

      {/* Formulário Controlado */}
      <form
        onSubmit={guardarProduto}
        className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-lg shadow-xl border transition-colors ${
          produtoEmEdicao ? "bg-zinc-900 border-blue-900 shadow-[0_0_20px_rgba(30,58,138,0.2)]" : "bg-zinc-900 border-zinc-800"
        }`}
      >
        <input
          type="text"
          placeholder="Nome do artigo"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder-zinc-500 p-3 rounded focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        />

        <select
          required
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 text-zinc-100 p-3 rounded focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        >
          <option value="peca">Peça de Mota</option>
          <option value="chinelo">Chinelo</option>
          <option value="mexa">Mexa</option>
        </select>

        <input
          type="number"
          step="0.01"
          placeholder="Preço de Custo (MT)"
          required
          value={precoCusto}
          onChange={(e) => setPrecoCusto(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder-zinc-500 p-3 rounded focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Preço de Venda (MT)"
          required
          value={precoVenda}
          onChange={(e) => setPrecoVenda(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder-zinc-500 p-3 rounded focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        />
        <input
          type="number"
          placeholder="Quantidade em Stock"
          required
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder-zinc-500 p-3 rounded md:col-span-2 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        />

        <div className="md:col-span-2 flex gap-4 mt-2">
          <button
            type="submit"
            className={`flex-1 font-bold py-3 px-4 rounded transition-colors ${
              produtoEmEdicao 
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]" 
                : "bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]"
            }`}
          >
            {produtoEmEdicao ? "Atualizar Produto" : "Guardar Produto"}
          </button>

          {produtoEmEdicao && (
            <button
              type="button"
              onClick={cancelarEdicao}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 px-4 rounded flex items-center gap-2 transition-colors border border-zinc-700"
            >
              <X size={20} /> Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Tabela de Produtos com Filtro */}
      <div className="mt-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h3 className="text-xl font-bold text-zinc-300">
            Stock Atual{" "}
            <span className="text-red-500">
              ({produtosFiltrados?.length || 0})
            </span>
          </h3>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 p-2 rounded focus:outline-none focus:border-red-500"
          >
            <option value="todas">Todas as Categorias</option>
            <option value="peca">Peças de Mota</option>
            <option value="chinelo">Chinelos</option>
            <option value="mexa">Mexas</option>
          </select>
        </div>

        <ul className="space-y-3">
          {produtosFiltrados?.map((p) => (
            <li
              key={p.id}
              className="bg-zinc-900 border border-zinc-800 p-4 flex flex-col md:flex-row justify-between rounded-lg shadow-sm items-start md:items-center gap-2 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-zinc-100 text-lg">
                  {p.nome}
                </span>
                <span className="text-xs font-semibold uppercase bg-zinc-950 text-red-500 border border-red-900/50 px-2 py-1 rounded">
                  {p.categoria}
                </span>
                <span className="text-xs text-zinc-500 hidden md:block">
                  Adicionado em:{" "}
                  {p.dataCriacao
                    ? new Date(p.dataCriacao).toLocaleString("pt-MZ")
                    : "Data não registada"}
                </span>
              </div>
              
              <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0 border-t border-zinc-800 pt-4 md:border-0 md:pt-0">
                <div className="text-right flex items-center gap-4">
                  <span
                    className={`font-bold ${p.stock < 5 ? "text-red-500 animate-pulse" : "text-zinc-400"}`}
                  >
                    Stock: {p.stock}
                  </span>
                  <span className="text-zinc-200 font-medium">
                    Venda: {p.precoVenda.toFixed(2)} MT
                  </span>
                </div>

                {/* Botões de Ação (Editar e Apagar) */}
                <div className="flex items-center gap-2 ml-4">
                  <button 
                    onClick={() => iniciarEdicao(p)}
                    className="p-2 bg-zinc-950 border border-zinc-800 hover:border-blue-500 hover:text-blue-500 text-zinc-400 rounded transition-colors"
                    title="Editar Produto"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => apagarProduto(p.id)}
                    className="p-2 bg-zinc-950 border border-zinc-800 hover:border-red-500 hover:text-red-500 text-zinc-400 rounded transition-colors"
                    title="Apagar Produto"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </li>
          ))}

          {produtosFiltrados?.length === 0 && (
            <div className="text-center p-8 border border-zinc-800 border-dashed rounded-lg bg-zinc-900/50 text-zinc-500">
              Nenhum produto encontrado nesta categoria.
            </div>
          )}
        </ul>
      </div>
    </div>
  );
}