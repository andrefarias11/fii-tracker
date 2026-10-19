'use client';

import Image from 'next/image';
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
import { Button } from './ui/Controls';

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
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const initials = (activeAccount?.displayName || activeAccount?.email || 'U')
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const syncLabel = isSyncingCloud
    ? 'Sincronizando'
    : isCloudConnected
      ? 'Nuvem conectada'
      : 'Conectar nuvem';

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/95 px-4 pb-2 pt-safe-header backdrop-blur-xl">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-wide text-zinc-500">
              FII TRACKER <span className="font-normal">· v{APP_VERSION}</span>
            </p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-white">
              {title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onTogglePrivacy && (
              <Button
                variant="icon"
                aria-label={
                  isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'
                }
                aria-pressed={isPrivacyMode}
                onClick={onTogglePrivacy}
              >
                {isPrivacyMode ? (
                  <EyeOff className="h-[18px] w-[18px]" />
                ) : (
                  <Eye className="h-[18px] w-[18px]" />
                )}
              </Button>
            )}
            {onOpenAccountSwitcher && (
              <Button
                variant="icon"
                onClick={onOpenAccountSwitcher}
                aria-label="Perfil e contas"
                title={
                  activeAccount
                    ? `Conta ativa: ${activeAccount.displayName}`
                    : 'Conectar conta'
                }
              >
                {activeAccount?.avatarUrl &&
                failedAvatarUrl !== activeAccount.avatarUrl ? (
                  <Image
                    width={32}
                    height={32}
                    unoptimized
                    src={activeAccount.avatarUrl}
                    alt=""
                    onError={() =>
                      setFailedAvatarUrl(activeAccount.avatarUrl ?? null)
                    }
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : activeAccount ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#1c1c1f] text-[11px] text-zinc-200">
                    {initials}
                  </span>
                ) : (
                  <User className="h-[18px] w-[18px]" />
                )}
              </Button>
            )}
            <Button
              variant="icon"
              onClick={onOpenSettings}
              aria-label="Configurações"
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-1 border-t border-white/[0.04] pt-1">
          <Button
            variant="ghost"
            onClick={onSyncCloud || onOpenSettings}
            disabled={isSyncingCloud}
            className="px-1 text-xs"
            aria-label={syncLabel}
          >
            {isCloudConnected ? (
              <Cloud className="h-3.5 w-3.5" />
            ) : (
              <CloudOff className="h-3.5 w-3.5" />
            )}
            <span>{syncLabel}</span>
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={onRefresh}
              disabled={isLoadingQuotes}
              className="px-2 text-xs"
              aria-label="Atualizar cotações"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingQuotes ? 'animate-spin' : ''}`}
              />
              <span>
                {isLoadingQuotes
                  ? 'Atualizando'
                  : lastSyncTime
                    ? lastSyncTime.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Atualizar'}
              </span>
            </Button>
            {onOpenWrapped && (
              <Button
                variant="icon"
                onClick={onOpenWrapped}
                aria-label="Retrospectiva B3"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
