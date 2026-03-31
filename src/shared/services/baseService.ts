/**
 * Base service utilities — validation helpers and common patterns for all services.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a value is a valid UUID v4 string.
 * @throws Error if invalid
 */
export function assertUUID(value: unknown, paramName = 'id'): asserts value is string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new Error(`Parâmetro inválido: ${paramName} deve ser um UUID válido`);
  }
}

/**
 * Validates that a string is non-empty after trimming.
 * @throws Error if empty
 */
export function assertNonEmpty(value: unknown, paramName = 'valor'): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Parâmetro inválido: ${paramName} não pode ser vazio`);
  }
}

/**
 * Validates that a number is positive (> 0).
 * @throws Error if not positive
 */
export function assertPositive(value: unknown, paramName = 'valor'): asserts value is number {
  if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
    throw new Error(`Parâmetro inválido: ${paramName} deve ser um número positivo`);
  }
}

/**
 * Wraps a supabase query response — throws on error, returns data.
 * Eliminates repetitive `if (error) throw error; return data` patterns.
 */
export function unwrap<T>(response: { data: T | null; error: any }): T {
  if (response.error) throw response.error;
  return response.data as T;
}
