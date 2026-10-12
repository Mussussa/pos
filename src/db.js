import Dexie from 'dexie';

export const db = new Dexie('MerceariaDB');

// Versão atualizada para refletir a realidade comercial, adicionando subcategoria, código e aplicando regras de unicidade (&)
db.version(5).stores({
  usuarios: '++id, username, role', 
  produtos: '++id, &codigo, &nome, categoria, subcategoria, precoVenda, precoCusto, stock, unidadeMedida', 
  vendas: '++id, data, vendedorId, total',
  sistema: 'id' 
});