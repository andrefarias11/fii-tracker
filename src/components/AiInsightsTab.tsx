'use client';
import { authenticatedFetch } from '../lib/authenticatedFetch';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FiiPosition, FixedIncomeAsset } from '../types/portfolio';
import type { BcbIndicatorsResponse } from '../app/api/bcb/route';
import type {
  AiPortfolioInsightsResponse,
  PortfolioPositionSummaryInput,
} from '../app/api/ai-insights/route';
import {
  Sparkles,
  ShieldAlert,
  FileText,
  ExternalLink,
  RefreshCw,
  KeyRound,
  Send,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { triggerHaptic } from '../lib/haptic';

interface AiInsightsTabProps {
  positions: FiiPosition[];
  fixedIncomeAssets: FixedIncomeAsset[];
  bcbIndicators: BcbIndicatorsResponse | null;
  initialTickerFilter?: string | null;
  onClearTickerFilter?: () => void;
  onOpenBuyModal?: (ticker: string) => void;
}

const AI_KEY_STORAGE = 'fii_tracker_ai_api_key_v1';

export function AiInsightsTab({
  positions,
  fixedIncomeAssets,
  bcbIndicators,
  initialTickerFilter = null,
  onClearTickerFilter,
  onOpenBuyModal,
}: AiInsightsTabProps) {
  const [promptType, setPromptType] = useState<
    'GERAL' | 'RISCOS' | 'TIJOLO_VS_PAPEL' | 'DESCONTADOS' | 'CUSTOM'
  >('GERAL');
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [insights, setInsights] = useState<AiPortfolioInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(AI_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });

  const fixedIncomeTotal = useMemo(
    () => fixedIncomeAssets.reduce((acc, item) => acc + item.investedAmount, 0),
    [fixedIncomeAssets]
  );

  const mappedPositions: PortfolioPositionSummaryInput[] = useMemo(() => {
    const totalEquity = Math.max(
      1,
      positions.reduce((acc, item) => acc + item.currentTotal, 0)
    );
    return positions.map((p) => ({
      ticker: p.ticker,
      name: p.name,
      assetClass: p.assetClass,
      segment: p.segment,
      totalShares: p.totalShares,
      averagePrice: p.averagePrice,
      currentPrice: p.currentPrice,
      currentTotal: p.currentTotal,
      totalMonthlyDividend: p.totalMonthlyDividend,
      yieldOnCostPercent: p.yieldOnCostPercent,
      pvp: p.pvp,
      allocationPercent: Math.round((p.currentTotal / totalEquity) * 100),
    }));
  }, [positions]);

  const requestInsights = useCallback(
    async (
      selectedPrompt: 'GERAL' | 'RISCOS' | 'TIJOLO_VS_PAPEL' | 'DESCONTADOS' | 'CUSTOM',
      questionOverride?: string
    ): Promise<AiPortfolioInsightsResponse | null> => {
      try {
        let savedKey = '';
        if (typeof window !== 'undefined') {
          savedKey = localStorage.getItem(AI_KEY_STORAGE) || '';
        }

        const res = await authenticatedFetch('/api/ai-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positions: mappedPositions,
            fixedIncomeTotal,
            selicAnnual: bcbIndicators?.selicAnnual ?? 10.75,
            cdiAnnual: bcbIndicators?.cdiAnnual ?? 10.65,
            ipca12m: bcbIndicators?.ipca12m ?? 4.42,
            focusProjections: bcbIndicators?.focusProjections ?? [],
            promptType: selectedPrompt,
            customQuestion: questionOverride ?? customQuestion,
            customApiKey: savedKey,
          }),
        });

        if (res.ok) {
          const data: AiPortfolioInsightsResponse = await res.json();
          return data;
        }
      } catch {
        // ignore network error
      }
      return null;
    },
    [mappedPositions, fixedIncomeTotal, bcbIndicators, customQuestion]
  );

  const fetchInsights = useCallback(
    async (
      selectedPrompt: 'GERAL' | 'RISCOS' | 'TIJOLO_VS_PAPEL' | 'DESCONTADOS' | 'CUSTOM',
      questionOverride?: string
    ) => {
      setIsLoading(true);
      const data = await requestInsights(selectedPrompt, questionOverride);
      if (data) setInsights(data);
      setIsLoading(false);
    },
    [requestInsights]
  );

  useEffect(() => {
    let active = true;
    requestInsights('GERAL').then((data) => {
      if (!active) return;
      if (data) setInsights(data);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [requestInsights]);

  const handleSaveApiKey = () => {
    triggerHaptic('light');
    try {
      if (apiKeyInput.trim()) {
        localStorage.setItem(AI_KEY_STORAGE, apiKeyInput.trim());
      } else {
        localStorage.removeItem(AI_KEY_STORAGE);
      }
    } catch {
      // ignore
    }
    setShowKeyConfig(false);
    fetchInsights(promptType);
  };

  const filteredFacts = useMemo(() => {
    if (!insights?.relevantFacts) return [];
    if (!initialTickerFilter) return insights.relevantFacts;
    return insights.relevantFacts.filter(
      (f) => f.ticker.toUpperCase() === initialTickerFilter.toUpperCase()
    );
  }, [insights, initialTickerFilter]);

  const getEngineBadgeLabel = (
    source?: AiPortfolioInsightsResponse['engineSource']
  ) => {
    if (source === 'GEMINI_AI') return 'Google Gemini AI Ativo';
    if (source === 'GROQ_AI') return 'Groq Llama 3.3 70B Ativo';
    return 'Motor Analítico B3 + FNet';
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho Solto Estilo XP */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-400">
            Diagnóstico de Risco & Tradutor de Comunicados B3
          </p>
          <h2 className="text-xl font-bold text-white tracking-tight">
            IA & Fatos Relevantes
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowKeyConfig((prev) => !prev);
            }}
            className="p-2 rounded-full bg-[#121215] text-zinc-300 border border-white/[0.06] hover:border-[#f5b800]/50 active:scale-95 transition-all"
            title="Configurar Chave Gemini / Groq (Opcional)"
          >
            <KeyRound className="w-4 h-4 text-[#f5b800]" />
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              triggerHaptic('light');
              fetchInsights(promptType);
            }}
            className="p-2 rounded-full bg-[#121215] text-zinc-300 border border-white/[0.06] hover:border-[#f5b800]/50 active:scale-95 transition-all disabled:opacity-50"
            title="Atualizar Análise"
          >
            <RefreshCw
              className={`w-4 h-4 text-[#f5b800] ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Gaveta Opcional de Chave Gemini / Groq API */}
      {showKeyConfig && (
        <div className="bg-[#121215] rounded-[20px] p-4 border border-[#f5b800]/30 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#f5b800]" />
              Conectar Chave Gemini ou Groq (Opcional)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800] font-semibold">
              100% Gratuito
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            O Motor Institucional B3 já funciona nativamente sem chave. Se quiser respostas geradas por LLM ao vivo, cole sua chave gratuita do Google AI Studio (`AIza...`) ou Groq (`gsk_...`):
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="Cole sua GEMINI_API_KEY ou GROQ_API_KEY..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#1c1c1f] border border-white/[0.08] text-white text-base sm:text-xs focus:border-[#f5b800] outline-none"
            />
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="px-4 py-2 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold active:scale-95 transition-all"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Score de Saúde Institucional da Carteira */}
      {insights && (
        <div className="bg-[#121215] rounded-[20px] p-5 border border-white/[0.06] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800] font-bold">
                  {getEngineBadgeLabel(insights.engineSource)}
                </span>
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  {insights.generatedAt}
                </span>
              </div>
              <h3 className="text-base font-bold text-white pt-1">
                Saúde da Carteira: {insights.healthLabel}
              </h3>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-[#1c1c1f] border border-[#f5b800]/40 flex flex-col items-center justify-center shrink-0">
              <span className="text-lg font-extrabold text-[#f5b800] tabular-nums leading-none">
                {insights.healthScore}
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5">/ 100</span>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            {insights.executiveSummary}
          </p>

          {/* Barra Macro: Tijolo vs Papel vs Ações vs Caixinhas */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Tijolo {insights.macroCorrelation.tijoloPercent}%</span>
              <span>Papel {insights.macroCorrelation.papelPercent}%</span>
              <span>Ações {insights.macroCorrelation.acoesPercent}%</span>
              <span>Caixinhas {insights.macroCorrelation.rendaFixaPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#1c1c1f] overflow-hidden flex">
              <div
                className="h-full bg-[#f5b800]"
                style={{ width: `${insights.macroCorrelation.tijoloPercent}%` }}
              />
              <div
                className="h-full bg-emerald-400"
                style={{ width: `${insights.macroCorrelation.papelPercent}%` }}
              />
              <div
                className="h-full bg-sky-400"
                style={{ width: `${insights.macroCorrelation.acoesPercent}%` }}
              />
              <div
                className="h-full bg-zinc-500"
                style={{ width: `${insights.macroCorrelation.rendaFixaPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {insights.macroCorrelation.verdict}
            </p>
          </div>
        </div>
      )}

      {/* Consultor Interativo de 1 Toque (Prompts) */}
      <div className="bg-[#121215] rounded-[20px] p-4 border border-white/[0.06] space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2b2512] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#f5b800]" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">
              Pergunte ao Analista IA da Carteira
            </h3>
            <p className="text-[11px] text-zinc-400">
              Toque em um diagnóstico rápido ou faça uma pergunta personalizada
            </p>
          </div>
        </div>

        {/* Pílulas de Diagnóstico Rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'GERAL', label: 'Resumo do Mês' },
            { id: 'RISCOS', label: 'Qual meu maior risco?' },
            { id: 'TIJOLO_VS_PAPEL', label: 'Tijolo ou Papel hoje?' },
            { id: 'DESCONTADOS', label: 'Ativos mais descontados' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                const nextType = pill.id as
                  | 'GERAL'
                  | 'RISCOS'
                  | 'TIJOLO_VS_PAPEL'
                  | 'DESCONTADOS';
                setPromptType(nextType);
                fetchInsights(nextType);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                promptType === pill.id
                  ? 'bg-[#f5b800] text-zinc-950 font-bold'
                  : 'bg-[#1c1c1f] text-zinc-300 hover:text-white border border-white/[0.06]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Input de Pergunta Customizada */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Pergunte sobre sua carteira (ex: vale aportar em HGLG11?)"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customQuestion.trim()) {
                setPromptType('CUSTOM');
                fetchInsights('CUSTOM', customQuestion);
              }
            }}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#1c1c1f] border border-white/[0.08] text-white text-base sm:text-xs focus:border-[#f5b800] outline-none"
          />
          <button
            type="button"
            disabled={isLoading || !customQuestion.trim()}
            onClick={() => {
              triggerHaptic('light');
              setPromptType('CUSTOM');
              fetchInsights('CUSTOM', customQuestion);
            }}
            className="p-2.5 rounded-full bg-[#f5b800] text-zinc-950 active:scale-95 transition-all disabled:opacity-40 shrink-0"
            title="Enviar pergunta"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Resposta Estruturada em Bullet Points */}
        {insights && (
          <div className="p-4 rounded-2xl bg-[#1c1c1f] border border-white/[0.04] space-y-2.5">
            <div className="text-xs font-bold text-[#f5b800]">
              {insights.promptQuestion}
            </div>
            <div className="space-y-2">
              {insights.promptAnswer.map((line, i) => (
                <p
                  key={i}
                  className="text-xs text-zinc-200 leading-relaxed"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alertas de Correlação e Risco Oculto */}
      {insights && insights.riskAlerts.length > 0 && (
        <div className="bg-[#121215] rounded-[20px] p-4 border border-white/[0.06] space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[#f5b800]" />
            Check-up de Correlação & Riscos da Carteira
          </h3>

          <div className="space-y-2.5">
            {insights.riskAlerts.map((alert, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-[#1c1c1f] border border-white/[0.05] space-y-1"
              >
                <div className="flex items-center gap-2">
                  {alert.level === 'HIGH' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  ) : alert.level === 'MEDIUM' ? (
                    <Info className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white">
                    {alert.title}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed pl-5">
                  {alert.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed de Fatos Relevantes & Relatórios Gerenciais Traduzidos em 3 Bullets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#f5b800]" />
            Fatos Relevantes & Raio-X por Ativo ({filteredFacts.length})
          </h3>

          {initialTickerFilter && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClearTickerFilter?.();
              }}
              className="px-2.5 py-1 rounded-full bg-[#2b2512] text-[#f5b800] text-[11px] font-bold"
            >
              Filtro: {initialTickerFilter} ✕
            </button>
          )}
        </div>

        {filteredFacts.map((fact) => (
          <div
            key={fact.ticker}
            className="bg-[#121215] rounded-[20px] p-5 border border-white/[0.06] space-y-3.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-white">
                    {fact.ticker}
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#1c1c1f] text-zinc-300 border border-white/[0.06]">
                    {fact.segment}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      fact.sentiment === 'POSITIVO'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : fact.sentiment === 'ATENCAO'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-[#2b2512] text-[#f5b800]'
                    }`}
                  >
                    {fact.sentiment === 'POSITIVO'
                      ? 'FUNDAMENTO FORTE'
                      : fact.sentiment === 'ATENCAO'
                      ? 'MONITORAR P/VP'
                      : 'ESTÁVEL'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {fact.sourceName} • {fact.publishedAt}
                </p>
              </div>
            </div>

            {/* Manchete Oficial / Comunicado */}
            <div className="p-3 rounded-2xl bg-[#1c1c1f] border border-white/[0.05]">
              <p className="text-xs font-semibold text-white leading-snug">
                “{fact.headline}”
              </p>
            </div>

            {/* Tradução em 3 Bullet Points Diretos */}
            <div className="space-y-2 text-xs text-zinc-300">
              {fact.bullets.map((b, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f5b800] mt-1.5 shrink-0" />
                  <span className="leading-relaxed">{b}</span>
                </div>
              ))}
            </div>

            {/* Botões de Ação Pílula Estilo XP */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <a
                href={fact.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <span>Relatório / FNet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenBuyModal?.(fact.ticker);
                }}
                className="py-2.5 px-3 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold active:scale-95 transition-all"
              >
                Aportar em {fact.ticker}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
