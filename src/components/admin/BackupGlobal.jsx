import { useState, useEffect } from 'react';
import { db } from '../../db';
import Papa from 'papaparse';
import { Save, FolderOpen, UploadCloud, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

export function BackupGlobal() {
  const [status, setStatus] = useState('A aguardar...');
  const [pastaConfigurada, setPastaConfigurada] = useState(false);
  const [ultimoBackup, setUltimoBackup] = useState(null);

  const CHAVE_SECRETA = import.meta.env.VITE_CHAVE_BACKUP || "CHAVE_FALHA_SEGURANCA";

  useEffect(() => {
    carregarConfiguracoes();
    const intervalo = setInterval(verificarBackupAutomatico, 5 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);

  const carregarConfiguracoes = async () => {
    const config = await db.sistema.get('config_backup');
    if (config?.diretorioHandle) setPastaConfigurada(true);
    if (config?.ultimaData) setUltimoBackup(new Date(config.ultimaData));
  };

  const escolherPasta = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await db.sistema.put({
        id: 'config_backup',
        diretorioHandle: handle,
        ultimaData: ultimoBackup ? ultimoBackup.toISOString() : null
      });
      setPastaConfigurada(true);
      setStatus('Pasta de backup ligada com sucesso!');
    } catch (err) {
      setStatus('Permissão de pasta recusada.');
    }
  };

  const derivarChaveAES = async () => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(CHAVE_SECRETA), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode("sal_fixo_vulpe_mart"), iterations: 100000, hash: "SHA-256" },
      keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
  };

  const encriptar = async (textoCSV) => {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const chave = await derivarChaveAES();
    const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, enc.encode(textoCSV));
    
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const cifradoHex = Array.from(new Uint8Array(cifrado)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${ivHex}.${cifradoHex}`;
  };

  const desencriptar = async (textoCifrado) => {
    const partes = textoCifrado.split('.');
    if (partes.length !== 2) throw new Error("Ficheiro inválido.");
    
    const iv = new Uint8Array(partes[0].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const dados = new Uint8Array(partes[1].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    const chave = await derivarChaveAES();
    const bufferAberto = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, chave, dados);
    return new TextDecoder().decode(bufferAberto);
  };

  const verificarPermissaoHandle = async (handle, comInteracao) => {
    if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') {
      return true;
    }
    if (comInteracao) {
      if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') {
        return true;
      }
    }
    return false;
  };

  const executarBackup = async (forcarManual = false) => {
    try {
      setStatus('A iniciar processo de backup...');
      const config = await db.sistema.get('config_backup');
      
      if (!config?.diretorioHandle) {
        setStatus('Primeiro tens de escolher a pasta de backup.');
        return false;
      }

      const handle = config.diretorioHandle;
      const temPermissao = await verificarPermissaoHandle(handle, forcarManual);

      if (!temPermissao) {
        setStatus('⚠️ O navegador bloqueou o acesso à pasta. Clica em "Forçar Agora" para autorizar.');
        return false;
      }

      setStatus('A gerar ficheiros encriptados...');

      const produtosBrutos = await db.produtos.toArray();
      const vendasBrutas = await db.vendas.toArray();

      const produtosNormalizados = produtosBrutos.map(p => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        precoCusto: p.precoCusto,
        precoVenda: p.precoVenda,
        stock: p.stock,
        dataCriacao: p.dataCriacao || 'Data não registada'
      }));

      const cifradoProdutos = await encriptar(Papa.unparse(produtosNormalizados));
      const cifradoVendas = await encriptar(Papa.unparse(vendasBrutas));

      const dataAtual = new Date();
      const timestamp = dataAtual.toISOString().replace(/[:.]/g, '-');

      const fileHandleProd = await handle.getFileHandle(`produtos_backup_${timestamp}.aes`, { create: true });
      const writableProd = await fileHandleProd.createWritable();
      await writableProd.write(cifradoProdutos);
      await writableProd.close();

      const fileHandleVendas = await handle.getFileHandle(`vendas_backup_${timestamp}.aes`, { create: true });
      const writableVendas = await fileHandleVendas.createWritable();
      await writableVendas.write(cifradoVendas);
      await writableVendas.close();

      await db.sistema.update('config_backup', { ultimaData: dataAtual.toISOString() });
      setUltimoBackup(dataAtual);
      setStatus(`✅ Backup ${forcarManual ? 'manual' : 'automático'} encriptado e guardado com sucesso!`);
      return true;

    } catch (err) {
      console.error(err);
      setStatus('Erro ao guardar os ficheiros na pasta. Verifica o espaço em disco.');
      return false;
    }
  };

  const verificarBackupAutomatico = async () => {
    const config = await db.sistema.get('config_backup');
    if (!config?.ultimaData || !config?.diretorioHandle) return;

    const dataUltimo = new Date(config.ultimaData).getTime();
    const agora = Date.now();
    const quatroHorasEmMs = 4 * 60 * 60 * 1000;

    if (agora - dataUltimo >= quatroHorasEmMs) {
      await executarBackup(false);
    }
  };

  const restaurarBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const tabelaDestino = file.name.includes('vendas') ? db.vendas : db.produtos;

    try {
      setStatus('A abrir o cofre e desencriptar o ficheiro...');
      
      const textoCifrado = await file.text();
      const csvAberto = await desencriptar(textoCifrado);

      Papa.parse(csvAberto, {
        header: true,
        dynamicTyping: true,
        complete: async (results) => {
          try {
            await db.transaction('rw', tabelaDestino, async () => {
              await tabelaDestino.clear();
              await tabelaDestino.bulkAdd(results.data);
            });
            setStatus(`✅ Dados de ${tabelaDestino.name} desencriptados e restaurados com sucesso!`);
          } catch (err) {
            setStatus('Erro ao escrever na base de dados.');
          }
        }
      });

    } catch (err) {
      setStatus('🚨 ALERTA: Ficheiro inválido, corrompido ou chave secreta incorreta.');
    }
    
    e.target.value = null; 
  };

  return (
    <div className="p-6 bg-zinc-50 min-h-full text-zinc-900 font-sans">
      <h2 className="text-2xl font-bold mb-6 text-orange-500 uppercase tracking-wider flex items-center gap-2">
        <ShieldCheck size={28} /> Centro de Segurança & Backup - Vulpe Mart
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2 mb-4">
            <RefreshCw className={navigator.onLine ? "text-green-500" : "text-zinc-400"} /> 
            Backup Automático Encriptado
          </h3>
          
          <p className="text-zinc-600 text-sm mb-4">
            O sistema guarda o stock e as vendas na pasta escolhida a cada 4 horas. 
            Os ficheiros ficam completamente ilegíveis fora do sistema.
          </p>

          <div className="bg-zinc-50 p-3 rounded border border-zinc-200 mb-6 flex flex-col gap-1 text-sm">
            <span>Status da Internet: {navigator.onLine ? <span className="text-green-600 font-bold">Online</span> : <span className="text-orange-600 font-bold">Offline</span>}</span>
            <span>Pasta Ligada: {pastaConfigurada ? <span className="text-green-600 font-bold">Sim</span> : <span className="text-orange-600 font-bold">Não</span>}</span>
            <span>Último Backup: <span className="font-bold text-zinc-800">{ultimoBackup ? ultimoBackup.toLocaleString('pt-MZ') : 'Nunca'}</span></span>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={escolherPasta}
              className="flex-1 bg-white border border-zinc-300 hover:border-orange-500 hover:text-orange-600 text-zinc-700 p-3 rounded flex justify-center items-center gap-2 transition-all"
            >
              <FolderOpen size={18} /> Mudar Pasta
            </button>
            <button 
              onClick={() => executarBackup(true)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white p-3 rounded flex justify-center items-center gap-2 transition-all shadow-sm"
            >
              <Save size={18} /> Forçar Agora
            </button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2 mb-4">
            <AlertTriangle className="text-orange-500" /> 
            Reposição do Sistema
          </h3>
          
          <p className="text-zinc-600 text-sm mb-6">
            Carrega um ficheiro de backup (.aes) gerado por este sistema. O painel irá usar a chave secreta para o desencriptar e restaurar a base de dados.
          </p>

          <label className="w-full bg-zinc-50 border border-zinc-300 hover:border-orange-500 text-zinc-700 p-4 rounded flex flex-col justify-center items-center gap-2 cursor-pointer transition-all border-dashed">
            <UploadCloud size={32} className="text-orange-500" />
            <span className="font-bold">Restaurar Ficheiro Encriptado</span>
            <span className="text-xs text-zinc-500">Seleciona o ficheiro .aes (Produtos ou Vendas)</span>
            <input type="file" accept=".aes" className="hidden" onChange={restaurarBackup} />
          </label>
        </div>

      </div>

      <div className={`mt-6 border p-4 rounded text-center text-sm font-bold font-mono transition-colors ${
        status.includes('ALERTA') || status.includes('⚠️') || status.includes('Erro')
          ? 'bg-red-50 border-red-200 text-red-600' 
          : status.includes('✅')
            ? 'bg-green-50 border-green-200 text-green-600'
            : 'bg-white border-zinc-200 text-zinc-600'
      }`}>
        {status}
      </div>

    </div>
  );
}