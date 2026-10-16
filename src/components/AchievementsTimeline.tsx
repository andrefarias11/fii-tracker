'use client';

import { useState, useMemo } from 'react';
import {
  Trophy,
  FileSpreadsheet,
  Layers,
  Coffee,
  PieChart,
  Wallet,
  Building2,
  Coins,
  Landmark,
  ShieldCheck,
  CalendarCheck,
  Award,
  Sparkles,
  Compass,
  Gem,
  Zap,
  Flame,
  TrendingUp,
  Snowflake,
  Crown,
  CheckCircle2,
  Lock,
  Target,
} from 'lucide-react';
import { FiiPosition, Transaction } from '../types/portfolio';
import confetti from 'canvas-confetti';
import { triggerHaptic } from '../lib/haptic';
import {
  evaluateAchievements,
  AchievementItem,
  AchievementTier,
} from '../lib/achievementsEngine';

interface AchievementsTimelineProps {
  positions: FiiPosition[];
  transactions: Transaction[];
  summary: {
    totalInvested: number;
    currentEquity: number;
    totalMonthlyDividends: number;
  };
  onOpenB3Modal: () => void;
}

export function AchievementsTimeline({
  positions,
  transactions,
  summary,
  onOpenB3Modal,
}: AchievementsTimelineProps) {
  const [filter, setFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED'>('ALL');

  const overview = useMemo(
    () => evaluateAchievements(positions, transactions, summary),
    [positions, transactions, summary]
  );

  const filteredAchievements = useMemo(() => {
    if (filter === 'UNLOCKED') {
      return overview.achievements.filter((a) => a.unlocked);
    }
    if (filter === 'LOCKED') {
      return overview.achievements.filter((a) => !a.unlocked);
    }
    return overview.achievements;
  }, [overview.achievements, filter]);

  const handleAchievementClick = (item: AchievementItem) => {
    if (item.unlocked) {
      triggerHaptic('trophy');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors:
          item.tier === 'PLATINA'
            ? ['#f5b800', '#22c55e', '#38bdf8', '#ffffff']
            : ['#f5b800', '#22c55e', '#cbd5e1'],
      });
    } else {
      triggerHaptic('medium');
    }
  };

  const renderIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case 'FileSpreadsheet':
        return <FileSpreadsheet className={className} />;
      case 'Layers':
        return <Layers className={className} />;
      case 'Coffee':
        return <Coffee className={className} />;
      case 'PieChart':
        return <PieChart className={className} />;
      case 'Wallet':
        return <Wallet className={className} />;
      case 'Building2':
        return <Building2 className={className} />;
      case 'Coins':
        return <Coins className={className} />;
      case 'Landmark':
        return <Landmark className={className} />;
      case 'ShieldCheck':
        return <ShieldCheck className={className} />;
      case 'CalendarCheck':
        return <CalendarCheck className={className} />;
      case 'Award':
        return <Award className={className} />;
      case 'Sparkles':
        return <Sparkles className={className} />;
      case 'Compass':
        return <Compass className={className} />;
      case 'Gem':
        return <Gem className={className} />;
      case 'Zap':
        return <Zap className={className} />;
      case 'Flame':
        return <Flame className={className} />;
      case 'TrendingUp':
        return <TrendingUp className={className} />;
      case 'Snowflake':
        return <Snowflake className={className} />;
      case 'Crown':
        return <Crown className={className} />;
      case 'Trophy':
      default:
        return <Trophy className={className} />;
    }
  };

  const getTierStyles = (tier: AchievementTier, unlocked: boolean) => {
    if (!unlocked) {
      return {
        badge: 'bg-white/[0.04] text-zinc-500 border-white/[0.06]',
        iconBox: 'bg-[#141416] border-white/[0.08] text-zinc-500',
        bar: 'bg-zinc-600',
      };
    }
    switch (tier) {
      case 'BRONZE':
        return {
          badge: 'bg-[#2b2512] text-[#f5b800] border-[#f5b800]/20',
          iconBox: 'bg-[#2b2512] border-[#f5b800]/40 text-[#f5b800]',
          bar: 'bg-[#f5b800]',
        };
      case 'PRATA':
        return {
          badge: 'bg-white/[0.08] text-zinc-200 border-white/[0.15]',
          iconBox: 'bg-white/[0.08] border-white/40 text-white',
          bar: 'bg-zinc-200',
        };
      case 'OURO':
        return {
          badge: 'bg-[#2b2512] text-[#f5b800] border-[#f5b800]/30',
          iconBox: 'bg-[#f5b800] border-[#f5b800] text-zinc-950',
          bar: 'bg-[#f5b800]',
        };
      case 'PLATINA':
        return {
          badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          iconBox: 'bg-emerald-500/20 border-emerald-400 text-emerald-400',
          bar: 'bg-emerald-400',
        };
    }
  };

  const formatDateBR = (iso?: string) => {
    if (!iso) return null;
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <div className="space-y-4">
      {/* Hero Card: Troféu Platina & Progresso Geral Estilo XP */}
      <div className="p-5 rounded-[20px] bg-[#1c1c1e] border border-white/[0.04]">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center text-white shrink-0">
              <Trophy className="w-4 h-4 text-[#f5b800]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]">
                  Modo Carreira B3
                </span>
                <span className="text-[11px] font-bold text-zinc-400 tabular-nums">
                  {overview.totalXp} / {overview.maxXp} XP
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-1 tracking-tight">
                {overview.currentLevelTitle}
              </h2>
              <p className="text-xs text-zinc-400">
                Conquistas validadas por planilhas oficiais da B3
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xl font-bold text-white tracking-tight tabular-nums">
              {overview.unlockedCount}
              <span className="text-xs text-zinc-500 font-semibold">/{overview.totalCount}</span>
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Troféus
            </span>
          </div>
        </div>

        {/* Barra rumo à Platina */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-[#f5b800]" />
              Progresso do Troféu Platina
            </span>
            <span className="font-bold text-white tabular-nums">{overview.platinumProgressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#f5b800] transition-all duration-700"
              style={{ width: `${overview.platinumProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Próxima conquista na mira */}
        {overview.nextAchievement && (
          <div className="p-3.5 rounded-2xl bg-[#141416] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#2b2512] flex items-center justify-center text-[#f5b800] shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#f5b800] block tabular-nums">
                  Próximo Troféu ({overview.nextAchievement.progressPercent}%)
                </span>
                <p className="text-xs font-bold text-white truncate">
                  #{String(overview.nextAchievement.order).padStart(2, '0')} ·{' '}
                  {overview.nextAchievement.title}
                </p>
                <p className="text-[11px] text-zinc-400 truncate tabular-nums">
                  {overview.nextAchievement.formattedCurrent} de{' '}
                  {overview.nextAchievement.formattedTarget}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenB3Modal}
              className="px-3.5 py-2 rounded-full bg-[#f5b800] hover:bg-[#ffca28] text-zinc-950 font-bold text-xs shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Subir B3
            </button>
          </div>
        )}
      </div>

      {/* Filtro de Conquistas em Pílulas Estilo XP */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setFilter('ALL');
          }}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all text-center ${
            filter === 'ALL'
              ? 'bg-[#f5b800] text-zinc-950'
              : 'bg-[#1c1c1e] text-zinc-300 hover:text-white'
          }`}
        >
          Todas ({overview.totalCount})
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setFilter('UNLOCKED');
          }}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all text-center ${
            filter === 'UNLOCKED'
              ? 'bg-[#f5b800] text-zinc-950'
              : 'bg-[#1c1c1e] text-zinc-300 hover:text-white'
          }`}
        >
          Conquistadas ({overview.unlockedCount})
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setFilter('LOCKED');
          }}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all text-center ${
            filter === 'LOCKED'
              ? 'bg-[#f5b800] text-zinc-950'
              : 'bg-[#1c1c1e] text-zinc-300 hover:text-white'
          }`}
        >
          Faltam ({overview.totalCount - overview.unlockedCount})
        </button>
      </div>

      {/* Linha do Tempo Vertical das Conquistas */}
      <div className="p-5 rounded-[20px] bg-[#1c1c1e] border border-white/[0.04]">
        <div className="relative space-y-3">
          {filteredAchievements.map((item: AchievementItem, index: number) => {
            const styles = getTierStyles(item.tier, item.unlocked);
            const isLast = index === filteredAchievements.length - 1;

            return (
              <div key={item.id} className="relative flex items-start gap-3">
                {/* Linha conectora vertical */}
                {!isLast && (
                  <div
                    className={`absolute left-4 top-10 bottom-[-14px] w-[1px] ${
                      item.unlocked ? 'bg-[#f5b800]/40' : 'bg-white/[0.06]'
                    }`}
                  />
                )}

                {/* Ícone do Troféu na Linha do Tempo */}
                <div
                  onClick={() => handleAchievementClick(item)}
                  className={`relative z-10 w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 ${styles.iconBox}`}
                >
                  {renderIcon(item.iconName, 'w-3.5 h-3.5')}
                </div>

                {/* Card da Conquista */}
                <div
                  onClick={() => handleAchievementClick(item)}
                  className={`flex-1 p-3.5 rounded-2xl transition-all cursor-pointer active:scale-[0.99] select-none ${
                    item.unlocked
                      ? 'bg-[#141416] hover:bg-white/[0.04]'
                      : 'bg-[#141416]/60 hover:bg-[#141416] opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[10px] font-bold text-zinc-500 tabular-nums">
                          #{String(item.order).padStart(2, '0')}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}
                        >
                          {item.tier}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400 tabular-nums">
                          +{item.xp} XP
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {item.title}
                        {item.unlocked ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-3 h-3 text-zinc-500 shrink-0" />
                        )}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      {item.unlocked ? (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                          {item.unlockedAt
                            ? `Em ${formatDateBR(item.unlockedAt)}`
                            : 'Desbloqueado'}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-zinc-400 tabular-nums">
                          {item.progressPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed mb-2.5">{item.description}</p>

                  {/* Barra de Progresso Individual */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 font-medium">{item.subtitle}</span>
                      <span className="text-white font-semibold tabular-nums">
                        {item.formattedCurrent}{' '}
                        <span className="text-zinc-500">/ {item.formattedTarget}</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.unlocked ? 'bg-emerald-400' : styles.bar
                        }`}
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
