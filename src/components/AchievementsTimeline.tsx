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
            ? ['#22d3ee', '#38bdf8', '#10b981', '#f59e0b']
            : ['#10b981', '#f59e0b', '#cbd5e1'],
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
        iconBox: 'bg-white/[0.03] border-white/[0.06] text-zinc-500',
        bar: 'bg-zinc-600',
      };
    }
    switch (tier) {
      case 'BRONZE':
        return {
          badge: 'bg-amber-700/20 text-amber-300 border-amber-600/30',
          iconBox: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          bar: 'bg-amber-500',
        };
      case 'PRATA':
        return {
          badge: 'bg-slate-400/15 text-slate-200 border-slate-400/30',
          iconBox: 'bg-slate-400/15 border-slate-300/30 text-slate-200',
          bar: 'bg-slate-300',
        };
      case 'OURO':
        return {
          badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
          iconBox: 'bg-yellow-500/15 border-yellow-400/30 text-yellow-400',
          bar: 'bg-yellow-400',
        };
      case 'PLATINA':
        return {
          badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
          iconBox: 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300',
          bar: 'bg-gradient-to-r from-cyan-400 to-emerald-400',
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
      {/* Hero Card: Troféu Platina & Progresso Geral */}
      <div className="p-6 rounded-[28px] bg-[#121215] border border-white/[0.07] relative overflow-hidden">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-13 h-13 rounded-2xl flex items-center justify-center border shrink-0 ${
                overview.isPlatinumUnlocked
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-lg shadow-cyan-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              }`}
            >
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Modo Carreira B3
                </span>
                <span className="text-[11px] font-semibold text-zinc-400">
                  {overview.totalXp} / {overview.maxXp} XP
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1 tracking-tight">
                {overview.currentLevelTitle}
              </h2>
              <p className="text-xs text-zinc-400">
                Conquistas validadas exclusivamente por planilhas oficiais da B3
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-2xl font-extrabold text-white tracking-tight">
              {overview.unlockedCount}
              <span className="text-sm text-zinc-500 font-semibold">/{overview.totalCount}</span>
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              Troféus
            </span>
          </div>
        </div>

        {/* Barra rumo à Platina */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-cyan-400" />
              Progresso do Troféu Platina
            </span>
            <span className="font-bold text-white">{overview.platinumProgressPercent}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-700"
              style={{ width: `${overview.platinumProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Próxima conquista na mira */}
        {overview.nextAchievement && (
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Próximo Troféu na Mira ({overview.nextAchievement.progressPercent}%)
                </span>
                <p className="text-xs font-bold text-white truncate">
                  #{String(overview.nextAchievement.order).padStart(2, '0')} ·{' '}
                  {overview.nextAchievement.title}
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  {overview.nextAchievement.formattedCurrent} de{' '}
                  {overview.nextAchievement.formattedTarget}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenB3Modal}
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Subir B3
            </button>
          </div>
        )}
      </div>

      {/* Filtro de Conquistas */}
      <div className="w-full">
        <div className="grid grid-cols-3 w-full p-1 rounded-2xl bg-[#121215] border border-white/[0.06] gap-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setFilter('ALL');
            }}
            className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition-all truncate text-center ${
              filter === 'ALL' ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
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
            className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition-all truncate text-center ${
              filter === 'UNLOCKED'
                ? 'bg-emerald-500 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Desbloqueadas ({overview.unlockedCount})
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setFilter('LOCKED');
            }}
            className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition-all truncate text-center ${
              filter === 'LOCKED' ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Faltam ({overview.totalCount - overview.unlockedCount})
          </button>
        </div>
      </div>

      {/* Linha do Tempo Vertical das 20 Conquistas */}
      <div className="p-5 rounded-[28px] bg-[#121215] border border-white/[0.06]">
        <div className="relative space-y-4">
          {filteredAchievements.map((item: AchievementItem, index: number) => {
            const styles = getTierStyles(item.tier, item.unlocked);
            const isLast = index === filteredAchievements.length - 1;

            return (
              <div key={item.id} className="relative flex items-start gap-3.5">
                {/* Linha conectora vertical */}
                {!isLast && (
                  <div
                    className={`absolute left-5 top-11 bottom-[-18px] w-[2px] ${
                      item.unlocked ? 'bg-emerald-500/35' : 'bg-white/[0.06]'
                    }`}
                  />
                )}

                {/* Ícone do Troféu na Linha do Tempo */}
                <div
                  onClick={() => handleAchievementClick(item)}
                  className={`relative z-10 w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 ${styles.iconBox}`}
                >
                  {renderIcon(item.iconName, 'w-4 h-4')}
                </div>

                {/* Card da Conquista */}
                <div
                  onClick={() => handleAchievementClick(item)}
                  className={`flex-1 p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] select-none ${
                    item.unlocked
                      ? 'bg-white/[0.03] border-emerald-500/25 hover:border-emerald-500/40'
                      : 'bg-white/[0.015] border-white/[0.05] opacity-80 hover:border-white/[0.1]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[10px] font-bold text-zinc-500">
                          #{String(item.order).padStart(2, '0')}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}
                        >
                          {item.tier}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-500">
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
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          {item.unlockedAt
                            ? `Conquistado em ${formatDateBR(item.unlockedAt)}`
                            : 'Desbloqueado'}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-zinc-400">
                          {item.progressPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">{item.description}</p>

                  {/* Barra de Progresso Individual */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 font-medium">{item.subtitle}</span>
                      <span className="text-zinc-300 font-semibold">
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

