'use client';

import { RefreshCw, SlidersHorizontal, Cloud, CloudOff, Eye, EyeOff } from 'lucide-react';
import { APP_VERSION } from '../lib/version';

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
    if (!date) return 'Offline';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-2xl border-b border-white/[0.05] px-4 pb-3 pt-safe-header ios-sticky-fix">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Identidade Minimalista estilo Apple / Nubank */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-[15px] font-bold tracking-tight text-white">
                FII Tracker
              </h1>
              <button
                type="button"
                onClick={onOpenSettings}
                title="Ver versão e novidades"
                className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-white/[0.06] text-zinc-400 hover:text-white transition-colors"
              >
                v{APP_VERSION}
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 font-medium leading-tight">
              {isLoadingQuotes ? 'Atualizando B3...' : `B3 • ${formatTime(lastSyncTime)}`}
            </p>
          </div>
        </div>

        {/* Botões Circulares Minimalistas estilo Nubank */}
        <div className="flex items-center gap-1.5">
          {onTogglePrivacy && (
            <button
              onClick={onTogglePrivacy}
              aria-label={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
              title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isPrivacyMode
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] hover:text-white'
              }`}
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={onOpenSettings}
            title={isCloudConnected ? 'Nuvem Sincronizada' : 'Nuvem Offline'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              isCloudConnected
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1] hover:text-white'
            }`}
          >
            {isCloudConnected ? (
              <Cloud className={`w-4 h-4 ${isSyncingCloud ? 'animate-pulse' : ''}`} />
            ) : (
              <CloudOff className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoadingQuotes}
            aria-label="Atualizar Cotações"
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingQuotes ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={onOpenSettings}
            aria-label="Configurações"
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white flex items-center justify-center active:scale-95 transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
