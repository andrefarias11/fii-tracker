'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Sparkles,
  Snowflake,
  Coins,
  ShieldCheck,
  Loader2,
  X,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';
import { FiiPosition } from '../types/portfolio';

interface UniversalMarketItem {
  ticker: string;
  name: string;
  assetClass: 'FII' | 'ACAO';
  segment: string;
  price?: number;
  changePercent?: number;
  logoUrl?: string;
  isCurated: boolean;
}

interface LiveQuoteInspection {
  ticker: string;
  name?: string;
  assetClass: 'FII' | 'ACAO';
  segment?: string;
  price: number;
  prevClose: number;
  changePercent: number;
  lastDividend?: number;
  annualDividend12m?: number;
  dividendExDate?: string;
  dividendPaymentDate?: string;
  dividendSource?: 'B3_OFICIAL' | 'MERCADO';
  vp: number;
  pvp: number;
  updatedAt: string;
}

interface UniversalB3ExplorerProps {
  positions: FiiPosition[];
  monthlyTarget: number;
  onOpenBuyModal?: (ticker: string) => void;
}

export function UniversalB3Explorer({
  positions,
  monthlyTarget,
  onOpenBuyModal,
}: UniversalB3ExplorerProps) {
  const [query, setQuery] = useState<string>('');
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'FII' | 'ACAO'>('ALL');
  const [items, setItems] = useState<UniversalMarketItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [inspectedQuote, setInspectedQuote] = useState<LiveQuoteInspection | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);

  const fetchMarketList = useCallback(
    async (q: string, filter: 'ALL' | 'FII' | 'ACAO') => {
      setIsLoadingList(true);
      try {
        const res = await fetch(
          `/api/market?q=${encodeURIComponent(q)}&type=${filter}&limit=60`
        );
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch {
        // Silencioso
      } finally {
        setIsLoadingList(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMarketList(query, assetFilter);
    }, 220);
    return () => clearTimeout(timer);
  }, [query, assetFilter, fetchMarketList]);

  const handleInspectAsset = async (ticker: string) => {
    const clean = ticker.trim().toUpperCase();
    if (!clean) return;

    setSelectedTicker(clean);
    setIsInspecting(true);
    setInspectError(null);

    try {
      const res = await fetch(`/api/quote?tickers=${encodeURIComponent(clean)}`);
      if (!res.ok) {
        setInspectError('Não foi possível consultar este código na B3 agora.');
        setInspectedQuote(null);
        return;
      }

      const data = await res.json();
      const quote: LiveQuoteInspection | undefined = data?.quotes?.[clean];

      if (!quote || typeof quote.price !== 'number') {
        setInspectError(
          `Ticker "${clean}" não encontrado ou sem pregão ativo na B3.`
        );
        setInspectedQuote(null);
        return;
      }

      setInspectedQuote(quote);
    } catch {
      setInspectError('Erro de conexão ao consultar a B3.');
      setInspectedQuote(null);
    } finally {
      setIsInspecting(false);
    }
  };

  const userPosition = selectedTicker
    ? positions.find((p) => p.ticker === selectedTicker)
    : undefined;

  // Cálculos em tempo real para o ativo inspecionado
  const renderLiveInspectionCard = () => {
    if (!selectedTicker) return null;

    if (isInspecting) {
      return (
        <div className="rounded-[20px] bg-[var(--surface-card)] border border-[#f5b800]/30 p-6 text-center space-y-2 animate-in fade-in">
          <Loader2 className="w-6 h-6 text-[#f5b800] animate-spin mx-auto" />
          <p className="text-xs font-bold text-white">
            Consultando {selectedTicker} ao vivo na B3...
          </p>
          <p className="text-[11px] text-zinc-400">
            Buscando cotação atual, histórico de 12 meses de dividendos e calculando Preço-Teto
          </p>
        </div>
      );
    }

    if (inspectError || !inspectedQuote) {
      return (
        <div className="rounded-[20px] bg-[var(--surface-card)] border border-rose-500/30 p-5 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="text-xs text-rose-400">{inspectError}</div>
          <button
            type="button"
            onClick={() => setSelectedTicker(null)}
            className="p-1.5 rounded-full bg-white/[0.06] text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    const q = inspectedQuote;
    const isStock = q.assetClass === 'ACAO';
    const isUp = q.changePercent >= 0;

    const monthlyDiv = q.lastDividend || 0;
    const annualDiv = q.annualDividend12m || Number((monthlyDiv * 12).toFixed(4));
    const annualYieldPct =
      q.price > 0 && annualDiv > 0
        ? Number(((annualDiv / q.price) * 100).toFixed(2))
        : 0;
    const monthlyYieldPct =
      q.price > 0 && monthlyDiv > 0
        ? Number(((monthlyDiv / q.price) * 100).toFixed(2))
        : 0;

    // Preço-Teto: Barsi 6% a.a. para Ações | 0,9% a.m. (10,8% a.a.) para FIIs
    const ceilingPrice =
      annualDiv > 0
        ? isStock
          ? Number((annualDiv / 0.06).toFixed(2))
          : Number((monthlyDiv / 0.009).toFixed(2))
        : q.price;

    const marginToCeilingPct =
      ceilingPrice > 0
        ? Number((((ceilingPrice - q.price) / ceilingPrice) * 100).toFixed(1))
        : 0;

    const isBelowCeiling = q.price <= ceilingPrice && annualDiv > 0;

    // Número Mágico (Bola de Neve)
    const magicShares =
      monthlyDiv > 0 ? Math.ceil(q.price / monthlyDiv) : 0;
    const magicCapitalRequired = Number((magicShares * q.price).toFixed(2));

    // Simulação rápida com a meta mensal do usuário (ou R$ 1.000)
    const simBudget = monthlyTarget >= 100 ? monthlyTarget : 1000;
    const sharesWithBudget = q.price > 0 ? Math.floor(simBudget / q.price) : 0;
    const monthlyIncomeWithBudget = Number((sharesWithBudget * monthlyDiv).toFixed(2));

    return (
      <div className="rounded-[20px] bg-[var(--surface-card)] border border-white/[0.08] p-5 shadow-2xl space-y-4 animate-in fade-in duration-150">
        {/* Topo do Raio-X Ao Vivo */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center shrink-0 text-white">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-white leading-tight">
                  {q.ticker}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]">
                  {isStock ? 'Ação B3' : 'FII / Fiagro B3'}
                </span>
                {userPosition && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 tabular-nums">
                    Na carteira ({userPosition.totalShares})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 uppercase tracking-wide truncate mt-0.5">
                {(q.name || q.ticker).toUpperCase()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedTicker(null)}
            aria-label="Fechar análise"
            className="p-1.5 rounded-full bg-[var(--surface-panel)] text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabela Key-Value Limpa Estilo XP */}
        <div className="space-y-2.5 pt-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Cotação ao vivo</span>
            <span className="text-white font-bold tabular-nums">
              {formatBRL(q.price)}{' '}
              <span
                className={`text-xs font-medium ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ({isUp ? '▲' : '▼'} {Math.abs(q.changePercent)}%)
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Dividend Yield (12m)</span>
            <span className="text-emerald-400 font-bold tabular-nums">
              {annualYieldPct > 0 ? `▲ ${annualYieldPct}% a.a. (${monthlyYieldPct}% a.m.)` : 'Sem div. 12m'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-400">
              {isStock ? 'Média mensal / 12m' : 'Último dividendo / 12m'}
            </span>
            <span className="text-white font-medium tabular-nums">
              {monthlyDiv > 0 ? `${formatBRL(monthlyDiv)} (${formatBRL(annualDiv)}/ano)` : 'R$ 0,00'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-400">
              {isStock ? 'Preço-Teto Barsi (6%)' : 'Preço-Teto (0,9% a.m.)'}
            </span>
            <span
              className={`font-semibold tabular-nums ${
                isBelowCeiling ? 'text-[#f5b800]' : 'text-zinc-300'
              }`}
            >
              {annualDiv > 0
                ? `${formatBRL(ceilingPrice)} (${
                    isBelowCeiling ? `${marginToCeilingPct}% margem` : 'Acima do teto'
                  })`
                : '—'}
            </span>
          </div>
        </div>

        {/* Bola de Neve & Simulador de Poder de Compra */}
        {monthlyDiv > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-[var(--surface-panel)] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5 text-[#f5b800]" />
                  Número Mágico
                </span>
                <div className="text-xs font-bold text-white mt-1 tabular-nums">
                  {magicShares} {isStock ? 'ações' : 'cotas'}
                </div>
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  Capital: {formatBRL(magicCapitalRequired)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-zinc-500 block">Gera/mês</span>
                <span className="text-xs font-bold text-emerald-400 tabular-nums">
                  +{formatBRL(magicShares * monthlyDiv)}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-panel)] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-[#f5b800]" />
                  Com <span className="tabular-nums">{formatBRL(simBudget)}</span>
                </span>
                <div className="text-xs font-bold text-white mt-1 tabular-nums">
                  Compra {sharesWithBudget} {isStock ? 'ações' : 'cotas'}
                </div>
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  Custo: {formatBRL(sharesWithBudget * q.price)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-zinc-500 block">Renda/mês</span>
                <span className="text-xs font-bold text-emerald-400 tabular-nums">
                  +{formatBRL(monthlyIncomeWithBudget)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Botões Pílula Estilo XP */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setSelectedTicker(null)}
            className="py-2.5 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold text-center active:scale-95 transition-all"
          >
            Fechar Raio-X
          </button>

          {onOpenBuyModal ? (
            <button
              type="button"
              onClick={() => onOpenBuyModal(q.ticker)}
              className="py-2.5 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold text-center active:scale-95 transition-all"
            >
              Aportar em {q.ticker}
            </button>
          ) : (
            <div className="py-2.5 rounded-full bg-[var(--surface-panel)] text-zinc-400 text-[11px] font-semibold text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              B3 Ao Vivo
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de Busca Estilo XP */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim().length >= 4) {
                handleInspectAsset(query);
              }
            }}
            placeholder="Buscar FII ou Ação na B3 (ex: HGLG11, ITUB4...)"
            className="w-full pl-10 pr-20 py-3 rounded-full bg-[var(--surface-card)] border border-white/[0.06] focus:border-[#f5b800]/60 text-base sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#f5b800] px-2.5 py-0.5 rounded-full bg-[#2b2512]"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Pílulas de Filtro Rápido */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: 'ALL', label: 'Todos da B3' },
              { id: 'FII', label: 'FIIs & Fiagros' },
              { id: 'ACAO', label: 'Ações' },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setAssetFilter(pill.id as 'ALL' | 'FII' | 'ACAO')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  assetFilter === pill.id
                    ? 'bg-[#f5b800] text-zinc-950'
                    : 'bg-[var(--surface-card)] text-zinc-300 hover:text-white'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {query.trim().length >= 4 && (
            <button
              type="button"
              onClick={() => handleInspectAsset(query)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold hover:opacity-90 transition-all whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Raio-X de &ldquo;{query.trim().toUpperCase()}&rdquo;
            </button>
          )}
        </div>
      </div>

      {/* CARD DE INSPEÇÃO AO VIVO */}
      {renderLiveInspectionCard()}

      {/* LISTA DE RESULTADOS DA B3 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 text-xs text-zinc-400">
          <span>
            {isLoadingList
              ? 'Buscando na B3...'
              : `Ativos listados (${items.length}) • Toque para abrir o Raio-X`}
          </span>
        </div>

        {isLoadingList ? (
          <div className="rounded-[20px] bg-[var(--surface-card)] border border-white/[0.06] p-8 text-center">
            <Loader2 className="w-6 h-6 text-[#f5b800] animate-spin mx-auto mb-2" />
            <p className="text-xs text-zinc-400">Carregando catálogo completo da B3...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[20px] bg-[var(--surface-card)] border border-white/[0.06] p-6 text-center space-y-3">
            <p className="text-xs text-zinc-300">
              Nenhum ativo listado no índice rápido para <strong>{query}</strong>.
            </p>
            {query.trim().length >= 4 && (
              <button
                type="button"
                onClick={() => handleInspectAsset(query)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold"
              >
                <Search className="w-3.5 h-3.5" />
                Consultar &ldquo;{query.trim().toUpperCase()}&rdquo; direto na B3
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-[20px] bg-[var(--surface-card)] border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden">
            {items.map((item) => {
              const isStock = item.assetClass === 'ACAO';
              const isSelected = selectedTicker === item.ticker;
              const isUp = (item.changePercent || 0) >= 0;

              return (
                <div
                  key={item.ticker}
                  onClick={() => handleInspectAsset(item.ticker)}
                  className={`px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#2b2512]/40'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg border border-white/80 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-white leading-none">
                        {item.ticker.slice(0, 4)}
                      </span>
                      <span
                        className={`text-[9px] font-bold mt-0.5 leading-none ${
                          isStock ? 'text-zinc-300' : 'text-[#f5b800]'
                        }`}
                      >
                        {item.ticker.slice(4)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white whitespace-nowrap">
                          {item.ticker}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800] whitespace-nowrap">
                          {isStock ? 'Ação' : 'FII'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 uppercase tracking-wide truncate mt-0.5">
                        {item.name}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {item.price ? (
                      <>
                        <div className="text-xs font-bold text-white tabular-nums whitespace-nowrap">
                          {formatBRL(item.price)}
                        </div>
                        {item.changePercent !== undefined && (
                          <div
                            className={`text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                              isUp ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isUp ? '▲ +' : '▼ '}
                            {item.changePercent}%
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#f5b800] bg-[#2b2512] px-3 py-1 rounded-full whitespace-nowrap">
                        Raio-X
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
