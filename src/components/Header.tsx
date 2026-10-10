'use client';

import { RefreshCw, SlidersHorizontal, TrendingUp, Cloud, CloudOff, Eye, EyeOff } from 'lucide-react';

interface HeaderProps {
  lastSyncTime: Date | null;
  isLoadingQuotes: boolean;
  isCloudConnected: boolean;
  isSyncingCloud: boolean;
  isPrivacyMode?: boolean;
  onTogglePrivacy?: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export function Header({
  lastSyncTime,
  isLoadingQuotes,
  isCloudConnected,
  isSyncingCloud,
  isPrivacyMode = false,
  onTogglePrivacy,
  onRefresh,
  onOpenSettings,
}: HeaderProps) {
  const formatTime = (date: Date | null) => {
    if (!date) return 'Não sincronizado';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 pb-3 pt-safe-header ios-sticky-fix">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <TrendingUp className="w-5 h-5 text-zinc-950 font-bold" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              FII Tracker
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                B3 • XP
              </span>
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span>{isLoadingQuotes ? 'Atualizando cotações...' : `Cotações: ${formatTime(lastSyncTime)}`}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Modo Privacidade (Ocultar Valores) */}
          {onTogglePrivacy && (
            <button
              onClick={onTogglePrivacy}
              aria-label={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
              title={isPrivacyMode ? 'Mostrar valores' : 'Modo Privacidade (Ocultar valores)'}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${
                isPrivacyMode
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {/* Indicador de Nuvem */}
          <button
            onClick={onOpenSettings}
            title={isCloudConnected ? 'Supabase Conectado' : 'Modo Offline - Toque para conectar Supabase'}
            className={`p-2 rounded-xl border flex items-center gap-1 transition-all active:scale-95 ${
              isCloudConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {isCloudConnected ? (
              <Cloud className={`w-4 h-4 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
            ) : (
              <CloudOff className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoadingQuotes}
            aria-label="Atualizar Cotações"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingQuotes ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={onOpenSettings}
            aria-label="Configurações e Metas"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white active:scale-95 transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
