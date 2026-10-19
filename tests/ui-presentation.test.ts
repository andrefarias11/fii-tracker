import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssetDetailsSheet } from '../src/components/AssetDetailsSheet';
import { PositionList } from '../src/components/PositionList';
import { PortfolioSummary } from '../src/components/PortfolioSummary';
import { OpportunityRadar } from '../src/components/OpportunityRadar';
import { MentorsTab } from '../src/components/MentorsTab';
import { AchievementsTimeline } from '../src/components/AchievementsTimeline';
import {
  formatCurrency,
  formatDecimal,
  formatPercent,
} from '../src/lib/formatFinancial';
import type { FiiPosition, QuoteData } from '../src/types/portfolio';

const position: FiiPosition = {
  ticker: 'MXRF11',
  name: 'Maxi Renda',
  assetClass: 'FII',
  segment: 'Papel',
  base: 10,
  vp: 9.72,
  pvp: 0.95,
  totalShares: 111,
  averagePrice: 8.91,
  totalInvested: 989.11,
  currentPrice: 9.23,
  currentTotal: 1024.53,
  profitLoss: 35.42,
  profitLossPercent: 3.58,
  monthlyDividendPerShare: 0.09,
  totalMonthlyDividend: 9.99,
  currentYieldPercent: 0.98,
  yieldOnCostPercent: 1.01,
  ceilingPrice: 10,
  magicNumber: 103,
  magicProgressPercent: 100,
};
const quotes: Record<string, QuoteData> = {
  MXRF11: {
    ticker: 'MXRF11',
    price: 9.23,
    changePercent: 0.5,
    prevClose: 9.2,
    updatedAt: '2026-10-19T12:00:00Z',
  },
};
const noop = () => {};
const sheetProps = {
  ticker: 'MXRF11',
  positions: [position],
  quotes,
  transactions: [],
  onClose: noop,
  onOpenBuyModal: noop,
  onUpdateDividend: noop,
  onOpenMapForTicker: noop,
  onOpenAiForTicker: noop,
};

test('shared asset sheet hides personal values while keeping the public quote readable', () => {
  const publicMarkup = renderToStaticMarkup(
    createElement(AssetDetailsSheet, sheetProps),
  );
  assert.ok(publicMarkup.includes('1.024,53'));
  const privateMarkup = renderToStaticMarkup(
    createElement(AssetDetailsSheet, { ...sheetProps, isPrivacyMode: true }),
  );
  for (const sensitive of ['1.024,53', '989,11', '35,42', '8,91', '3,58%'])
    assert.ok(!privateMarkup.includes(sensitive), sensitive);
  assert.ok(privateMarkup.includes('••••'));
  assert.ok(privateMarkup.includes('9,23'));
  assert.ok(privateMarkup.includes('role="dialog"'));
});

test('closed and unknown asset sheets do not fabricate position or quote values', () => {
  assert.equal(
    renderToStaticMarkup(
      createElement(AssetDetailsSheet, { ...sheetProps, ticker: null }),
    ),
    '',
  );
  const markup = renderToStaticMarkup(
    createElement(AssetDetailsSheet, {
      ...sheetProps,
      ticker: 'ZZZZ11',
      positions: [],
      quotes: {},
    }),
  );
  assert.ok(markup.includes('Você ainda não tem este ativo'));
  assert.ok(markup.includes('sem atualização verificável'));
  assert.ok(!markup.includes('R$'));
});

test('summary and portfolio list mask the same personal totals and returns', () => {
  const markup = renderToStaticMarkup(
    createElement(
      'div',
      null,
      createElement(PositionList, {
        positions: [position],
        isPrivacyMode: true,
        onUpdateDividend: noop,
        onOpenAsset: noop,
      }),
      createElement(PortfolioSummary, {
        currentEquity: 1024.53,
        totalInvested: 989.11,
        totalProfitLoss: 35.42,
        totalProfitLossPercent: 3.58,
        totalMonthlyDividends: 9.99,
        isPrivacyMode: true,
      }),
    ),
  );
  for (const sensitive of ['1.024,53', '989,11', '35,42', '3,58%', '9,99'])
    assert.ok(!markup.includes(sensitive), sensitive);
});

test('portfolio, Radar and mentors expose the shared asset entry point', () => {
  const components = [
    createElement(PositionList, {
      positions: [position],
      onUpdateDividend: noop,
      onOpenAsset: noop,
    }),
    createElement(OpportunityRadar, {
      quotes,
      positions: [position],
      monthlyTarget: 500,
      currentMonthInvested: 0,
      totalMonthlyDividends: 9.99,
      onOpenAsset: noop,
    }),
    createElement(MentorsTab, {
      quotes,
      positions: [position],
      monthlyTarget: 500,
      onOpenAsset: noop,
    }),
  ];
  for (const component of components)
    assert.ok(
      renderToStaticMarkup(component).includes(
        'aria-label="Abrir ficha de MXRF11"',
      ),
    );
});

test('financial formatting uses pt-BR decimals and safe unavailable states', () => {
  assert.equal(formatDecimal(1.2), '1,20');
  assert.equal(formatPercent(-3.5), '-3,50%');
  assert.equal(formatPercent(NaN), '—');
  assert.equal(formatCurrency(Infinity), '—');
  assert.equal(formatCurrency(98765.43, true), 'R$ ••••');
});

test('private analyses and trophies do not expose personal budgets or totals in disclosures', () => {
  const markup = renderToStaticMarkup(
    createElement(
      'div',
      null,
      createElement(OpportunityRadar, {
        quotes,
        positions: [position],
        monthlyTarget: 543.21,
        currentMonthInvested: 54.32,
        totalMonthlyDividends: 9.99,
        isPrivacyMode: true,
        onOpenAsset: noop,
      }),
      createElement(MentorsTab, {
        quotes,
        positions: [position],
        monthlyTarget: 543.21,
        isPrivacyMode: true,
        onOpenAsset: noop,
      }),
      createElement(AchievementsTimeline, {
        positions: [position],
        transactions: [],
        summary: {
          totalInvested: 989.11,
          currentEquity: 1024.53,
          totalMonthlyDividends: 9.99,
        },
        onOpenB3Modal: noop,
        isPrivacyMode: true,
      }),
    ),
  );
  for (const sensitive of ['543,21', '54,32', '488,89', '989,11', '1.024,53'])
    assert.ok(!markup.includes(sensitive), sensitive);
});
