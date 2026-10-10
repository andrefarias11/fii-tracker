'use client';

import { useState } from 'react';
import { Calculator, TrendingUp, Wallet, Flag } from 'lucide-react';

interface InvestmentSimulatorProps {
  currentEquity?: number;
  monthlyTarget?: number;
  averageYieldPercent?: number;
  isPrivacyMode?: boolean;
}

export function InvestmentSimulator({
  currentEquity = 0,
  monthlyTarget = 200,
  averageYieldPercent = 0.85,
  isPrivacyMode = false,
}: InvestmentSimulatorProps) {
  const [monthlyContribution, setMonthlyContribution] = useState<number>(() => monthlyTarget || 200);
  const [monthlyYieldPercent, setMonthlyYieldPercent] = useState<number>(() =>
    averageYieldPercent >= 0.6 && averageYieldPercent <= 1.3 ? averageYieldPercent : 0.85
  );
  const [startFromCurrentEquity, setStartFromCurrentEquity] = useState<boolean>(true);

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const initialCapital = startFromCurrentEquity ? currentEquity : 0;

  // Calcular simulação com reinvestimento total de dividendos + patrimônio inicial
  const calculateProgression = (years: number) => {
    const totalMonths = years * 12;
    const rate = monthlyYieldPercent / 100;
    let accumulated = initialCapital;
    let totalInvestedFromPocket = initialCapital;

    for (let m = 1; m <= totalMonths; m++) {
      accumulated += monthlyContribution;
      totalInvestedFromPocket += monthlyContribution;
      // Rende no fim do mês
      accumulated += accumulated * rate;
    }

    const estimatedMonthlyIncome = accumulated * rate;
    const dividendProfit = accumulated - totalInvestedFromPocket;

    return {
      years,
      accumulated: Number(accumulated.toFixed(2)),
      totalInvestedFromPocket: Number(totalInvestedFromPocket.toFixed(2)),
      dividendProfit: Number(dividendProfit.toFixed(2)),
      estimatedMonthlyIncome: Number(estimatedMonthlyIncome.toFixed(2)),
    };
  };

  // Calcular em quantos meses atinge determinados marcos patrimoniais
  const calculateMonthsToTarget = (targetAmount: number): number => {
    if (initialCapital >= targetAmount) return 0;
    const rate = monthlyYieldPercent / 100;
    let acc = initialCapital;
    let months = 0;
    const maxMonths = 600; // limite de 50 anos

    while (acc < targetAmount && months < maxMonths) {
      acc += monthlyContribution;
      acc += acc * rate;
      months++;
    }
    return months;
  };

  const formatDuration = (months: number): string => {
    if (months === 0) return 'Conquistado! 🎉';
    if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (m === 0) return `${y} ${y === 1 ? 'ano' : 'anos'}`;
    return `${y}a e ${m}m`;
  };

  const scenarios = [1, 3, 5, 10].map((y) => calculateProgression(y));
  const milestones = [5000, 10000, 50000].map((target) => ({
    target,
    months: calculateMonthsToTarget(target),
  }));

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Simulador de Futuro</h3>
            <p className="text-[11px] text-zinc-400">Projeção com juros compostos em FIIs</p>
          </div>
        </div>

        {currentEquity > 0 && (
          <button
            type="button"
            onClick={() => setStartFromCurrentEquity(!startFromCurrentEquity)}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 border transition-all ${
              startFromCurrentEquity
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400'
            }`}
            title="Alternar entre iniciar com seu patrimônio atual ou do zero"
          >
            <Wallet className="w-3 h-3" />
            {startFromCurrentEquity ? 'Com Minha Carteira' : 'Partindo do R$ 0'}
          </button>
        )}
      </div>

      {/* Controles simples */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">Aporte Mensal (R$)</label>
          <input
            type="number"
            step="50"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(Math.max(10, Number(e.target.value)))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">Yield Mensal Médio</label>
          <select
            value={monthlyYieldPercent}
            onChange={(e) => setMonthlyYieldPercent(Number(e.target.value))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-violet-500"
          >
            {averageYieldPercent >= 0.6 &&
              averageYieldPercent <= 1.3 &&
              ![0.75, 0.85, 1.0].includes(averageYieldPercent) && (
                <option value={averageYieldPercent}>
                  {averageYieldPercent}% a.m. (Sua Carteira)
                </option>
              )}
            <option value={0.75}>0.75% a.m. (Conservador)</option>
            <option value={0.85}>0.85% a.m. (Média FIIs)</option>
            <option value={1.0}>1.00% a.m. (Otimista)</option>
          </select>
        </div>
      </div>

      {/* Tempo estimado até os próximos Marcos */}
      <div className="p-3 rounded-2xl bg-zinc-950/50 border border-zinc-800/60">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 mb-2">
          <Flag className="w-3 h-3 text-violet-400" />
          Tempo até seus marcos (mantendo {formatBRL(monthlyContribution)}/mês)
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {milestones.map((m) => (
            <div key={m.target} className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
              <div className="text-[10px] text-zinc-400 font-medium">
                R$ {(m.target / 1000).toFixed(0)} mil
              </div>
              <div className="text-xs font-extrabold text-violet-300 mt-0.5">
                {formatDuration(m.months)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cards de Cenários */}
      <div className="space-y-2">
        {scenarios.map((sc) => (
          <div
            key={sc.years}
            className="p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-800/60 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-violet-400 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
                  {sc.years} {sc.years === 1 ? 'ano' : 'anos'}
                </span>
                <span className="text-xs font-bold text-white">
                  {formatBRL(sc.accumulated)}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Investido: {formatBRL(sc.totalInvestedFromPocket)} • Juros:{' '}
                <strong className="text-emerald-400 font-medium">+{formatBRL(sc.dividendProfit)}</strong>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block">Renda passiva/mês</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1">
                <TrendingUp className="w-3 h-3" />
                {formatBRL(sc.estimatedMonthlyIncome)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

