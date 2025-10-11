import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { profile } = useAuth();

  useEffect(() => {
    loadNotifications();
    subscribeToNotifications();
  }, [profile]);

  const loadNotifications = async () => {
    if (!profile) return;

    // Para supervisores: notificar sobre RMEs pendentes
    if (profile.role === 'admin' || profile.role === 'area_tecnica') {
      const { data: pendingRMEs } = await supabase
        .from('rme_relatorios')
        .select('id, created_at, tickets(numero_ticket, titulo)')
        .eq('status_aprovacao', 'pendente')
        .order('created_at', { ascending: false })
        .limit(5);

      if (pendingRMEs) {
        const notifs: Notification[] = pendingRMEs.map((rme: any) => ({
          id: rme.id,
          type: 'rme_pending',
          title: 'Novo RME para aprovar',
          message: `${rme.tickets?.numero_ticket}: ${rme.tickets?.titulo}`,
          created_at: rme.created_at,
          read: false,
        }));
        setNotifications(notifs);
        setUnreadCount(notifs.length);
      }
    }

    // Para técnicos: notificar sobre RMEs aprovados/rejeitados
    if (profile.role === 'tecnico_campo') {
      const { data: tecnicoData } = await supabase
        .from('tecnicos')
        .select('id')
        .eq('profile_id', profile.id)
        .single();

      if (tecnicoData) {
        const { data: rmeUpdates } = await supabase
          .from('rme_relatorios')
          .select('id, status_aprovacao, data_aprovacao, tickets(numero_ticket)')
          .eq('tecnico_id', tecnicoData.id)
          .in('status_aprovacao', ['aprovado', 'rejeitado'])
          .gte(
            'data_aprovacao',
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          )
          .order('data_aprovacao', { ascending: false })
          .limit(5);

        if (rmeUpdates) {
          const notifs: Notification[] = rmeUpdates.map((rme: any) => ({
            id: rme.id,
            type: `rme_${rme.status_aprovacao}`,
            title:
              rme.status_aprovacao === 'aprovado' ? 'RME Aprovado' : 'RME Rejeitado',
            message: `${rme.tickets?.numero_ticket} foi ${
              rme.status_aprovacao === 'aprovado' ? 'aprovado' : 'rejeitado'
            }`,
            created_at: rme.data_aprovacao,
            read: false,
          }));
          setNotifications(notifs);
          setUnreadCount(notifs.length);
        }
      }
    }
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rme_relatorios',
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma notificação
          </div>
        ) : (
          notifications.map((notif) => (
            <DropdownMenuItem key={notif.id} className="flex flex-col items-start p-3">
              <div className="font-medium text-sm">{notif.title}</div>
              <div className="text-xs text-muted-foreground">{notif.message}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(notif.created_at), 'dd/MM/yyyy HH:mm')}
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
