import Dexie from 'dexie';

export const db = new Dexie('MerceariaDB');

// Subimos para a versão 7 para guardar lotes e respetivas validades.
db.version(7).stores({
  usuarios: '++id, username, role', 
  produtos: '++id, &codigo, &nome, categoria, subcategoria, precoVenda, precoCusto, stock, unidadeMedida, sincronizado', 
  vendas: '++id, data, vendedorId, total, sincronizado',
  lotes: 'id, produtoId, validade, sincronizado',
  sistema: 'id' 
});

///home/ismael/vulpe/vulpe-markt/bb/*  */_comercial/pos_nhapulo/src/db.js