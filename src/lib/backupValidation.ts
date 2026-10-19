import type { Transaction, PortfolioGoals, FixedIncomeAsset } from '../types/portfolio';

export interface PortfolioBackup { version: string; transactions: Transaction[]; goals: PortfolioGoals; customDividends: Record<string, number>; fixedIncomeAssets: FixedIncomeAsset[] }
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12;
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
export function validateTransaction(v: unknown): v is Transaction {
  if (!record(v)) return false;
  return typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 200 &&
    typeof v.ticker === 'string' && /^[A-Z]{4}\d{1,2}B?$/.test(v.ticker) && date(v.date) &&
    (v.type === undefined || ['BUY','SELL','DIVIDEND'].includes(String(v.type))) &&
    number(v.shares) && number(v.price) && number(v.total) && typeof v.broker === 'string' &&
    (v.splitAdjustment === undefined || (record(v.splitAdjustment) && date(v.splitAdjustment.effectiveDate) &&
      number(v.splitAdjustment.factor) && v.splitAdjustment.factor > 0 && typeof v.splitAdjustment.source === 'string' && v.splitAdjustment.source.trim().length > 0));
}
export function parsePortfolioBackup(json: string): PortfolioBackup {
  if (json.length > 10_000_000) throw new Error('Backup maior que 10 MB.');
  const value: unknown = JSON.parse(json);
  if (!record(value) || !['2.5', '5.0.0'].includes(String(value.version)) ||
      !Array.isArray(value.transactions) || value.transactions.length > 50_000 || !value.transactions.every(validateTransaction) ||
      new Set(value.transactions.map(t => t.id)).size !== value.transactions.length ||
      !record(value.goals) || !['monthlyTarget','milestoneEquityTarget','monthlyIncomeTarget'].every(k => number(value.goals && (value.goals as Record<string,unknown>)[k])) ||
      !record(value.customDividends) || !Object.entries(value.customDividends).every(([k,v]) => /^[A-Z]{4}\d{1,2}B?$/.test(k) && number(v)) ||
      !Array.isArray(value.fixedIncomeAssets) || !value.fixedIncomeAssets.every(a => record(a) &&
        typeof a.id === 'string' && a.id.length > 0 && typeof a.name === 'string' && typeof a.institution === 'string' &&
        ['CAIXINHA','CDB','TESOURO_SELIC','TESOURO_IPCA','TESOURO_PREFIXADO','LCI_LCA','OUTROS'].includes(String(a.type)) &&
        ['CDI','IPCA','PREFIXADO'].includes(String(a.rateType)) && number(a.ratePercent) && number(a.investedAmount) && number(a.currentBalance) &&
        typeof a.isExempt === 'boolean' && typeof a.updatedAt === 'string' && (!a.maturityDate || date(a.maturityDate))) ||
      new Set(value.fixedIncomeAssets.map(a => a.id)).size !== value.fixedIncomeAssets.length) {
    throw new Error('Backup inválido ou versão não suportada. Nenhum dado foi alterado.');
  }
  return value as unknown as PortfolioBackup;
}
