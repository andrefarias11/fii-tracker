import { BcbIndicators, FiiPosition, FixedIncomeAsset, Transaction } from '../types/portfolio';
import { calculateFixedIncomeMonthlyYield } from '../domain/portfolioEngine';

function escapeCsvCell(raw: string | number | undefined | null): string {
  const str = raw === undefined || raw === null ? '' : String(raw);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

function formatDecimalPtBr(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0,00';
  return value.toFixed(decimals).replace('.', ',');
}

export function buildPositionsCsv(
  positions: FiiPosition[],
  fixedIncomeAssets: FixedIncomeAsset[] = [],
  bcbIndicators: BcbIndicators | null = null
): string {
  const header = [
    'Classe',
    'Ticker / Aplicação',
    'Nome / Instituição',
    'Segmento / Tipo',
    'Quantidade',
    'Preço Médio (R$)',
    'Cotação / Taxa Atual',
    'Total Aplicado (R$)',
    'Posição Atual (R$)',
    'Resultado (R$)',
    'Resultado (%)',
    'Renda Mensal Estimada (R$)',
    'Yield on Cost (% a.a.)',
  ];

  const rows: string[][] = [header];

  for (const pos of positions) {
    rows.push([
      pos.assetClass === 'ACAO' ? 'Ação B3' : 'FII / Fiagro B3',
      pos.ticker,
      pos.name,
      pos.segment,
      formatDecimalPtBr(pos.totalShares, Number.isInteger(pos.totalShares) ? 0 : 4),
      formatDecimalPtBr(pos.averagePrice, 2),
      formatDecimalPtBr(pos.currentPrice, 2),
      formatDecimalPtBr(pos.totalInvested, 2),
      formatDecimalPtBr(pos.currentTotal, 2),
      formatDecimalPtBr(pos.profitLoss, 2),
      formatDecimalPtBr(pos.profitLossPercent, 2),
      formatDecimalPtBr(pos.totalMonthlyDividend, 2),
      formatDecimalPtBr(pos.yieldOnCostPercent * 12, 2),
    ]);
  }

  for (const fi of fixedIncomeAssets) {
    const monthlyYield = calculateFixedIncomeMonthlyYield(fi, bcbIndicators);
    const profit = Number((fi.currentBalance - fi.investedAmount).toFixed(2));
    const profitPct =
      fi.investedAmount > 0 ? Number(((profit / fi.investedAmount) * 100).toFixed(2)) : 0;
    const rateLabel =
      fi.rateType === 'CDI'
        ? `${formatDecimalPtBr(fi.ratePercent, 2)}% CDI`
        : fi.rateType === 'IPCA'
        ? `IPCA + ${formatDecimalPtBr(fi.ratePercent, 2)}%`
        : `${formatDecimalPtBr(fi.ratePercent, 2)}% a.a.`;

    rows.push([
      'Renda Fixa',
      fi.name,
      fi.institution,
      fi.type,
      '1',
      formatDecimalPtBr(fi.investedAmount, 2),
      rateLabel,
      formatDecimalPtBr(fi.investedAmount, 2),
      formatDecimalPtBr(fi.currentBalance, 2),
      formatDecimalPtBr(profit, 2),
      formatDecimalPtBr(profitPct, 2),
      formatDecimalPtBr(monthlyYield, 2),
      '',
    ]);
  }

  return `\uFEFF${rows.map((r) => r.map(escapeCsvCell).join(';')).join('\r\n')}`;
}

export function buildTransactionsCsv(transactions: Transaction[]): string {
  const header = [
    'Data',
    'Tipo',
    'Ticker',
    'Quantidade',
    'Preço / Valor Unitário (R$)',
    'Valor Total (R$)',
    'Corretora',
    'Fator Desdobro',
    'Observações',
  ];

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const rows: string[][] = [header];

  for (const tx of sorted) {
    const typeLabel =
      tx.type === 'DIVIDEND' ? 'Provento' : tx.type === 'SELL' ? 'Venda' : 'Compra';
    const dateBr = /^\d{4}-\d{2}-\d{2}$/.test(tx.date)
      ? tx.date.split('-').reverse().join('/')
      : tx.date;

    rows.push([
      dateBr,
      typeLabel,
      tx.ticker,
      formatDecimalPtBr(tx.shares, Number.isInteger(tx.shares) ? 0 : 4),
      formatDecimalPtBr(tx.price, tx.type === 'DIVIDEND' ? 4 : 2),
      formatDecimalPtBr(tx.total, 2),
      tx.broker || '',
      tx.splitAdjustment ? `${tx.splitAdjustment.factor}x (${tx.splitAdjustment.effectiveDate})` : '',
      tx.notes || '',
    ]);
  }

  return `\uFEFF${rows.map((r) => r.map(escapeCsvCell).join(';')).join('\r\n')}`;
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
