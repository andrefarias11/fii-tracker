'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Check,
  Trash2,
  ArrowLeft,
  LogOut,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  User,
} from 'lucide-react';
import {
  SavedAccountSession,
  getSavedAccounts,
  getActiveAccount,
  switchAccount,
  removeAccountFromVault,
  signOutCurrentAccount,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  subscribeAuthAccounts,
} from '../lib/authManager';
import { triggerHaptic } from '../lib/haptic';

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountChanged?: () => void;
}

function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function getInitials(nameOrEmail?: string): string {
  if (!nameOrEmail) return 'U';
  const clean = nameOrEmail.trim();
  const parts = clean.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function AccountAvatar({
  account,
  size = 'md',
}: {
  account: SavedAccountSession;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClasses =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-12 h-12 text-base'
      : 'w-10 h-10 text-sm';

  const initials = getInitials(account.displayName || account.email);

  if (account.avatarUrl && !imageFailed) {
    return (
      <img
        src={account.avatarUrl}
        alt={account.displayName}
        onError={() => setImageFailed(true)}
        className={`${sizeClasses} rounded-full object-cover border border-white/[0.08] shadow-sm shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-[#f5b800] text-zinc-950 font-bold flex items-center justify-center shadow-sm shrink-0 uppercase tracking-tighter`}
    >
      {initials}
    </div>
  );
}

export function AccountSwitcherModal({
  isOpen,
  onClose,
  onAccountChanged,
}: AccountSwitcherModalProps) {
  const [accounts, setAccounts] = useState<SavedAccountSession[]>([]);
  const [activeAccount, setActiveAccount] = useState<SavedAccountSession | null>(null);
  const [view, setView] = useState<'list' | 'add'>('list');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setAccounts(getSavedAccounts());
    setActiveAccount(getActiveAccount());

    const unsubscribe = subscribeAuthAccounts((accs, act) => {
      setAccounts(accs);
      setActiveAccount(act);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen) {
      const current = getSavedAccounts();
      setAccounts(current);
      setActiveAccount(getActiveAccount());
      setView(current.length === 0 ? 'add' : 'list');
      setErrorMessage(null);
      setEmail('');
      setPassword('');
      setIsLoadingGoogle(false);
      setIsLoadingEmail(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitch = async (userId: string) => {
    if (activeAccount?.id === userId) return;
    triggerHaptic('medium');
    await switchAccount(userId);
    onAccountChanged?.();
    onClose();
  };

  const handleRemove = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    triggerHaptic('light');
    removeAccountFromVault(userId);
    onAccountChanged?.();
  };

  const handleSignOut = async () => {
    triggerHaptic('medium');
    await signOutCurrentAccount();
    onAccountChanged?.();
    onClose();
  };

  const handleGoogleSignIn = async () => {
    triggerHaptic('light');
    setIsLoadingGoogle(true);
    setErrorMessage(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMessage(error.message || 'Erro ao conectar com o Google');
        setIsLoadingGoogle(false);
      }
      // O redirect OAuth levará ao Google e retornará à aplicação
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro inesperado no login Google');
      setIsLoadingGoogle(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Preencha e-mail e senha.');
      return;
    }

    triggerHaptic('light');
    setIsLoadingEmail(true);
    setErrorMessage(null);

    try {
      if (isSignUp) {
        const { error } = await signUpWithEmail(email, password);
        if (error) throw error;
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
      }

      onAccountChanged?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao autenticar com e-mail.');
    } finally {
      setIsLoadingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#1c1c1e] border-t sm:border border-white/[0.08] rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col max-h-[88dvh] overflow-hidden pb-safe-modal">
        {/* Top Handle visual para iOS */}
        <div className="w-full flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            {view === 'add' && accounts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setView('list');
                  setErrorMessage(null);
                }}
                className="w-8 h-8 rounded-full bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition-all mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {view === 'list' ? 'Alternar Conta' : 'Adicionar Conta'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {view === 'list'
                  ? 'Contas conectadas neste aparelho'
                  : 'Conecte sua conta para sincronizar a carteira'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/[0.04] text-zinc-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo Dinâmico */}
        <div className="p-5 overflow-y-auto space-y-4">
          {view === 'list' ? (
            <>
              {/* Lista de Contas Estilo Instagram */}
              <div className="space-y-2">
                {accounts.map((acc) => {
                  const isActive = activeAccount?.id === acc.id;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => handleSwitch(acc.id)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#2b2512] border-[#f5b800]/40 shadow-sm'
                          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AccountAvatar account={acc} size="md" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white text-sm truncate">
                              {acc.displayName}
                            </span>
                            {acc.provider === 'google' && (
                              <span className="shrink-0" title="Conta Google">
                                <GoogleIcon className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 truncate">{acc.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isActive ? (
                          <div className="w-7 h-7 rounded-full bg-[#f5b800] text-zinc-950 flex items-center justify-center shadow">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleRemove(e, acc.id)}
                            title="Desconectar do aparelho"
                            className="w-8 h-8 rounded-full text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botão Adicionar Outra Conta */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setView('add');
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-[#f5b800] font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar outra conta</span>
              </button>

              {/* Sair da Conta Atual */}
              {activeAccount && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5 py-1 px-3"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair da conta atual</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Tela Adicionar Conta: 1. DESTAQUE NO TOPO CONTINUAR COM O GOOGLE */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoadingGoogle}
                className="w-full bg-white text-zinc-950 hover:bg-zinc-100 font-bold rounded-full py-3.5 px-4 flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg disabled:opacity-50 text-sm"
              >
                {isLoadingGoogle ? (
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-950" />
                ) : (
                  <GoogleIcon className="w-5 h-5" />
                )}
                <span>
                  {isLoadingGoogle ? 'Conectando ao Google...' : 'Continuar com o Google'}
                </span>
              </button>

              {/* Divisor "ou use seu e-mail" */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.08]" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-[#1c1c1e] px-3 text-zinc-400 font-medium">
                    ou use seu e-mail
                  </span>
                </div>
              </div>

              {/* Formulário Tradicional de E-mail */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-zinc-400 font-medium mb-1">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-3.5 py-2.5 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#f5b800]/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 font-medium mb-1">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-3.5 py-2.5 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#f5b800]/50 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoadingEmail}
                  className="w-full bg-[#f5b800] text-zinc-950 font-bold rounded-full py-3 px-4 flex items-center justify-center gap-2 hover:bg-[#e5ac00] transition-all active:scale-[0.98] disabled:opacity-50 text-sm mt-4 shadow-md shadow-[#f5b800]/10"
                >
                  {isLoadingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isSignUp ? 'Criar Nova Conta' : 'Entrar com E-mail'}</span>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setIsSignUp(!isSignUp);
                      setErrorMessage(null);
                    }}
                    className="text-xs text-zinc-400 hover:text-[#f5b800] transition-colors"
                  >
                    {isSignUp
                      ? 'Já possui conta? Clique para entrar'
                      : 'Não tem conta? Clique para criar uma'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

