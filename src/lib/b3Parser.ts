import * as XLSX from 'xlsx';
import { Transaction } from '../types/portfolio';
import { normalizeTransactionForSplit } from '../domain/portfolioEngine';
import { isValidIsoCalendarDate } from './pushNavigation';
import { normalizeB3Ticker, STOCK_UNIT_11_TICKERS } from './ticker';

export { normalizeB3Ticker, STOCK_UNIT_11_TICKERS } from './ticker';

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

export interface DetectedB3SplitEvent {
  ticker: string;
  date: string; // YYYY-MM-DD
  creditedShares: number;
}

export interface B3ParseResult {
  success: boolean;
  transactions: Transaction[];
  detectedSplits?: DetectedB3SplitEvent[];
  isPositionSnapshot?: boolean;
  summary: {
    totalRows: number;
    fiiRowsFound: number;
    dividendRowsFound?: number;
    splitsDetected?: number;
    nonFiiRowsSkipped: number;
    intraFileDuplicatesRemoved: number;
    uniqueTickersFound: string[];
    totalAmountInvested: number;
    totalDividendsReceived?: number;
    sheetsProcessed?: number;
  };
  error?: string;
}

function todaySaoPauloIso(): string {
  try {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Normalizar números formatados em PT-BR (ex: "R$ 1.250,50" -> 1250.5)
function parseBRLNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;

  const str = String(val)
    .replace(/R\$/gi, '')
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (!str || str === '-' || str === '--') return 0;

  // Se contiver vírgula e ponto (ex: "1.250,50"), ponto é milhar e vírgula é decimal
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      const cleaned = str.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return Number.isFinite(num) ? num : 0;
    } else {
      const cleaned = str.replace(/,/g, '');
      const num = parseFloat(cleaned);
      return Number.isFinite(num) ? num : 0;
    }
  }

  if (str.includes(',')) {
    const cleaned = str.replace(',', '.');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
}

// Converter datas do Excel (número serial, Date ou string DD/MM/YYYY) para YYYY-MM-DD validado
export function parseB3Date(val: unknown): string {
  const fallback = todaySaoPauloIso();
  if (!val) return fallback;

  if (val instanceof Date && Number.isFinite(val.getTime())) {
    const iso = val.toISOString().slice(0, 10);
    if (isValidIsoCalendarDate(iso)) return iso;
  }

  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y >= 1990 && parsed.y <= 2100) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      const candidate = `${y}-${m}-${d}`;
      if (isValidIsoCalendarDate(candidate)) return candidate;
    }
  }

  const str = String(val).trim();
  if (!str || str === '-') return fallback;

  // ISO YYYY-MM-DD (ou YYYY-MM-DDTHH:mm:ss)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const candidate = str.slice(0, 10);
    if (isValidIsoCalendarDate(candidate)) return candidate;
  }

  // Formato brasileiro DD/MM/YYYY (ou DD-MM-YYYY, DD/MM/YY)
  const parts = str.split(/[/.-]/).map((p) => p.trim());
  if (parts.length >= 3) {
    if (parts[0].length <= 2 && parts[2].length >= 2) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      let yearNum = parseInt(parts[2].slice(0, 4), 10);
      if (parts[2].length === 2 && yearNum >= 0 && yearNum <= 99) {
        yearNum += 2000;
      }

      // Padrão B3 brasileiro: DD/MM/YYYY
      const dd = String(p0).padStart(2, '0');
      const mm = String(p1).padStart(2, '0');
      const yyyy = String(yearNum);
      const brCandidate = `${yyyy}-${mm}-${dd}`;
      if (isValidIsoCalendarDate(brCandidate)) {
        return brCandidate;
      }

      // Caso algum CSV americano tenha invertido MM/DD/YYYY (ex: 10/25/2026)
      const usCandidate = `${yyyy}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      if (isValidIsoCalendarDate(usCandidate)) {
        return usCandidate;
      }
    }
  }

  return fallback;
}

// Normaliza texto removendo acentos para busca precisa de colunas
function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function findColumnKey(
  row: Record<string, unknown>,
  possibleNames: string[],
  excludeKeys: Array<string | undefined> = []
): string | undefined {
  const excluded = new Set(excludeKeys.filter((k): k is string => Boolean(k)));
  const keys = Object.keys(row).filter((k) => !excluded.has(k));

  // 1. Busca exata primeiro
  for (const name of possibleNames) {
    const target = stripAccents(name);
    const exact = keys.find((k) => stripAccents(k) === target);
    if (exact) return exact;
  }
  // 2. Busca por inclusão
  for (const name of possibleNames) {
    const target = stripAccents(name);
    const partial = keys.find((k) => stripAccents(k).includes(target));
    if (partial) return partial;
  }
  return undefined;
}

function isBinarySpreadsheet(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  // ZIP (.xlsx / .ods) = 50 4B 03 04
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return true;
  }
  // Compound File Binary (.xls) = D0 CF 11 E0
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return true;
  }
  return false;
}

function decodeCsvText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes).replace(/^\uFEFF/, '');
  }
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsvToMatrix(text: string): unknown[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // Detecta delimitador predominante nas primeiras linhas (; no Excel PT-BR/B3, , ou \t)
  const sample = lines.slice(0, 5).join('\n');
  const semicolons = (sample.match(/;/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  const delimiter = semicolons >= commas && semicolons >= tabs ? ';' : tabs > commas ? '\t' : ',';

  return lines.map((line) => parseCsvLine(line, delimiter));
}

function convertMatrixToRecords(matrix: unknown[][]): Record<string, unknown>[] {
  if (!matrix || matrix.length === 0) return [];

  // Descobre em qual linha (0 a 15) estão os cabeçalhos reais da tabela da B3
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(15, matrix.length); r++) {
    const rowCells = (matrix[r] || []).map((c) => stripAccents(String(c || '')));
    const hasTickerCol = rowCells.some(
      (c) =>
        c.includes('codigo') ||
        c.includes('negociacao') ||
        c.includes('produto') ||
        c.includes('ativo') ||
        c.includes('ticker') ||
        c.includes('papel')
    );
    const hasQtdCol = rowCells.some((c) => c.includes('quantidade') || c.includes('qtd'));
    if (hasTickerCol && hasQtdCol) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx < 0) {
    headerRowIdx = 0;
  }

  const headerCells = (matrix[headerRowIdx] || []).map((cell, idx) => {
    const clean = String(cell ?? '').trim();
    return clean || `__col_${idx}`;
  });

  // Garante nomes de colunas únicos se houver cabeçalhos repetidos
  const uniqueHeaders: string[] = [];
  const seen = new Map<string, number>();
  for (const h of headerCells) {
    const count = seen.get(h) || 0;
    seen.set(h, count + 1);
    uniqueHeaders.push(count === 0 ? h : `${h}_${count + 1}`);
  }

  const rows: Record<string, unknown>[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const rowArr = matrix[r] || [];
    const nonEmpty = rowArr.some((cell) => String(cell ?? '').trim() !== '');
    if (!nonEmpty) continue;

    const obj: Record<string, unknown> = {};
    for (let c = 0; c < uniqueHeaders.length; c++) {
      obj[uniqueHeaders[c]] = rowArr[c] ?? '';
    }
    rows.push(obj);
  }

  return rows;
}

/**
 * Converte uma aba do Excel em linhas JSON preservando valores crus (sem inverter DD/MM para MM/DD)
 * e pulando linhas de título vazias no topo caso a planilha da B3 tenha cabeçalho deslocado.
 */
function extractRowsFromSheet(worksheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    raw: true,
  });
  return convertMatrixToRecords(matrix);
}

// ETFs conhecidos que terminam em 11 mas NÃO são FIIs nem Units de Ações
const ETF_11_TICKERS = new Set([
  'BOVA11',
  'IVVB11',
  'SMAL11',
  'HASH11',
  'NASD11',
  'GOLD11',
  'DIVO11',
  'SPXI11',
  'XINA11',
  'EURP11',
  'WRLD11',
  'ALUG11',
  'MATB11',
  'FIND11',
  'GOVE11',
  'ISUS11',
  'PIBB11',
  'BRAX11',
  'ECOO11',
  'BOVV11',
  'NDIV11',
  'DIVD11',
  'DEFI11',
  'QBTC11',
  'QETH11',
  'BITH11',
  'ETHE11',
  'TECK11',
  'CHIP11',
  'LFTS11',
  'NTNS11',
  'IMAB11',
  'B5P211',
  'IB5M11',
  'TRIG11',
  'ACWI11',
  'USTK11',
]);

/**
 * Classifica qualquer ticker da B3 em 'FII', 'ACAO' ou 'OUTRO' (ETF/BDR/Opções)
 */
export function classifyB3Ticker(rawTicker: string): 'FII' | 'ACAO' | 'OUTRO' {
  const clean = normalizeB3Ticker(rawTicker);
  if (!clean) return 'OUTRO';

  if (STOCK_UNIT_11_TICKERS.has(clean)) {
    return 'ACAO';
  }

  // Suporta ações padrão e prefixos alfanuméricos oficiais da B3 como B3SA3
  if (/^[A-Z][A-Z0-9]{3}[3456]$/.test(clean)) {
    return 'ACAO';
  }

  if (/^[A-Z]{4}11[B]?$/.test(clean) && !ETF_11_TICKERS.has(clean)) {
    return 'FII';
  }

  return 'OUTRO';
}

const POSITION_SNAPSHOT_NOTE = 'Posição Custódia B3';
const SETTLEMENT_BUY_NOTE = 'Liquidação Oficial B3';
const SETTLEMENT_SELL_NOTE = 'Liquidação Venda B3';

function parseSheetRows(
  rawData: Record<string, unknown>[],
  filterOnlyFIIs: boolean,
  sheetIdx: number
): {
  recognized: boolean;
  isPositionSnapshot: boolean;
  transactions: Transaction[];
  detectedSplits: DetectedB3SplitEvent[];
  nonFiiCount: number;
} {
  if (!rawData || rawData.length === 0) {
    return {
      recognized: false,
      isPositionSnapshot: false,
      transactions: [],
      detectedSplits: [],
      nonFiiCount: 0,
    };
  }

  const sampleRow = rawData[0];

  const dateKey = findColumnKey(sampleRow, [
    'data do negócio',
    'data negocio',
    'data da operação',
    'data da operacao',
    'data de liquidação',
    'data de liquidacao',
    'data',
    'date',
  ]);

  // Prefere coluna explícita "Código de Negociação" antes de "Produto" (essencial na planilha de Posição da B3)
  const tickerKey = findColumnKey(sampleRow, [
    'código de negociação',
    'codigo de negociacao',
    'ticker',
    'ativo',
    'papel',
    'produto',
    'código',
  ]);

  const entryExitKey = findColumnKey(sampleRow, ['entrada/saída', 'entrada/saida']);

  const movementDescKey = findColumnKey(
    sampleRow,
    [
      'tipo de movimentação',
      'tipo de movimentacao',
      'movimentação',
      'movimentacao',
      'operação',
      'operacao',
      'c/v',
      'tipo',
    ],
    [tickerKey, entryExitKey]
  );

  // Na planilha de Posição da B3 há "Quantidade", "Quantidade Disponível" e "Quantidade Indisponível" — busca exata pega "Quantidade" total
  const sharesKey = findColumnKey(sampleRow, [
    'quantidade',
    'quantidade negociada',
    'quantidade (líquida)',
    'quantidade disponivel',
    'qtd',
  ]);

  const closingPriceKey = findColumnKey(sampleRow, [
    'preço de fechamento',
    'preco de fechamento',
    'cotação de fechamento',
  ]);

  const updatedValueKey = findColumnKey(sampleRow, [
    'valor atualizado',
    'posição atual',
    'posicao atual',
  ]);

  const priceKey = findColumnKey(
    sampleRow,
    [
      'preço (r$)',
      'preco (r$)',
      'preço unitário',
      'preco unitario',
      'valor unitário',
      'valor unitario',
      'preço médio',
      'preco medio',
      'preço de fechamento',
      'preco de fechamento',
      'preço',
      'preco',
    ],
    [tickerKey, sharesKey]
  );

  const totalKey = findColumnKey(
    sampleRow,
    [
      'valor da operação',
      'valor da operacao',
      'valor líquido',
      'valor liquido',
      'valor total',
      'valor atualizado',
      'valor (r$)',
      'financeiro',
      'valor',
      'total',
      'volume',
    ],
    [tickerKey, sharesKey, priceKey]
  );

  const brokerKey = findColumnKey(sampleRow, [
    'instituição',
    'instituicao',
    'corretora',
    'agente de custódia',
    'agente de custodia',
  ]);

  if (!tickerKey || !sharesKey) {
    return {
      recognized: false,
      isPositionSnapshot: false,
      transactions: [],
      detectedSplits: [] as DetectedB3SplitEvent[],
      nonFiiCount: 0,
    };
  }

  // Detecta se a aba é um Relatório de Posição / Custódia Consolidada da B3 (retrato atual sem data de operação)
  const sampleMov = movementDescKey ? stripAccents(String(sampleRow[movementDescKey] || '')) : '';
  const looksLikeShareClassType = ['cotas', 'cota', 'on', 'pn', 'pna', 'pnb', 'unt', 'ci'].includes(
    sampleMov
  );
  const isPositionSheet =
    !dateKey &&
    !entryExitKey &&
    (Boolean(closingPriceKey || updatedValueKey) || looksLikeShareClassType || !movementDescKey);

  const sheetTransactions: Transaction[] = [];
  const sheetSplits: DetectedB3SplitEvent[] = [];
  let nonFiiCount = 0;
  const snapshotDate = todaySaoPauloIso();

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rawTickerCell = String(row[tickerKey] ?? '').trim();
    if (!rawTickerCell) continue;

    const normalizedCellText = stripAccents(rawTickerCell);
    if (
      normalizedCellText === 'total' ||
      normalizedCellText.startsWith('total ') ||
      normalizedCellText.startsWith('subtotal')
    ) {
      continue;
    }

    const cleanTicker = normalizeB3Ticker(rawTickerCell);
    if (!cleanTicker || cleanTicker.length < 5) continue;

    const assetKind = classifyB3Ticker(cleanTicker);
    if (assetKind === 'OUTRO') {
      nonFiiCount++;
      continue;
    }

    if (filterOnlyFIIs && assetKind !== 'FII') {
      nonFiiCount++;
      continue;
    }

    const broker =
      brokerKey && String(row[brokerKey] || '').trim()
        ? String(row[brokerKey]).trim()
        : 'XP Investimentos';

    if (isPositionSheet) {
      const shares = Math.abs(parseBRLNumber(row[sharesKey]));
      if (shares <= 0) continue;

      let price = priceKey ? Math.abs(parseBRLNumber(row[priceKey])) : 0;
      let total = totalKey ? Math.abs(parseBRLNumber(row[totalKey])) : 0;

      if (price <= 0 && total > 0) {
        price = Number((total / shares).toFixed(4));
      } else if (total <= 0 && price > 0) {
        total = Number((shares * price).toFixed(2));
      } else if (price > 0 && total > 0) {
        total = Number(total.toFixed(2));
        price = Number((total / shares).toFixed(4));
      }

      if (price <= 0 || total <= 0) continue;

      sheetTransactions.push({
        id: `b3-pos-${snapshotDate}-${cleanTicker}-${shares}-${sheetIdx}-${i}`,
        ticker: cleanTicker,
        type: 'BUY',
        date: snapshotDate,
        shares,
        price,
        total,
        broker,
        notes: POSITION_SNAPSHOT_NOTE,
      });
      continue;
    }

    // Analisar se a linha é Compra, Venda, Desdobro ou Provento Real (Rendimento/Dividendo/JCP da aba Movimentação)
    const movDesc = movementDescKey ? stripAccents(String(row[movementDescKey] || '')) : '';
    const entryExit = entryExitKey ? stripAccents(String(row[entryExitKey] || '')) : '';

    // Captura explícita de Desdobro oficial da aba Movimentação B3 (sem transformá-lo em compra falsa)
    if (
      movDesc.includes('desdobro') &&
      entryExit !== 'debito' &&
      entryExit !== 'saida' &&
      dateKey
    ) {
      const splitDate = parseB3Date(row[dateKey]);
      const creditedShares = Math.abs(parseBRLNumber(row[sharesKey]));
      if (isValidIsoCalendarDate(splitDate) && creditedShares > 0) {
        sheetSplits.push({
          ticker: cleanTicker,
          date: splitDate,
          creditedShares,
        });
      }
      continue;
    }

    // Ignora eventos corporativos sem fluxo de compra/venda ou provisões futuras
    if (
      movDesc.includes('fracao') ||
      movDesc.includes('fracoes') ||
      movDesc.includes('leilao') ||
      movDesc.includes('atualizacao') ||
      movDesc.includes('cessao') ||
      movDesc.includes('direito') ||
      movDesc.includes('aluguel') ||
      movDesc.includes('emprestimo') ||
      movDesc.includes('subscricao') ||
      movDesc.includes('desdobro') ||
      movDesc.includes('grupamento') ||
      movDesc.includes('bonificacao') ||
      movDesc.includes('amortizacao') ||
      movDesc.includes('incorporacao') ||
      movDesc.includes('fusao') ||
      movDesc.includes('cisao') ||
      movDesc.includes('restituicao') ||
      movDesc.includes('reembolso') ||
      movDesc.includes('provisionado') ||
      movDesc.includes('bloqueio')
    ) {
      continue;
    }

    const isDividend =
      !movDesc.includes('transferencia') &&
      entryExit !== 'debito' &&
      entryExit !== 'saida' &&
      (movDesc.includes('rendimento') ||
        movDesc.includes('dividendo') ||
        movDesc.includes('juros') ||
        movDesc.includes('jcp'));

    const isSettlement =
      !isDividend &&
      (movDesc.includes('transferencia - liquidacao') ||
        movDesc.includes('transferencia-liquidacao') ||
        movDesc === 'liquidacao');

    // Ignora transferência pura de custódia (STVM entre corretoras) que NÃO é liquidação de compra/venda
    if (!isDividend && !isSettlement && movDesc.includes('transferencia')) {
      continue;
    }

    const isExplicitSell = movDesc.includes('venda') || movDesc === 'v';
    const isExplicitBuy = movDesc.includes('compra') || movDesc === 'c';

    const isSell =
      !isDividend &&
      (isExplicitSell ||
        (isSettlement && (entryExit.includes('debito') || entryExit.includes('saida'))) ||
        (!entryExitKey && movDesc.includes('debito')));

    const isBuy =
      !isDividend &&
      !isSell &&
      (isExplicitBuy ||
        (isSettlement &&
          (entryExit.includes('credito') || entryExit.includes('entrada') || entryExit === '')) ||
        (!entryExitKey && (movDesc.includes('credito') || movDesc === '')));

    if (!isBuy && !isSell && !isDividend) {
      continue;
    }

    const date = dateKey ? parseB3Date(row[dateKey]) : snapshotDate;

    if (isDividend) {
      const rawShares = sharesKey ? Math.abs(parseBRLNumber(row[sharesKey])) : 0;
      const rawPrice = priceKey ? Math.abs(parseBRLNumber(row[priceKey])) : 0;
      const rawTotal = totalKey ? Math.abs(parseBRLNumber(row[totalKey])) : 0;

      const shares = rawShares > 0 ? rawShares : 1;
      const total =
        rawTotal > 0
          ? Number(rawTotal.toFixed(2))
          : rawPrice > 0
          ? Number((shares * rawPrice).toFixed(2))
          : 0;
      const price =
        rawPrice > 0
          ? Number(rawPrice.toFixed(4))
          : total > 0
          ? Number((total / shares).toFixed(4))
          : 0;

      if (total <= 0) continue;

      const proventoLabel =
        movDesc.includes('juros') || movDesc.includes('jcp')
          ? '[PROVENTO B3] JCP Oficial'
          : movDesc.includes('dividendo')
          ? '[PROVENTO B3] Dividendo Oficial'
          : '[PROVENTO B3] Rendimento Oficial';

      sheetTransactions.push({
        id: `b3-div-${date}-${cleanTicker}-${total.toFixed(2)}-${sheetIdx}-${i}`,
        ticker: cleanTicker,
        type: 'DIVIDEND',
        date,
        shares,
        price,
        total,
        broker,
        notes: proventoLabel,
      });
      continue;
    }

    const shares = Math.abs(parseBRLNumber(row[sharesKey]));
    if (shares <= 0) continue;

    let price = priceKey ? Math.abs(parseBRLNumber(row[priceKey])) : 0;
    let total = totalKey ? Math.abs(parseBRLNumber(row[totalKey])) : 0;

    if (price <= 0 && total > 0) {
      price = Number((total / shares).toFixed(4));
    } else if (total <= 0 && price > 0) {
      price = Number((shares * price).toFixed(2));
    } else if (price > 0 && total > 0) {
      total = Number(total.toFixed(2));
      const expectedTotal = Number((shares * Number(price.toFixed(2))).toFixed(2));
      if (Math.abs(total - expectedTotal) <= 0.02) {
        price = Number(price.toFixed(2));
      } else {
        price = Number((total / shares).toFixed(4));
      }
    }

    if (price <= 0 || total <= 0) continue;

    const noteLabel = isSettlement
      ? isSell
        ? SETTLEMENT_SELL_NOTE
        : SETTLEMENT_BUY_NOTE
      : isSell
      ? 'Venda Oficial B3'
      : 'Compra Oficial B3';

    sheetTransactions.push({
      id: `b3-${date}-${cleanTicker}-${isSell ? 'S' : 'B'}-${shares}-${price.toFixed(2)}-${sheetIdx}-${i}`,
      ticker: cleanTicker,
      type: isSell ? 'SELL' : 'BUY',
      date,
      shares,
      price,
      total,
      broker,
      notes: noteLabel,
    });
  }

  return {
    recognized: true,
    isPositionSnapshot: isPositionSheet,
    transactions: sheetTransactions,
    detectedSplits: sheetSplits,
    nonFiiCount,
  };
}

export function consolidateB3SplitEvents(events: DetectedB3SplitEvent[]): DetectedB3SplitEvent[] {
  const byTickerDate = new Map<string, DetectedB3SplitEvent>();
  for (const ev of events) {
    const cleanTicker = normalizeB3Ticker(ev.ticker);
    if (!cleanTicker || !isValidIsoCalendarDate(ev.date) || !(ev.creditedShares > 0)) continue;
    const key = `${cleanTicker}|${ev.date}`;
    const prev = byTickerDate.get(key);
    if (prev) {
      prev.creditedShares = Number((prev.creditedShares + ev.creditedShares).toFixed(6));
    } else {
      byTickerDate.set(key, {
        ticker: cleanTicker,
        date: ev.date,
        creditedShares: Number(ev.creditedShares.toFixed(6)),
      });
    }
  }
  return Array.from(byTickerDate.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker)
  );
}

/**
 * Aplica eventos explícitos de Desdobro da B3 (aba Movimentação) sobre operações anteriores
 * ao evento (tanto novas transações do arquivo quanto transações já existentes na carteira),
 * preservando idempotência caso a planilha seja reimportada.
 */
export function applyDetectedB3Splits(
  newTransactions: Transaction[],
  existingTransactions: Transaction[],
  splitEvents: DetectedB3SplitEvent[]
): {
  adjustedNewTransactions: Transaction[];
  updatedExistingTransactions: Transaction[];
  appliedSplitsCount: number;
} {
  const consolidatedSplits = consolidateB3SplitEvents(splitEvents);
  if (consolidatedSplits.length === 0) {
    return {
      adjustedNewTransactions: newTransactions,
      updatedExistingTransactions: [],
      appliedSplitsCount: 0,
    };
  }

  const workingNew = newTransactions.map((t) => ({ ...t }));
  const workingExisting = existingTransactions
    .filter((t) => !t.id.startsWith('demo-'))
    .map((t) => ({ ...t }));
  const modifiedExistingIds = new Set<string>();
  let appliedSplitsCount = 0;

  for (const split of consolidatedSplits) {
    const priorTrades = [...workingExisting, ...workingNew].filter(
      (tx) =>
        tx.type !== 'DIVIDEND' &&
        normalizeB3Ticker(tx.ticker) === split.ticker &&
        tx.date < split.date
    );
    if (priorTrades.length === 0) continue;

    // Se todas as operações anteriores já têm desdobramento registrado nesta data ou posterior, não reaplica
    const unadjustedForSplit = priorTrades.filter(
      (tx) => !tx.splitAdjustment || tx.splitAdjustment.effectiveDate < split.date
    );
    if (unadjustedForSplit.length === 0) continue;

    // Se parte das compras já possui este split (ex.: compra importada antes), usa fator já conhecido;
    // caso contrário, calcula fator auditável exato: (cotasAntes + cotasCreditadasNoDesdobro) / cotasAntes
    const matchingExistingSplit = priorTrades.find(
      (tx) => tx.splitAdjustment?.effectiveDate === split.date && tx.splitAdjustment.factor > 1
    );

    let stepFactor = matchingExistingSplit?.splitAdjustment?.factor ?? 0;

    if (!(stepFactor > 1)) {
      const sortedPrior = [...priorTrades].sort((a, b) => a.date.localeCompare(b.date));
      let heldBefore = 0;
      for (const tx of sortedPrior) {
        const norm = normalizeTransactionForSplit(tx, split.date);
        heldBefore = Math.max(
          0,
          heldBefore + (tx.type === 'SELL' ? -norm.shares : norm.shares)
        );
      }
      if (heldBefore <= 0) continue;
      stepFactor = Number(((heldBefore + split.creditedShares) / heldBefore).toFixed(6));
    }

    if (!Number.isFinite(stepFactor) || stepFactor <= 1) continue;

    let touchedAny = false;
    const applyToTx = (tx: Transaction): boolean => {
      if (
        tx.type === 'DIVIDEND' ||
        normalizeB3Ticker(tx.ticker) !== split.ticker ||
        tx.date >= split.date
      ) {
        return false;
      }
      if (tx.splitAdjustment && tx.splitAdjustment.effectiveDate >= split.date) {
        return false;
      }
      const prevFactor =
        tx.splitAdjustment && tx.splitAdjustment.factor > 0 ? tx.splitAdjustment.factor : 1;
      tx.splitAdjustment = {
        factor: Number((prevFactor * stepFactor).toFixed(6)),
        effectiveDate: split.date,
        source: 'Extrato Movimentação B3 (Desdobro Oficial)',
      };
      return true;
    };

    for (const tx of workingNew) {
      if (applyToTx(tx)) touchedAny = true;
    }
    for (const tx of workingExisting) {
      if (applyToTx(tx)) {
        modifiedExistingIds.add(tx.id);
        touchedAny = true;
      }
    }

    if (touchedAny) appliedSplitsCount++;
  }

  return {
    adjustedNewTransactions: workingNew,
    updatedExistingTransactions: workingExisting.filter((tx) => modifiedExistingIds.has(tx.id)),
    appliedSplitsCount,
  };
}

export function parseB3FileBuffer(buffer: ArrayBuffer, filterOnlyFIIs = false): B3ParseResult {
  try {
    const bytes = new Uint8Array(buffer);
    if (bytes.length === 0) {
      return {
        success: false,
        transactions: [],
        summary: {
          totalRows: 0,
          fiiRowsFound: 0,
          nonFiiRowsSkipped: 0,
          intraFileDuplicatesRemoved: 0,
          uniqueTickersFound: [],
          totalAmountInvested: 0,
        },
        error: 'O arquivo enviado está vazio.',
      };
    }

    const sheetRowsList: Record<string, unknown>[][] = [];

    if (isBinarySpreadsheet(bytes)) {
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return {
          success: false,
          transactions: [],
          summary: {
            totalRows: 0,
            fiiRowsFound: 0,
            nonFiiRowsSkipped: 0,
            intraFileDuplicatesRemoved: 0,
            uniqueTickersFound: [],
            totalAmountInvested: 0,
          },
          error: 'A planilha da B3 está vazia ou não contém abas válidas.',
        };
      }

      for (const sheetName of workbook.SheetNames) {
        const rows = extractRowsFromSheet(workbook.Sheets[sheetName]);
        if (rows.length > 0) {
          sheetRowsList.push(rows);
        }
      }
    } else {
      const csvText = decodeCsvText(bytes);
      const matrix = parseCsvToMatrix(csvText);
      const rows = convertMatrixToRecords(matrix);
      if (rows.length > 0) {
        sheetRowsList.push(rows);
      }
    }

    if (sheetRowsList.length === 0) {
      return {
        success: false,
        transactions: [],
        summary: {
          totalRows: 0,
          fiiRowsFound: 0,
          nonFiiRowsSkipped: 0,
          intraFileDuplicatesRemoved: 0,
          uniqueTickersFound: [],
          totalAmountInvested: 0,
        },
        error: 'Nenhuma linha encontrada na planilha da B3.',
      };
    }

    let totalRows = 0;
    let nonFiiCount = 0;
    let recognizedSheets = 0;
    let positionSnapshotSheets = 0;
    const rawTransactions: Transaction[] = [];
    const rawSplits: DetectedB3SplitEvent[] = [];

    for (let s = 0; s < sheetRowsList.length; s++) {
      const sheetRows = sheetRowsList[s];
      totalRows += sheetRows.length;
      const parsed = parseSheetRows(sheetRows, filterOnlyFIIs, s);
      if (parsed.recognized) {
        recognizedSheets++;
        if (parsed.isPositionSnapshot) positionSnapshotSheets++;
        nonFiiCount += parsed.nonFiiCount;
        rawTransactions.push(...parsed.transactions);
        rawSplits.push(...parsed.detectedSplits);
      }
    }

    if (recognizedSheets === 0) {
      return {
        success: false,
        transactions: [],
        summary: {
          totalRows,
          fiiRowsFound: 0,
          nonFiiRowsSkipped: 0,
          intraFileDuplicatesRemoved: 0,
          uniqueTickersFound: [],
          totalAmountInvested: 0,
        },
        error:
          'Colunas obrigatórias da B3 não foram reconhecidas (Código de Negociação/Produto e Quantidade). Exporte a planilha em Extratos -> Negociação ou Movimentação no portal da B3.',
      };
    }

    // Se todas as transações vieram de abas de Posição (Retrato de Custódia), consolida múltiplas corretoras por ticker
    const isPositionSnapshot =
      positionSnapshotSheets > 0 &&
      rawTransactions.length > 0 &&
      rawTransactions.every((t) => t.notes === POSITION_SNAPSHOT_NOTE);

    let consolidatedTransactions = rawTransactions;
    let intraFileDuplicatesRemoved = 0;

    if (isPositionSnapshot) {
      const byTicker = new Map<string, Transaction>();
      for (const tx of rawTransactions) {
        const existing = byTicker.get(tx.ticker);
        if (!existing) {
          byTicker.set(tx.ticker, { ...tx });
        } else {
          const mergedShares = existing.shares + tx.shares;
          const mergedTotal = Number((existing.total + tx.total).toFixed(2));
          const mergedPrice = Number((mergedTotal / mergedShares).toFixed(4));
          byTicker.set(tx.ticker, {
            ...existing,
            shares: mergedShares,
            total: mergedTotal,
            price: mergedPrice,
            broker:
              existing.broker === tx.broker ? existing.broker : `${existing.broker} + outras`,
          });
          intraFileDuplicatesRemoved++;
        }
      }
      consolidatedTransactions = Array.from(byTicker.values());
    }

    const consolidatedSplits = consolidateB3SplitEvents(rawSplits);
    // Deduz duplicidades internas antes de calcular proporção de Desdobro intra-arquivo
    const intraDeduped = isPositionSnapshot
      ? consolidatedTransactions
      : deduplicateB3Transactions(consolidatedTransactions, []).uniqueTransactions;
    if (!isPositionSnapshot) {
      intraFileDuplicatesRemoved += consolidatedTransactions.length - intraDeduped.length;
    }

    const { adjustedNewTransactions } = applyDetectedB3Splits(
      intraDeduped,
      [],
      consolidatedSplits
    );

    const validTransactions = adjustedNewTransactions.sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    const uniqueTickersFound = Array.from(
      new Set([
        ...validTransactions.map((t) => t.ticker),
        ...consolidatedSplits.map((s) => s.ticker),
      ])
    ).sort();
    const totalInvested = validTransactions
      .filter((t) => t.type === 'BUY' || !t.type)
      .reduce((acc, t) => acc + t.total, 0);
    const dividendRows = validTransactions.filter((t) => t.type === 'DIVIDEND');
    const totalDividendsReceived = dividendRows.reduce((acc, t) => acc + t.total, 0);

    return {
      success: validTransactions.length > 0 || consolidatedSplits.length > 0,
      isPositionSnapshot,
      transactions: validTransactions,
      detectedSplits: consolidatedSplits,
      summary: {
        totalRows,
        fiiRowsFound: validTransactions.length,
        dividendRowsFound: dividendRows.length,
        splitsDetected: consolidatedSplits.length,
        nonFiiRowsSkipped: nonFiiCount,
        intraFileDuplicatesRemoved,
        uniqueTickersFound,
        totalAmountInvested: Number(totalInvested.toFixed(2)),
        totalDividendsReceived: Number(totalDividendsReceived.toFixed(2)),
        sheetsProcessed: recognizedSheets,
      },
      ...(validTransactions.length === 0 && consolidatedSplits.length === 0
        ? { error: 'Nenhuma compra, venda, provento ou desdobramento de FII/Ação elegível foi encontrado nesta planilha.' }
        : {}),
    };
  } catch (err) {
    console.error('Erro ao processar planilha da B3:', err);
    return {
      success: false,
      transactions: [],
      summary: {
        totalRows: 0,
        fiiRowsFound: 0,
        nonFiiRowsSkipped: 0,
        intraFileDuplicatesRemoved: 0,
        uniqueTickersFound: [],
        totalAmountInvested: 0,
      },
      error:
        'Não foi possível ler o arquivo. Certifique-se de que é um Excel (.xlsx/.xls) ou CSV válido exportado da B3.',
    };
  }
}

export function buildTransactionSignature(
  tx: Pick<Transaction, 'ticker' | 'date' | 'shares' | 'price' | 'type'> & { total?: number }
): string {
  const cleanTicker = normalizeB3Ticker(tx.ticker);
  const cleanDate = parseB3Date(tx.date);
  if (tx.type === 'DIVIDEND') {
    const absTotal = Math.abs(Number(tx.total || tx.shares * tx.price)).toFixed(2);
    return `${cleanTicker}|${cleanDate}|${absTotal}|DIVIDEND`;
  }
  const txType = tx.type === 'SELL' ? 'SELL' : 'BUY';
  const absShares = Math.abs(Number(tx.shares));
  const absPrice = Math.abs(Number(tx.price)).toFixed(2);
  return `${cleanTicker}|${cleanDate}|${absShares}|${absPrice}|${txType}`;
}

function isSettlementNote(notes?: string): boolean {
  return notes === SETTLEMENT_BUY_NOTE || notes === SETTLEMENT_SELL_NOTE;
}

function isTradeNote(notes?: string): boolean {
  return !isSettlementNote(notes) && notes !== POSITION_SNAPSHOT_NOTE;
}

function calendarDaysBetween(earlierIso: string, laterIso: string): number {
  const [y1, m1, d1] = earlierIso.split('-').map(Number);
  const [y2, m2, d2] = laterIso.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  if (!Number.isFinite(utc1) || !Number.isFinite(utc2)) return Number.POSITIVE_INFINITY;
  return Math.round((utc2 - utc1) / 86_400_000);
}

/**
 * Reconcilia uma planilha de Posição (Retrato de Custódia Atual) contra as transações já cadastradas:
 * importa apenas a diferença líquida de cotas (+ novas cotas compradas ou novos FIIs), evitando somar
 * o retrato inteiro em cima da carteira anterior quando o usuário sobe uma nova planilha meses depois.
 */
function reconcilePositionSnapshot(
  snapshotTxs: Transaction[],
  realExisting: Transaction[]
): {
  uniqueTransactions: Transaction[];
  skippedTransactions: Transaction[];
  duplicatesCount: number;
} {
  const currentSharesByTicker = new Map<string, number>();
  const chronological = [...realExisting].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of chronological) {
    if (tx.type === 'DIVIDEND') continue;
    const ticker = normalizeB3Ticker(tx.ticker);
    if (!ticker) continue;
    const norm = normalizeTransactionForSplit(tx);
    const prev = currentSharesByTicker.get(ticker) || 0;
    if (tx.type === 'SELL') {
      currentSharesByTicker.set(ticker, Math.max(0, prev - norm.shares));
    } else {
      currentSharesByTicker.set(ticker, prev + norm.shares);
    }
  }

  const uniqueTransactions: Transaction[] = [];
  const skippedTransactions: Transaction[] = [];
  let duplicatesCount = 0;

  for (const snap of snapshotTxs) {
    const ticker = normalizeB3Ticker(snap.ticker);
    const existingShares = currentSharesByTicker.get(ticker) || 0;
    const delta = Number((snap.shares - existingShares).toFixed(6));

    if (Math.abs(delta) < 1e-6) {
      skippedTransactions.push(snap);
      duplicatesCount++;
    } else if (delta > 0) {
      const unitPrice = Number(snap.price.toFixed(4));
      const deltaTotal = Number((delta * unitPrice).toFixed(2));
      uniqueTransactions.push({
        ...snap,
        type: 'BUY',
        shares: delta,
        price: unitPrice,
        total: deltaTotal,
        notes:
          existingShares > 0
            ? `Ajuste de Custódia B3 (+${delta} novas cotas)`
            : POSITION_SNAPSHOT_NOTE,
      });
      if (existingShares > 0) {
        duplicatesCount++;
      }
    } else {
      const soldShares = Math.abs(delta);
      const unitPrice = Number(snap.price.toFixed(4));
      const deltaTotal = Number((soldShares * unitPrice).toFixed(2));
      uniqueTransactions.push({
        ...snap,
        type: 'SELL',
        shares: soldShares,
        price: unitPrice,
        total: deltaTotal,
        notes: `Ajuste de Custódia B3 (-${soldShares} cotas vendidas)`,
      });
    }
  }

  return { uniqueTransactions, skippedTransactions, duplicatesCount };
}

export function deduplicateB3Transactions(
  incoming: Transaction[],
  existing: Transaction[]
): {
  uniqueTransactions: Transaction[];
  skippedTransactions: Transaction[];
  duplicatesCount: number;
} {
  // Ignorar transações de demonstração (demo-*) na comparação, pois serão substituídas pelos dados reais da B3
  const realExisting = existing.filter((tx) => !tx.id.startsWith('demo-'));

  // Caso especial: Planilha de Posição (Retrato de Custódia) reconciliada por saldo de cotas
  if (
    incoming.length > 0 &&
    incoming.every((tx) => tx.notes === POSITION_SNAPSHOT_NOTE)
  ) {
    return reconcilePositionSnapshot(incoming, realExisting);
  }

  // 1. Deduplicação exata por assinatura (respeitando multiplicidade de execuções parciais no mesmo dia)
  const existingCounts = new Map<string, number>();
  for (const tx of realExisting) {
    const sig = buildTransactionSignature(tx);
    existingCounts.set(sig, (existingCounts.get(sig) || 0) + 1);
  }

  const afterExactPass: Transaction[] = [];
  const skippedTransactions: Transaction[] = [];
  let duplicatesCount = 0;

  // Marca quais existentes já foram consumidos na passagem exata para não reutilizar no cruzamento D+0 <-> D+2
  const consumedExistingIdx = new Set<number>();
  const existingSigs = realExisting.map((tx) => buildTransactionSignature(tx));

  for (const tx of incoming) {
    const sig = buildTransactionSignature(tx);
    const remainingExisting = existingCounts.get(sig) || 0;
    if (remainingExisting > 0) {
      existingCounts.set(sig, remainingExisting - 1);
      const matchIdx = existingSigs.findIndex(
        (s, idx) => s === sig && !consumedExistingIdx.has(idx)
      );
      if (matchIdx >= 0) consumedExistingIdx.add(matchIdx);
      skippedTransactions.push(tx);
      duplicatesCount++;
    } else {
      afterExactPass.push(tx);
    }
  }

  // 2. Deduplicação cruzada D+0 (Negociação) <-> D+2 (Movimentação / Transferência - Liquidação)
  // Evita duplicar compras e vendas quando o investidor importa tanto Negociação quanto Movimentação!
  const uniqueTransactions: Transaction[] = [];

  // Agrupa candidatos de Negociação em aberto caso múltiplos fills do mesmo dia tenham liquidado juntos em D+2
  const pendingIncomingTrades: Transaction[] = [];

  for (const tx of afterExactPass) {
    if (tx.type === 'DIVIDEND') {
      uniqueTransactions.push(tx);
      continue;
    }

    const txTicker = normalizeB3Ticker(tx.ticker);
    const txType = tx.type === 'SELL' ? 'SELL' : 'BUY';
    const txDate = parseB3Date(tx.date);

    if (isSettlementNote(tx.notes)) {
      // Incoming é Liquidação (D+2 da Movimentação): procura compra/venda correspondente em D-6..D0 no existente
      const candidateIndices: number[] = [];
      for (let idx = 0; idx < realExisting.length; idx++) {
        if (consumedExistingIdx.has(idx)) continue;
        const ex = realExisting[idx];
        if (ex.type === 'DIVIDEND') continue;
        if (!isTradeNote(ex.notes)) continue;
        const exType = ex.type === 'SELL' ? 'SELL' : 'BUY';
        if (normalizeB3Ticker(ex.ticker) !== txTicker || exType !== txType) continue;
        const diffDays = calendarDaysBetween(parseB3Date(ex.date), txDate);
        if (diffDays >= 0 && diffDays <= 6) {
          candidateIndices.push(idx);
        }
      }

      // 2a. Match individual exato (mesma qtd e valor total compatível)
      const exactSingleIdx = candidateIndices.find((idx) => {
        const ex = realExisting[idx];
        return (
          Math.abs(ex.shares - tx.shares) < 1e-6 &&
          Math.abs(ex.total - tx.total) <= Math.max(0.05, tx.shares * 0.01)
        );
      });

      if (exactSingleIdx !== undefined) {
        consumedExistingIdx.add(exactSingleIdx);
        skippedTransactions.push(tx);
        duplicatesCount++;
        continue;
      }

      // 2b. Match consolidado por dia de pregão (ex: 2 fills parciais no mesmo pregão liquidados em 1 linha D+2)
      const byTradeDate = new Map<string, number[]>();
      for (const idx of candidateIndices) {
        const d = parseB3Date(realExisting[idx].date);
        const arr = byTradeDate.get(d) || [];
        arr.push(idx);
        byTradeDate.set(d, arr);
      }

      let matchedGroup: number[] | null = null;
      for (const groupIndices of byTradeDate.values()) {
        const sumShares = groupIndices.reduce((acc, idx) => acc + realExisting[idx].shares, 0);
        const sumTotal = groupIndices.reduce((acc, idx) => acc + realExisting[idx].total, 0);
        if (
          Math.abs(sumShares - tx.shares) < 1e-6 &&
          Math.abs(sumTotal - tx.total) <= Math.max(0.05, tx.shares * 0.01)
        ) {
          matchedGroup = groupIndices;
          break;
        }
      }

      if (matchedGroup) {
        for (const idx of matchedGroup) consumedExistingIdx.add(idx);
        skippedTransactions.push(tx);
        duplicatesCount++;
        continue;
      }

      uniqueTransactions.push(tx);
    } else {
      pendingIncomingTrades.push(tx);
    }
  }

  // Simétrico: Incoming é Negociação (D+0) e o usuário já havia subido Movimentação (Liquidação em D+2)
  if (pendingIncomingTrades.length > 0) {
    // Primeiro tenta casar grupos por (ticker, type, tradeDate) contra uma Liquidação existente em D+0..D+6
    const tradeGroups = new Map<string, Transaction[]>();
    for (const tx of pendingIncomingTrades) {
      const key = `${normalizeB3Ticker(tx.ticker)}|${tx.type === 'SELL' ? 'SELL' : 'BUY'}|${parseB3Date(tx.date)}`;
      const list = tradeGroups.get(key) || [];
      list.push(tx);
      tradeGroups.set(key, list);
    }

    for (const group of tradeGroups.values()) {
      const sample = group[0];
      const gTicker = normalizeB3Ticker(sample.ticker);
      const gType = sample.type === 'SELL' ? 'SELL' : 'BUY';
      const gDate = parseB3Date(sample.date);

      // Tenta match individual para cada fill primeiro
      const remainingInGroup: Transaction[] = [];
      for (const tx of group) {
        const singleIdx = realExisting.findIndex((ex, idx) => {
          if (consumedExistingIdx.has(idx) || ex.type === 'DIVIDEND') return false;
          if (!isSettlementNote(ex.notes)) return false;
          const exType = ex.type === 'SELL' ? 'SELL' : 'BUY';
          if (normalizeB3Ticker(ex.ticker) !== gTicker || exType !== gType) return false;
          const diffDays = calendarDaysBetween(gDate, parseB3Date(ex.date));
          return (
            diffDays >= 0 &&
            diffDays <= 6 &&
            Math.abs(ex.shares - tx.shares) < 1e-6 &&
            Math.abs(ex.total - tx.total) <= Math.max(0.05, tx.shares * 0.01)
          );
        });

        if (singleIdx >= 0) {
          consumedExistingIdx.add(singleIdx);
          skippedTransactions.push(tx);
          duplicatesCount++;
        } else {
          remainingInGroup.push(tx);
        }
      }

      if (remainingInGroup.length > 1) {
        const sumShares = remainingInGroup.reduce((acc, t) => acc + t.shares, 0);
        const sumTotal = remainingInGroup.reduce((acc, t) => acc + t.total, 0);
        const consolidatedIdx = realExisting.findIndex((ex, idx) => {
          if (consumedExistingIdx.has(idx) || ex.type === 'DIVIDEND') return false;
          if (!isSettlementNote(ex.notes)) return false;
          const exType = ex.type === 'SELL' ? 'SELL' : 'BUY';
          if (normalizeB3Ticker(ex.ticker) !== gTicker || exType !== gType) return false;
          const diffDays = calendarDaysBetween(gDate, parseB3Date(ex.date));
          return (
            diffDays >= 0 &&
            diffDays <= 6 &&
            Math.abs(ex.shares - sumShares) < 1e-6 &&
            Math.abs(ex.total - sumTotal) <= Math.max(0.05, sumShares * 0.01)
          );
        });

        if (consolidatedIdx >= 0) {
          consumedExistingIdx.add(consolidatedIdx);
          skippedTransactions.push(...remainingInGroup);
          duplicatesCount += remainingInGroup.length;
          continue;
        }
      }

      uniqueTransactions.push(...remainingInGroup);
    }
  }

  uniqueTransactions.sort((a, b) => b.date.localeCompare(a.date));
  return { uniqueTransactions, skippedTransactions, duplicatesCount };
}
