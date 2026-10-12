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
    dividendRowsFound?: number;
    nonFiiRowsSkipped: number;
    intraFileDuplicatesRemoved: number;
    uniqueTickersFound: string[];
    totalAmountInvested: number;
    totalDividendsReceived?: number;
  };
  error?: string;
}

/**
 * Extrai e normaliza o código de negociação (Ticker) de qualquer formato da B3 (FIIs e Ações):
 * - "MXRF11" -> "MXRF11"
 * - "MXRF11F" / "BBAS3F" / "ITSA4F" / "TAEE11F" (fracionário) -> "MXRF11" / "BBAS3" / "ITSA4" / "TAEE11"
 * - "MXRF11 - MAXI RENDA FII" / "BBAS3 - BANCO DO BRASIL" (aba Movimentação) -> "MXRF11" / "BBAS3"
 * - "VGIR11.SA" -> "VGIR11"
 */
export function normalizeB3Ticker(raw: unknown): string {
  if (!raw) return '';
  const upper = String(raw).toUpperCase().trim();

  // Pega o primeiro token antes de espaço, hífen ou ponto (ex: "BBAS3 - BANCO DO BRASIL" -> "BBAS3")
  const firstToken = upper.split(/[\s\-./]+/)[0] || '';

  // Remove sufixo 'F' de lote fracionário para FIIs e Ações (ex: MXRF11F -> MXRF11, BBAS3F -> BBAS3, ITSA4F -> ITSA4)
  if (/^[A-Z]{4}(?:3|4|5|6|11)F$/.test(firstToken)) {
    return firstToken.slice(0, -1);
  }

  // Busca padrão oficial de ticker na string inteira caso o formato seja "FII MXRF11" ou "ACAO BBAS3F"
  const match = upper.match(/\b([A-Z]{4}(?:3|4|5|6|11)[B]?)F?\b/);
  if (match && match[1]) {
    return match[1];
  }

  return firstToken;
}

// Normalizar números formatados em PT-BR (ex: "R$ 1.250,50" -> 1250.5)
function parseBRLNumber(val: unknown): number {
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  if (!val) return 0;

  const str = String(val)
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (!str || str === '-') return 0;

  // Se contiver vírgula e ponto (ex: "1.250,50"), ponto é milhar e vírgula é decimal
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      const cleaned = str.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    } else {
      const cleaned = str.replace(/,/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
  }

  if (str.includes(',')) {
    const cleaned = str.replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Converter datas do Excel (número serial ou string DD/MM/YYYY) para YYYY-MM-DD
function parseB3Date(val: unknown): string {
  if (!val) return new Date().toISOString().slice(0, 10);

  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y >= 2000) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  const parts = str.split(/[/ -]/);
  if (parts.length >= 3) {
    if (parts[0].length <= 2 && parts[2].length >= 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].slice(0, 4);
      return `${y}-${m}-${d}`;
    }
  }

  return new Date().toISOString().slice(0, 10);
}

// Normaliza texto removendo acentos para busca precisa de colunas
function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function findColumnKey(row: Record<string, unknown>, possibleNames: string[]): string | undefined {
  const keys = Object.keys(row);
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

/**
 * Converte uma aba do Excel em linhas JSON, pulando linhas de título vazias no topo
 * caso a planilha da B3 tenha cabeçalho deslocado.
 */
function extractRowsFromSheet(worksheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = XLSX.utils.sheet_to_json< unknown[] >(worksheet, {
    header: 1,
    defval: '',
  });
  if (!matrix || matrix.length === 0) return [];

  // Descobre em qual linha (0 a 10) estão os cabeçalhos reais da tabela da B3
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(10, matrix.length); r++) {
    const rowCells = (matrix[r] || []).map((c) => stripAccents(String(c || '')));
    const hasTickerCol = rowCells.some(
      (c) =>
        c.includes('codigo') ||
        c.includes('negociacao') ||
        c.includes('produto') ||
        c.includes('ativo') ||
        c.includes('ticker')
    );
    const hasQtdCol = rowCells.some((c) => c.includes('quantidade') || c.includes('qtd'));
    if (hasTickerCol && hasQtdCol) {
      headerRowIdx = r;
      break;
    }
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    range: headerRowIdx,
    defval: '',
  });
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
]);

// Units de Ações que terminam em 11 (ex: Taesa, Santander, Klabin, Sanepar, Alupar, Energisa, BTG)
export const STOCK_UNIT_11_TICKERS = new Set([
  'TAEE11',
  'SANB11',
  'KLBN11',
  'BPAC11',
  'ENGI11',
  'ALUP11',
  'SAPR11',
  'IGTI11',
  'STBP11',
  'AESB11',
  'MODL11',
  'RNEW11',
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

  if (/^[A-Z]{4}[3456]$/.test(clean)) {
    return 'ACAO';
  }

  if (/^[A-Z]{4}11[B]?$/.test(clean) && !ETF_11_TICKERS.has(clean)) {
    return 'FII';
  }

  return 'OUTRO';
}

export function parseB3FileBuffer(buffer: ArrayBuffer, filterOnlyFIIs = false): B3ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
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

    // Procura a melhor aba com dados de negociação/movimentação
    let rawData: Record<string, unknown>[] = [];
    for (const sheetName of workbook.SheetNames) {
      const rows = extractRowsFromSheet(workbook.Sheets[sheetName]);
      if (rows.length > 0) {
        const sample = rows[0];
        const hasTicker = findColumnKey(sample, [
          'código de negociação',
          'codigo de negociacao',
          'produto',
          'ativo',
          'ticker',
          'código',
        ]);
        const hasShares = findColumnKey(sample, ['quantidade', 'qtd', 'quantidade negociada']);
        if (hasTicker && hasShares) {
          rawData = rows;
          break;
        }
      }
    }

    if (rawData.length === 0) {
      rawData = extractRowsFromSheet(workbook.Sheets[workbook.SheetNames[0]]);
    }

    if (!rawData || rawData.length === 0) {
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

    const sampleRow = rawData[0];

    const dateKey = findColumnKey(sampleRow, [
      'data do negócio',
      'data negocio',
      'data da operação',
      'data de liquidação',
      'data',
      'date',
    ]);
    const tickerKey = findColumnKey(sampleRow, [
      'código de negociação',
      'codigo de negociacao',
      'produto',
      'ativo',
      'ticker',
      'papel',
      'código',
    ]);
    const movementDescKey = findColumnKey(sampleRow, [
      'movimentação',
      'movimentacao',
      'tipo de movimentação',
      'tipo de movimentacao',
      'operação',
      'operacao',
      'tipo',
      'c/v',
    ]);
    const entryExitKey = findColumnKey(sampleRow, ['entrada/saída', 'entrada/saida']);
    const sharesKey = findColumnKey(sampleRow, [
      'quantidade',
      'quantidade negociada',
      'quantidade (líquida)',
      'qtd',
    ]);
    const priceKey = findColumnKey(sampleRow, [
      'preço (r$)',
      'preco (r$)',
      'preço unitário',
      'preco unitario',
      'valor unitário',
      'preço médio',
      'preço',
      'preco',
    ]);
    const totalKey = findColumnKey(sampleRow, [
      'valor da operação',
      'valor (r$)',
      'valor líquido',
      'valor',
      'total',
      'volume',
    ]);
    const brokerKey = findColumnKey(sampleRow, [
      'instituição',
      'instituicao',
      'corretora',
      'agente de custódia',
    ]);

    if (!tickerKey || !sharesKey) {
      return {
        success: false,
        transactions: [],
        summary: {
          totalRows: rawData.length,
          fiiRowsFound: 0,
          nonFiiRowsSkipped: 0,
          intraFileDuplicatesRemoved: 0,
          uniqueTickersFound: [],
          totalAmountInvested: 0,
        },
        error:
          'Colunas obrigatórias da B3 não foram reconhecidas (Código de Negociação/Produto e Quantidade). Exporte a planilha em Extratos -> Negociação no portal da B3.',
      };
    }

    const rawTransactions: Transaction[] = [];
    let nonFiiCount = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const cleanTicker = normalizeB3Ticker(row[tickerKey]);

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

      // Analisar se a linha é Compra, Venda ou Provento Real (Rendimento/Dividendo/JCP da aba Movimentação)
      const movDesc = movementDescKey ? stripAccents(String(row[movementDescKey] || '')) : '';
      const entryExit = entryExitKey ? stripAccents(String(row[entryExitKey] || '')) : '';

      // Ignora frações em leilão, atualizações cadastrais, cessão de direitos ou aluguel
      if (
        movDesc.includes('fracao') ||
        movDesc.includes('fracoes') ||
        movDesc.includes('leilao') ||
        movDesc.includes('atualizacao') ||
        movDesc.includes('cessao') ||
        movDesc.includes('direito') ||
        movDesc.includes('aluguel') ||
        movDesc.includes('subscricao')
      ) {
        continue;
      }

      const isDividend =
        !movDesc.includes('transferencia') &&
        (movDesc.includes('rendimento') ||
          movDesc.includes('dividendo') ||
          movDesc.includes('juros') ||
          movDesc.includes('jcp'));

      const isSell =
        !isDividend &&
        (movDesc.includes('venda') ||
          movDesc === 'v' ||
          movDesc.includes('debito') ||
          entryExit.includes('debito') ||
          entryExit.includes('saida'));

      const isBuy =
        !isDividend &&
        !isSell &&
        (movDesc.includes('compra') ||
          movDesc === 'c' ||
          movDesc.includes('transferencia - liquidacao') ||
          movDesc.includes('liquidacao') ||
          movDesc.includes('credito') ||
          entryExit.includes('credito') ||
          entryExit.includes('entrada') ||
          movDesc === '');

      if (!isBuy && !isSell && !isDividend) {
        continue;
      }

      const date = dateKey ? parseB3Date(row[dateKey]) : new Date().toISOString().slice(0, 10);
      const broker =
        brokerKey && row[brokerKey] ? String(row[brokerKey]).trim() : 'XP Investimentos';

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

        rawTransactions.push({
          id: `b3-div-${date}-${cleanTicker}-${total.toFixed(2)}-${i}`,
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
        price = Number((total / shares).toFixed(2));
      } else if (total <= 0 && price > 0) {
        total = Number((shares * price).toFixed(2));
      } else if (price > 0 && total > 0) {
        // Consistência: garante que total seja exatamente shares * price arredondado
        price = Number(price.toFixed(2));
        total = Number((shares * price).toFixed(2));
      }

      if (price <= 0 || total <= 0) continue;

      rawTransactions.push({
        id: `b3-${date}-${cleanTicker}-${isSell ? 'S' : 'B'}-${shares}-${price.toFixed(2)}-${i}`,
        ticker: cleanTicker,
        type: isSell ? 'SELL' : 'BUY',
        date,
        shares,
        price,
        total,
        broker,
        notes: isSell ? 'Venda Oficial B3' : 'Compra Oficial B3',
      });
    }

    const validTransactions = rawTransactions.sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    const uniqueTickersFound = Array.from(new Set(validTransactions.map((t) => t.ticker))).sort();
    const totalInvested = validTransactions
      .filter((t) => t.type === 'BUY' || !t.type)
      .reduce((acc, t) => acc + t.total, 0);
    const dividendRows = validTransactions.filter((t) => t.type === 'DIVIDEND');
    const totalDividendsReceived = dividendRows.reduce((acc, t) => acc + t.total, 0);

    return {
      success: true,
      transactions: validTransactions,
      summary: {
        totalRows: rawData.length,
        fiiRowsFound: validTransactions.length,
        dividendRowsFound: dividendRows.length,
        nonFiiRowsSkipped: nonFiiCount,
        intraFileDuplicatesRemoved: 0,
        uniqueTickersFound,
        totalAmountInvested: Number(totalInvested.toFixed(2)),
        totalDividendsReceived: Number(totalDividendsReceived.toFixed(2)),
      },
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

  const existingCounts = new Map<string, number>();
  for (const tx of realExisting) {
    const sig = buildTransactionSignature(tx);
    existingCounts.set(sig, (existingCounts.get(sig) || 0) + 1);
  }

  const uniqueTransactions: Transaction[] = [];
  const skippedTransactions: Transaction[] = [];
  let duplicatesCount = 0;

  for (const tx of incoming) {
    const sig = buildTransactionSignature(tx);
    const remainingExisting = existingCounts.get(sig) || 0;
    if (remainingExisting > 0) {
      existingCounts.set(sig, remainingExisting - 1);
      skippedTransactions.push(tx);
      duplicatesCount++;
    } else {
      uniqueTransactions.push(tx);
    }
  }

  return { uniqueTransactions, skippedTransactions, duplicatesCount };
}
