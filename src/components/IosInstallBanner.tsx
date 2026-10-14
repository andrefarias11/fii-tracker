'use client';

import { useState } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

export function IosInstallBanner() {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in window.navigator &&
          (window.navigator as unknown as { standalone: boolean }).standalone);
      const dismissedInStorage = localStorage.getItem('fii_pwa_banner_dismissed');
      return Boolean(isStandalone || dismissedInStorage);
    } catch {
      return true;
    }
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('fii_pwa_banner_dismissed', 'true');
  };

  if (isDismissed) return null;

  return (
    <div className="relative rounded-[24px] bg-[#121215] border border-white/[0.06] p-5 mb-4">
      <button
        onClick={handleDismiss}
        aria-label="Dispensar banner"
        className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3.5 pr-6">
        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300 shrink-0">
          <Share className="w-4 h-4 text-emerald-400" />
        </div>

        <div>
          <h4 className="text-xs font-bold text-white mb-1">
            Instalar app no iPhone
          </h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed mb-2.5">
            Para usar em tela cheia como um app nativo, toque no botão{' '}
            <strong className="text-zinc-200">Compartilhar</strong> no Safari e selecione:{' '}
            <span className="inline-flex items-center gap-1 font-semibold text-zinc-200 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-md">
              <PlusSquare className="w-3 h-3 text-emerald-400" />
              Adicionar à Tela de Início
            </span>
          </p>

          <button
            onClick={handleDismiss}
            className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Entendido, já sei como fazer
          </button>
        </div>
      </div>
    </div>
  );
}

