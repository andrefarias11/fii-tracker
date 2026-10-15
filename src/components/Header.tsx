'use client';

import { useState } from 'react';
import {
  RefreshCw,
  SlidersHorizontal,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  Sparkles,
  User,
} from 'lucide-react';
import { APP_VERSION } from '../lib/version';
import { SavedAccountSession } from '../lib/authManager';

interface HeaderProps {
  title?: string;
  lastSyncTime: Date | null;
  isLoadingQuotes: boolean;
  isCloudConnected: boolean;
  isSyncingCloud: boolean;
  isPrivacyMode?: boolean;
  onTogglePrivacy?: () => void;
  onRefresh: () => void;
  onSyncCloud?: () => void;
  onOpenSettings: () => void;
  onOpenWrapped?: () => void;
  onOpenAccountSwitcher?: () => void;
  activeAccount?: SavedAccountSession | null;
}

export function Header({
  title = 'Carteira',
  lastSyncTime,
  isLoadingQuotes,
  isCloudConnected,
  isSyncingCloud,
  isPrivacyMode = false,
  onTogglePrivacy,
  onRefresh,
  onSyncCloud,
  onOpenSettings,
  onOpenWrapped,
  onOpenAccountSwitcher,
  activeAccount,
}: HeaderProps) {
  const [avatarError, setAvatarError] = useState(false);

  const getInitials = (nameOrEmail?: string) => {
    if (!nameOrEmail) return 'U';
    const clean = nameOrEmail.trim();
    const parts = clean.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  const formatTime = (date: Date | null) => {
    if (!date) return 'Offline';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0b0b0d]/95 backdrop-blur-2xl border-b border-white/[0.04] px-4 pb-3 pt-safe-header ios-sticky-fix">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Título da Aba Ativa Estilo XP */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-white tracking-tight">
              {title}
            </h1>
            <button
              type="button"
              onClick={onOpenSettings}
              title={`FII Tracker v${APP_VERSION}`}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#1c1c1e] text-zinc-400 hover:text-[#f5b800] transition-colors border border-white/[0.04]"
            >
              v{APP_VERSION}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 font-medium leading-tight mt-0.5">
            {isLoadingQuotes ? 'Atualizando B3...' : `B3 • ${formatTime(lastSyncTime)}`}
          </p>
        </div>

        {/* Botões Circulares XP: bg-[#1c1c1e] w-10 h-10 rounded-full text-zinc-200 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onOpenWrapped && (
            <button
              type="button"
              onClick={onOpenWrapped}
              title="Retrospectiva B3"
              aria-label="Retrospectiva B3"
              className="w-10 h-10 rounded-full bg-[#1c1c1e] text-zinc-200 hover:text-[#f5b800] flex items-center justify-center active:scale-95 transition-all border border-white/[0.04]"
            >
              <Sparkles className="w-4 h-4 text-[#f5b800]" />
            </button>
          )}

          {onTogglePrivacy && (
            <button
              type="button"
              onClick={onTogglePrivacy}
              aria-label={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
              title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
              className={`w-10 h-10 rounded-full bg-[#1c1c1e] flex items-center justify-center transition-all active:scale-95 border border-white/[0.04] ${
                isPrivacyMode
                  ? 'bg-[#2b2512] text-[#f5b800] border-[#f5b800]/30'
                  : 'text-zinc-200 hover:text-white'
              }`}
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={onSyncCloud || onOpenSettings}
            title={
              isCloudConnected
                ? isSyncingCloud
                  ? 'Sincronizando com a Nuvem...'
                  : 'Nuvem Conectada • Toque para Sincronizar'
                : 'Nuvem Offline • Toque para Configurar'
            }
            aria-label="Sincronizar Nuvem"
            className={`w-10 h-10 rounded-full bg-[#1c1c1e] flex items-center justify-center transition-all active:scale-95 border border-white/[0.04] ${
              isCloudConnected
                ? 'text-[#f5b800]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {isCloudConnected ? (
              <Cloud className={`w-4 h-4 ${isSyncingCloud ? 'animate-spin text-[#f5b800]' : ''}`} />
            ) : (
              <CloudOff className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoadingQuotes}
            aria-label="Atualizar Cotações"
            className="w-10 h-10 rounded-full bg-[#1c1c1e] hover:text-white text-zinc-200 flex items-center justify-center active:scale-95 transition-all border border-white/[0.04] disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingQuotes ? 'animate-spin text-[#f5b800]' : ''}`} />
          </button>

          {onOpenAccountSwitcher && (
            <button
              type="button"
              onClick={onOpenAccountSwitcher}
              title={
                activeAccount
                  ? `Conta ativa: ${activeAccount.displayName} (${activeAccount.email}) • Alternar`
                  : 'Alternar / Conectar Conta'
              }
              aria-label="Perfil e Contas"
              className="w-10 h-10 rounded-full bg-[#1c1c1e] text-zinc-200 hover:text-white flex items-center justify-center active:scale-95 transition-all border border-white/[0.04] shrink-0 overflow-hidden"
            >
              {activeAccount?.avatarUrl && !avatarError ? (
                <img
                  src={activeAccount.avatarUrl}
                  alt={activeAccount.displayName}
                  onError={() => setAvatarError(true)}
                  className="w-8 h-8 rounded-full object-cover border border-white/[0.1]"
                />
              ) : activeAccount ? (
                <span className="w-8 h-8 rounded-full bg-[#f5b800] text-zinc-950 font-bold flex items-center justify-center text-xs uppercase tracking-tighter shadow-sm">
                  {getInitials(activeAccount.displayName || activeAccount.email)}
                </span>
              ) : (
                <User className="w-4 h-4 text-zinc-300" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configurações"
            className="w-10 h-10 rounded-full bg-[#1c1c1e] hover:text-white text-zinc-200 flex items-center justify-center active:scale-95 transition-all border border-white/[0.04]"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
