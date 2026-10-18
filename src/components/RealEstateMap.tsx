'use client';

import { useState, useMemo } from 'react';
import { FiiPosition } from '../types/portfolio';
import {
  FII_PROPERTIES_CATALOG,
  FiiRealEstateProperty,
} from '../data/fiiProperties';
import type { CepLookupResponse } from '../app/api/cep/route';
import {
  MapPin,
  Building2,
  Warehouse,
  ShoppingBag,
  Store,
  Tractor,
  Search,
  ExternalLink,
  CheckCircle2,
  Layers,
  Navigation,
  Compass,
  Loader2,
} from 'lucide-react';
import { triggerHaptic } from '../lib/haptic';

interface RealEstateMapProps {
  positions: FiiPosition[];
  initialTickerFilter?: string | null;
  onClearTickerFilter?: () => void;
  onOpenBuyModal?: (ticker: string) => void;
}

type ScopeFilter = 'MY_PORTFOLIO' | 'ALL_B3';
type PropertyTypeFilter =
  | 'ALL'
  | 'Logística'
  | 'Shopping'
  | 'Renda Urbana'
  | 'Laje Corporativa'
  | 'Agro / Terra';

// Projeção geográfica calibrada para o território brasileiro (Lat: +5.3 a -33.8, Lng: -74.0 a -34.5)
function projectLatLngToSvg(lat: number, lng: number): { x: number; y: number } {
  const minLng = -74.0;
  const maxLng = -34.0;
  const maxLat = 5.5;
  const minLat = -34.0;

  const clampedLng = Math.max(minLng, Math.min(maxLng, lng));
  const clampedLat = Math.max(minLat, Math.min(maxLat, lat));

  const x = ((clampedLng - minLng) / (maxLng - minLng)) * 340 + 30;
  const y = ((maxLat - clampedLat) / (maxLat - minLat)) * 340 + 25;
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

export function RealEstateMap({
  positions,
  initialTickerFilter = null,
  onClearTickerFilter,
  onOpenBuyModal,
}: RealEstateMapProps) {
  const portfolioTickers = useMemo(
    () => new Set(positions.map((p) => p.ticker.toUpperCase())),
    [positions]
  );

  const hasPortfolioProperties = useMemo(
    () => FII_PROPERTIES_CATALOG.some((prop) => portfolioTickers.has(prop.ticker)),
    [portfolioTickers]
  );

  const [scope, setScope] = useState<ScopeFilter>(() =>
    initialTickerFilter
      ? 'ALL_B3'
      : hasPortfolioProperties
      ? 'MY_PORTFOLIO'
      : 'ALL_B3'
  );
  const [typeFilter, setTypeFilter] = useState<PropertyTypeFilter>('ALL');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  // Estado da consulta ao vivo BrasilAPI CEP v2
  const [cepInput, setCepInput] = useState<string>('');
  const [isLoadingCep, setIsLoadingCep] = useState<boolean>(false);
  const [cepResult, setCepResult] = useState<CepLookupResponse | null>(null);
  const [cepError, setCepError] = useState<string | null>(null);

  const filteredProperties = useMemo(() => {
    return FII_PROPERTIES_CATALOG.filter((prop) => {
      if (initialTickerFilter && prop.ticker !== initialTickerFilter.toUpperCase()) {
        return false;
      }
      if (!initialTickerFilter && scope === 'MY_PORTFOLIO' && !portfolioTickers.has(prop.ticker)) {
        return false;
      }
      if (typeFilter !== 'ALL' && prop.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [scope, typeFilter, portfolioTickers, initialTickerFilter]);

  const activeProperty: FiiRealEstateProperty | null = useMemo(() => {
    if (filteredProperties.length === 0) return null;
    if (selectedPropertyId) {
      const found = filteredProperties.find((p) => p.id === selectedPropertyId);
      if (found) return found;
    }
    return filteredProperties[0];
  }, [filteredProperties, selectedPropertyId]);

  // Estatísticas consolidadas
  const stats = useMemo(() => {
    const totalAbl = filteredProperties.reduce((acc, p) => acc + p.ablM2, 0);
    const statesSet = new Set(filteredProperties.map((p) => p.state));
    const tickersSet = new Set(filteredProperties.map((p) => p.ticker));
    const avgOccupancy =
      filteredProperties.length > 0
        ? filteredProperties.reduce((acc, p) => acc + p.occupancyPercent, 0) /
          filteredProperties.length
        : 0;

    // Distribuição por Estado (UF)
    const byStateMap = new Map<string, { count: number; abl: number }>();
    for (const p of filteredProperties) {
      const prev = byStateMap.get(p.state) || { count: 0, abl: 0 };
      byStateMap.set(p.state, { count: prev.count + 1, abl: prev.abl + p.ablM2 });
    }

    const byState = Array.from(byStateMap.entries())
      .map(([uf, data]) => ({
        uf,
        count: data.count,
        abl: data.abl,
        percent:
          filteredProperties.length > 0
            ? Math.round((data.count / filteredProperties.length) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalProperties: filteredProperties.length,
      totalAbl,
      statesCount: statesSet.size,
      tickersCount: tickersSet.size,
      avgOccupancy: Number(avgOccupancy.toFixed(1)),
      byState,
    };
  }, [filteredProperties]);

  const handleLookupCep = async (rawCepToQuery?: string) => {
    const targetCep = (rawCepToQuery ?? cepInput).replace(/\D/g, '');
    if (targetCep.length !== 8) {
      setCepError('Digite um CEP válido de 8 dígitos (ex: 04538-132).');
      return;
    }

    triggerHaptic('light');
    setIsLoadingCep(true);
    setCepError(null);

    try {
      const res = await fetch(`/api/cep?cep=${targetCep}`);
      const data = await res.json();
      if (!res.ok) {
        setCepError(data.error || 'CEP não encontrado.');
        setCepResult(null);
      } else {
        setCepResult(data as CepLookupResponse);
        setCepInput(data.cep);
      }
    } catch {
      setCepError('Falha ao conectar na BrasilAPI CEP v2.');
    } finally {
      setIsLoadingCep(false);
    }
  };

  const getPropertyIcon = (type: FiiRealEstateProperty['type']) => {
    switch (type) {
      case 'Logística':
        return Warehouse;
      case 'Shopping':
        return ShoppingBag;
      case 'Renda Urbana':
        return Store;
      case 'Laje Corporativa':
        return Building2;
      case 'Agro / Terra':
        return Tractor;
      default:
        return Building2;
    }
  };

  const formatNumber = (n: number) =>
    new Intl.NumberFormat('pt-BR').format(n);

  return (
    <div className="space-y-4">
      {/* Cabeçalho Solto Estilo XP */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-zinc-400">
              Patrimônio Físico & Geolocalização (BrasilAPI v2)
            </p>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Mapa Imobiliário B3
            </h2>
          </div>

          {initialTickerFilter && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClearTickerFilter?.();
              }}
              className="px-3 py-1.5 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold border border-[#f5b800]/30 active:scale-95 transition-all"
            >
              Filtro: {initialTickerFilter} ✕
            </button>
          )}
        </div>
      </div>

      {/* Seletor Meus Imóveis vs Todos da B3 */}
      {!initialTickerFilter && (
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#1c1c1e] border border-white/[0.04] gap-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setScope('MY_PORTFOLIO');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              scope === 'MY_PORTFOLIO'
                ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-[#f5b800]" />
            <span>Meus Imóveis (Carteira)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setScope('ALL_B3');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              scope === 'ALL_B3'
                ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-[#f5b800]" />
            <span>Todos da B3 ({FII_PROPERTIES_CATALOG.length})</span>
          </button>
        </div>
      )}

      {/* Pílulas de Segmento Imobiliário */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { id: 'ALL', label: 'Todos Setores' },
            { id: 'Logística', label: 'Galpões Logísticos' },
            { id: 'Shopping', label: 'Shoppings' },
            { id: 'Renda Urbana', label: 'Renda Urbana' },
            { id: 'Laje Corporativa', label: 'Lajes Triple A' },
            { id: 'Agro / Terra', label: 'Agro & Terras' },
          ] as { id: PropertyTypeFilter; label: string }[]
        ).map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setTypeFilter(pill.id);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              typeFilter === pill.id
                ? 'bg-[#f5b800] text-zinc-950 font-bold'
                : 'bg-[#1c1c1e] text-zinc-400 hover:text-zinc-200 border border-white/[0.04]'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* KPIs do Portfólio Imobiliário */}
      <div className="bg-[#1c1c1e] rounded-[20px] p-4 border border-white/[0.04] grid grid-cols-3 divide-x divide-white/[0.06]">
        <div className="pr-3">
          <div className="text-[11px] text-zinc-400">Imóveis Físicos</div>
          <div className="text-lg font-bold text-white tabular-nums mt-0.5">
            {stats.totalProperties}
          </div>
          <div className="text-[11px] text-[#f5b800] font-medium">
            {stats.tickersCount} {stats.tickersCount === 1 ? 'fundo' : 'fundos'}
          </div>
        </div>

        <div className="px-3">
          <div className="text-[11px] text-zinc-400">Área Locável (ABL)</div>
          <div className="text-lg font-bold text-white tabular-nums mt-0.5">
            {formatNumber(Math.round(stats.totalAbl / 1000))}k m²
          </div>
          <div className="text-[11px] text-emerald-400 font-medium tabular-nums">
            {stats.avgOccupancy}% ocupação
          </div>
        </div>

        <div className="pl-3">
          <div className="text-[11px] text-zinc-400">Presença Nacional</div>
          <div className="text-lg font-bold text-white tabular-nums mt-0.5">
            {stats.statesCount} {stats.statesCount === 1 ? 'Estado' : 'Estados'}
          </div>
          <div className="text-[11px] text-zinc-400 truncate">
            {stats.byState
              .slice(0, 3)
              .map((s) => s.uf)
              .join(', ') || 'Brasil'}
          </div>
        </div>
      </div>

      {/* MAPA INTERATIVO DARK RADAR DO BRASIL */}
      <div className="bg-[#1c1c1e] rounded-[20px] p-4 border border-white/[0.04] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#2b2512] flex items-center justify-center">
              <Navigation className="w-3.5 h-3.5 text-[#f5b800]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">
                Radar Geográfico de Ativos Reais
              </h3>
              <p className="text-[11px] text-zinc-400">
                Toque em qualquer pin dourado para inspecionar o imóvel
              </p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#141416] text-zinc-400 border border-white/[0.06]">
            Satélite / Vetor
          </span>
        </div>

        {/* Canvas SVG Interativo do Brasil + Pins de Coordenadas Reais */}
        <div className="relative w-full aspect-[1.08/1] rounded-2xl bg-[#0b0b0d] border border-white/[0.05] overflow-hidden flex items-center justify-center">
          <svg
            viewBox="0 0 400 390"
            className="w-full h-full select-none"
            aria-label="Mapa Imobiliário do Brasil"
          >
            <defs>
              <radialGradient id="xpGoldGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f5b800" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#f5b800" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="emeraldGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Grade Cartográfica Dark Sutil */}
            {[60, 120, 180, 240, 300, 360].map((pos) => (
              <g key={pos}>
                <line
                  x1={pos}
                  y1={0}
                  x2={pos}
                  y2={390}
                  stroke="rgba(255,255,255,0.03)"
                  strokeDasharray="3 3"
                />
                <line
                  x1={0}
                  y1={pos}
                  x2={400}
                  y2={pos}
                  stroke="rgba(255,255,255,0.03)"
                  strokeDasharray="3 3"
                />
              </g>
            ))}

            {/* Silhueta Geográfica Estilizada do Território Brasileiro + Regiões */}
            <path
              d="M 135 32 L 195 24 L 245 45 L 305 70 L 362 110 L 358 158 L 325 208 L 308 252 L 265 292 L 235 352 L 198 368 L 185 325 L 182 268 L 135 232 L 105 182 L 45 148 L 42 102 L 88 65 Z"
              fill="#141416"
              stroke="rgba(245, 184, 0, 0.22)"
              strokeWidth="1.5"
            />

            {/* Linhas divisórias sutis de Macro-Regiões */}
            <path
              d="M 105 182 L 235 175 L 325 208 M 235 175 L 245 45 M 182 268 L 308 252"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Siglas de Estados de Referência */}
            {[
              { uf: 'AM', lat: -3.5, lng: -62.0 },
              { uf: 'PA', lat: -4.5, lng: -52.0 },
              { uf: 'CE', lat: -5.0, lng: -39.5 },
              { uf: 'PE', lat: -8.3, lng: -36.0 },
              { uf: 'BA', lat: -12.8, lng: -41.5 },
              { uf: 'MT', lat: -13.0, lng: -56.0 },
              { uf: 'GO', lat: -16.5, lng: -49.5 },
              { uf: 'MG', lat: -18.8, lng: -44.5 },
              { uf: 'RJ', lat: -22.7, lng: -42.5 },
              { uf: 'SP', lat: -23.3, lng: -48.0 },
              { uf: 'PR', lat: -25.3, lng: -51.5 },
              { uf: 'SC', lat: -27.2, lng: -50.2 },
              { uf: 'RS', lat: -30.2, lng: -53.2 },
            ].map((st) => {
              const pt = projectLatLngToSvg(st.lat, st.lng);
              return (
                <text
                  key={st.uf}
                  x={pt.x}
                  y={pt.y}
                  fill="rgba(255,255,255,0.22)"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {st.uf}
                </text>
              );
            })}

            {/* Pins dos Imóveis Filtrados */}
            {filteredProperties.map((prop, idx) => {
              const basePt = projectLatLngToSvg(prop.lat, prop.lng);
              // Pequeno offset espiral determinístico para não sobrepor pins na mesma cidade (ex: SP)
              const angle = idx * 2.1;
              const offsetRadius = prop.state === 'SP' ? (idx % 4) * 4.2 : 0;
              const x = basePt.x + Math.cos(angle) * offsetRadius;
              const y = basePt.y + Math.sin(angle) * offsetRadius;

              const isSelected = activeProperty?.id === prop.id;
              const isOwned = portfolioTickers.has(prop.ticker);

              return (
                <g
                  key={prop.id}
                  onClick={() => {
                    triggerHaptic('selection');
                    setSelectedPropertyId(prop.id);
                  }}
                  className="cursor-pointer"
                >
                  {isSelected && (
                    <circle
                      cx={x}
                      cy={y}
                      r={20}
                      fill="url(#xpGoldGlow)"
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 7.5 : 5}
                    fill={isSelected ? '#f5b800' : isOwned ? '#22c55e' : '#f5b800'}
                    fillOpacity={isSelected ? 1 : 0.85}
                    stroke="#0b0b0d"
                    strokeWidth="2"
                  />
                  {isSelected && (
                    <text
                      x={x}
                      y={y - 11}
                      fill="#f5b800"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {prop.ticker}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Pin extra caso o usuário tenha consultado um CEP ao vivo na BrasilAPI */}
            {cepResult && (
              <g>
                {(() => {
                  const pt = projectLatLngToSvg(cepResult.lat, cepResult.lng);
                  return (
                    <>
                      <circle cx={pt.x} cy={pt.y} r={18} fill="url(#emeraldGlow)" />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={6.5}
                        fill="#22c55e"
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 10}
                        fill="#22c55e"
                        fontSize="9.5"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        CEP {cepResult.cep}
                      </text>
                    </>
                  );
                })()}
              </g>
            )}
          </svg>

          {/* Legenda Flutuante no Canto Inferior */}
          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] text-zinc-400 bg-[#141416]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                Na sua Carteira
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f5b800] inline-block" />
                Catálogo B3 / Selecionado
              </span>
            </div>
            <span className="text-zinc-300 font-semibold tabular-nums">
              {filteredProperties.length} ativos
            </span>
          </div>
        </div>

        {/* Card de Inspeção do Imóvel Selecionado no Mapa */}
        {activeProperty ? (
          <div className="p-4 rounded-2xl bg-[#141416] border border-[#f5b800]/30 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-[#2b2512] text-[#f5b800] text-xs font-bold">
                    {activeProperty.ticker}
                  </span>
                  <span className="text-xs font-semibold text-zinc-300">
                    {activeProperty.type}
                  </span>
                  {portfolioTickers.has(activeProperty.ticker) && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Sócio na Carteira
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-white mt-1.5">
                  {activeProperty.propertyName}
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {activeProperty.address} — {activeProperty.city}/{activeProperty.state} (CEP{' '}
                  {activeProperty.cep})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2.5 rounded-xl bg-[#1c1c1e] border border-white/[0.04]">
                <span className="text-zinc-400 block text-[11px]">Inquilino / Operação</span>
                <span className="text-white font-semibold truncate block mt-0.5">
                  {activeProperty.mainTenant}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#1c1c1e] border border-white/[0.04]">
                <span className="text-zinc-400 block text-[11px]">Área Locável & Ocupação</span>
                <span className="text-emerald-400 font-semibold tabular-nums block mt-0.5">
                  {formatNumber(activeProperty.ablM2)} m² ({activeProperty.occupancyPercent}%)
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {activeProperty.highlight}
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleLookupCep(activeProperty.cep)}
                className="py-2 px-2.5 rounded-full bg-[#1c1c1e] text-zinc-200 text-[11px] font-semibold border border-white/[0.08] hover:border-[#f5b800]/50 active:scale-95 transition-all truncate"
              >
                Validar CEP
              </button>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${activeProperty.propertyName} ${activeProperty.city} ${activeProperty.state}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-2.5 rounded-full bg-[#2b2512] text-[#f5b800] text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <span>Satélite 3D</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenBuyModal?.(activeProperty.ticker);
                }}
                className="py-2 px-2.5 rounded-full bg-[#f5b800] text-zinc-950 text-[11px] font-bold active:scale-95 transition-all"
              >
                Aportar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-[#141416] text-center space-y-2">
            <p className="text-xs font-semibold text-zinc-300">
              Nenhum imóvel de tijolo encontrado neste filtro na sua carteira atual.
            </p>
            <button
              type="button"
              onClick={() => setScope('ALL_B3')}
              className="px-4 py-2 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold active:scale-95 transition-all"
            >
              Explorar Todos os Imóveis da B3
            </button>
          </div>
        )}
      </div>

      {/* CONEXÃO BRASILAPI CEP V2 AO VIVO */}
      <div className="bg-[#1c1c1e] rounded-[20px] p-4 border border-white/[0.04] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#f5b800]" />
              Consulta Geolocalizada de Imóvel por CEP (BrasilAPI v2)
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Digite o CEP de qualquer galpão, shopping ou torre corporativa para localizar no mapa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Ex: 04538-132 (Faria Lima) ou 05676-120"
            value={cepInput}
            onChange={(e) => setCepInput(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#141416] border border-white/[0.08] text-white text-base sm:text-xs focus:border-[#f5b800] outline-none tabular-nums"
          />
          <button
            type="button"
            disabled={isLoadingCep}
            onClick={() => handleLookupCep()}
            className="px-4 py-2.5 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold active:scale-95 transition-all disabled:opacity-50 shrink-0 flex items-center gap-1.5"
          >
            {isLoadingCep ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Buscando</span>
              </>
            ) : (
              <span>Localizar CEP</span>
            )}
          </button>
        </div>

        {cepError && (
          <p className="text-xs text-rose-400 font-medium">{cepError}</p>
        )}

        {cepResult && (
          <div className="p-3.5 rounded-2xl bg-[#141416] border border-emerald-500/30 space-y-1.5 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                CEP {cepResult.cep} Localizado ({cepResult.source})
              </span>
              <span className="text-[11px] text-zinc-400 tabular-nums">
                {cepResult.lat.toFixed(4)}, {cepResult.lng.toFixed(4)}
              </span>
            </div>
            <p className="text-white font-medium">
              {cepResult.street} — {cepResult.neighborhood}
            </p>
            <p className="text-zinc-400">
              {cepResult.city} / {cepResult.state}
            </p>
          </div>
        )}
      </div>

      {/* Distribuição Regional por Estado (UF) */}
      {stats.byState.length > 0 && (
        <div className="bg-[#1c1c1e] rounded-[20px] p-4 border border-white/[0.04] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#f5b800]" />
              Concentração Geográfica por Estado (UF)
            </h3>
            <span className="text-[11px] text-zinc-400">
              {formatNumber(stats.totalAbl)} m² totais
            </span>
          </div>

          <div className="space-y-2.5">
            {stats.byState.map((st) => (
              <div key={st.uf} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-semibold">
                    {st.uf} — { st.count } {st.count === 1 ? 'imóvel' : 'imóveis'}
                  </span>
                  <span className="text-zinc-400 tabular-nums">
                    {formatNumber(st.abl)} m² ({st.percent}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#141416] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#f5b800]"
                    style={{ width: `${Math.max(4, st.percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista Completa de Imóveis no Padrão XP Key-Value */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white px-1">
          Catálogo de Imóveis ({filteredProperties.length})
        </h3>

        {filteredProperties.map((prop) => {
          const Icon = getPropertyIcon(prop.type);
          const isSelected = activeProperty?.id === prop.id;
          const isOwned = portfolioTickers.has(prop.ticker);

          return (
            <div
              key={prop.id}
              onClick={() => {
                triggerHaptic('light');
                setSelectedPropertyId(prop.id);
              }}
              className={`bg-[#1c1c1e] rounded-[20px] p-4 border transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#f5b800]/60 shadow-[0_0_0_1px_rgba(245,184,0,0.2)]'
                  : 'border-white/[0.04] hover:border-white/[0.1]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {prop.ticker}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800] font-semibold">
                        {prop.city}/{prop.state}
                      </span>
                      {isOwned && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">
                          Na Carteira
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-zinc-200 truncate mt-0.5">
                      {prop.propertyName}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 mt-3 pt-3 border-t border-white/[0.05] text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Inquilino / Operador</span>
                  <span className="text-white font-medium truncate max-w-[60%] text-right">
                    {prop.mainTenant}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Área Bruta Locável (ABL)</span>
                  <span className="text-white font-medium tabular-nums">
                    {formatNumber(prop.ablM2)} m²
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Taxa de Ocupação</span>
                  <span className="text-emerald-400 font-semibold tabular-nums">
                    {prop.occupancyPercent}% ocupado
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

