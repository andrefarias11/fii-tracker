'use client';

import { useState } from 'react';
import { FiiPosition, QuoteData } from '../types/portfolio';
import { evaluateMentorsRecommendations, MentorId } from '../lib/mentorEngine';

interface MentorsTabProps {
  quotes: Record<string, QuoteData>;
  positions: FiiPosition[];
  monthlyTarget: number;
  isPrivacyMode?: boolean;
  onOpenBuyModal?: (ticker: string) => void;
}

const initials: Record<MentorId, string> = { barsi: 'LB', buffett: 'WB', graham: 'BG', baroni: 'PB' };

export function MentorsTab({ quotes, positions, monthlyTarget, isPrivacyMode = false, onOpenBuyModal }: MentorsTabProps) {
  const [selectedMentor, setSelectedMentor] = useState<'ALL' | MentorId>('ALL');
  const { mentors, consensus } = evaluateMentorsRecommendations(quotes, positions, monthlyTarget);
  const visibleMentors = selectedMentor === 'ALL' ? mentors : mentors.filter((mentor) => mentor.id === selectedMentor);
  const formatBRL = (value: number, privateValue = false) => privateValue && isPrivacyMode
    ? 'R$ ••••'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const updateTimes = Object.values(quotes).map((quote) => Date.parse(quote.updatedAt)).filter(Number.isFinite);
  const latestUpdate = updateTimes.length ? new Date(Math.max(...updateTimes)) : null;

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-white/[0.06] bg-[#121215] p-4">
        <h2 className="text-base font-bold text-white">Consenso Hoje</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          {latestUpdate ? <>Cotações recebidas · <time dateTime={latestUpdate.toISOString()}>{latestUpdate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time></> : 'Sem horário verificável de atualização das cotações.'}
          {' '}Fundamentos: catálogo de referência.
        </p>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {consensus.map((item) => <article key={item.fii.ticker} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold text-white">{item.fii.ticker}</h3><span className="text-xs font-medium text-zinc-300 tabular-nums">{item.mentors.length}/4 mentores</span></div>
            <div className="mt-2 flex items-center gap-1.5">{item.mentors.map((mentor) => <span key={mentor.id} title={mentor.name} aria-label={mentor.name} className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-white/[0.08] px-1 text-[10px] font-semibold text-zinc-400">{initials[mentor.id]}</span>)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-zinc-500">Preço</dt><dd className="mt-1 font-semibold text-white tabular-nums">{formatBRL(item.fii.currentPrice)}</dd></div><div><dt className="text-zinc-500">P/VP</dt><dd className="mt-1 font-semibold text-white tabular-nums">{item.fii.pvp.toFixed(2).replace('.', ',')}</dd></div></dl>
            <details className="mt-2"><summary className="cursor-pointer py-2 text-xs text-[#f5b800]">Critérios do consenso</summary><p className="text-xs leading-relaxed text-zinc-400">{item.combinedReason}</p></details>
          </article>)}
          {consensus.length === 0 && <p className="text-sm text-zinc-400">Nenhum ativo reúne dois ou mais mentores nas condições atuais.</p>}
        </div>
      </section>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Filtrar mentores">
        {[{ id: 'ALL', name: 'Todos' }, ...mentors].map((mentor) => <button key={mentor.id} type="button" onClick={() => setSelectedMentor(mentor.id as 'ALL' | MentorId)} aria-pressed={selectedMentor === mentor.id} className={`min-h-11 shrink-0 rounded-full border px-3.5 text-xs font-semibold ${selectedMentor === mentor.id ? 'border-white/20 bg-white/10 text-white' : 'border-white/[0.06] bg-[#121215] text-zinc-400'}`}>{mentor.name}</button>)}
      </div>
      {visibleMentors.map((mentor) => {
        const topPick = mentor.topPicks[0];
        return <article key={mentor.id} className="rounded-[20px] border border-white/[0.06] bg-[#121215] p-4">
          <h3 className="text-base font-bold text-white">{mentor.name}</h3><p className="mt-1 text-xs text-zinc-500">{mentor.title}</p>
          {topPick ? <>
            <div className="mt-4 flex items-start justify-between gap-3"><div><p className="text-[11px] text-zinc-500">Principal escolha</p><p className="mt-1 text-lg font-semibold text-white">{topPick.fii.ticker}</p></div><div className="text-right"><p className="text-[11px] text-zinc-500">{topPick.keyMetricLabel}</p><p className="mt-1 text-sm font-semibold text-white tabular-nums">{topPick.keyMetricValue}</p></div></div>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs"><div><dt className="inline text-zinc-500">Preço · </dt><dd className="inline text-zinc-200 tabular-nums">{formatBRL(topPick.fii.currentPrice)}</dd></div><div><dt className="inline text-zinc-500">P/VP · </dt><dd className="inline text-zinc-200 tabular-nums">{topPick.fii.pvp.toFixed(2).replace('.', ',')}</dd></div></dl>
            <details className="mt-3 border-t border-white/[0.06] pt-1">
              <summary className="cursor-pointer py-3 text-xs font-semibold text-[#f5b800]">Ver análise e fundamentos</summary>
              <div className="space-y-4 text-xs leading-relaxed text-zinc-400">
                <blockquote className="border-l border-white/15 pl-3">{mentor.quote}</blockquote>
                <p>{mentor.philosophySummary}</p><ul className="list-disc space-y-1 pl-4">{mentor.pillars.map((pillar) => <li key={pillar}>{pillar}</li>)}</ul>
                {mentor.portfolioDiagnosis && <p><strong className="text-zinc-200">Sua carteira: </strong>{mentor.portfolioDiagnosis}</p>}
                <ul className="list-disc space-y-2 pl-4">{topPick.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                <p>Preço-teto: <span className="text-white tabular-nums">{formatBRL(topPick.fii.ceilingPrice)}</span> · Renda mensal estimada: <span className="tabular-nums">{topPick.fii.monthlyYieldPercent}%</span></p>
                <p>Com {formatBRL(monthlyTarget, true)}: <span className="tabular-nums">{topPick.suggestedSharesForBudget} unidades</span> · renda estimada de {formatBRL(topPick.monthlyIncomeFromBudget, true)}/mês.</p>
                {mentor.topPicks.slice(1).map((pick) => <div key={pick.fii.ticker} className="rounded-xl border border-white/[0.04] bg-[#1c1c1f] p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="text-white">#{pick.rank} · {pick.fii.ticker}</strong><span className="tabular-nums">{formatBRL(pick.fii.currentPrice)} · P/VP {pick.fii.pvp}</span></div><ul className="mt-2 space-y-1">{pick.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>)}
              </div>
            </details>
            {onOpenBuyModal && <button type="button" onClick={() => onOpenBuyModal(topPick.fii.ticker)} className="mt-3 min-h-11 w-full rounded-full border border-white/10 text-xs font-semibold text-white">Aportar em {topPick.fii.ticker}</button>}
          </> : <p className="mt-4 text-sm text-zinc-400">Sem candidatos disponíveis para este orçamento e as cotações recebidas.</p>}
        </article>;
      })}
      <p className="px-1 text-[11px] leading-relaxed text-zinc-500">Análises automáticas aplicam critérios inspirados nas filosofias dos mentores aos dados disponíveis.</p>
    </div>
  );
}
