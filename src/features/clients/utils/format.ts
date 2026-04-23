// Máscaras de exibição (read-only). Não bagunçam o valor original do banco.

export function formatCpfCnpj(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return String(raw);
}

export function formatCep(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 8) {
    return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }
  return String(raw);
}

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return digits.replace(/^55(\d{2})(\d{5})(\d{4})$/, '+55 ($1) $2-$3');
  }
  return String(raw);
}

/**
 * Aplica formatação a cada linha "Tipo: número" preservando o rótulo.
 */
export function formatPhoneLines(raw: string | null | undefined): string {
  if (!raw) return '—';
  return String(raw)
    .split('\n')
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return formatPhone(line);
      const prefix = line.slice(0, idx + 1);
      const rest = line.slice(idx + 1).trim();
      return `${prefix} ${formatPhone(rest)}`;
    })
    .join('\n');
}

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
