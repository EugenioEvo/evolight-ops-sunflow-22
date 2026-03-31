/**
 * Base service utilities — validation helpers, common patterns, and DI support for all services.
 */

import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/** Typed Supabase client for this project's schema */
export type AppSupabaseClient = SupabaseClient<Database>;

/** Returns the provided client or falls back to the default singleton */
export function getClient(client?: AppSupabaseClient): AppSupabaseClient {
  return client ?? supabase;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUUID(value: unknown, paramName = 'id'): asserts value is string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new Error(`Parâmetro inválido: ${paramName} deve ser um UUID válido`);
  }
}

export function assertNonEmpty(value: unknown, paramName = 'valor'): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Parâmetro inválido: ${paramName} não pode ser vazio`);
  }
}

export function assertPositive(value: unknown, paramName = 'valor'): asserts value is number {
  if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
    throw new Error(`Parâmetro inválido: ${paramName} deve ser um número positivo`);
  }
}

export function unwrap<T>(response: { data: T | null; error: any }): T {
  if (response.error) throw response.error;
  return response.data as T;
}
