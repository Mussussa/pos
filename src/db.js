import Dexie from 'dexie';

export const db = new Dexie('LojaDB');

// Subimos para a versão 2 para adicionar a tabela de sistema sem perder os dados antigos
db.version(2).stores({
  usuarios: '++id, username, role', 
  produtos: '++id, nome, categoria, precoVenda, precoCusto, stock', 
  vendas: '++id, data, vendedorId',
  sistema: 'id' // Guarda configurações como a pasta de backup e a hora
});