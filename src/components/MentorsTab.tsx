'use client';

import { useState, useMemo } from 'react';
import {
  GraduationCap,
  Award,
  Sparkles,
  Plus,
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
  onOpenAddModalWithTicker: (ticker: string) => void;
}

export function MentorsTab({
  quotes,
  positions,
  monthlyTarget,
  isPrivacyMode = false,
  onOpenAddModalWithTicker,
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
          border: 'border-emerald-500/30',
          bgGradient: 'from-zinc-900 via-zinc-900 to-emerald-950/30',
          iconBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
          badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          pillBg: 'bg-emerald-500/10 text-emerald-400',
          highlightText: 'text-emerald-400',
          buttonHover: 'hover:bg-emerald-500 hover:text-zinc-950',
        };
      case 'amber':
        return {
          border: 'border-amber-500/30',
          bgGradient: 'from-zinc-900 via-zinc-900 to-amber-950/30',
          iconBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          pillBg: 'bg-amber-500/10 text-amber-400',
          highlightText: 'text-amber-400',
          buttonHover: 'hover:bg-amber-500 hover:text-zinc-950',
        };
      case 'sky':
        return {
          border: 'border-sky-500/30',
          bgGradient: 'from-zinc-900 via-zinc-900 to-sky-950/30',
          iconBg: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
          badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          pillBg: 'bg-sky-500/10 text-sky-400',
          highlightText: 'text-sky-400',
          buttonHover: 'hover:bg-sky-500 hover:text-zinc-950',
        };
      case 'violet':
        return {
          border: 'border-violet-500/30',
          bgGradient: 'from-zinc-900 via-zinc-900 to-violet-950/30',
          iconBg: 'bg-violet-500/15 border-violet-500/30 text-violet-400',
          badgeBg: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
          pillBg: 'bg-violet-500/10 text-violet-400',
          highlightText: 'text-violet-400',
          buttonHover: 'hover:bg-violet-500 hover:text-zinc-950',
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
      <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/40 border border-emerald-500/30 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
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
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            B3 Ao Vivo
          </span>
        </div>

        {/* Consenso dos Mentores (Ativos que passam no crivo de múltiplos mentores hoje) */}
        {consensus.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2">
              <Award className="w-3.5 h-3.5" />
              <span>Consenso Hoje (Aprovado por 2+ Mentores)</span>
            </div>

            <div className="space-y-2">
              {consensus.slice(0, 2).map((item) => (
                <div
                  key={item.fii.ticker}
                  className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-sm font-extrabold text-white">
                        {item.fii.ticker}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        {formatBRL(item.fii.currentPrice)} • P/VP {item.fii.pvp}
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-400">
                        Yield {item.fii.monthlyYieldPercent}% a.m.
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {item.mentors.map((m) => (
                        <span
                          key={m.id}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300"
                        >
                          ✓ {m.name.split(' ')[0] === 'Prof.' ? 'Prof. Baroni' : m.name.split(' ').slice(0, 2).join(' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenAddModalWithTicker(item.fii.ticker)}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-extrabold hover:bg-emerald-400 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    Aportar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. FILTRO POR MENTOR */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'ALL', label: 'Todos os Mentores' },
          { id: 'barsi', label: '👑 Luiz Barsi' },
          { id: 'buffett', label: '🏛️ Warren Buffett' },
          { id: 'graham', label: '🛡️ Benjamin Graham' },
          { id: 'baroni', label: '🎓 Prof. Baroni' },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setSelectedMentor(chip.id as 'ALL' | MentorId)}
            className={`text-xs px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${
              selectedMentor === chip.id
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
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
              className={`rounded-3xl bg-gradient-to-br ${styles.bgGradient} border ${styles.border} p-4 shadow-lg transition-all`}
            >
              {/* Cabeçalho do Mentor */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 ${styles.iconBg}`}
                  >
                    <MentorIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-white">
                        {mentor.name}
                      </h3>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${styles.badgeBg}`}
                      >
                        {mentor.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{mentor.title}</p>
                  </div>
                </div>
              </div>

              {/* Frase Clássica + Pilares */}
              <div className="p-2.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/70 mb-3">
                <p className="text-[11px] italic text-zinc-300 flex items-start gap-1.5 leading-relaxed">
                  <Quote className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                  <span>{mentor.quote}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-zinc-800/60">
                  {mentor.pillars.map((pillar) => (
                    <span
                      key={pillar}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800"
                    >
                      • {pillar}
                    </span>
                  ))}
                </div>
              </div>

              {/* Diagnóstico da Carteira (Especial Prof. Baroni) */}
              {mentor.portfolioDiagnosis && (
                <div className="mb-3 p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/25 text-[11px] text-violet-200 leading-relaxed">
                  <strong className="text-violet-300">Diagnóstico da sua carteira:</strong>{' '}
                  {mentor.portfolioDiagnosis}
                </div>
              )}

              {/* ESCOLHA Nº 1 DO MENTOR AGORA NA B3 */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800/90">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${styles.pillBg}`}
                  >
                    ★ Top #1 Indicação {mentor.name.split(' ')[0] === 'Prof.' ? 'Baroni' : mentor.name.split(' ')[1] || mentor.name}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {top1.keyMetricLabel}:{' '}
                    <strong className="text-zinc-200">{top1.keyMetricValue}</strong>
                  </span>
                </div>

                {/* Frase no formato pedido: "Usando a estratégia X, investir em Y devido a:" */}
                <div className="mb-2.5">
                  <p className="text-xs font-bold text-white leading-snug">
                    Usando a estratégia{' '}
                    <span className={styles.highlightText}>{mentor.name}</span>, investir em{' '}
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-white font-mono">
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
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${styles.highlightText}`}
                      />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>

                {/* Métricas Rápidas da B3 + Botão Aportar */}
                <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-zinc-900/90 border border-zinc-800/70 mb-3 text-center">
                  <div>
                    <span className="text-[9px] text-zinc-500 block">Preço B3</span>
                    <span className="text-xs font-bold text-white">
                      {formatBRL(top1.fii.currentPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block">P/VP Atual</span>
                    <span className="text-xs font-bold text-zinc-200">
                      {top1.fii.pvp}{' '}
                      <span className="text-[10px] text-emerald-400">
                        ({top1.fii.discountPercent > 0 ? `-${top1.fii.discountPercent}%` : 'Justo'})
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block">Yield Isento</span>
                    <span className={`text-xs font-bold ${styles.highlightText}`}>
                      {top1.fii.monthlyYieldPercent}% a.m.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-zinc-400">
                    Com {formatBRL(monthlyTarget, true)}:{' '}
                    <strong className="text-zinc-200">
                      +{top1.suggestedSharesForBudget}{' '}
                      {top1.suggestedSharesForBudget === 1 ? 'cota' : 'cotas'}
                    </strong>{' '}
                    (+{formatBRL(top1.monthlyIncomeFromBudget, true)}/mês)
                  </span>

                  <button
                    type="button"
                    onClick={() => onOpenAddModalWithTicker(top1.fii.ticker)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 text-white text-xs font-bold transition-all active:scale-95 ${styles.buttonHover}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aportar em {top1.fii.ticker}
                  </button>
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
                    <div className="space-y-2 mt-2 pt-2 border-t border-zinc-800/60 animate-in fade-in duration-150">
                      {otherPicks.map((pick) => (
                        <div
                          key={pick.fii.ticker}
                          className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/70"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                #{pick.rank}
                              </span>
                              <span className="text-xs font-extrabold text-white">
                                {pick.fii.ticker}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {pick.fii.segment}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {formatBRL(pick.fii.currentPrice)}
                              </span>
                              <button
                                type="button"
                                onClick={() => onOpenAddModalWithTicker(pick.fii.ticker)}
                                className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 text-[10px] font-bold transition-all"
                              >
                                + Aportar
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-zinc-300 leading-relaxed">
                            <strong className={styles.highlightText}>Por que investir:</strong>{' '}
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
      <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 text-[11px] text-zinc-400 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          As análises acima aplicam automaticamente as regras matemáticas de cada mentor (Preço-Teto de Barsi, Fosso Competitivo de Buffett, Desconto P/VP de Graham e Equilíbrio 60/40 de Baroni) sobre os preços e dividendos sincronizados da B3.
        </p>
      </div>
    </div>
  );
}

