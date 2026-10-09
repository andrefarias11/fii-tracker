'use client';

import { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

export function IosInstallBanner() {
  const [isDismissed, setIsDismissed] = useState<boolean>(true);

  useEffect(() => {
    // Verificar se já está rodando standalone (PWA instalado)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone);

    const dismissedInStorage = localStorage.getItem('fii_pwa_banner_dismissed');

    if (!isStandalone && !dismissedInStorage) {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('fii_pwa_banner_dismissed', 'true');
  };

  if (isDismissed) return null;

  return (
    <div className="relative rounded-3xl bg-gradient-to-r from-emerald-950/70 via-zinc-900 to-zinc-900 border border-emerald-500/30 p-4 shadow-xl mb-4">
      <button
        onClick={handleDismiss}
        aria-label="Dispensar banner"
        className="absolute top-3 right-3 text-zinc-400 hover:text-white p-1"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <Share className="w-4 h-4 text-emerald-400" />
        </div>

        <div>
          <h4 className="text-xs font-bold text-white mb-1">
            Instalar app no iPhone
          </h4>
          <p className="text-[11px] text-zinc-300 leading-relaxed mb-2">
            Para usar em tela cheia como um app nativo, toque no botão{' '}
            <strong className="text-emerald-300">Compartilhar</strong> (abaixo no Safari) e selecione:{' '}
            <span className="inline-flex items-center gap-1 font-semibold text-white bg-zinc-800 px-1.5 py-0.5 rounded">
              <PlusSquare className="w-3 h-3 text-emerald-400" />
              Adicionar à Tela de Início
            </span>
          </p>

          <button
            onClick={handleDismiss}
            className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Entendido, já sei como fazer!
          </button>
        </div>
      </div>
    </div>
  );
}

