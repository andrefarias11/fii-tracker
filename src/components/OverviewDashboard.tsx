'use client';

import { ArrowUpRight, CalendarDays, Plus, Upload, Wallet } from 'lucide-react';
import type { FiiPosition, Transaction, UnifiedPortfolioSummary } from '../types/portfolio';
import { calculateMonthDividends, getDividendEventDates, formatDividendCalendarDate } from '../data/fiiDividendCalendar';
import { formatCurrency, formatPercent } from '../lib/formatFinancial';
import { Button } from './ui/Controls';

interface Props {
  positions: FiiPosition[];
  transactions: Transaction[];
  summary: UnifiedPortfolioSummary;
  privateMode: boolean;
  onPortfolio: () => void;
  onDividends: () => void;
  onImport: () => void;
  onAdd: () => void;
  onAsset: (ticker: string) => void;
}

export function OverviewDashboard({ positions, transactions, summary, privateMode, onPortfolio, onDividends, onImport, onAdd, onAsset }: Props) {
  const now = new Date();
  const month = calculateMonthDividends(positions, now, {}, transactions);
  const today = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const next = month.events.filter(e => e.status === 'CONFIRMED')
    .map(event => ({ event, date: getDividendEventDates(event, now).paymentDate }))
    .filter(({ date }) => date.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const money = (value: number) => formatCurrency(value, privateMode);
  const allocations = [
    { label: 'Fundos imobiliários', value: summary.fiiEquity, percent: summary.fiiPercent, color: 'var(--accent)' },
    { label: 'Ações', value: summary.acaoEquity, percent: summary.acaoPercent, color: '#93c5fd' },
    { label: 'Renda fixa', value: summary.fixedIncomeEquity, percent: summary.fixedIncomePercent, color: '#6ee7b7' },
  ];
  return <div className="overview-grid">
    <section className="overview-hero" aria-labelledby="equity-title">
      <div className="flex items-center justify-between gap-3"><p className="eyebrow" id="equity-title">Seu patrimônio</p><Wallet className="h-5 w-5 text-zinc-400" /></div>
      <p className="hero-value mt-5">{money(summary.totalGlobalEquity)}</p>
      <p className="mt-3 text-sm text-zinc-300">Resultado acumulado <span className={`financial-result ${privateMode ? 'is-private' : summary.totalGlobalProfitLoss >= 0 ? 'is-positive' : 'is-negative'}`}>{money(summary.totalGlobalProfitLoss)} · {formatPercent(summary.totalGlobalProfitLossPercent, privateMode)}</span></p>
      <p className="ui-caption mt-2">Bolsa e renda fixa · aplicado {money(summary.totalGlobalInvested)}</p>
      <div className="overview-income"><p className="eyebrow">Renda mensal estimada da carteira</p><p className="ui-value-lg mt-2">{money(summary.totalGlobalMonthlyIncome)}</p><p className="ui-caption mt-1">Estimativa combinada de proventos e renda fixa.</p></div>
      <div className="mt-7 flex flex-wrap gap-2"><Button variant="primary" onClick={onAdd}><Plus size={16} /> Registrar operação</Button><Button onClick={onImport}><Upload size={16} /> Importar B3</Button></div>
    </section>
    <section className="ui-section" aria-labelledby="income-title">
      <p className="eyebrow">Proventos da bolsa</p><h2 className="ui-title mt-2" id="income-title">{now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })}</h2>
      <dl className="income-metrics mt-5">
        <div className="income-metric income-metric--received"><dt><span className="status-dot" />Recebido</dt><dd>{money(month.summary.totalReceived)}</dd><p>Registrado no extrato</p></div>
        <div className="income-metric income-metric--confirmed"><dt><span className="status-dot" />Confirmado</dt><dd>{money(month.summary.totalConfirmed)}</dd><p>Anunciado, ainda sem recibo</p></div>
        <div className="income-metric income-metric--estimated"><dt><span className="status-dot" />Estimado</dt><dd>{money(month.summary.totalEstimated)}</dd><p>Projeção, sujeita a mudança</p></div>
      </dl>
      <Button variant="ghost" className="mt-3 w-full justify-between" onClick={onDividends}>Acompanhar proventos <ArrowUpRight size={16} /></Button>
    </section>
    <section className="ui-section"><div className="flex items-center justify-between gap-3"><h2 className="ui-title">Distribuição da carteira</h2><Button variant="ghost" onClick={onPortfolio}>Ver carteira <ArrowUpRight size={16} /></Button></div>
      {summary.totalGlobalEquity > 0 ? <>
        {!privateMode && <div className="allocation-bar mt-5" aria-hidden="true">{allocations.map(item => <span key={item.label} style={{ width: `${Math.max(0, item.percent)}%`, background: item.color }} />)}</div>}
        <dl className="mt-4 divide-y divide-white/10">{allocations.map(item => <div key={item.label} className="flex flex-wrap items-center justify-between gap-2 py-3"><dt className="text-sm text-zinc-300"><span className="status-dot" style={{ background: item.color }} />{item.label}</dt><dd className="text-sm font-medium">{money(item.value)} <span className="ml-2 text-zinc-400">{formatPercent(item.percent, privateMode)}</span></dd></div>)}</dl>
      </> : <div className="portfolio-empty-state py-5">
        <p className="ui-caption">Sua distribuição aparece aqui quando você adicionar seus primeiros ativos.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onImport}><Upload size={16} /> Importar B3</Button>
          <Button onClick={onAdd}><Plus size={16} /> Registrar operação</Button>
        </div>
      </div>}
    </section>
    <section className="ui-section"><p className="eyebrow flex items-center gap-2"><CalendarDays size={16} /> Próximo pagamento confirmado</p>
      {next ? <><h2 className="mt-5 text-2xl font-semibold">{next.event.ticker}</h2><p className="ui-value-lg mt-2">{money(next.event.totalValue)}</p><p className="ui-caption mt-2">{formatDividendCalendarDate(next.date)} · {next.event.dividendSource === 'B3_OFICIAL' ? 'Fonte B3' : 'Fonte de mercado'}</p><p className="ui-caption mt-1">Anúncio do mês, ainda sem recebimento registrado.</p><Button className="mt-5" onClick={() => onAsset(next.event.ticker)}>Ver ativo <ArrowUpRight size={16} /></Button></> : <><h2 className="ui-title mt-5">Nenhum pagamento futuro confirmado neste mês</h2><p className="ui-caption mt-2">Consulte o calendário para ver estimativas e conferir recebimentos.</p><Button className="mt-5" onClick={onDividends}>Abrir calendário</Button></>}
    </section>
  </div>;
}
