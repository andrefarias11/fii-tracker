import * as XLSX from 'xlsx';
import { Transaction } from '../types/portfolio';

export interface ParsedB3Row {
  ticker: string;
  date: string; // YYYY-MM-DD
  shares: number;
  price: number;
  total: number;
  type: 'Compra' | 'Venda';
  broker: string;
  isFII: boolean;
}

export interface B3ParseResult {
  success: boolean;
  transactions: Transaction[];
  summary: {
    totalRows: number;
    fiiRowsFound: number;
    nonFiiRowsSkipped: number;
    totalAmountInvested: number;
  };
  error?: string;
}

// Normalizar números formatados em PT-BR (ex: "1.250,50" -> 1250.5)
function parseBRLNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;

  const str = String(val).trim();
  // Se contiver vírgula, tratar como decimal brasileiro
  if (str.includes(',')) {
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Converter datas do Excel (número de série ou string DD/MM/YYYY) para YYYY-MM-DD
function parseB3Date(val: unknown): string {
  if (!val) return new Date().toISOString().slice(0, 10);

  // Se for número serial do Excel
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();

  // Se já for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Se for DD/MM/YYYY ou DD-MM-YYYY
  const parts = str.split(/[/ -]/);
  if (parts.length === 3) {
    if (parts[0].length <= 2 && parts[2].length === 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }

  return new Date().toISOString().slice(0, 10);
}

// Normalizar cabeçalhos para encontrar as colunas da B3
function findColumnKey(row: Record<string, unknown>, possibleNames: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const name of possibleNames) {
    const found = keys.find((k) => k.toLowerCase().trim().includes(name));
    if (found) return found;
  }
  return undefined;
}

export function parseB3FileBuffer(buffer: ArrayBuffer, filterOnlyFIIs = true): B3ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        transactions: [],
        summary: { totalRows: 0, fiiRowsFound: 0, nonFiiRowsSkipped: 0, totalAmountInvested: 0 },
        error: 'A planilha da B3 está vazia ou não contém abas válidas.'
      };
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      return {
        success: false,
        transactions: [],
        summary: { totalRows: 0, fiiRowsFound: 0, nonFiiRowsSkipped: 0, totalAmountInvested: 0 },
        error: 'Nenhuma linha encontrada no extrato.'
      };
    }

    // Identificar nomes de colunas usando a primeira linha com dados
    const sampleRow = rawData[0];

    const dateKey = findColumnKey(sampleRow, ['data do negócio', 'data negocio', 'data da operação', 'data', 'date']);
    const tickerKey = findColumnKey(sampleRow, ['código de negociação', 'codigo de negociacao', 'código', 'ativo', 'ticker', 'produto', 'papel']);
    const typeKey = findColumnKey(sampleRow, ['tipo de movimentação', 'tipo de movimentacao', 'tipo', 'operação', 'operacao', 'c/v']);
    const sharesKey = findColumnKey(sampleRow, ['quantidade', 'qtd', 'quantidade negociada']);
    const priceKey = findColumnKey(sampleRow, ['preço (r$)', 'preco (r$)', 'preço', 'preco', 'valor unitário', 'preço médio']);
    const totalKey = findColumnKey(sampleRow, ['valor (r$)', 'valor', 'total', 'volume']);
    const brokerKey = findColumnKey(sampleRow, ['instituição', 'instituicao', 'corretora', 'agente de custódia']);

    if (!tickerKey || !sharesKey) {
      return {
        success: false,
        transactions: [],
        summary: { totalRows: rawData.length, fiiRowsFound: 0, nonFiiRowsSkipped: 0, totalAmountInvested: 0 },
        error: 'Colunas obrigatórias da B3 não foram reconhecidas (Código do Ativo e Quantidade).'
      };
    }

    const validTransactions: Transaction[] = [];
    let fiiCount = 0;
    let nonFiiCount = 0;
    let totalInvested = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      let rawTicker = String(row[tickerKey] || '').toUpperCase().trim();

      if (!rawTicker) continue;

      // Remover sufixo 'F' de mercado fracionário se houver (ex: MXRF11F -> MXRF11)
      if (rawTicker.endsWith('11F')) {
        rawTicker = rawTicker.slice(0, -1);
      }

      // Identificar se é FII (termina em 11)
      const isFII = rawTicker.endsWith('11');

      if (filterOnlyFIIs && !isFII) {
        nonFiiCount++;
        continue;
      }

      const operationType = typeKey ? String(row[typeKey] || '').toLowerCase() : 'compra';
      const isBuy = operationType.includes('compra') || operationType.includes('c') || operationType === '';

      // Foco em aportes de compra
      if (!isBuy) {
        continue;
      }

      const shares = Math.abs(parseBRLNumber(row[sharesKey]));
      if (shares <= 0) continue;

      let price = priceKey ? Math.abs(parseBRLNumber(row[priceKey])) : 0;
      let total = totalKey ? Math.abs(parseBRLNumber(row[totalKey])) : 0;

      if (price <= 0 && total > 0) {
        price = Number((total / shares).toFixed(2));
      } else if (total <= 0 && price > 0) {
        total = Number((shares * price).toFixed(2));
      }

      if (price <= 0 || total <= 0) continue;

      const date = dateKey ? parseB3Date(row[dateKey]) : new Date().toISOString().slice(0, 10);
      const broker = brokerKey && row[brokerKey] ? String(row[brokerKey]).trim() : 'XP Investimentos';

      validTransactions.push({
        id: `b3-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        ticker: rawTicker,
        date,
        shares,
        price,
        total,
        broker,
        notes: 'Importado da B3'
      });

      fiiCount++;
      totalInvested += total;
    }

    return {
      success: true,
      transactions: validTransactions.sort((a, b) => b.date.localeCompare(a.date)),
      summary: {
        totalRows: rawData.length,
        fiiRowsFound: fiiCount,
        nonFiiRowsSkipped: nonFiiCount,
        totalAmountInvested: Number(totalInvested.toFixed(2))
      }
    };
  } catch (err) {
    console.error('Erro ao processar planilha da B3:', err);
    return {
      success: false,
      transactions: [],
      summary: { totalRows: 0, fiiRowsFound: 0, nonFiiRowsSkipped: 0, totalAmountInvested: 0 },
      error: 'Não foi possível ler o arquivo. Certifique-se de que é um Excel (.xlsx/.xls) ou CSV válido da B3.'
    };
  }
}

