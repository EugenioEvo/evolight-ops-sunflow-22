import { ParsedRow } from './excelImporter';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidatedCliente {
  empresa: string | null;
  cnpj_cpf: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  _validation: ValidationResult;
  _rowIndex: number;
}

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Validar CNPJ (apenas formato, não dígito verificador completo)
function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.length === 14;
}

// Validar CPF (apenas formato)
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.length === 11;
}

// Formatar CNPJ
function formatCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length !== 14) return value;
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

// Formatar CPF
function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length !== 11) return value;
  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

// Formatar CEP
function formatCEP(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length !== 8) return value;
  return cleaned.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

// Validar CEP
function isValidCEP(cep: string): boolean {
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.length === 8;
}

// Validar estado
function isValidEstado(estado: string): boolean {
  return ESTADOS_BR.includes(estado.toUpperCase());
}

export function validateCliente(row: ParsedRow, rowIndex: number): ValidatedCliente {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  let empresa = row.empresa ? String(row.empresa).trim() : null;
  let cnpj_cpf = row.cnpj_cpf ? String(row.cnpj_cpf).trim() : null;
  let endereco = row.endereco ? String(row.endereco).trim() : null;
  let cidade = row.cidade ? String(row.cidade).trim() : null;
  let estado = row.estado ? String(row.estado).trim() : null;
  let cep = row.cep ? String(row.cep).trim() : null;
  
  // Validar empresa (obrigatório)
  if (!empresa) {
    errors.push('Campo "Empresa" é obrigatório');
  }
  
  // Validar CNPJ/CPF (obrigatório)
  if (!cnpj_cpf) {
    errors.push('Campo "CNPJ/CPF" é obrigatório');
  } else {
    const cleanedDoc = cnpj_cpf.replace(/\D/g, '');
    if (cleanedDoc.length === 14) {
      if (!isValidCNPJ(cnpj_cpf)) {
        errors.push('CNPJ inválido (deve ter 14 dígitos)');
      } else {
        cnpj_cpf = formatCNPJ(cnpj_cpf);
      }
    } else if (cleanedDoc.length === 11) {
      if (!isValidCPF(cnpj_cpf)) {
        errors.push('CPF inválido (deve ter 11 dígitos)');
      } else {
        cnpj_cpf = formatCPF(cnpj_cpf);
      }
    } else {
      errors.push('CNPJ/CPF inválido (CNPJ: 14 dígitos, CPF: 11 dígitos)');
    }
  }
  
  // Validar estado (opcional, mas deve ser válido se preenchido)
  if (estado && !isValidEstado(estado)) {
    errors.push(`Estado "${estado}" inválido (use sigla: SP, RJ, GO, etc.)`);
  } else if (estado) {
    estado = estado.toUpperCase();
  }
  
  // Validar CEP (opcional, mas deve ser válido se preenchido)
  if (cep) {
    if (!isValidCEP(cep)) {
      warnings.push('CEP com formato inválido (esperado: 8 dígitos)');
    } else {
      cep = formatCEP(cep);
    }
  }
  
  return {
    empresa,
    cnpj_cpf,
    endereco,
    cidade,
    estado,
    cep,
    _validation: {
      valid: errors.length === 0,
      errors,
      warnings
    },
    _rowIndex: rowIndex
  };
}

export function validateClientesBatch(
  rows: ParsedRow[], 
  existingDocuments: string[] = []
): ValidatedCliente[] {
  const validated: ValidatedCliente[] = [];
  const seenDocuments = new Set<string>();
  const existingSet = new Set(existingDocuments.map(d => d.replace(/\D/g, '')));
  
  rows.forEach((row, index) => {
    const validatedRow = validateCliente(row, index);
    
    // Verificar duplicatas no lote
    const doc = String(row.cnpj_cpf || '').replace(/\D/g, '');
    if (doc) {
      if (seenDocuments.has(doc)) {
        validatedRow._validation.errors.push('CNPJ/CPF duplicado neste arquivo');
        validatedRow._validation.valid = false;
      } else {
        seenDocuments.add(doc);
      }
      
      // Verificar se já existe no banco
      if (existingSet.has(doc)) {
        validatedRow._validation.errors.push('CNPJ/CPF já cadastrado no sistema');
        validatedRow._validation.valid = false;
      }
    }
    
    validated.push(validatedRow);
  });
  
  return validated;
}

export function prepareClienteForInsert(row: ValidatedCliente): Record<string, unknown> {
  return {
    empresa: row.empresa,
    cnpj_cpf: row.cnpj_cpf,
    endereco: row.endereco || null,
    cidade: row.cidade || null,
    estado: row.estado || null,
    cep: row.cep || null,
  };
}
