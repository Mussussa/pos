import Dexie from 'dexie';

export const db = new Dexie('MerceariaDB');

// Subimos para a versão 6 adicionando a flag de sincronização
db.version(6).stores({
  usuarios: '++id, username, role', 
  produtos: '++id, &codigo, &nome, categoria, subcategoria, precoVenda, precoCusto, stock, unidadeMedida, sincronizado', 
  vendas: '++id, data, vendedorId, total, sincronizado',
  sistema: 'id' 
});

///home/ismael/vulpe/vulpe-markt/bb/*  */_comercial/pos_nhapulo/src/db.js