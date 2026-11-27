import { useEffect } from 'react';
import { db } from '../db'; // Ajusta o caminho do import se necessário

export function MotorSincronizacao() {
  useEffect(() => {
    let sincronizacaoEmCurso = false;
    let avisoSessaoRegistado = false;
    let desmontado = false;
    let subscricaoAuth;

    const executarSincronizacaoSilenciosa = async () => {
      if (!navigator.onLine || sincronizacaoEmCurso) return;
      sincronizacaoEmCurso = true;

      try {
        // 1. Verifica se esta máquina já tem uma loja configurada
        const configLocal = await db.sistema.get('config_loja');
        if (!configLocal?.loja_id) return;

        // 2. Verifica se a sessão do Supabase (do Admin que ativou a máquina) continua válida no navegador
        const { supabase } = await import('../services/supabase');
        const { data: { session }, error: erroSessao } = await supabase.auth.getSession();
        if (erroSessao) throw erroSessao;
        if (!session?.user?.id) {
          if (!avisoSessaoRegistado) {
            console.warn('[Motor de Sincronização] Sessão Supabase indisponível. Os dados pendentes permanecem no dispositivo e serão sincronizados após iniciar sessão.');
            avisoSessaoRegistado = true;
          }
          return;
        }
        avisoSessaoRegistado = false;

        const lojaId = configLocal.loja_id;

        const { sincronizarBackupCompleto } = await import('../services/backupSync');
        await sincronizarBackupCompleto(supabase, db, lojaId);
        console.log('✅ [Motor Invisível] Sincronização concluída com sucesso!');
      } catch (err) {
        console.error('🚨 [Motor Invisível] Erro oculto na sincronização:', err);
      } finally {
        sincronizacaoEmCurso = false;
      }
    };

    import('../services/supabase').then(({ supabase }) => {
      if (desmontado) return;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, session) => {
        if ((evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED') && session) {
          window.setTimeout(executarSincronizacaoSilenciosa, 0);
        }
      });
      subscricaoAuth = subscription;
    }).catch(err => {
      console.error('[Motor de Sincronização] Não foi possível acompanhar a sessão Supabase:', err);
    });

    // Ouve o momento exato em que a internet volta
    window.addEventListener('online', executarSincronizacaoSilenciosa);
    
    // De forma redundante, tenta enviar de 5 em 5 minutos silenciosamente se houver internet
    const intervalo = setInterval(executarSincronizacaoSilenciosa, 5 * 60 * 1000);

    
    // Tenta correr uma vez logo que a aplicação abre
    executarSincronizacaoSilenciosa();

    return () => {
      desmontado = true;
      subscricaoAuth?.unsubscribe();
      window.removeEventListener('online', executarSincronizacaoSilenciosa);
      clearInterval(intervalo);
    };
  }, []);


  // Este componente não tem ecrã, é invisível na interface!
  return null;
}