'use client';

import { useState } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';

export function InvestmentSimulator() {
  const [monthlyContribution, setMonthlyContribution] = useState<number>(200);
  const [monthlyYieldPercent, setMonthlyYieldPercent] = useState<number>(0.85); // 0.85% a.m. (média sólida de FIIs)

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  // Calcular simulação com reinvestimento total de dividendos
  const calculateProgression = (years: number) => {
    const totalMonths = years * 12;
    const rate = monthlyYieldPercent / 100;
    let accumulated = 0;
    let totalInvestedFromPocket = 0;

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
      totalInvestedFromPocket,
      dividendProfit: Number(dividendProfit.toFixed(2)),
      estimatedMonthlyIncome: Number(estimatedMonthlyIncome.toFixed(2)),
    };
  };

  const scenarios = [1, 3, 5, 10].map((y) => calculateProgression(y));

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <Calculator className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Simulador de R$ {monthlyContribution}/mês</h3>
          <p className="text-[11px] text-zinc-400">Poder dos juros compostos em FIIs</p>
        </div>
      </div>

      {/* Controles simples */}
      <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
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
          <label className="text-[11px] text-zinc-400 block mb-1">Rendimento Médio</label>
          <select
            value={monthlyYieldPercent}
            onChange={(e) => setMonthlyYieldPercent(Number(e.target.value))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-violet-500"
          >
            <option value={0.75}>0.75% a.m. (Conservador)</option>
            <option value={0.85}>0.85% a.m. (Média de FIIs)</option>
            <option value={1.0}>1.00% a.m. (Otimista)</option>
          </select>
        </div>
      </div>

      {/* Cards de Cenários */}
      <div className="space-y-2.5">
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
                Seu bolso: {formatBRL(sc.totalInvestedFromPocket)} • Lucro dividendos:{' '}
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

