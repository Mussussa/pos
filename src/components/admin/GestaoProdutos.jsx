import { useState } from "react";
import { db } from "../../db";
import { supabase } from "../../services/supabase"; // Importação crucial para apagar na nuvem
import { useLiveQuery } from "dexie-react-hooks";
import { Edit, Trash2, X } from "lucide-react";

const mapaCategorias = {
  alimentacao: { 
    prefixo: 'A', 
    subcategorias: ['graus e massas', 'Laticínios e Charcutaria', 'Bolachas e biscoitos', 'Carnes', 'Mariscos', 'Snacks e Doces', 'outros'] 
  },
  bebidas: { 
    prefixo: 'B', 
    subcategorias: ['Águas', 'Sumos e Néctares', 'Refrigerantes e Energéticas', 'Cervejas', 'Vinhos e Espirituosas', 'outros'] 
  },
  limpeza: { 
    prefixo: 'L', 
    subcategorias: ['Limpeza do Lar', 'Tratamento de Roupa', 'Higiene Pessoal', 'Papel e Descartáveis', 'outros'] 
  },
  diversos: { 
    prefixo: 'D', 
    subcategorias: ['Casa e Utilidades', 'Alimentação Animal', 'Papelaria', 'Pilhas e Eletrónica', 'Outros'] 
  }
};

export function GestaoProdutos() {
  const produtos = useLiveQuery(() => db.produtos.toArray());
  const [erro, setErro] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const [produtoEmEdicao, setProdutoEmEdicao] = useState(null);
  const [codigoNumerico, setCodigoNumerico] = useState("");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("alimentacao");
  const [subcategoria, setSubcategoria] = useState(mapaCategorias["alimentacao"].subcategorias[0]);
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [stock, setStock] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("Un."); 

  const iniciarEdicao = (produto) => {
    setErro("");
    setProdutoEmEdicao(produto.id);
    setCodigoNumerico(produto.codigo ? produto.codigo.substring(1) : "");
    setNome(produto.nome);
    setCategoria(produto.categoria);
    setSubcategoria(produto.subcategoria || mapaCategorias[produto.categoria].subcategorias[0]);
    setPrecoCusto(produto.precoCusto);
    setPrecoVenda(produto.precoVenda);
    setStock(produto.stock);
    setUnidadeMedida(produto.unidadeMedida || "Un.");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicao = () => {
    setProdutoEmEdicao(null);
    setCodigoNumerico("");
    setNome("");
    setCategoria("alimentacao");
    setSubcategoria(mapaCategorias["alimentacao"].subcategorias[0]);
    setPrecoCusto("");
    setPrecoVenda("");
    setStock("");
    setUnidadeMedida("Un.");
    setErro("");
  };

  const handleCategoriaChange = (e) => {
    const novaCategoria = e.target.value;
    setCategoria(novaCategoria);
    setSubcategoria(mapaCategorias[novaCategoria].subcategorias[0]);
  };

  const guardarProduto = async (e) => {
    e.preventDefault();
    setErro("");

    const pNome = nome.trim();
    const numLimpo = codigoNumerico.replace(/\D/g, '').substring(0, 3);
    const pCodigo = mapaCategorias[categoria].prefixo + numLimpo.padStart(3, '0');
    const pVenda = Number(precoVenda);
    const pCusto = Number(precoCusto);
    const pStock = Number(stock);

    if (numLimpo.length === 0) return setErro("O código numérico é obrigatório.");
    if (!pNome) return setErro("O nome é obrigatório.");
    if (pVenda <= 0 || pCusto < 0) return setErro("Preços inválidos.");
    if (pStock < 0) return setErro("O stock não pode ser negativo.");

    const duplicado = produtos.find(p => 
      (p.nome.toLowerCase() === pNome.toLowerCase() || p.codigo === pCodigo) && p.id !== produtoEmEdicao
    );

    if (duplicado) {
      return setErro(`Já existe um artigo com o código ${pCodigo} ou nome "${pNome}".`);
    }

    try {
      const dadosProduto = {
        codigo: pCodigo,
        nome: pNome,
        categoria,
        subcategoria,
        precoVenda: pVenda,
        precoCusto: pCusto,
        stock: pStock,
        unidadeMedida,
        sincronizado: 0 // Marca sempre como não sincronizado inicialmente
      };

      let idLocalAtual = produtoEmEdicao;

      // 1. Grava no Dexie Local
      if (produtoEmEdicao) {
        await db.produtos.update(produtoEmEdicao, dadosProduto);
      } else {
        idLocalAtual = await db.produtos.add(dadosProduto);
      }
      cancelarEdicao();

      // 2. SINCRONIZAÇÃO INSTANTÂNEA: Se houver internet, envia de imediato para a nuvem
      if (navigator.onLine) {
        const configLocal = await db.sistema.get('config_loja');
        if (configLocal?.loja_id) {
          const payloadNuvem = {
            loja_id: configLocal.loja_id,
            codigo: pCodigo,
            nome: pNome,
            categoria,
            subcategoria,
            preco_venda: pVenda,
            preco_custo: pCusto,
            stock: pStock,
            unidade_medida: unidadeMedida
          };

          const { error } = await supabase
            .from('produtos')
            .upsert([payloadNuvem], { onConflict: 'loja_id, codigo' });

          // Se a nuvem confirmou a receção, atualiza a flag localmente
          if (!error) {
            await db.produtos.update(idLocalAtual, { sincronizado: 1 });
          }
        }
      }
    } catch (err) {
      setErro("Erro ao guardar o produto. Verifica se há duplicação de registos.");
    }
  };

  // A CORREÇÃO PRINCIPAL ESTÁ AQUI: Apaga na Nuvem
  const apagarProduto = async (id) => {
    const confirmar = window.confirm("Tens a certeza? A ação será definitiva na nuvem.");
    if (!confirmar) return;

    try {
      // 1. Guarda os dados do produto ANTES de o apagar localmente
      const produtoParaApagar = await db.produtos.get(id);

      // 2. Apaga localmente no Dexie
      await db.produtos.delete(id);
      if (produtoEmEdicao === id) cancelarEdicao();

      // 3. APAGA NO SUPABASE (Mata o Zombie)
      if (navigator.onLine && produtoParaApagar) {
        const configLocal = await db.sistema.get('config_loja');
        if (configLocal?.loja_id) {
          const { error } = await supabase
            .from('produtos')
            .delete()
            .eq('loja_id', configLocal.loja_id)
            .eq('codigo', produtoParaApagar.codigo);
            
          if (error) console.error("Erro ao apagar na nuvem:", error);
        }
      }
    } catch (err) {
      console.error("Erro ao processar exclusão:", err);
    }
  };

  const produtosFiltrados = produtos?.filter((p) =>
    filtroCategoria === "todas" ? true : p.categoria === filtroCategoria
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

      <form
        onSubmit={guardarProduto}
        className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-lg shadow-sm border transition-colors ${
          produtoEmEdicao ? "bg-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]" : "bg-white border-zinc-200"
        }`}
      >
        <div className="flex gap-2">
          <div className="flex items-center justify-center bg-zinc-100 border border-zinc-300 rounded px-4 font-bold text-zinc-600">
            {mapaCategorias[categoria].prefixo}
          </div>
          <input
            type="text"
            placeholder="Cód. (ex: 112)"
            maxLength="3"
            required
            value={codigoNumerico}
            onChange={(e) => setCodigoNumerico(e.target.value.replace(/\D/g, ''))}
            className="flex-1 bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>

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
          onChange={handleCategoriaChange}
          className="bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        >
          <option value="alimentacao">Alimentação</option>
          <option value="bebidas">Bebidas</option>
          <option value="limpeza">Limpeza</option>
          <option value="diversos">Diversos</option>
        </select>

        <select
          required
          value={subcategoria}
          onChange={(e) => setSubcategoria(e.target.value)}
          className="bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        >
          {mapaCategorias[categoria].subcategorias.map(sub => (
            <option key={sub} value={sub}>{sub}</option>
          ))}
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
            step="0.01"
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
            <option value="Un.">Un.</option>
            <option value="Kg">Kg</option>
            <option value="Litro">Litro</option>
            <option value="Caixa">Caixa</option>
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
                <span className="font-mono bg-zinc-100 text-zinc-600 px-2 py-1 rounded text-sm border border-zinc-200">
                  {p.codigo}
                </span>
                <div className="flex flex-col">
                  <span className="font-bold text-zinc-900 text-lg">
                    {p.nome}
                  </span>
                  <span className="text-xs text-zinc-500 mt-1">
                    {p.categoria} &gt; {p.subcategoria}
                  </span>
                </div>
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