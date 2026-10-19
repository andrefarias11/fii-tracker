import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePortfolioPositions, calculateDividendStaircase, normalizeTransactionForSplit } from '../src/domain/portfolioEngine';
import { calculateMonthDividends } from '../src/data/fiiDividendCalendar';
import { deduplicateB3Transactions } from '../src/lib/b3Parser';
import { evaluateMentorsRecommendations } from '../src/lib/mentorEngine';
import { parsePortfolioBackup } from '../src/lib/backupValidation';
import type { Transaction } from '../src/types/portfolio';

const buy: Transaction = { id: 'one', ticker: 'MXRF11', type: 'BUY', date: '2026-09-01', shares: 10, price: 10, total: 100, broker: 'B3' };
const receipt: Transaction = { ...buy, id: 'div', type: 'DIVIDEND', date: '2026-10-15', total: 1.25, price: 0.125 };
test('partial sales preserve weighted cost basis', () => {
  const txs = [buy, { ...buy, id: 'two', price: 12, total: 120 }, { ...buy, id: 'sell', type: 'SELL' as const, date: '2026-10-01', shares: 5, price: 20, total: 100 }];
  const [position] = calculatePortfolioPositions(txs, {}, {}, '2026-10');
  assert.equal(position.totalShares, 15); assert.equal(position.averagePrice, 11); assert.equal(position.totalInvested, 165);
});
test('high historical prices never cause an inferred split', () => {
  assert.equal(normalizeTransactionForSplit({ ...buy, ticker: 'CPTS11', price: 100, total: 1000 }).shares, 10);
});
test('explicit split preserves cost and fractional quantities', () => {
  const result = normalizeTransactionForSplit({ ...buy, splitAdjustment: { effectiveDate: '2026-10-01', factor: 2.5, source: 'Comunicado importado' } });
  assert.deepEqual(result, { shares: 25, price: 4, total: 100 });
});
test('no extrapolated past payments in payback or staircase', () => {
  const positions = calculatePortfolioPositions([buy], {}, {}, '2026-10');
  assert.equal(positions[0].paybackReceived, 0);
  assert.equal(calculateDividendStaircase(positions, [buy], '2026-10').totalLifetimeDividends, 0);
});
test('only actual receipts count toward payback', () => {
  const positions = calculatePortfolioPositions([buy, receipt], {}, {}, '2026-10');
  assert.equal(positions[0].paybackReceived, 1.25);
});
test('payment date alone never marks money as received', () => {
  const [position] = calculatePortfolioPositions([buy], {}, {}, '2026-10');
  const calendar = calculateMonthDividends([{ ...position, dividendPaymentDate: '15/10/2026', dividendExDate: '30/09/2026', isCurrentMonthAnnounced: true, dividendSource: 'B3_OFICIAL' }], new Date('2026-10-19T12:00:00Z'), {}, [buy]);
  assert.equal(calendar.summary.totalReceived, 0); assert.equal(calendar.events[0].status, 'CONFIRMED');
});
test('purchases after cutoff do not increase announced payment', () => {
  const later = { ...buy, id: 'late', date: '2026-10-05', shares: 100, total: 1000 };
  const [position] = calculatePortfolioPositions([buy, later], {}, {}, '2026-10');
  const calendar = calculateMonthDividends([{ ...position, monthlyDividendPerShare: 0.1, dividendPaymentDate: '15/10/2026', dividendExDate: '30/09/2026', isCurrentMonthAnnounced: true, dividendSource: 'B3_OFICIAL' }], new Date('2026-10-19T12:00:00Z'), {}, [buy, later]);
  assert.equal(calendar.events[0].shares, 10); assert.equal(calendar.events[0].totalValue, 1);
});
test('receipts of fully sold assets remain visible', () => {
  const { summary } = calculateMonthDividends([], new Date('2026-10-19T12:00:00Z'), {}, [receipt]);
  assert.equal(summary.totalReceived, 1.25);
});
test('legacy manual status cannot fabricate an official receipt', () => {
  const positions = calculatePortfolioPositions([buy], {}, {}, '2026-10');
  const { summary } = calculateMonthDividends(positions, new Date('2026-10-19T12:00:00Z'), { MXRF11: 'PAID' }, [buy]);
  assert.equal(summary.totalReceived, 0);
});
test('deduplication respects identical legitimate executions and buy/sell distinction', () => {
  const sell = { ...buy, type: 'SELL' as const, id: 'sell' };
  assert.equal(deduplicateB3Transactions([buy, { ...buy, id: 'two' }, sell], [buy]).uniqueTransactions.length, 2);
  assert.equal(deduplicateB3Transactions([buy], [buy]).uniqueTransactions.length, 0);
});
test('mentors never suggest a purchase above a zero budget', () => {
  const result = evaluateMentorsRecommendations({}, [], 0);
  assert.ok(result.mentors.every(m => m.topPicks.length === 0));
});
const validBackup = () => ({ version: '5.0.0', transactions: [buy], goals: { monthlyTarget: 200, monthlyIncomeTarget: 10, milestoneEquityTarget: 1000 }, customDividends: {}, fixedIncomeAssets: [] });
test('valid current and legacy backups are accepted', () => {
  assert.equal(parsePortfolioBackup(JSON.stringify(validBackup())).transactions.length, 1);
  assert.equal(parsePortfolioBackup(JSON.stringify({ ...validBackup(), version: '2.5' })).transactions.length, 1);
});
test('backup validation rejects malformed dates, amounts, duplicate IDs and unsupported versions', () => {
  for (const changed of [
    { ...validBackup(), version: 'future' },
    { ...validBackup(), transactions: [buy, buy] },
    { ...validBackup(), transactions: [{ ...buy, date: '2026-02-30' }] },
    { ...validBackup(), transactions: [{ ...buy, total: -100 }] },
    { ...validBackup(), customDividends: { MXRF11: 'bad' } },
  ]) assert.throws(() => parsePortfolioBackup(JSON.stringify(changed)));
});

 test('split applies only after its effective date, including dividend cutoff', () => {
  const tx = { ...buy, splitAdjustment: { effectiveDate: '2026-10-01', factor: 2, source: 'Comunicado' } };
  assert.equal(normalizeTransactionForSplit(tx, '2026-09-30').shares, 10);
  assert.equal(normalizeTransactionForSplit(tx, '2026-10-01').shares, 20);
  const [position] = calculatePortfolioPositions([tx], {}, {}, '2026-10');
  const calendar = calculateMonthDividends([{ ...position, monthlyDividendPerShare: 0.1, dividendPaymentDate: '15/10/2026', dividendExDate: '30/09/2026', isCurrentMonthAnnounced: true, dividendSource: 'B3_OFICIAL' }], new Date('2026-10-19T12:00:00Z'), {}, [tx]);
  assert.equal(calendar.events[0].totalValue, 1);
});
test('announced stock payment uses event amount instead of monthly average', () => {
  const [position] = calculatePortfolioPositions([buy], {}, {}, '2026-10');
  const calendar = calculateMonthDividends([{ ...position, assetClass: 'ACAO', monthlyDividendPerShare: 0.1, announcedDividendPerShare: 1.2, dividendPaymentDate: '15/10/2026', dividendExDate: '30/09/2026', isCurrentMonthAnnounced: true, dividendSource: 'B3_OFICIAL' }], new Date('2026-10-19T12:00:00Z'), {}, [buy]);
  assert.equal(calendar.events[0].totalValue, 12);
});
