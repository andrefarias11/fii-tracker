'use client';

import { useState, useMemo } from 'react';
import { Calculator, Wallet, Flag, TrendingDown, Landmark } from 'lucide-react';
import type { BcbIndicators, FocusYearlyProjection } from '../types/portfolio';
import { triggerHaptic } from '../lib/haptic';

interface InvestmentSimulatorProps {
  currentEquity?: number;
  monthlyTarget?: number;
  averageYieldPercent?: number;
  bcbIndicators?: BcbIndicators | null;
  isPrivacyMode?: boolean;
}

const DEFAULT_FOCUS_PROJECTIONS: FocusYearlyProjection[] = [
  { year: 2027, selicMedian: 10.0, ipcaMedian: 4.0, realRateAnnual: 5.77 },
  { year: 2028, selicMedian: 9.25, ipcaMedian: 3.75, realRateAnnual: 5.3 },
  { year: 2029, selicMedian: 8.75, ipcaMedian: 3.5, realRateAnnual: 5.07 },
];

export function InvestmentSimulator({
  currentEquity = 0,
  monthlyTarget = 200,
  averageYieldPercent = 0.85,
  bcbIndicators = null,
  isPrivacyMode = false,
}: InvestmentSimulatorProps) {
  const [monthlyContribution, setMonthlyContribution] = useState<number>(
    () => monthlyTarget || 200
  );
  const [monthlyYieldPercent, setMonthlyYieldPercent] = useState<number>(() =>
    averageYieldPercent >= 0.6 && averageYieldPercent <= 1.3
      ? averageYieldPercent
      : 0.85
  );
  const [startFromCurrentEquity, setStartFromCurrentEquity] =
    useState<boolean>(true);
  const [simulationMode, setSimulationMode] = useState<'FOCUS_CURVE' | 'FIXED'>(
    'FOCUS_CURVE'
  );

  const focusProjections = useMemo(() => {
    if (
      bcbIndicators?.focusProjections &&
      bcbIndicators.focusProjections.length > 0
    ) {
      return bcbIndicators.focusProjections;
    }
    return DEFAULT_FOCUS_PROJECTIONS;
  }, [bcbIndicators]);

  const currentSelic = bcbIndicators?.selicAnnual ?? 10.75;
  const lastProjectedSelic =
    focusProjections[focusProjections.length - 1]?.selicMedian ?? 9.0;
  const isSelicFalling = lastProjectedSelic < currentSelic;

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const initialCapital = startFromCurrentEquity ? currentEquity : 0;

  // Taxa mensal equivalente de cada ano da curva Focus (considerando prêmio imobiliário isento sobre Selic líquida)
  const getFocusMonthlyRateForYearOffset = (yearIndex: number) => {
    if (simulationMode === 'FIXED') {
      return {
        nominalMonthlyRate: monthlyYieldPercent / 100,
        inflationMonthlyRate: (bcbIndicators?.ipcaMonthly ?? 0.36) / 100,
      };
    }

    const refProj =
      focusProjections[Math.min(yearIndex, focusProjections.length - 1)];
    // Carteira mista FII + Caixinha acompanha ~92% da Selic Bruta (isenta nos FIIs) + prêmio IPCA
    const equivalentAnnualYield = Math.max(
      8.2,
      refProj.selicMedian * 0.92 + refProj.ipcaMedian * 0.35
    );
    const nominalMonthlyRate =
      Math.pow(1 + equivalentAnnualYield / 100, 1 / 12) - 1;
    const inflationMonthlyRate =
      Math.pow(1 + refProj.ipcaMedian / 100, 1 / 12) - 1;

    return { nominalMonthlyRate, inflationMonthlyRate };
  };

  // Calcular simulação com reinvestimento total de dividendos + curva Focus BCB
  const calculateProgression = (years: number) => {
    const totalMonths = years * 12;
    let accumulated = initialCapital;
    let totalInvestedFromPocket = initialCapital;
    let cumulativeInflationFactor = 1;

    for (let m = 1; m <= totalMonths; m++) {
      const yearIdx = Math.floor((m - 1) / 12);
      const { nominalMonthlyRate, inflationMonthlyRate } =
        getFocusMonthlyRateForYearOffset(yearIdx);

      accumulated += monthlyContribution;
      totalInvestedFromPocket += monthlyContribution;
      accumulated += accumulated * nominalMonthlyRate;
      cumulativeInflationFactor *= 1 + inflationMonthlyRate;
    }

    const finalYearRate = getFocusMonthlyRateForYearOffset(
      Math.max(0, years - 1)
    ).nominalMonthlyRate;
    const estimatedMonthlyIncome = accumulated * finalYearRate;
    const dividendProfit = accumulated - totalInvestedFromPocket;
    const realPurchasingPower = accumulated / cumulativeInflationFactor;

    return {
      years,
      accumulated: Number(accumulated.toFixed(2)),
      realPurchasingPower: Number(realPurchasingPower.toFixed(2)),
      totalInvestedFromPocket: Number(totalInvestedFromPocket.toFixed(2)),
      dividendProfit: Number(dividendProfit.toFixed(2)),
      estimatedMonthlyIncome: Number(estimatedMonthlyIncome.toFixed(2)),
    };
  };

  // Calcular em quantos meses atinge determinados marcos patrimoniais
  const calculateMonthsToTarget = (targetAmount: number): number => {
    if (initialCapital >= targetAmount) return 0;
    let acc = initialCapital;
    let months = 0;
    const maxMonths = 600; // limite de 50 anos

    while (acc < targetAmount && months < maxMonths) {
      const yearIdx = Math.floor(months / 12);
      const { nominalMonthlyRate } = getFocusMonthlyRateForYearOffset(yearIdx);
      acc += monthlyContribution;
      acc += acc * nominalMonthlyRate;
      months++;
    }
    return months;
  };

  const formatDuration = (months: number): string => {
    if (months === 0) return 'Conquistado!';
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
    <div className="space-y-4">
      {/* PAINEL BOLETIM FOCUS — API OLINDA DO BANCO CENTRAL */}
      <div className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center text-white shrink-0">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Boletim Focus BCB
              </h3>
              <p className="text-[11px] text-zinc-400 uppercase tracking-wide mt-0.5">
                API OLINDA • EXPECTATIVAS DO MERCADO
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-[#2b2512] text-[#f5b800] text-[11px] font-bold tabular-nums">
            Selic Hoje: {currentSelic}%
          </span>
        </div>

        {/* Grade 3 Anos do Boletim Focus */}
        <div className="grid grid-cols-3 gap-2">
          {focusProjections.map((proj) => (
            <div
              key={proj.year}
              className="p-3 rounded-2xl bg-[#141416] border border-white/[0.05] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#f5b800] tabular-nums">
                  {proj.year}
                </span>
                <span className="text-[10px] text-zinc-500">Focus</span>
              </div>

              <div className="space-y-0.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px]">Selic</span>
                  <span className="text-white font-bold tabular-nums">
                    {proj.selicMedian}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px]">IPCA</span>
                  <span className="text-zinc-200 font-semibold tabular-nums">
                    {proj.ipcaMedian}%
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
                  <span className="text-zinc-400 text-[10px]">Juro Real</span>
                  <span className="text-emerald-400 font-bold text-[11px] tabular-nums">
                    +{proj.realRateAnnual}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Termômetro de Ciclo Tijolo vs Papel */}
        <div className="p-3.5 rounded-2xl bg-[#141416] border border-white/[0.05] flex items-start gap-2.5">
          <TrendingDown className="w-4 h-4 text-[#f5b800] shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 leading-relaxed">
            <strong className="text-white">Termômetro do Ciclo Focus: </strong>
            {isSelicFalling ? (
              <span>
                O consenso do Banco Central projeta queda da Selic de{' '}
                <strong className="text-[#f5b800]">{currentSelic}%</strong> para{' '}
                <strong className="text-emerald-400">
                  {lastProjectedSelic}% a.a.
                </strong>{' '}
                até {focusProjections[focusProjections.length - 1]?.year}. Esse
                fechamento de juros historicamente impulsiona a{' '}
                <strong className="text-white">
                  valorização das cotas de FIIs de Tijolo
                </strong>{' '}
                (Galpões e Shoppings).
              </span>
            ) : (
              <span>
                O mercado projeta manutenção de juros elevados até{' '}
                {focusProjections[focusProjections.length - 1]?.year},
                favorecendo forte carrego mensal em{' '}
                <strong className="text-white">
                  FIIs de Papel (CDI+ / IPCA+) e Caixinhas
                </strong>
                .
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SIMULADOR DE FUTURO CONECTADO À CURVA FOCUS */}
      <div className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center text-white shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Simulador de Futuro
              </h3>
              <p className="text-[11px] text-zinc-400 uppercase tracking-wide mt-0.5">
                {simulationMode === 'FOCUS_CURVE'
                  ? 'CURVA DINÂMICA BOLETIM FOCUS'
                  : 'PROJEÇÃO DE TAXA FIXA'}
              </p>
            </div>
          </div>

          {currentEquity > 0 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setStartFromCurrentEquity(!startFromCurrentEquity);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                startFromCurrentEquity
                  ? 'bg-[#2b2512] text-[#f5b800]'
                  : 'bg-[#141416] text-zinc-400'
              }`}
              title="Alternar entre iniciar com seu patrimônio atual ou do zero"
            >
              <Wallet className="w-3.5 h-3.5" />
              {startFromCurrentEquity ? 'Com Carteira' : 'Do R$ 0'}
            </button>
          )}
        </div>

        {/* Seletor de Modo: Curva Focus BCB vs Taxa Fixa */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#141416] border border-white/[0.04] gap-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSimulationMode('FOCUS_CURVE');
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
              simulationMode === 'FOCUS_CURVE'
                ? 'bg-[#2b2512] text-[#f5b800] font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Curva Focus BCB
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSimulationMode('FIXED');
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
              simulationMode === 'FIXED'
                ? 'bg-[#2b2512] text-[#f5b800] font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Taxa Fixa Manual
          </button>
        </div>

        {/* Controles simples */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#141416]">
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
              Aporte Mensal (R$)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="50"
              value={monthlyContribution}
              onChange={(e) =>
                setMonthlyContribution(Math.max(10, Number(e.target.value)))
              }
              className="w-full bg-[#1c1c1e] border border-white/[0.08] rounded-xl px-3 py-2 text-base sm:text-xs text-white font-bold outline-none focus:border-[#f5b800]/60 tabular-nums"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
              {simulationMode === 'FOCUS_CURVE'
                ? 'Indexador Base'
                : 'Yield Mensal Médio'}
            </label>
            {simulationMode === 'FOCUS_CURVE' ? (
              <div className="w-full bg-[#1c1c1e] border border-[#f5b800]/30 rounded-xl px-3 py-2 text-xs text-[#f5b800] font-bold tabular-nums truncate">
                Focus Selic + IPCA
              </div>
            ) : (
              <select
                value={monthlyYieldPercent}
                onChange={(e) => setMonthlyYieldPercent(Number(e.target.value))}
                className="w-full bg-[#1c1c1e] border border-white/[0.08] rounded-xl px-2.5 py-2 text-base sm:text-xs text-white font-bold outline-none focus:border-[#f5b800]/60 tabular-nums"
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
            )}
          </div>
        </div>

        {/* Tempo estimado até os próximos Marcos */}
        <div className="p-4 rounded-2xl bg-[#141416]">
          <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 mb-2.5">
            <Flag className="w-3.5 h-3.5 text-[#f5b800]" />
            <span>
              Tempo até os marcos (
              <span className="tabular-nums text-[#f5b800]">
                {formatBRL(monthlyContribution)}/mês
              </span>
              )
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {milestones.map((m) => (
              <div
                key={m.target}
                className="p-2.5 rounded-xl bg-[#1c1c1e] border border-white/[0.04]"
              >
                <div className="text-[11px] text-zinc-400 font-medium tabular-nums">
                  R$ {(m.target / 1000).toFixed(0)} mil
                </div>
                <div className="text-xs font-bold text-white mt-0.5 tabular-nums">
                  {formatDuration(m.months)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cenários estilo Tabela Corrida XP */}
        <div className="space-y-2.5">
          {scenarios.map((sc) => (
            <div
              key={sc.years}
              className="p-4 rounded-2xl bg-[#141416] flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] font-bold text-[#f5b800] px-2.5 py-0.5 rounded-full bg-[#2b2512]">
                    {sc.years} {sc.years === 1 ? 'ano' : 'anos'}
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {formatBRL(sc.accumulated)}
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  Aplicado:{' '}
                  <span className="tabular-nums text-zinc-300">
                    {formatBRL(sc.totalInvestedFromPocket)}
                  </span>{' '}
                  • Juros:{' '}
                  <strong className="text-emerald-400 font-semibold tabular-nums">
                    +{formatBRL(sc.dividendProfit)}
                  </strong>
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                  Poder de compra real (pós-IPCA Focus):{' '}
                  <span className="text-zinc-300 font-medium">
                    {formatBRL(sc.realPurchasingPower)}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[11px] text-zinc-400 block mb-0.5">
                  Renda/mês
                </span>
                <span className="text-xs font-bold text-emerald-400 tabular-nums">
                  ▲ {formatBRL(sc.estimatedMonthlyIncome)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
