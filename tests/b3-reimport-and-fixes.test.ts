import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  parseB3FileBuffer,
  deduplicateB3Transactions,
  applyDetectedB3Splits,
  classifyB3Ticker,
} from '../src/lib/b3Parser';
import { normalizeB3Ticker, isValidB3Ticker } from '../src/lib/ticker';
import { findFiiInfo } from '../src/data/fiiDatabase';
import { parsePortfolioBackup, validateTransaction } from '../src/lib/backupValidation';
import { calculatePortfolioPositions } from '../src/domain/portfolioEngine';
import { calculateMonthDividends, parseDividendCalendarDate } from '../src/data/fiiDividendCalendar';
import { evaluateUserPortfolioEvents } from '../src/lib/serverPushEngine';
import { buildVerifiedAnnouncement } from '../src/lib/marketDividendSource';
import { generateIrpfAnnualReport } from '../src/lib/irpfEngine';
import { buildPositionsCsv, buildTransactionsCsv } from '../src/lib/csvExport';
import { TransactionHistory } from '../src/components/TransactionHistory';
import { GoalsCard } from '../src/components/GoalsCard';
import { MagicNumberCard } from '../src/components/MagicNumberCard';
import type { Transaction } from '../src/types/portfolio';

function buildWorkbookBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}

test('re-uploading cumulative B3 Negociação after buying new FIIs imports only new rows without bugging shares', () => {
  // Month 1 upload: MXRF11 (10 cotas) + VISC11 (2 cotas)
  const month1Buffer = buildWorkbookBuffer({
    Negociacao: [
      ['Data do Negócio', 'Tipo de Movimentação', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço', 'Valor'],
      ['10/10/2026', 'Compra', 'XP INVESTIMENTOS', 'MXRF11', 10, 'R$ 9,50', 'R$ 95,00'],
      ['05/10/2026', 'Compra', 'XP INVESTIMENTOS', 'VISC11', 2, 'R$ 110,00', 'R$ 220,00'],
    ],
  });

  const parsed1 = parseB3FileBuffer(month1Buffer);
  assert.equal(parsed1.success, true);
  assert.equal(parsed1.transactions.length, 2);

  // Simulate saving Month 1 with fresh UUIDs
  const savedAfterMonth1: Transaction[] = parsed1.transactions.map((t, i) => ({
    ...t,
    id: `b3-uuid-m1-${i}`,
  }));

  // Month 2 cumulative upload: user bought NEW FII HGLG11 (3 cotas), MORE MXRF11 (5 cotas), and B3SA3F (10 ações)
  const month2Buffer = buildWorkbookBuffer({
    Negociacao: [
      ['Data do Negócio', 'Tipo de Movimentação', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço', 'Valor'],
      ['20/11/2026', 'Compra', 'XP INVESTIMENTOS', 'HGLG11', 3, 'R$ 155,00', 'R$ 465,00'],
      ['18/11/2026', 'Compra', 'XP INVESTIMENTOS', 'MXRF11F', 5, 'R$ 9,60', 'R$ 48,00'],
      ['15/11/2026', 'Compra', 'XP INVESTIMENTOS', 'B3SA3F', 10, 'R$ 10,50', 'R$ 105,00'],
      ['10/10/2026', 'Compra', 'XP INVESTIMENTOS', 'MXRF11', 10, 'R$ 9,50', 'R$ 95,00'],
      ['05/10/2026', 'Compra', 'XP INVESTIMENTOS', 'VISC11', 2, 'R$ 110,00', 'R$ 220,00'],
    ],
  });

  const parsed2 = parseB3FileBuffer(month2Buffer);
  assert.equal(parsed2.success, true);
  assert.equal(parsed2.transactions.length, 5);

  const dedup = deduplicateB3Transactions(parsed2.transactions, savedAfterMonth1);
  assert.equal(dedup.duplicatesCount, 2);
  assert.equal(dedup.uniqueTransactions.length, 3);

  const combined = [...dedup.uniqueTransactions, ...savedAfterMonth1];
  const positions = calculatePortfolioPositions(combined, {}, {}, '2026-11');
  const byTicker = new Map(positions.map((p) => [p.ticker, p]));

  assert.equal(byTicker.get('MXRF11')?.totalShares, 15);
  assert.equal(byTicker.get('VISC11')?.totalShares, 2);
  assert.equal(byTicker.get('HGLG11')?.totalShares, 3);
  assert.equal(byTicker.get('B3SA3')?.totalShares, 10);
  assert.equal(byTicker.get('B3SA3')?.assetClass, 'ACAO');
});

test('Negociação (D+0) + Movimentação (D+2 Liquidação + Proventos + Desdobro/Amortização) never duplicates purchases', () => {
  // 1. User imports Negociação with 2 partial fills on 10/10/2026 (5 + 5 = 10 MXRF11 @ 9.50)
  const negociacaoBuffer = buildWorkbookBuffer({
    Negociacao: [
      ['Data do Negócio', 'Tipo de Movimentação', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço', 'Valor'],
      ['10/10/2026', 'Compra', 'XP', 'MXRF11', 5, 9.5, 47.5],
      ['10/10/2026', 'Compra', 'XP', 'MXRF11', 5, 9.5, 47.5],
    ],
  });
  const negParsed = parseB3FileBuffer(negociacaoBuffer);
  assert.equal(negParsed.transactions.length, 2);

  // 2. User later imports Movimentação containing:
  // - D+2 consolidated settlement (14/10/2026, 10 MXRF11 @ 9.50 = 95.00) -> MUST be skipped!
  // - Real dividend credit (15/10/2026, Rendimento MXRF11 = 0.90) -> MUST be imported as DIVIDEND!
  // - Corporate events (Desdobro, Amortização, Transferência de custódia) -> MUST NOT turn into fake BUYs!
  // - A brand new November settlement not in Negociação (20/11/2026, XPML11, 2 cotas @ 105 = 210) -> MUST be imported!
  const movimentacaoBuffer = buildWorkbookBuffer({
    Movimentacao: [
      ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
      ['Credito', '20/11/2026', 'Transferência - Liquidação', 'XPML11 - XP MALLS FII', 'XP', 2, 105, 210],
      ['Credito', '15/10/2026', 'Rendimento', 'MXRF11 - MAXI RENDA FII', 'XP', 10, 0.09, 0.9],
      ['Credito', '14/10/2026', 'Transferência - Liquidação', 'MXRF11 - MAXI RENDA FII', 'XP', 10, 9.5, 95],
      ['Credito', '12/10/2026', 'Desdobro', 'CPTS11 - CAPITANIA', 'XP', 90, 8.5, 765],
      ['Credito', '12/10/2026', 'Amortização', 'TGAR11 - TG ATIVO REAL', 'XP', 5, 2.0, 10],
      ['Credito', '12/10/2026', 'Transferência', 'MXRF11 - MAXI RENDA FII', 'INTER', 10, 9.5, 95],
    ],
  });

  const movParsed = parseB3FileBuffer(movimentacaoBuffer);
  assert.equal(movParsed.success, true);
  // Only XPML11 settlement, MXRF11 dividend, and MXRF11 settlement are valid rows (Desdobro/Amortização/Transferência STVM ignored)
  assert.equal(movParsed.transactions.length, 3);

  const dedup = deduplicateB3Transactions(movParsed.transactions, negParsed.transactions);
  assert.equal(dedup.duplicatesCount, 1); // MXRF11 D+2 settlement matched against the two 5-share D+0 fills!
  assert.equal(dedup.uniqueTransactions.length, 2); // Only XPML11 buy + MXRF11 dividend!

  const combined = [...dedup.uniqueTransactions, ...negParsed.transactions];
  const positions = calculatePortfolioPositions(combined, {}, {}, '2026-11');
  const mxrf = positions.find((p) => p.ticker === 'MXRF11')!;
  const xpml = positions.find((p) => p.ticker === 'XPML11')!;
  assert.equal(mxrf.totalShares, 10);
  assert.equal(mxrf.paybackReceived, 0.9);
  assert.equal(xpml.totalShares, 2);
});

test('multi-sheet B3 Posição (Custódia) reads both Ações and FIIs tabs and reconciles delta on re-upload', () => {
  const posMonth1 = buildWorkbookBuffer({
    Acoes: [
      ['Produto', 'Instituição', 'Código de Negociação', 'Tipo', 'Quantidade', 'Preço de Fechamento', 'Valor Atualizado'],
      ['BBAS3 - BANCO DO BRASIL', 'XP', 'BBAS3', 'ON', 10, 28.0, 280.0],
      ['Total', '', '', '', '', '', 280.0],
    ],
    'Fundo de Investimento': [
      ['Produto', 'Instituição', 'Código de Negociação', 'Tipo', 'Quantidade', 'Preço de Fechamento', 'Valor Atualizado'],
      ['MXRF11 - MAXI RENDA', 'XP', 'MXRF11', 'Cotas', 20, 9.5, 190.0],
      ['MXRF11 - MAXI RENDA', 'INTER', 'MXRF11', 'Cotas', 5, 9.5, 47.5],
    ],
  });

  const p1 = parseB3FileBuffer(posMonth1);
  assert.equal(p1.success, true);
  assert.equal(p1.isPositionSnapshot, true);
  assert.equal(p1.transactions.length, 2); // BBAS3 (10) + consolidated MXRF11 (25)

  // Month 2: user bought +15 MXRF11 (now 40 total) and a new FII KNCR11 (4 cotas), BBAS3 unchanged (10)
  const posMonth2 = buildWorkbookBuffer({
    Acoes: [
      ['Produto', 'Instituição', 'Código de Negociação', 'Tipo', 'Quantidade', 'Preço de Fechamento', 'Valor Atualizado'],
      ['BBAS3 - BANCO DO BRASIL', 'XP', 'BBAS3', 'ON', 10, 29.0, 290.0],
    ],
    'Fundo de Investimento': [
      ['Produto', 'Instituição', 'Código de Negociação', 'Tipo', 'Quantidade', 'Preço de Fechamento', 'Valor Atualizado'],
      ['MXRF11 - MAXI RENDA', 'XP', 'MXRF11', 'Cotas', 40, 9.7, 388.0],
      ['KNCR11 - KINEA RENDIMENTOS', 'XP', 'KNCR11', 'Cotas', 4, 102.0, 408.0],
    ],
  });

  const p2 = parseB3FileBuffer(posMonth2);
  const dedup = deduplicateB3Transactions(p2.transactions, p1.transactions);
  assert.equal(dedup.uniqueTransactions.length, 2); // +15 MXRF11 delta and +4 KNCR11

  const finalTxs = [...dedup.uniqueTransactions, ...p1.transactions];
  const positions = calculatePortfolioPositions(finalTxs, {}, {}, '2026-11');
  const byTicker = new Map(positions.map((p) => [p.ticker, p]));
  assert.equal(byTicker.get('BBAS3')?.totalShares, 10);
  assert.equal(byTicker.get('MXRF11')?.totalShares, 40);
  assert.equal(byTicker.get('KNCR11')?.totalShares, 4);
});

test('CSV PT-BR semicolon keeps DD/MM/YYYY dates without MM/DD swap and supports B3SA3 backup validation', () => {
  const csvContent = [
    'Data do Negócio;Tipo de Movimentação;Instituição;Código de Negociação;Quantidade;Preço;Valor',
    '01/10/2026;Compra;XP;MXRF11;12;R$ 9,50;R$ 114,00',
    '02/10/2026;Compra;XP;B3SA3;8;R$ 11,00;R$ 88,00',
  ].join('\r\n');
  const encoded = new TextEncoder().encode(csvContent);
  const parsed = parseB3FileBuffer(encoded.buffer);

  assert.equal(parsed.success, true);
  assert.equal(parsed.transactions.length, 2);
  const mxrf = parsed.transactions.find((t) => t.ticker === 'MXRF11')!;
  const b3sa = parsed.transactions.find((t) => t.ticker === 'B3SA3')!;
  assert.equal(mxrf.date, '2026-10-01'); // Strictly October 1st, NOT January 10th!
  assert.equal(b3sa.date, '2026-10-02');
  assert.equal(validateTransaction(b3sa), true);

  assert.equal(normalizeB3Ticker('B3SA3F'), 'B3SA3');
  assert.equal(isValidB3Ticker('B3SA3'), true);
  assert.equal(classifyB3Ticker('B3SA3'), 'ACAO');
  assert.equal(findFiiInfo('IGTI11').assetClass, 'ACAO');

  const backupJson = JSON.stringify({
    version: '5.0.0',
    transactions: [b3sa, mxrf],
    goals: { monthlyTarget: 200, milestoneEquityTarget: 1000, monthlyIncomeTarget: 10 },
    customDividends: { B3SA3: 0.05 },
    fixedIncomeAssets: [],
  });
  assert.equal(parsePortfolioBackup(backupJson).transactions.length, 2);
});

test('server push announcement matching never cross-contaminates distinct FIIs sharing exDate and paymentDate', () => {
  const txs: Transaction[] = [
    { id: '1', ticker: 'MXRF11', type: 'BUY', date: '2026-10-01', shares: 10, price: 9.5, total: 95, broker: 'XP' },
    { id: '2', ticker: 'HGLG11', type: 'BUY', date: '2026-10-01', shares: 2, price: 155, total: 310, broker: 'XP' },
  ];
  const mxrfAnn = buildVerifiedAnnouncement({
    ticker: 'MXRF11',
    source: 'STATUS_INVEST',
    amountPerShare: 0.09,
    exDate: '30/10/2026',
    paymentDate: '16/11/2026',
    isCurrentMonthAnnounced: true,
  })!;
  const hglgAnn = buildVerifiedAnnouncement({
    ticker: 'HGLG11',
    source: 'STATUS_INVEST',
    amountPerShare: 1.1,
    exDate: '30/10/2026',
    paymentDate: '16/11/2026',
    isCurrentMonthAnnounced: true,
  })!;

  // MXRF11 was already announced; HGLG11 is brand new on the exact same exDate & paymentDate
  const events = evaluateUserPortfolioEvents({
    localDate: '2026-11-01',
    preferences: {
      notifyConfirmedDividend: true,
      notifyExDate: true,
      notifyPaymentDay: true,
    },
    transactions: txs,
    announcements: { MXRF11: [mxrfAnn], HGLG11: [hglgAnn] },
    existingEvents: [
      {
        id: 'ev-mxrf',
        userId: 'u1',
        ticker: 'MXRF11',
        eventType: 'DIVIDEND_ANNOUNCED',
        eventReference: 'cycle:2026-10-30:2026-11-16',
        dataVersion: mxrfAnn.dataVersion,
        source: 'STATUS_INVEST',
        sourceEventDate: '2026-10-30',
        payload: { exDate: '2026-10-30', paymentDate: '2026-11-16', amountPerShare: 0.09 },
        digestId: 'd1',
        status: 'sent',
      },
    ],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].ticker, 'HGLG11');
  assert.equal(events[0].eventType, 'DIVIDEND_ANNOUNCED'); // Must be DIVIDEND_ANNOUNCED, NOT false DIVIDEND_UPDATED!
});

test('February calendar clamps day-30 stock schedule, TransactionHistory protects DIVIDEND from edit, and GoalsCard masks privacy mode', () => {
  const cmigTx: Transaction = {
    id: 'cmig-1',
    ticker: 'CMIG4',
    type: 'BUY',
    date: '2026-01-10',
    shares: 10,
    price: 11,
    total: 110,
    broker: 'XP',
  };
  const positions = calculatePortfolioPositions([cmigTx], {}, {}, '2026-02');
  const feb = calculateMonthDividends(positions, new Date('2026-02-10T12:00:00Z'), {}, [cmigTx]);
  assert.equal(feb.events[0].paymentDateFormatted, '28/02/2026');
  assert.ok(parseDividendCalendarDate(feb.events[0].paymentDateFormatted));

  const divReceipt: Transaction = {
    id: 'div-1',
    ticker: 'MXRF11',
    type: 'DIVIDEND',
    date: '2026-10-15',
    shares: 77,
    price: 0.1,
    total: 7.7,
    broker: 'XP',
    notes: '[PROVENTO B3] Rendimento Oficial',
  };
  const historyHtml = renderToStaticMarkup(
    createElement(TransactionHistory, {
      transactions: [cmigTx, divReceipt],
      isPrivacyMode: true,
      pendingSyncIds: ['cmig-1'],
      onEditTransaction: () => {},
      onDeleteTransaction: () => {},
    })
  );
  // Both BUY and DIVIDEND support manual editing, pending badge renders, and share count 10 is masked
  assert.ok(historyHtml.includes('Editar operação de CMIG4'));
  assert.ok(historyHtml.includes('Editar operação de MXRF11'));
  assert.ok(historyHtml.includes('Pendente neste aparelho'));
  assert.ok(!historyHtml.includes('10 cotas'));

  const magicHtml = renderToStaticMarkup(
    createElement(MagicNumberCard, {
      positions,
      monthlyTarget: 200,
      isPrivacyMode: true,
    })
  );
  assert.ok(!magicHtml.includes('Bola de Neve ativada!'));

  const goalsHtml = renderToStaticMarkup(
    createElement(GoalsCard, {
      monthlyTarget: 456.78,
      currentMonthInvested: 123.45,
      monthlyGoalProgressPercent: 27,
      milestoneEquityTarget: 9876.54,
      currentEquity: 3456.78,
      equityGoalProgressPercent: 35,
      monthlyIncomeTarget: 88.88,
      totalMonthlyDividends: 44.44,
      incomeGoalProgressPercent: 50,
      isPrivacyMode: true,
      onOpenSettings: () => {},
    })
  );
  for (const leaked of ['456,78', '123,45', '9.876,54', '3.456,78', '88,88', '44,44', '27%', '35%', '50%']) {
    assert.ok(!goalsHtml.includes(leaked), `GoalsCard leaked ${leaked}`);
  }
});

test('B3 Movimentação Desdobro auto-calculates exact split factor and stays idempotent on re-import', () => {
  const existingBuy: Transaction = {
    id: 'buy-cpts-1',
    ticker: 'CPTS11',
    type: 'BUY',
    date: '2025-05-10',
    shares: 10,
    price: 82,
    total: 820,
    broker: 'XP Investimentos',
  };

  const movWithSplitBuffer = buildWorkbookBuffer({
    Movimentacao: [
      ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
      ['Credito', '25/09/2025', 'Desdobro', 'CPTS11 - CAPITANIA SECURITIES II', 'XP INVESTIMENTOS', 90, '-', '-'],
    ],
  });

  const parsed = parseB3FileBuffer(movWithSplitBuffer);
  assert.equal(parsed.success, true);
  assert.equal(parsed.detectedSplits?.length, 1);
  assert.equal(parsed.detectedSplits?.[0].creditedShares, 90);

  const firstPass = applyDetectedB3Splits([], [existingBuy], parsed.detectedSplits || []);
  assert.equal(firstPass.appliedSplitsCount, 1);
  assert.equal(firstPass.updatedExistingTransactions.length, 1);
  assert.equal(firstPass.updatedExistingTransactions[0].splitAdjustment?.factor, 10);

  const posAfterSplit = calculatePortfolioPositions(
    firstPass.updatedExistingTransactions,
    {},
    {},
    '2026-10'
  );
  assert.equal(posAfterSplit[0].totalShares, 100);
  assert.equal(posAfterSplit[0].averagePrice, 8.2);
  assert.equal(posAfterSplit[0].totalInvested, 820);

  // Re-importing the exact same Movimentação file must NOT double-apply the 10x split!
  const secondPass = applyDetectedB3Splits(
    [],
    firstPass.updatedExistingTransactions,
    parsed.detectedSplits || []
  );
  assert.equal(secondPass.appliedSplitsCount, 0);
  assert.equal(secondPass.updatedExistingTransactions.length, 0);
});

test('IRPF annual report, historical month navigation, CSV formula-escape and failed Push retry work accurately', () => {
  const txs: Transaction[] = [
    { id: 't1', ticker: 'HGLG11', type: 'BUY', date: '2025-03-10', shares: 5, price: 160, total: 800, broker: 'XP Investimentos' },
    { id: 't2', ticker: 'BBAS3', type: 'BUY', date: '2026-02-05', shares: 20, price: 28, total: 560, broker: 'BTG Pactual' },
    { id: 't3', ticker: 'HGLG11', type: 'DIVIDEND', date: '2026-03-14', shares: 5, price: 1.1, total: 5.5, broker: 'XP Investimentos', notes: '[PROVENTO B3] Rendimento Oficial' },
    { id: 't4', ticker: 'BBAS3', type: 'DIVIDEND', date: '2026-03-28', shares: 20, price: 0.45, total: 9.0, broker: 'BTG Pactual', notes: '[PROVENTO B3] JCP Oficial' },
  ];

  const irpf2026 = generateIrpfAnnualReport(txs, [], 2026, new Date('2026-11-24T12:00:00Z'));
  assert.equal(irpf2026.totals.costBasisPrevYear, 800);
  assert.equal(irpf2026.totals.costBasisEndOfYear, 1360);
  assert.equal(irpf2026.totals.totalExemptIncome, 5.5);
  assert.equal(irpf2026.totals.totalExclusiveJcp, 9.0);
  assert.equal(irpf2026.bensEDireitos.find((b) => b.ticker === 'HGLG11')?.itemCode, '73');
  assert.equal(irpf2026.bensEDireitos.find((b) => b.ticker === 'BBAS3')?.itemCode, '01');

  // Historical month navigation (March 2026 viewed in November 2026) shows only actual PAID receipts
  const positions = calculatePortfolioPositions(txs, {}, {}, '2026-11');
  const marchHistorical = calculateMonthDividends(
    positions,
    new Date('2026-03-15T12:00:00Z'),
    {},
    txs,
    new Date('2026-11-24T12:00:00Z')
  );
  assert.equal(marchHistorical.summary.totalReceived, 14.5);
  assert.equal(marchHistorical.summary.totalEstimated, 0);

  // CSV formula-injection defense & BOM
  const maliciousNoteTx: Transaction = {
    ...txs[0],
    notes: '=CMD()|calc',
  };
  const txCsv = buildTransactionsCsv([maliciousNoteTx]);
  assert.ok(txCsv.startsWith('\uFEFF'));
  assert.ok(txCsv.includes("'=CMD()|calc"));
  const posCsv = buildPositionsCsv(positions);
  assert.ok(posCsv.includes('HGLG11'));

  // Failed Push alert events do NOT block re-evaluation when device is re-subscribed
  const ann = buildVerifiedAnnouncement({
    ticker: 'HGLG11',
    source: 'STATUS_INVEST',
    amountPerShare: 1.1,
    exDate: '30/10/2026',
    paymentDate: '16/11/2026',
    isCurrentMonthAnnounced: true,
  })!;
  const retryEvents = evaluateUserPortfolioEvents({
    localDate: '2026-11-01',
    preferences: { notifyConfirmedDividend: true, notifyExDate: true, notifyPaymentDay: true },
    transactions: txs,
    announcements: { HGLG11: [ann] },
    existingEvents: [
      {
        id: 'ev-failed',
        userId: 'u1',
        ticker: 'HGLG11',
        eventType: 'DIVIDEND_ANNOUNCED',
        eventReference: 'cycle:2026-10-30:2026-11-16',
        dataVersion: ann.dataVersion,
        source: 'STATUS_INVEST',
        sourceEventDate: '2026-10-30',
        payload: { exDate: '2026-10-30', paymentDate: '2026-11-16', amountPerShare: 1.1 },
        digestId: 'd-fail',
        status: 'failed',
      },
    ],
  });
  assert.equal(retryEvents.length, 1);
  assert.equal(retryEvents[0].eventType, 'DIVIDEND_ANNOUNCED');
});
