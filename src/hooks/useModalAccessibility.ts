'use client';
import { useEffect, useRef } from 'react';
const dialogs: HTMLElement[] = [];
let previousOverflow = '';
export function useModalAccessibility(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const root = ref.current;
    if (!open || !root) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialogs.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    dialogs.push(root);
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', root.querySelector('h2,h3')?.textContent || 'Janela de opções');
    root.tabIndex = -1;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]')).filter(el => el.getClientRects().length > 0);
    (focusable()[0] || root).focus();
    const onKey = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== root) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key === 'Tab') {
        const items = focusable();
        if (!items.length) { event.preventDefault(); root.focus(); return; }
        if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === root)) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      dialogs.splice(dialogs.indexOf(root), 1);
      if (!dialogs.length) document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
