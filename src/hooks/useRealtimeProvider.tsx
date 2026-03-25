import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Listener = () => void;

interface RealtimeContextValue {
  subscribe: (listener: Listener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const listenersRef = useRef<Set<Listener>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel('global-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        listenersRef.current.forEach(fn => fn());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => {
        listenersRef.current.forEach(fn => fn());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rme_relatorios' }, () => {
        listenersRef.current.forEach(fn => fn());
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useGlobalRealtime = (onChangeCallback?: Listener) => {
  const context = useContext(RealtimeContext);

  useEffect(() => {
    if (!context || !onChangeCallback) return;
    return context.subscribe(onChangeCallback);
  }, [context, onChangeCallback]);
};
