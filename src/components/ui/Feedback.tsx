'use client';

import { useEffect, type ReactNode } from 'react';
import { Check, Info, Loader2, X } from 'lucide-react';
import { Button } from './Controls';

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      {icon && (
        <span className="ui-empty__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h3 className="ui-title">{title}</h3>
      <p className="ui-caption max-w-xs">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SectionSkeleton({
  label = 'Carregando conteúdo',
  chart = false,
}: {
  label?: string;
  chart?: boolean;
}) {
  return (
    <div role="status" aria-busy="true" className="ui-skeleton-section">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-5">
        <div className="ui-skeleton h-3 w-28" />
        <div className="ui-skeleton h-8 w-44" />
        {chart ? (
          <div className="ui-skeleton h-60 w-full rounded-2xl" />
        ) : (
          [0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center gap-3 border-t border-white/[0.06] pt-4"
            >
              <div className="ui-skeleton h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="ui-skeleton h-3 w-24" />
                <div className="ui-skeleton h-2 w-36" />
              </div>
              <div className="ui-skeleton h-4 w-16" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function PortfolioSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="app-shell min-h-dvh px-4 pt-safe-header"
    >
      <span className="sr-only">Carregando sua carteira</span>
      <div aria-hidden="true" className="mx-auto max-w-5xl space-y-6 pt-3">
        <div className="space-y-3 border-b border-white/[0.06] pb-3">
          <div className="flex items-center justify-between">
            <div className="ui-skeleton h-6 w-28" />
            <div className="flex gap-2">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="ui-skeleton h-11 w-11 rounded-full"
                />
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <div className="ui-skeleton h-4 w-28" />
            <div className="ui-skeleton h-4 w-24" />
          </div>
        </div>
        <div className="space-y-4 py-3">
          <div className="ui-skeleton h-3 w-32" />
          <div className="ui-skeleton h-10 w-56" />
          <div className="ui-skeleton h-3 w-40" />
          <div className="space-y-3 border-y border-white/[0.06] py-4">
            <div className="ui-skeleton h-3 w-36" />
            <div className="ui-skeleton h-7 w-28" />
          </div>
        </div>
        <div className="ui-skeleton h-12 rounded-xl" />
        <SectionSkeleton />
      </div>
    </div>
  );
}

export interface Notice {
  id: number;
  message: string;
  tone?: 'success' | 'info' | 'error';
  busy?: boolean;
}

export function FeedbackToast({
  notice,
  onClose,
}: {
  notice: Notice | null;
  onClose: () => void;
}) {
  const id = notice?.id;
  const message = notice?.message;
  const busy = notice?.busy;
  useEffect(() => {
    if (id === undefined || busy) return;
    const timer = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(timer);
  }, [id, message, busy, onClose]);

  if (!notice) return null;
  const Icon = notice.busy ? Loader2 : notice.tone === 'success' ? Check : Info;
  return (
    <div className="ui-toast" data-tone={notice.tone ?? 'info'}>
      <Icon
        aria-hidden="true"
        className={`h-4 w-4 shrink-0 ${notice.busy ? 'animate-spin' : ''}`}
      />
      <p
        role={notice.tone === 'error' ? 'alert' : 'status'}
        aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
        className="flex-1 text-xs leading-relaxed"
      >
        {notice.message}
      </p>
      <Button variant="icon" aria-label="Fechar aviso" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
