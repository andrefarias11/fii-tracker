'use client';

import { useState, useMemo } from 'react';
import {
  GraduationCap,
  Award,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Coins,
  Scale,
  ChevronDown,
  ChevronUp,
  Quote,
} from 'lucide-react';
import { FiiPosition, QuoteData } from '../types/portfolio';
import {
  evaluateMentorsRecommendations,
  MentorId,
  MentorAnalysis,
} from '../lib/mentorEngine';

interface MentorsTabProps {
  quotes: Record<string, QuoteData>;
  positions: FiiPosition[];
  monthlyTarget: number;
  isPrivacyMode?: boolean;
}

export function MentorsTab({
  quotes,
  positions,
  monthlyTarget,
  isPrivacyMode = false,
}: MentorsTabProps) {
  const [selectedMentor, setSelectedMentor] = useState<'ALL' | MentorId>('ALL');
  const [expandedMentors, setExpandedMentors] = useState<Record<string, boolean>>({});

  const { mentors, consensus } = useMemo(
    () => evaluateMentorsRecommendations(quotes, positions, monthlyTarget),
    [quotes, positions, monthlyTarget]
  );

  const formatBRL = (val: number, hideInPrivacy = false) => {
    if (hideInPrivacy && isPrivacyMode) return 'R$ ••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const toggleExpand = (id: string) => {
    setExpandedMentors((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const visibleMentors =
    selectedMentor === 'ALL'
      ? mentors
      : mentors.filter((m) => m.id === selectedMentor);

  const getAccentStyles = (color: MentorAnalysis['accentColor']) => {
    switch (color) {
      case 'emerald':
        return {
          border: 'border-white/[0.06]',
          iconBg: 'bg-white/[0.04] border-white/[0.06] text-zinc-300',
          badgeBg: 'bg-white/[0.04] text-zinc-300 border-white/[0.06]',
          pillBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
          highlightText: 'text-emerald-400',
        };
      case 'amber':
        return {
          border: 'border-white/[0.06]',
          iconBg: 'bg-white/[0.04] border-white/[0.06] text-zinc-300',
          badgeBg: 'bg-white/[0.04] text-zinc-300 border-white/[0.06]',
          pillBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
          highlightText: 'text-amber-400',
        };
      case 'sky':
        return {
          border: 'border-white/[0.06]',
          iconBg: 'bg-white/[0.04] border-white/[0.06] text-zinc-300',
          badgeBg: 'bg-white/[0.04] text-zinc-300 border-white/[0.06]',
          pillBg: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
          highlightText: 'text-sky-400',
        };
      case 'violet':
        return {
          border: 'border-white/[0.06]',
          iconBg: 'bg-white/[0.04] border-white/[0.06] text-zinc-300',
          badgeBg: 'bg-white/[0.04] text-zinc-300 border-white/[0.06]',
          pillBg: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
          highlightText: 'text-violet-400',
        };
    }
  };

  const getMentorIcon = (id: MentorId) => {
    switch (id) {
      case 'barsi':
        return Coins;
      case 'buffett':
        return ShieldCheck;
      case 'graham':
        return TrendingUp;
      case 'baroni':
        return Scale;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. CABEÇALHO EXPLICATIVO + CONSENSO DOS MENTORES */}
      <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                Visão dos Grandes Investidores
              </h2>
              <p className="text-[11px] text-zinc-400">
                Filosofias clássicas aplicadas às cotações atuais da B3
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            B3 Ao Vivo
          </span>
        </div>

        {/* Consenso dos Mentores (Ativos que passam no crivo de múltiplos mentores hoje) */}
        {consensus.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2.5">
              <Award className="w-3.5 h-3.5" />
              <span>Consenso Hoje (Aprovado por 2+ Mentores)</span>
            </div>

            <div className="space-y-2">
              {consensus.slice(0, 2).map((item) => (
                <div
                  key={item.fii.ticker}
                  className="p-3.5 rounded-2xl bg-white/[0.025] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className="text-sm font-bold text-white">
                        {item.fii.ticker}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.06] tabular-nums">
                        {formatBRL(item.fii.currentPrice)} • P/VP {item.fii.pvp}
                      </span>
                      <span className="text-[11px] font-medium text-emerald-400 tabular-nums">
                        Yield {item.fii.monthlyYieldPercent}% a.m.
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {item.mentors.map((m) => (
                        <span
                          key={m.id}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.05] text-zinc-300"
                        >
                          ✓ {m.name.split(' ')[0] === 'Prof.' ? 'Prof. Baroni' : m.name.split(' ').slice(0, 2).join(' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. FILTRO POR MENTOR */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'ALL', label: 'Todos os Mentores' },
          { id: 'barsi', label: 'Luiz Barsi' },
          { id: 'buffett', label: 'Warren Buffett' },
          { id: 'graham', label: 'Benjamin Graham' },
          { id: 'baroni', label: 'Prof. Baroni' },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setSelectedMentor(chip.id as 'ALL' | MentorId)}
            className={`text-xs px-3.5 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${
              selectedMentor === chip.id
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                : 'bg-[#121215] border border-white/[0.06] text-zinc-400 hover:text-white'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 3. CARDS DE CADA MENTOR COM A RECOMENDAÇÃO PRINCIPAL ("Usando estratégia X, investir em Y devido a:") */}
      <div className="space-y-4">
        {visibleMentors.map((mentor) => {
          const styles = getAccentStyles(mentor.accentColor);
          const MentorIcon = getMentorIcon(mentor.id);
          const top1 = mentor.topPicks[0];
          const otherPicks = mentor.topPicks.slice(1);
          const isExpanded =
            selectedMentor !== 'ALL' || Boolean(expandedMentors[mentor.id]);

          if (!top1) return null;

          return (
            <div
              key={mentor.id}
              className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-5 shadow-lg transition-all"
            >
              {/* Cabeçalho do Mentor */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 text-zinc-300">
                    <MentorIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">
                        {mentor.name}
                      </h3>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.04] text-zinc-300 border border-white/[0.06]">
                        {mentor.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{mentor.title}</p>
                  </div>
                </div>
              </div>

              {/* Frase Clássica + Pilares */}
              <div className="p-3.5 rounded-2xl bg-white/[0.025] mb-3">
                <p className="text-[11px] italic text-zinc-300 flex items-start gap-1.5 leading-relaxed">
                  <Quote className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                  <span>{mentor.quote}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-white/[0.05]">
                  {mentor.pillars.map((pillar) => (
                    <span
                      key={pillar}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white/[0.04] text-zinc-300"
                    >
                      • {pillar}
                    </span>
                  ))}
                </div>
              </div>

              {/* Diagnóstico da Carteira (Especial Prof. Baroni) */}
              {mentor.portfolioDiagnosis && (
                <div className="mb-3 p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.06] text-[11px] text-zinc-300 leading-relaxed">
                  <strong className="text-emerald-400">Diagnóstico da sua carteira:</strong>{' '}
                  {mentor.portfolioDiagnosis}
                </div>
              )}

              {/* ESCOLHA Nº 1 DO MENTOR AGORA NA B3 */}
              <div className="p-4 rounded-2xl bg-white/[0.025]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Indicação Principal {mentor.name.split(' ')[0] === 'Prof.' ? 'Baroni' : mentor.name.split(' ')[1] || mentor.name}
                  </span>
                  <span className="text-[11px] text-zinc-400 tabular-nums">
                    {top1.keyMetricLabel}:{' '}
                    <strong className="text-zinc-200">{top1.keyMetricValue}</strong>
                  </span>
                </div>

                {/* Frase no formato pedido: "Usando a estratégia X, investir em Y devido a:" */}
                <div className="mb-2.5">
                  <p className="text-xs font-bold text-white leading-snug">
                    Usando a estratégia{' '}
                    <span className="text-emerald-400">{mentor.name}</span>, investir em{' '}
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white font-mono">
                      {top1.fii.ticker}
                    </span>{' '}
                    devido a:
                  </p>
                </div>

                {/* Lista de motivos baseados nos números atuais da B3 */}
                <ul className="space-y-1.5 mb-3">
                  {top1.reasons.map((reason, idx) => (
                    <li
                      key={idx}
                      className="text-[11px] text-zinc-300 flex items-start gap-1.5 leading-relaxed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>

                {/* Métricas Rápidas da B3 + Botão Aportar */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-3 text-center">
                  <div>
                    <span className="text-[11px] text-zinc-500 block">Preço B3</span>
                    <span className="text-xs font-bold text-white tabular-nums">
                      {formatBRL(top1.fii.currentPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-500 block">P/VP Atual</span>
                    <span className="text-xs font-bold text-zinc-200 tabular-nums">
                      {top1.fii.pvp}{' '}
                      <span className="text-[11px] text-emerald-400 font-normal">
                        ({top1.fii.discountPercent > 0 ? `-${top1.fii.discountPercent}%` : 'Justo'})
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-500 block">Yield Isento</span>
                    <span className="text-xs font-bold text-emerald-400 tabular-nums">
                      {top1.fii.monthlyYieldPercent}% a.m.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-zinc-400">
                    Com <span className="tabular-nums">{formatBRL(monthlyTarget, true)}</span>:{' '}
                    <strong className="text-zinc-200 tabular-nums">
                      +{top1.suggestedSharesForBudget}{' '}
                      {top1.suggestedSharesForBudget === 1 ? 'cota' : 'cotas'}
                    </strong>{' '}
                    (+<span className="tabular-nums">{formatBRL(top1.monthlyIncomeFromBudget, true)}</span>/mês)
                  </span>

                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-zinc-300 tabular-nums">
                    Teto {formatBRL(top1.fii.ceilingPrice)}
                  </span>
                </div>
              </div>

              {/* Botão para ver a 2ª e 3ª opções do Mentor */}
              {otherPicks.length > 0 && (
                <div className="mt-2.5">
                  {selectedMentor === 'ALL' && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(mentor.id)}
                      className="w-full py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <span>Ocultar outras opções de {mentor.name.split(' ')[0]}</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>
                            Ver #2 e #3 indicações de{' '}
                            {mentor.name.split(' ')[0] === 'Prof.'
                              ? 'Prof. Baroni'
                              : mentor.name}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}

                  {isExpanded && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-white/[0.05] animate-in fade-in duration-150">
                      {otherPicks.map((pick) => (
                        <div
                          key={pick.fii.ticker}
                          className="p-3.5 rounded-2xl bg-white/[0.025]"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300">
                                #{pick.rank}
                              </span>
                              <span className="text-xs font-bold text-white">
                                {pick.fii.ticker}
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                {pick.fii.segment}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white tabular-nums">
                                {formatBRL(pick.fii.currentPrice)}
                              </span>
                              <span className="text-[11px] font-medium text-emerald-400 tabular-nums">
                                P/VP {pick.fii.pvp}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-zinc-300 leading-relaxed">
                            <strong className="text-emerald-400">Por que investir:</strong>{' '}
                            {pick.reasons[0]} {pick.reasons[1]}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Nota Educativa */}
      <div className="p-4 rounded-[24px] bg-[#121215] border border-white/[0.06] text-[11px] text-zinc-400 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          As análises acima aplicam automaticamente as regras matemáticas de cada mentor (Preço-Teto de Barsi, Fosso Competitivo de Buffett, Desconto P/VP de Graham e Equilíbrio 60/40 de Baroni) sobre os preços e dividendos sincronizados da B3.
        </p>
      </div>
    </div>
  );
}

