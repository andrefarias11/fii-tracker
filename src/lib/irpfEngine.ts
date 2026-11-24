import { FixedIncomeAsset, Transaction } from '../types/portfolio';
import { findFiiInfo } from '../data/fiiDatabase';
import { normalizeTransactionForSplit } from '../domain/portfolioEngine';
import { normalizeB3Ticker } from './ticker';

export interface IrpfAssetRightItem {
  ticker: string;
  name: string;
  assetCategory: 'FII' | 'FIAGRO' | 'ACAO';
  groupCode: '07' | '03';
  itemCode: '73' | '74' | '01';
  codeLabel: string;
  broker: string;
  sharesPrevYear: number;
  costBasisPrevYear: number; // Situação em 31/12/(ano-1)
  sharesEndOfYear: number;
  averageCostEndOfYear: number;
  costBasisEndOfYear: number; // Situação em 31/12/ano
  discriminacao: string;
}

export interface IrpfFixedIncomeItem {
  id: string;
  name: string;
  institution: string;
  groupCode: '04';
  itemCode: '02' | '03';
  codeLabel: string;
  investedAmount: number;
  currentBalance: number;
  discriminacao: string;
}

export interface IrpfIncomeItem {
  ticker: string;
  name: string;
  ficha: 'ISENTOS' | 'EXCLUSIVA';
  itemCode: '99' | '09' | '10';
  codeLabel: string;
  paymentsCount: number;
  totalAmount: number;
}

export interface IrpfRealizedSaleItem {
  month: string; // YYYY-MM
  ticker: string;
  assetCategory: 'FII' | 'FIAGRO' | 'ACAO';
  sharesSold: number;
  saleTotal: number;
  costBasisSold: number;
  realizedResult: number;
}

export interface IrpfAnnualReport {
  calendarYear: number;
  declarationYear: number;
  availableYears: number[];
  bensEDireitos: IrpfAssetRightItem[];
  rendaFixaItems: IrpfFixedIncomeItem[];
  rendimentosIsentos: IrpfIncomeItem[];
  rendimentosExclusivosJcp: IrpfIncomeItem[];
  realizedSales: IrpfRealizedSaleItem[];
  totals: {
    costBasisPrevYear: number;
    costBasisEndOfYear: number;
    totalExemptIncome: number;
    totalExclusiveJcp: number;
    totalRealizedGainLoss: number;
  };
}

interface HoldingSnapshot {
  shares: number;
  totalCost: number;
  averageCost: number;
  brokerShares: Map<string, number>;
}

function classifyIrpfCategory(ticker: string): {
  category: 'FII' | 'FIAGRO' | 'ACAO';
  groupCode: '07' | '03';
  itemCode: '73' | '74' | '01';
  codeLabel: string;
  name: string;
} {
  const info = findFiiInfo(ticker);
  if (info.assetClass === 'ACAO') {
    return {
      category: 'ACAO',
      groupCode: '03',
      itemCode: '01',
      codeLabel: 'Grupo 03 · Cód. 01 (Ações)',
      name: info.name,
    };
  }
  const seg = info.segment.toLowerCase();
  if (seg.includes('fiagro') || seg.includes('agro')) {
    return {
      category: 'FIAGRO',
      groupCode: '07',
      itemCode: '74',
      codeLabel: 'Grupo 07 · Cód. 74 (Fiagro)',
      name: info.name,
    };
  }
  return {
    category: 'FII',
    groupCode: '07',
    itemCode: '73',
    codeLabel: 'Grupo 07 · Cód. 73 (FII)',
    name: info.name,
  };
}

function computeSnapshotAtDate(
  transactions: Transaction[],
  cutoffIso: string
): Map<string, HoldingSnapshot> {
  const map = new Map<string, HoldingSnapshot>();
  const sorted = [...transactions]
    .filter((tx) => tx.type !== 'DIVIDEND' && tx.date <= cutoffIso)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    const ticker = normalizeB3Ticker(tx.ticker);
    if (!ticker) continue;
    const norm = normalizeTransactionForSplit(tx, cutoffIso);
    const snap = map.get(ticker) || {
      shares: 0,
      totalCost: 0,
      averageCost: 0,
      brokerShares: new Map<string, number>(),
    };
    const broker = (tx.broker || 'Corretora B3').trim();

    if (tx.type === 'SELL') {
      const sold = Math.min(snap.shares, norm.shares);
      const remaining = Number((snap.shares - sold).toFixed(6));
      if (remaining <= 1e-6) {
        snap.shares = 0;
        snap.totalCost = 0;
        snap.averageCost = 0;
        snap.brokerShares.clear();
      } else {
        snap.shares = remaining;
        snap.totalCost = Number((remaining * snap.averageCost).toFixed(2));
        const prevBroker = snap.brokerShares.get(broker) || 0;
        snap.brokerShares.set(broker, Math.max(0, prevBroker - sold));
      }
    } else {
      const nextShares = Number((snap.shares + norm.shares).toFixed(6));
      const nextCost = Number((snap.totalCost + norm.total).toFixed(2));
      snap.shares = nextShares;
      snap.totalCost = nextCost;
      snap.averageCost = nextShares > 0 ? nextCost / nextShares : 0;
      snap.brokerShares.set(broker, (snap.brokerShares.get(broker) || 0) + norm.shares);
    }

    map.set(ticker, snap);
  }

  return map;
}

function pickPrimaryBroker(brokerShares: Map<string, number>, fallback = 'Corretora B3'): string {
  let best = fallback;
  let bestCount = -1;
  for (const [b, count] of brokerShares) {
    if (count > bestCount) {
      best = b;
      bestCount = count;
    }
  }
  return best;
}

function formatBRLPlain(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export function getAvailableIrpfYears(
  transactions: Transaction[],
  now = new Date()
): number[] {
  const realTxs = transactions.some((t) => !t.id.startsWith('demo-'))
    ? transactions.filter((t) => !t.id.startsWith('demo-'))
    : transactions;

  const currentYear = Number(
    now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 4)
  );
  const years = new Set<number>([currentYear, currentYear - 1]);

  for (const tx of realTxs) {
    const y = Number((tx.date || '').slice(0, 4));
    if (Number.isInteger(y) && y >= 2015 && y <= currentYear + 1) {
      years.add(y);
    }
  }

  return Array.from(years).sort((a, b) => b - a);
}

export function generateIrpfAnnualReport(
  transactions: Transaction[],
  fixedIncomeAssets: FixedIncomeAsset[] = [],
  calendarYear?: number,
  now = new Date()
): IrpfAnnualReport {
  const realTxs = transactions.some((t) => !t.id.startsWith('demo-'))
    ? transactions.filter((t) => !t.id.startsWith('demo-'))
    : transactions;
  const realFi = fixedIncomeAssets.some((f) => !f.id.startsWith('demo-fi-'))
    ? fixedIncomeAssets.filter((f) => !f.id.startsWith('demo-fi-'))
    : fixedIncomeAssets;

  const availableYears = getAvailableIrpfYears(realTxs, now);
  const currentYear = Number(
    now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 4)
  );
  const targetYear =
    calendarYear ??
    (realTxs.some((t) => t.date.startsWith(`${currentYear - 1}-`))
      ? currentYear - 1
      : currentYear);

  const prevCutoff = `${targetYear - 1}-12-31`;
  const endCutoff = `${targetYear}-12-31`;

  const prevSnapMap = computeSnapshotAtDate(realTxs, prevCutoff);
  const endSnapMap = computeSnapshotAtDate(realTxs, endCutoff);

  const allTickers = new Set<string>([...prevSnapMap.keys(), ...endSnapMap.keys()]);
  const bensEDireitos: IrpfAssetRightItem[] = [];

  for (const ticker of Array.from(allTickers).sort()) {
    const prev = prevSnapMap.get(ticker);
    const end = endSnapMap.get(ticker);
    const sharesPrev = prev?.shares || 0;
    const sharesEnd = end?.shares || 0;

    // Só entra em Bens e Direitos se havia posição em 31/12/(ano-1) OU em 31/12/ano
    if (sharesPrev <= 1e-6 && sharesEnd <= 1e-6) continue;

    const meta = classifyIrpfCategory(ticker);
    const broker =
      sharesEnd > 1e-6
        ? pickPrimaryBroker(end!.brokerShares)
        : pickPrimaryBroker(prev!.brokerShares);
    const costPrev = sharesPrev > 1e-6 ? Number((prev?.totalCost || 0).toFixed(2)) : 0;
    const costEnd = sharesEnd > 1e-6 ? Number((end?.totalCost || 0).toFixed(2)) : 0;
    const avgEnd = sharesEnd > 1e-6 ? Number((costEnd / sharesEnd).toFixed(2)) : 0;

    const unitWord = meta.category === 'ACAO' ? 'AÇÕES' : 'COTAS';
    const classPhrase =
      meta.category === 'ACAO'
        ? `DE ${meta.name.toUpperCase()}`
        : meta.category === 'FIAGRO'
        ? `DO FIAGRO ${meta.name.toUpperCase()}`
        : `DO FUNDO IMOBILIÁRIO ${meta.name.toUpperCase()}`;

    const discriminacao =
      sharesEnd > 1e-6
        ? `${Number(sharesEnd.toFixed(4))} ${unitWord} ${classPhrase} (TICKER B3: ${ticker}), ADQUIRIDAS PELO CUSTO MÉDIO PONDERADO DE ${formatBRLPlain(avgEnd)} POR UNIDADE (CUSTO TOTAL DE AQUISIÇÃO ${formatBRLPlain(costEnd)}), CUSTODIADAS NA INSTITUIÇÃO ${broker.toUpperCase()}.`
        : `POSIÇÃO DE ${ticker} (${meta.name.toUpperCase()}) INTEGRALMENTE ENCERRADA AO LONGO DE ${targetYear} (SALDO EM 31/12/${targetYear - 1}: ${Number(sharesPrev.toFixed(4))} ${unitWord}).`;

    bensEDireitos.push({
      ticker,
      name: meta.name,
      assetCategory: meta.category,
      groupCode: meta.groupCode,
      itemCode: meta.itemCode,
      codeLabel: meta.codeLabel,
      broker,
      sharesPrevYear: Number(sharesPrev.toFixed(4)),
      costBasisPrevYear: costPrev,
      sharesEndOfYear: Number(sharesEnd.toFixed(4)),
      averageCostEndOfYear: avgEnd,
      costBasisEndOfYear: costEnd,
      discriminacao,
    });
  }

  // Renda Fixa & Caixinhas (referência atual de posição)
  const rendaFixaItems: IrpfFixedIncomeItem[] = realFi.map((fi) => {
    const isExempt = fi.isExempt || fi.type === 'LCI_LCA';
    const itemCode: '02' | '03' = isExempt ? '03' : '02';
    const codeLabel = isExempt
      ? 'Grupo 04 · Cód. 03 (Títulos Isentos: LCI/LCA)'
      : 'Grupo 04 · Cód. 02 (Renda Fixa: CDB/Tesouro/Caixinha)';
    const discriminacao = `APLICAÇÃO DE RENDA FIXA "${fi.name.toUpperCase()}" (${fi.type}) MANTIDA JUNTO A ${fi.institution.toUpperCase()}, VALOR APLICADO DE ${formatBRLPlain(fi.investedAmount)}.`;
    return {
      id: fi.id,
      name: fi.name,
      institution: fi.institution,
      groupCode: '04',
      itemCode,
      codeLabel,
      investedAmount: Number(fi.investedAmount.toFixed(2)),
      currentBalance: Number(fi.currentBalance.toFixed(2)),
      discriminacao,
    };
  });

  // Rendimentos Isentos vs Tributação Exclusiva (JCP) no ano-calendário
  const incomeMap = new Map<string, IrpfIncomeItem>();
  const yearPrefix = `${targetYear}-`;

  for (const tx of realTxs) {
    if (tx.type !== 'DIVIDEND' || !tx.date.startsWith(yearPrefix)) continue;
    const ticker = normalizeB3Ticker(tx.ticker);
    if (!ticker) continue;
    const amount = Math.abs(Number(tx.total || 0));
    if (amount <= 0) continue;

    const meta = classifyIrpfCategory(ticker);
    const notesUpper = (tx.notes || '').toUpperCase();
    const isJcp = notesUpper.includes('JCP') || notesUpper.includes('JUROS');

    const ficha: 'ISENTOS' | 'EXCLUSIVA' = isJcp ? 'EXCLUSIVA' : 'ISENTOS';
    const itemCode: '99' | '09' | '10' = isJcp
      ? '10'
      : meta.category === 'ACAO'
      ? '09'
      : '99';
    const codeLabel = isJcp
      ? 'Tributação Exclusiva · Cód. 10 (JCP)'
      : meta.category === 'ACAO'
      ? 'Rendimentos Isentos · Cód. 09 (Dividendos de Ações)'
      : 'Rendimentos Isentos · Cód. 99 (Rendimentos de FII / Fiagro)';

    const mapKey = `${ticker}|${ficha}|${itemCode}`;
    const existing = incomeMap.get(mapKey);
    if (existing) {
      existing.paymentsCount += 1;
      existing.totalAmount = Number((existing.totalAmount + amount).toFixed(2));
    } else {
      incomeMap.set(mapKey, {
        ticker,
        name: meta.name,
        ficha,
        itemCode,
        codeLabel,
        paymentsCount: 1,
        totalAmount: Number(amount.toFixed(2)),
      });
    }
  }

  const allIncomes = Array.from(incomeMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount || a.ticker.localeCompare(b.ticker)
  );
  const rendimentosIsentos = allIncomes.filter((i) => i.ficha === 'ISENTOS');
  const rendimentosExclusivosJcp = allIncomes.filter((i) => i.ficha === 'EXCLUSIVA');

  // Apuração de Vendas Realizadas no Ano (Resultado p/ Renda Variável / DARF)
  const realizedSales: IrpfRealizedSaleItem[] = [];
  const runningState = new Map<string, { shares: number; avgCost: number }>();
  const sortedTradesUpToYearEnd = [...realTxs]
    .filter((tx) => tx.type !== 'DIVIDEND' && tx.date <= endCutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sortedTradesUpToYearEnd) {
    const ticker = normalizeB3Ticker(tx.ticker);
    if (!ticker) continue;
    const norm = normalizeTransactionForSplit(tx, tx.date);
    const cur = runningState.get(ticker) || { shares: 0, avgCost: 0 };

    if (tx.type === 'SELL') {
      const soldShares = Math.min(cur.shares > 0 ? cur.shares : norm.shares, norm.shares);
      const costSold = Number((soldShares * cur.avgCost).toFixed(2));
      const saleTotal = Number(norm.total.toFixed(2));
      const realized = Number((saleTotal - costSold).toFixed(2));

      if (tx.date.startsWith(yearPrefix)) {
        const meta = classifyIrpfCategory(ticker);
        realizedSales.push({
          month: tx.date.slice(0, 7),
          ticker,
          assetCategory: meta.category,
          sharesSold: Number(soldShares.toFixed(4)),
          saleTotal,
          costBasisSold: costSold,
          realizedResult: realized,
        });
      }

      const rem = Math.max(0, Number((cur.shares - soldShares).toFixed(6)));
      runningState.set(ticker, { shares: rem, avgCost: rem > 1e-6 ? cur.avgCost : 0 });
    } else {
      const totalCost = cur.shares * cur.avgCost + norm.total;
      const nextShares = Number((cur.shares + norm.shares).toFixed(6));
      runningState.set(ticker, {
        shares: nextShares,
        avgCost: nextShares > 0 ? totalCost / nextShares : 0,
      });
    }
  }

  const costBasisPrevYear = Number(
    bensEDireitos.reduce((acc, i) => acc + i.costBasisPrevYear, 0).toFixed(2)
  );
  const costBasisEndOfYear = Number(
    bensEDireitos.reduce((acc, i) => acc + i.costBasisEndOfYear, 0).toFixed(2)
  );
  const totalExemptIncome = Number(
    rendimentosIsentos.reduce((acc, i) => acc + i.totalAmount, 0).toFixed(2)
  );
  const totalExclusiveJcp = Number(
    rendimentosExclusivosJcp.reduce((acc, i) => acc + i.totalAmount, 0).toFixed(2)
  );
  const totalRealizedGainLoss = Number(
    realizedSales.reduce((acc, i) => acc + i.realizedResult, 0).toFixed(2)
  );

  return {
    calendarYear: targetYear,
    declarationYear: targetYear + 1,
    availableYears,
    bensEDireitos,
    rendaFixaItems,
    rendimentosIsentos,
    rendimentosExclusivosJcp,
    realizedSales,
    totals: {
      costBasisPrevYear,
      costBasisEndOfYear,
      totalExemptIncome,
      totalExclusiveJcp,
      totalRealizedGainLoss,
    },
  };
}
