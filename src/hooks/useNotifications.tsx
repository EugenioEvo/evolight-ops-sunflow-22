import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Notificacao {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  link: string | null;
  created_at: string;
}

const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

const showDesktopNotification = (titulo: string, mensagem: string, link?: string | null) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification(titulo, {
    body: mensagem,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `sunflow-${Date.now()}`,
    requireInteraction: false,
  });

  if (link) {
    notification.onclick = () => {
      window.focus();
      window.location.href = link;
      notification.close();
    };
  }
};

export const useNotifications = () => {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const { user } = useAuth();

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission().then(setPermissionGranted);
  }, []);

  const handleNewNotification = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      const newNotif = payload.new as Notificacao;
      setNotificacoes(prev => [newNotif, ...prev].slice(0, 20));
      if (!newNotif.lida) {
        setNaoLidas(prev => prev + 1);
        // Show desktop/mobile notification
        showDesktopNotification(newNotif.titulo, newNotif.mensagem, newNotif.link);
      }
    } else {
      // For UPDATE/DELETE, just reload
      loadNotificacoes();
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setNotificacoes([]);
      setNaoLidas(0);
      setLoading(false);
      return;
    }

    loadNotificacoes();

    const channel = supabase
      .channel('notificacoes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
          filter: `user_id=eq.${user.id}`,
        },
        handleNewNotification
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, handleNewNotification]);

  const loadNotificacoes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotificacoes(data || []);
      setNaoLidas((data || []).filter(n => !n.lida).length);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoLida = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id);

      if (error) throw error;

      setNotificacoes(prev =>
        prev.map(n => (n.id === id ? { ...n, lida: true } : n))
      );
      setNaoLidas(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const marcarTodasComoLidas = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('user_id', user.id)
        .eq('lida', false);

      if (error) throw error;

      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      setNaoLidas(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const deletarNotificacao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const notificacao = notificacoes.find(n => n.id === id);
      setNotificacoes(prev => prev.filter(n => n.id !== id));
      if (notificacao && !notificacao.lida) {
        setNaoLidas(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
    }
  };

  const solicitarPermissao = async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    return granted;
  };

  return {
    notificacoes,
    loading,
    naoLidas,
    permissionGranted,
    marcarComoLida,
    marcarTodasComoLidas,
    deletarNotificacao,
    solicitarPermissao,
  };
};
