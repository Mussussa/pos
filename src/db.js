import Dexie from 'dexie';

export const db = new Dexie('MerceariaDB');

// Versão atualizada para refletir a realidade comercial de mercearias e lojas locais
db.version(2).stores({
  usuarios: '++id, username, role', 
  produtos: '++id, nome, categoria, precoVenda, precoCusto, stock, unidadeMedida', 
  vendas: '++id, data, vendedorId, total',
  sistema: 'id' 
});