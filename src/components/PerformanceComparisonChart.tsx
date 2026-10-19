"use client";
import { useState } from 'react';
import type { FiiPosition, Transaction, BcbIndicators } from '../types/portfolio';

interface Props { positions: FiiPosition[]; transactions: Transaction[]; monthlyContribution?: number; bcbIndicators?: BcbIndicators | null; isPrivacyMode?: boolean }
export function PerformanceComparisonChart({ positions, bcbIndicators, isPrivacyMode = false }: Props) {
  const [base, setBase] = useState('portfolio');
  const equity = positions.reduce((sum,p) => sum + p.currentTotal, 0);
  const income = positions.reduce((sum,p) => sum + p.totalMonthlyDividend, 0);
  const initial = base === 'portfolio' ? equity : Number(base);
  const monthly = equity > 0 ? income / equity : 0;
  const scenarios = [
    { name: 'Renda da carteira reinvestida', rate: monthly, color: '#f5b800' },
    ...(bcbIndicators ? [
      { name: 'CDI líquido estimado', rate: bcbIndicators.cdiNetMonthly / 100, color: '#38bdf8' },
      { name: 'Inflação (cenário constante)', rate: bcbIndicators.ipcaMonthly / 100, color: '#a78bfa' },
    ] : []),
  ];
  const curves = scenarios.map(s => ({ ...s, points: Array.from({ length: 13 }, (_,m) => initial * Math.pow(1 + s.rate, m)) }));
  const all = curves.flatMap(c => c.points);
  const min = Math.min(...all, initial) * 0.98;
  const max = Math.max(...all, initial) * 1.02 || 1;
  const format = (value: number) => isPrivacyMode ? 'R$ ••••' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return <section className="rounded-2xl bg-[#1c1c1e] p-5 space-y-4">
    <h3 className="font-bold">Simulação dos próximos 12 meses</h3>
    <p className="text-sm text-zinc-400">Projeção, não rentabilidade histórica. Mantém as taxas atuais e o preço das cotas constantes, reinveste a renda estimada e não inclui novos aportes. Os resultados podem variar.</p>
    <label className="text-sm">Capital inicial
      <select aria-label="Capital inicial da simulação" className="ml-3 bg-zinc-800 p-2 rounded" value={base} onChange={e => setBase(e.target.value)}>
        <option value="portfolio">Patrimônio atual</option><option value="1000">R$ 1 mil</option><option value="10000">R$ 10 mil</option>
      </select>
    </label>
    <p className="text-sm">Base: {format(initial)} · Renda estimada: {(monthly * 100).toFixed(2)}% ao mês</p>
    <svg viewBox="0 0 360 180" role="img" aria-label="Projeção futura com taxas constantes, valores detalhados na tabela abaixo" className="w-full">
      {curves.map(c => <polyline key={c.name} fill="none" stroke={c.color} strokeWidth="2" points={c.points.map((v,i) => `${10 + i * 28},${160 - ((v-min)/(max-min || 1))*145}`).join(' ')} />)}
      <text x="10" y="177" fill="#aaa" fontSize="10">Hoje</text><text x="298" y="177" fill="#aaa" fontSize="10">12 meses</text>
    </svg>
    <table className="w-full text-sm"><caption className="text-left pb-2">Valores projetados em 12 meses</caption><tbody>
      {curves.map(c => <tr key={c.name}><th className="text-left py-2 font-normal" style={{ color: c.color }}>{c.name}</th><td className="text-right">{format(c.points[12])}</td></tr>)}
    </tbody></table>
    <p className="text-xs text-zinc-400">{bcbIndicators ? `Indicadores: ${bcbIndicators.source === 'FALLBACK' ? 'referência estimada (fonte indisponível)' : 'Banco Central'} · ${bcbIndicators.updatedAt}. CDI líquido usa hipótese simplificada de tributação.` : 'Comparadores indisponíveis: atualize os indicadores.'}</p>
  </section>;
}
