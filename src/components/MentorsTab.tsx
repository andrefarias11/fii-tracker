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
} from '../lib/mentorEngine';

interface MentorsTabProps {
  quotes: Record<string, QuoteData>;
  positions: FiiPosition[];
  monthlyTarget: number;
  isPrivacyMode?: boolean;
  onOpenBuyModal?: (ticker: string) => void;
}

export function MentorsTab({
  quotes,
  positions,
  monthlyTarget,
  isPrivacyMode = false,
  onOpenBuyModal,
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
      <div className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center text-white shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Visão dos Grandes Investidores
              </h2>
              <p className="text-[11px] text-zinc-400 uppercase tracking-wide mt-0.5">
                FILOSOFIAS CLÁSSICAS APLICADAS À B3
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#2b2512] text-[#f5b800]">
            B3 Ao Vivo
          </span>
        </div>

        {/* Consenso dos Mentores */}
        {consensus.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#f5b800] uppercase tracking-wider mb-3">
              <Award className="w-3.5 h-3.5" />
              <span>Consenso Hoje (Aprovado por 2+ Mentores)</span>
            </div>

            <div className="space-y-2.5">
              {consensus.slice(0, 2).map((item) => (
                <div
                  key={item.fii.ticker}
                  className="p-3.5 rounded-2xl bg-[#141416] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-bold text-white">
                        {item.fii.ticker}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-200 tabular-nums">
                        {formatBRL(item.fii.currentPrice)} • P/VP {item.fii.pvp}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
                        ▲ {item.fii.monthlyYieldPercent}% a.m.
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.mentors.map((m) => (
                        <span
                          key={m.id}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]"
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

      {/* 2. FILTRO POR MENTOR EM PÍLULAS ESTILO XP */}
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
            className={`text-xs px-3.5 py-1.5 rounded-full whitespace-nowrap font-bold transition-all ${
              selectedMentor === chip.id
                ? 'bg-[#f5b800] text-zinc-950'
                : 'bg-[#1c1c1e] text-zinc-300 hover:text-white'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 3. CARDS DE CADA MENTOR */}
      <div className="space-y-4">
        {visibleMentors.map((mentor) => {
          const MentorIcon = getMentorIcon(mentor.id);
          const top1 = mentor.topPicks[0];
          const otherPicks = mentor.topPicks.slice(1);
          const isExpanded =
            selectedMentor !== 'ALL' || Boolean(expandedMentors[mentor.id]);

          if (!top1) return null;

          return (
            <div
              key={mentor.id}
              className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] p-5 transition-all"
            >
              {/* Cabeçalho do Mentor */}
              <div className="flex items-start justify-between gap-2 mb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center shrink-0 text-white">
                    <MentorIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white leading-tight">
                        {mentor.name}
                      </h3>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]">
                        {mentor.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 uppercase tracking-wide mt-0.5">
                      {mentor.title.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Frase Clássica + Pilares */}
              <div className="p-3.5 rounded-2xl bg-[#141416] mb-3.5">
                <p className="text-xs italic text-zinc-300 flex items-start gap-2 leading-relaxed">
                  <Quote className="w-3.5 h-3.5 text-[#f5b800] shrink-0 mt-0.5" />
                  <span>{mentor.quote}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-white/[0.06]">
                  {mentor.pillars.map((pillar) => (
                    <span
                      key={pillar}
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white/[0.04] text-zinc-300"
                    >
                      • {pillar}
                    </span>
                  ))}
                </div>
              </div>

              {/* Diagnóstico da Carteira (Especial Prof. Baroni) */}
              {mentor.portfolioDiagnosis && (
                <div className="mb-3.5 p-3.5 rounded-2xl bg-[#141416] border border-white/[0.04] text-xs text-zinc-300 leading-relaxed">
                  <strong className="text-[#f5b800]">Diagnóstico da sua carteira:</strong>{' '}
                  {mentor.portfolioDiagnosis}
                </div>
              )}

                {/* ESCOLHA Nº 1 DO MENTOR AGORA NA B3 */}
              <div className="p-4 rounded-2xl bg-[#141416]">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]">
                      Indicação #1 {mentor.name.split(' ')[0] === 'Prof.' ? 'Baroni' : mentor.name.split(' ')[1] || mentor.name}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      {top1.fii.qualityBadgeLabel}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {top1.keyMetricLabel}:{' '}
                    <strong className="text-white">{top1.keyMetricValue}</strong>
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-bold text-white leading-snug">
                    Usando a estratégia{' '}
                    <span className="text-[#f5b800]">{mentor.name}</span>, investir em{' '}
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.08] text-white font-mono">
                      {top1.fii.ticker}
                    </span>{' '}
                    devido a:
                  </p>
                </div>

                {/* Lista de motivos */}
                <ul className="space-y-1.5 mb-3.5">
                  {top1.reasons.map((reason, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-zinc-300 flex items-start gap-1.5 leading-relaxed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>

                {/* Tabela Key-Value Limpa Estilo XP */}
                <div className="space-y-2 py-3 border-y border-white/[0.06] text-xs mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Preço atual na B3</span>
                    <span className="text-white font-bold tabular-nums">
                      {formatBRL(top1.fii.currentPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">P/VP atual</span>
                    <span className="text-white font-medium tabular-nums">
                      {top1.fii.pvp}{' '}
                      <span className="text-emerald-400">
                        ({top1.fii.discountPercent > 0 ? `▼ -${top1.fii.discountPercent}%` : 'Justo'})
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Preço-Teto calculado</span>
                    <span className="text-[#f5b800] font-semibold tabular-nums">
                      {formatBRL(top1.fii.ceilingPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Yield mensal isento</span>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      ▲ {top1.fii.monthlyYieldPercent}% a.m.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>
                    Com <span className="tabular-nums text-white">{formatBRL(monthlyTarget, true)}</span>:{' '}
                    <strong className="text-white tabular-nums">
                      +{top1.suggestedSharesForBudget}{' '}
                      {top1.suggestedSharesForBudget === 1 ? 'cota' : 'cotas'}
                    </strong>
                  </span>
                  <span className="text-emerald-400 font-semibold tabular-nums">
                    +{formatBRL(top1.monthlyIncomeFromBudget, true)}/mês
                  </span>
                </div>
              </div>

              {/* Base do Card (Botões Pílula Estilo XP) */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {otherPicks.length > 0 && selectedMentor === 'ALL' ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(mentor.id)}
                    className="py-2.5 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <span>{isExpanded ? 'Ocultar #2 e #3' : 'Ver #2 e #3'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <div className="py-2.5 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold text-center">
                    Top Pick B3
                  </div>
                )}

                {onOpenBuyModal ? (
                  <button
                    type="button"
                    onClick={() => onOpenBuyModal(top1.fii.ticker)}
                    className="py-2.5 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold text-center active:scale-95 transition-all"
                  >
                    Aportar {top1.fii.ticker}
                  </button>
                ) : (
                  <div className="py-2.5 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold text-center tabular-nums">
                    Teto {formatBRL(top1.fii.ceilingPrice)}
                  </div>
                )}
              </div>

              {/* 2ª e 3ª opções do Mentor */}
              {otherPicks.length > 0 && isExpanded && (
                <div className="space-y-2.5 mt-4 pt-4 border-t border-white/[0.06] animate-in fade-in duration-150">
                  {otherPicks.map((pick) => (
                    <div
                      key={pick.fii.ticker}
                      className="p-3.5 rounded-2xl bg-[#141416]"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]">
                            #{pick.rank}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {pick.fii.ticker}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {pick.fii.segment}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white tabular-nums">
                            {formatBRL(pick.fii.currentPrice)}
                          </span>
                          <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                            P/VP {pick.fii.pvp}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed">
                        <strong className="text-[#f5b800]">Por que investir:</strong>{' '}
                        {pick.reasons[0]} {pick.reasons[1]}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Nota Educativa */}
      <div className="p-4 rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] text-xs text-zinc-400 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-[#f5b800] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          As análises acima aplicam automaticamente as regras matemáticas de cada mentor (Preço-Teto de Barsi, Fosso Competitivo de Buffett, Desconto P/VP de Graham e Equilíbrio 60/40 de Baroni) sobre os preços e dividendos sincronizados da B3.
        </p>
      </div>
    </div>
  );
}
