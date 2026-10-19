'use client';

import { useState } from 'react';
import { FiiPosition, QuoteData } from '../types/portfolio';
import { evaluateMentorsRecommendations, MentorId } from '../lib/mentorEngine';
import { formatCurrency, formatDecimal } from '../lib/formatFinancial';
import { Button, Chip } from './ui/Controls';
import { EmptyState, SectionSkeleton } from './ui/Feedback';

interface MentorsTabProps {
  quotes: Record<string, QuoteData>;
  positions: FiiPosition[];
  monthlyTarget: number;
  isPrivacyMode?: boolean;
  onOpenBuyModal?: (ticker: string) => void;
  onOpenAsset: (ticker: string) => void;
  isLoading?: boolean;
}

const initials: Record<MentorId, string> = { barsi: 'LB', buffett: 'WB', graham: 'BG', baroni: 'PB' };

export function MentorsTab({ quotes, positions, monthlyTarget, isPrivacyMode = false, onOpenBuyModal, onOpenAsset, isLoading = false }: MentorsTabProps) {
  const [selectedMentor, setSelectedMentor] = useState<'ALL' | MentorId>('ALL');
  const { mentors, consensus } = evaluateMentorsRecommendations(quotes, positions, monthlyTarget);
  const visibleMentors = selectedMentor === 'ALL' ? mentors : mentors.filter((mentor) => mentor.id === selectedMentor);
  const formatBRL = (value: number, privateValue = false) => formatCurrency(value, privateValue && isPrivacyMode);
  const updateTimes = Object.values(quotes).map((quote) => Date.parse(quote.updatedAt)).filter(Number.isFinite);
  const latestUpdate = updateTimes.length ? new Date(Math.max(...updateTimes)) : null;
  if (isLoading) return <SectionSkeleton label="Consultando análises dos mentores" />;

  return (
    <div className="space-y-4">
      <section className="ui-section">
        <h2 className="ui-title">Consenso Hoje</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          {latestUpdate ? <>Cotações recebidas · <time dateTime={latestUpdate.toISOString()}>{latestUpdate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time></> : 'Sem horário verificável de atualização das cotações.'}
          {' '}Fundamentos: catálogo de referência.
        </p>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {consensus.map((item) => <article key={item.fii.ticker} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3><button type="button" className="ui-asset-trigger text-base" onClick={() => onOpenAsset(item.fii.ticker)} aria-label={`Abrir ficha de ${item.fii.ticker}`}>{item.fii.ticker}</button></h3><span className="text-xs font-medium text-zinc-300 tabular-nums">{item.mentors.length}/4 mentores</span></div>
            <div className="mt-2 flex items-center gap-1.5">{item.mentors.map((mentor) => <span key={mentor.id} title={mentor.name} aria-label={mentor.name} className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-white/[0.08] px-1 text-[10px] font-semibold text-zinc-400">{initials[mentor.id]}</span>)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-zinc-500">Preço</dt><dd className="mt-1 font-semibold text-white tabular-nums">{formatBRL(item.fii.currentPrice)}</dd></div><div><dt className="text-zinc-500">P/VP</dt><dd className="mt-1 font-semibold text-white tabular-nums">{formatDecimal(item.fii.pvp)}</dd></div></dl>
            <details className="mt-2"><summary className="cursor-pointer py-2 text-xs text-zinc-300">Critérios do consenso</summary><p className="text-xs leading-relaxed text-zinc-400">{isPrivacyMode ? 'Justificativa financeira oculta no modo privacidade.' : item.combinedReason}</p></details>
          </article>)}
          {consensus.length === 0 && <EmptyState title="Sem consenso neste momento" description="Nenhum ativo reúne dois ou mais mentores nas condições atuais. Atualize as cotações ou ajuste seu orçamento nas metas." />}
        </div>
      </section>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Filtrar mentores">
        {[{ id: 'ALL', name: 'Todos' }, ...mentors].map((mentor) => <Chip key={mentor.id} onClick={() => setSelectedMentor(mentor.id as 'ALL' | MentorId)} selected={selectedMentor === mentor.id}>{mentor.name}</Chip>)}
      </div>
      {visibleMentors.map((mentor) => {
        const topPick = mentor.topPicks[0];
        return <article key={mentor.id} className="ui-section">
          <h3 className="ui-title">{mentor.name}</h3><p className="ui-caption mt-1">{mentor.title}</p>
          {topPick ? <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="ui-label">Principal escolha</p><button type="button" className="ui-asset-trigger text-lg" onClick={() => onOpenAsset(topPick.fii.ticker)} aria-label={`Abrir ficha de ${topPick.fii.ticker}`}>{topPick.fii.ticker}</button></div><div className="text-right"><p className="ui-label">{topPick.keyMetricLabel}</p><p className="mt-1 text-sm font-semibold text-white tabular-nums">{topPick.keyMetricValue}</p></div></div>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs"><div><dt className="inline text-zinc-500">Preço · </dt><dd className="inline text-zinc-200 tabular-nums">{formatBRL(topPick.fii.currentPrice)}</dd></div><div><dt className="inline text-zinc-500">P/VP · </dt><dd className="inline text-zinc-200 tabular-nums">{topPick.fii.pvp.toFixed(2).replace('.', ',')}</dd></div></dl>
            <details className="mt-3 border-t border-white/[0.06] pt-1">
              <summary className="cursor-pointer py-3 text-xs font-semibold text-zinc-300">Ver análise e fundamentos</summary>
              <div className="space-y-4 text-xs leading-relaxed text-zinc-400">
                <blockquote className="border-l border-white/15 pl-3">{mentor.quote}</blockquote>
                <p>{mentor.philosophySummary}</p><ul className="list-disc space-y-1 pl-4">{mentor.pillars.map((pillar) => <li key={pillar}>{pillar}</li>)}</ul>
                {mentor.portfolioDiagnosis && <p><strong className="text-zinc-200">Sua carteira: </strong>{isPrivacyMode ? 'Diagnóstico financeiro oculto.' : mentor.portfolioDiagnosis}</p>}
                {isPrivacyMode ? <p>Justificativas financeiras ocultas no modo privacidade.</p> : <ul className="list-disc space-y-2 pl-4">{topPick.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
                <p>Preço-teto: <span className="text-white tabular-nums">{formatBRL(topPick.fii.ceilingPrice)}</span> · Renda mensal estimada: <span className="tabular-nums">{topPick.fii.monthlyYieldPercent}%</span></p>
                <p>Com {formatBRL(monthlyTarget, true)}: <span className="tabular-nums">{isPrivacyMode ? '••••' : topPick.suggestedSharesForBudget} unidades</span> · renda estimada de {formatBRL(topPick.monthlyIncomeFromBudget, true)}/mês.</p>
                {mentor.topPicks.slice(1).map((pick) => <div key={pick.fii.ticker} className="border-t border-white/[0.06] pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><button type="button" className="ui-asset-trigger" onClick={() => onOpenAsset(pick.fii.ticker)}>#{pick.rank} · {pick.fii.ticker}</button><span className="tabular-nums">{formatBRL(pick.fii.currentPrice)} · P/VP {formatDecimal(pick.fii.pvp)}</span></div>{isPrivacyMode ? <p>Justificativas financeiras ocultas.</p> : <ul className="mt-2 space-y-1">{pick.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div>)}
              </div>
            </details>
            <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => onOpenAsset(topPick.fii.ticker)}>Ficha do ativo</Button>{onOpenBuyModal && <Button variant="primary" onClick={() => onOpenBuyModal(topPick.fii.ticker)}>Aportar</Button>}</div>
          </> : <p className="mt-4 text-sm text-zinc-400">Sem candidatos disponíveis para este orçamento e as cotações recebidas.</p>}
        </article>;
      })}
      <p className="px-1 text-[11px] leading-relaxed text-zinc-500">Análises automáticas aplicam critérios inspirados nas filosofias dos mentores aos dados disponíveis.</p>
    </div>
  );
}
