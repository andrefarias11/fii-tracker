'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Building2, MapPin, Search, ArrowUpRight, ChevronRight, X, Loader2, LocateFixed } from 'lucide-react';
import { FiiPosition } from '../types/portfolio';
import { FII_PROPERTIES_CATALOG, STATE_COORDINATES, FiiRealEstateProperty } from '../data/fiiProperties';
import { BRAZIL_OUTLINE } from '../data/brazilMap';
import type { CepLookupResponse } from '../app/api/cep/route';
import { triggerHaptic } from '../lib/haptic';
import { Chip, SegmentedControl } from './ui/Controls';

interface RealEstateMapProps {
  positions: FiiPosition[];
  initialTickerFilter?: string | null;
  onClearTickerFilter?: () => void;
  onOpenBuyModal?: (ticker: string) => void;
}

type ScopeFilter = 'MY_PORTFOLIO' | 'ALL_B3';
type PropertyTypeFilter = 'ALL' | FiiRealEstateProperty['type'];

function projectLatLngToSvg(lat: number, lng: number) {
  return {
    x: ((Math.max(-74, Math.min(-34, lng)) + 74) / 40) * 340 + 30,
    y: ((5.5 - Math.max(-34, Math.min(5.5, lat))) / 39.5) * 340 + 25,
  };
}

// Leader lines preserve the geographic anchor while separating dense Southeast labels.
const STATE_LABEL_OFFSETS: Record<string, [number, number]> = {
  SP: [-15, 15], RJ: [28, 5], MG: [3, -15], ES: [28, -9],
  PR: [-22, 6], SC: [20, 13], RS: [-5, 12], DF: [20, -14], GO: [-15, 8],
};

const sectors: { id: PropertyTypeFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' }, { id: 'Logística', label: 'Logística' },
  { id: 'Shopping', label: 'Shoppings' }, { id: 'Renda Urbana', label: 'Renda urbana' },
  { id: 'Laje Corporativa', label: 'Escritórios' }, { id: 'Agro / Terra', label: 'Terras' },
];

export function RealEstateMap({ positions, initialTickerFilter = null, onClearTickerFilter, onOpenBuyModal }: RealEstateMapProps) {
  const gradientId = useId();
  const detailRef = useRef<HTMLElement>(null);
  const portfolioTickers = useMemo(() => new Set(positions.map((position) => position.ticker.toUpperCase())), [positions]);
  const hasPortfolioProperties = FII_PROPERTIES_CATALOG.some((property) => portfolioTickers.has(property.ticker));
  const [scope, setScope] = useState<ScopeFilter>(() => initialTickerFilter || !hasPortfolioProperties ? 'ALL_B3' : 'MY_PORTFOLIO');
  const [typeFilter, setTypeFilter] = useState<PropertyTypeFilter>('ALL');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cepInput, setCepInput] = useState('');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepResult, setCepResult] = useState<CepLookupResponse | null>(null);
  const [cepError, setCepError] = useState<string | null>(null);

  const filteredProperties = FII_PROPERTIES_CATALOG.filter((property) => {
    if (initialTickerFilter && property.ticker !== initialTickerFilter.toUpperCase()) return false;
    if (!initialTickerFilter && scope === 'MY_PORTFOLIO' && !portfolioTickers.has(property.ticker)) return false;
    if (typeFilter !== 'ALL' && property.type !== typeFilter) return false;
    const searchable = `${property.ticker} ${property.propertyName} ${property.city} ${property.state}`;
    return searchable.toLocaleLowerCase('pt-BR').includes(searchQuery.trim().toLocaleLowerCase('pt-BR'));
  });

  const totalAbl = filteredProperties.reduce((sum, property) => sum + property.ablM2, 0);
  const tickersCount = new Set(filteredProperties.map((property) => property.ticker)).size;
  const avgOccupancy = filteredProperties.length ? filteredProperties.reduce((sum, property) => sum + property.occupancyPercent, 0) / filteredProperties.length : 0;
  const states = [...new Set(filteredProperties.map((property) => property.state))].map((uf) => {
    const properties = filteredProperties.filter((property) => property.state === uf);
    const centroid = STATE_COORDINATES[uf] ?? {
      lat: properties.reduce((sum, property) => sum + property.lat, 0) / properties.length,
      lng: properties.reduce((sum, property) => sum + property.lng, 0) / properties.length,
      name: uf,
    };
    return { uf, properties, centroid, percent: Math.round(properties.length / filteredProperties.length * 100) };
  }).sort((a, b) => b.properties.length - a.properties.length);
  const focusedState = states.some((state) => state.uf === selectedState) ? selectedState : null;
  const visibleProperties = focusedState ? filteredProperties.filter((property) => property.state === focusedState) : filteredProperties;
  const activeProperty = visibleProperties.find((property) => property.id === selectedPropertyId) ?? visibleProperties[0] ?? null;
  const formatNumber = (value: number) => value.toLocaleString('pt-BR');

  const selectState = (uf: string | null) => {
    triggerHaptic('selection');
    setSelectedState(uf);
    setSelectedPropertyId(null);
  };

  const handleLookupCep = async (rawCepToQuery?: string) => {
    const targetCep = (rawCepToQuery ?? cepInput).replace(/\D/g, '');
    if (targetCep.length !== 8) { setCepError('Digite um CEP com 8 dígitos.'); return; }
    triggerHaptic('light');
    setIsLoadingCep(true);
    setCepError(null);
    try {
      const response = await fetch(`/api/cep?cep=${targetCep}`);
      const data = await response.json();
      if (!response.ok) { setCepError(data.error || 'CEP não encontrado.'); setCepResult(null); }
      else { setCepResult(data as CepLookupResponse); setCepInput(data.cep); }
    } catch { setCepError('Não foi possível consultar o CEP. Tente novamente.'); }
    finally { setIsLoadingCep(false); }
  };

  return (
    <div className="space-y-5">
      <header className="px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Portfólio imobiliário</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Patrimônio no mapa</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">Conheça os imóveis por trás dos seus fundos.</p>
        {initialTickerFilter && <button type="button" onClick={onClearTickerFilter} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-[#121215] px-3 text-xs text-white">{initialTickerFilter}<X className="h-3.5 w-3.5" /><span className="sr-only">Limpar filtro do fundo</span></button>}
      </header>

      {!initialTickerFilter && <SegmentedControl label="Escopo dos imóveis" value={scope} onChange={(value) => { setScope(value); selectState(null); }} options={[{ value: 'MY_PORTFOLIO', label: 'Minha carteira' }, { value: 'ALL_B3', label: 'Explorar catálogo' }]} />}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Setor imobiliário">
        {sectors.map((sector) => <Chip key={sector.id} selected={typeFilter === sector.id} onClick={() => { setTypeFilter(sector.id); selectState(null); }}>{sector.label}</Chip>)}
      </div>

      <section className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#121215]">
        <div className="flex items-center justify-between gap-2 px-5 pt-5">
          <div><h3 className="text-sm font-semibold text-white">Presença no Brasil</h3><p className="mt-1 text-[11px] text-zinc-500">Selecione um estado para explorar</p></div>
          <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-zinc-400">Visão nacional</span>
        </div>
        <div className="relative mt-2 bg-[radial-gradient(ellipse_at_55%_55%,rgba(70,78,94,0.16),transparent_70%)]">
          <svg viewBox="0 0 400 410" className="block w-full" role="group" aria-label="Imóveis do catálogo agrupados por estado">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#242932" /><stop offset="100%" stopColor="#171A20" /></linearGradient></defs>
            {[90, 170, 250, 330].map((coordinate) => <g key={coordinate} aria-hidden="true"><line x1={coordinate} x2={coordinate} y1="25" y2="375" stroke="white" strokeOpacity="0.025" /><line x1="30" x2="370" y1={coordinate} y2={coordinate} stroke="white" strokeOpacity="0.025" /></g>)}
            <path d={BRAZIL_OUTLINE} fill={`url(#${gradientId})`} fillRule="evenodd" stroke="#505663" strokeOpacity="0.55" strokeWidth="0.8" />
            <text x="44" y="326" fill="#444954" fontSize="9" letterSpacing="2">BRASIL</text>
            <text x="305" y="210" fill="#333943" fontSize="8" letterSpacing="1.5" transform="rotate(-60 305 210)">ATLÂNTICO</text>
            {states.map((state) => {
              const anchor = projectLatLngToSvg(state.centroid.lat, state.centroid.lng);
              const offset = STATE_LABEL_OFFSETS[state.uf] ?? [0, 0];
              const x = anchor.x + offset[0];
              const y = anchor.y + offset[1];
              const selected = focusedState === state.uf;
              const owned = state.properties.some((property) => portfolioTickers.has(property.ticker));
              return <g key={state.uf} role="button" tabIndex={0} aria-label={`${state.centroid.name}: ${state.properties.length} imóveis. Selecionar estado.`} aria-pressed={selected} onClick={() => selectState(selected ? null : state.uf)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectState(selected ? null : state.uf); } }} className="cursor-pointer outline-none focus-visible:[&>circle:last-of-type]:stroke-white">
                <circle cx={x} cy={y} r="27" fill="transparent" />
                <path d={`M${anchor.x},${anchor.y} L${x},${y}`} stroke={selected ? '#F5B800' : '#69717E'} strokeWidth="0.8" strokeOpacity="0.6" pointerEvents="none" />
                <circle cx={anchor.x} cy={anchor.y} r="2" fill="#69717E" pointerEvents="none" />
                {selected && <circle cx={x} cy={y} r="21" fill="#F5B800" fillOpacity="0.08" stroke="#F5B800" strokeOpacity="0.25" pointerEvents="none" />}
                <circle cx={x} cy={y} r="14" fill={selected ? '#F5B800' : '#242932'} stroke={selected ? '#F5B800' : owned ? '#6A9B87' : '#606875'} strokeWidth="1.2" pointerEvents="none" />
                <text x={x} y={y + 3.5} fill={selected ? '#121215' : '#E4E4E7'} fontSize="10" fontWeight="600" textAnchor="middle" pointerEvents="none">{state.properties.length}</text>
                <text x={x} y={y + 27} fill={selected ? '#F5B800' : '#9299A4'} fontSize="9" fontWeight="500" textAnchor="middle" pointerEvents="none">{state.uf}</text>
              </g>;
            })}
            {cepResult && (() => { const point = projectLatLngToSvg(cepResult.lat, cepResult.lng); return <g aria-label={`CEP localizado: ${cepResult.cep}`} pointerEvents="none"><circle cx={point.x} cy={point.y} r="10" fill="#93C5FD" fillOpacity="0.12" /><circle cx={point.x} cy={point.y} r="4" fill="#93C5FD" stroke="#121215" strokeWidth="2" /></g>; })()}
          </svg>
          {filteredProperties.length === 0 && <div className="absolute inset-x-5 top-1/3 rounded-2xl border border-white/10 bg-[#121215]/95 p-5 text-center"><MapPin className="mx-auto h-5 w-5 text-zinc-500" /><p className="mt-2 text-sm text-zinc-300">Nenhum imóvel neste filtro</p><p className="mt-1 text-xs text-zinc-500">Tente outro setor ou explore o catálogo.</p></div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-4 text-[10px] text-zinc-500"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#6A9B87]" />Fundos da sua carteira</span><span>Números = imóveis por estado</span></div>
        <div className="grid grid-cols-3 border-t border-white/[0.06] bg-black/10 px-5 py-4">
          {[[filteredProperties.length, 'Imóveis'], [tickersCount, 'Fundos'], [states.length, 'Estados']].map(([value, label]) => <div key={label} className="border-r border-white/[0.06] pl-4 first:pl-0 last:border-0"><p className="text-xl font-semibold tracking-tight text-white tabular-nums">{value}</p><p className="mt-0.5 text-[10px] text-zinc-500">{label}</p></div>)}
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Filtrar imóveis por estado">
        <Chip onClick={() => selectState(null)} selected={!focusedState}>Brasil</Chip>
        {states.map((state) => <Chip key={state.uf} onClick={() => selectState(state.uf)} selected={focusedState === state.uf} className="tabular-nums">{state.uf} · {state.properties.length}</Chip>)}
      </div>

      {activeProperty && <section ref={detailRef} className="scroll-mt-24 rounded-[24px] border border-white/[0.08] bg-[#121215] p-5" aria-label="Imóvel selecionado">
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold tracking-wide text-[#F5B800]">{activeProperty.ticker}</span><span className="text-[10px] text-zinc-500">{activeProperty.type}</span></div>
        <h3 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-white">{activeProperty.propertyName}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400"><MapPin className="h-3.5 w-3.5 shrink-0" />{activeProperty.city}, {activeProperty.state}{portfolioTickers.has(activeProperty.ticker) && <span className="ml-auto text-[10px] text-[#8FB7A5]">Na carteira</span>}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4"><div><dt className="text-[10px] text-zinc-500">Área locável</dt><dd className="mt-1 text-lg font-semibold text-white tabular-nums">{formatNumber(activeProperty.ablM2)} <span className="text-xs font-normal text-zinc-500">m²</span></dd></div><div><dt className="text-[10px] text-zinc-500">Ocupação</dt><dd className="mt-1 text-lg font-semibold text-white tabular-nums">{activeProperty.occupancyPercent}<span className="text-xs font-normal text-zinc-500">%</span></dd></div></dl>
        <details className="mt-4 border-t border-white/[0.06]"><summary className="cursor-pointer py-3 text-xs font-medium text-zinc-300">Detalhes do imóvel</summary><div className="space-y-3 pb-2 text-xs leading-relaxed text-zinc-400"><p>{activeProperty.highlight}</p><p><span className="text-zinc-500">Operação · </span>{activeProperty.mainTenant}</p><p>{activeProperty.address}<br />CEP {activeProperty.cep}</p><button type="button" disabled={isLoadingCep} onClick={() => handleLookupCep(activeProperty.cep)} className="min-h-11 text-[#F5B800] disabled:opacity-50">{isLoadingCep ? 'Consultando…' : 'Consultar endereço por CEP'}</button></div></details>
        <div className={`mt-2 grid gap-2 ${onOpenBuyModal ? 'grid-cols-2' : 'grid-cols-1'}`}><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activeProperty.propertyName} ${activeProperty.city} ${activeProperty.state}`)}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-xs font-medium text-zinc-300">Abrir no Maps<ArrowUpRight className="h-3.5 w-3.5" /></a>{onOpenBuyModal && <button type="button" onClick={() => { triggerHaptic('light'); onOpenBuyModal(activeProperty.ticker); }} className="min-h-11 rounded-xl bg-[#F5B800] text-xs font-semibold text-black">Aportar em {activeProperty.ticker}</button>}</div>
      </section>}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1"><h3 className="text-sm font-semibold text-white">{focusedState ? `Imóveis em ${focusedState}` : 'Explorar imóveis'}</h3><span className="text-[11px] text-zinc-500 tabular-nums">{visibleProperties.length} imóveis</span></div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.06] bg-[#121215] px-3"><Search className="h-4 w-4 shrink-0 text-zinc-500" /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Fundo, imóvel ou cidade" aria-label="Buscar no catálogo de imóveis" className="min-w-0 flex-1 bg-transparent py-3 text-base text-white outline-none placeholder:text-zinc-600 sm:text-sm" /></label>
        <div className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#121215] divide-y divide-white/[0.06]">
          {visibleProperties.map((property) => <button key={property.id} type="button" aria-pressed={activeProperty?.id === property.id} onClick={() => { triggerHaptic('selection'); setSelectedPropertyId(property.id); detailRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }} className={`flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition-colors ${activeProperty?.id === property.id ? 'bg-white/[0.045]' : 'hover:bg-white/[0.025]'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${activeProperty?.id === property.id ? 'border-[#F5B800]/20 text-[#F5B800]' : 'border-white/[0.06] text-zinc-500'}`}><Building2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-xs font-semibold text-white">{property.ticker}<span className="truncate text-[10px] font-normal text-zinc-500">{property.city} / {property.state}</span></span><span className="mt-1 block truncate text-xs text-zinc-400">{property.propertyName}</span></span><ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" /></button>)}
          {visibleProperties.length === 0 && <p className="p-5 text-center text-xs text-zinc-500">Nenhum imóvel encontrado.</p>}
        </div>
      </section>

      <details className="rounded-[20px] border border-white/[0.06] bg-[#121215] px-4"><summary className="cursor-pointer py-4 text-xs font-medium text-zinc-300">Distribuição e área locável</summary><div className="space-y-4 pb-4"><div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-400"><span className="tabular-nums">{formatNumber(totalAbl)} m² no catálogo filtrado</span><span className="tabular-nums">{avgOccupancy.toFixed(1)}% de ocupação média</span></div>{states.map((state) => <div key={state.uf}><div className="mb-1.5 flex justify-between text-[11px]"><span className="text-zinc-300">{state.centroid.name}</span><span className="text-zinc-500 tabular-nums">{state.properties.length} imóveis · {state.percent}%</span></div><div className="h-1 overflow-hidden rounded-full bg-white/[0.04]"><div className="h-full rounded-full bg-zinc-500" style={{ width: `${state.percent}%` }} /></div></div>)}</div></details>

      <details className="rounded-[20px] border border-white/[0.06] bg-[#121215] px-4"><summary className="cursor-pointer py-4 text-xs font-medium text-zinc-300">Localizar endereço por CEP</summary><form className="space-y-3 pb-4" onSubmit={(event) => { event.preventDefault(); void handleLookupCep(); }}><label htmlFor={`${gradientId}-cep`} className="block text-[11px] text-zinc-500">Consulte um endereço e veja sua posição no mapa.</label><div className="flex gap-2"><input id={`${gradientId}-cep`} inputMode="numeric" autoComplete="postal-code" value={cepInput} onChange={(event) => setCepInput(event.target.value)} placeholder="00000-000" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#1c1c1f] px-3 text-base text-white tabular-nums outline-none focus:border-white/25" /><button type="submit" disabled={isLoadingCep} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-zinc-200 disabled:opacity-50">{isLoadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}Buscar</button></div></form></details>
      {cepError && <p role="alert" className="px-1 text-xs text-rose-300">{cepError}</p>}
      {cepResult && <div role="status" className="rounded-2xl border border-sky-300/15 bg-[#121215] p-4 text-xs"><p className="font-medium text-sky-200">CEP {cepResult.cep}</p><p className="mt-1 text-zinc-300">{cepResult.street} · {cepResult.city}/{cepResult.state}</p><p className="mt-2 text-[10px] text-zinc-500">Fonte: {cepResult.source} · {cepResult.lat.toFixed(4)}, {cepResult.lng.toFixed(4)}</p></div>}
      <p className="px-1 text-[10px] leading-relaxed text-zinc-600">Imóveis e indicadores do catálogo de referência. Contorno geográfico: IBGE. A quantidade de imóveis representa a cobertura do catálogo, não a totalidade dos portfólios dos fundos.</p>
    </div>
  );
}
