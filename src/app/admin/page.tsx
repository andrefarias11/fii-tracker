'use client';
import Image from 'next/image';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  Users,
  Coins,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  Lock,
  User,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { AdminAccountOverview, AdminDashboardData } from '../api/admin/route';
import {
  getSavedAccounts,
  getActiveAccount,
  switchAccount,
  SavedAccountSession,
} from '../../lib/authManager';
import { calculatePortfolioPositions, calculateUnifiedPortfolioSummary } from '../../domain/portfolioEngine';
import { Transaction, FixedIncomeAsset } from '../../types/portfolio';
import { triggerHaptic } from '../../lib/haptic';

type SortOption = 'equity' | 'income' | 'positions' | 'recent';

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
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

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginUsername, setLoginUsername] = useState<string>('admin');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState<boolean>(false);

  const [cloudData, setCloudData] = useState<AdminDashboardData | null>(null);
  const [localAccounts, setLocalAccounts] = useState<SavedAccountSession[]>([]);
  const [activeAccount, setActiveAccount] = useState<SavedAccountSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('equity');

  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('fii_tracker_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  const togglePrivacyMode = () => {
    triggerHaptic('light');
    setIsPrivacyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('fii_tracker_privacy_mode', String(next));
      } catch {}
      return next;
    });
  };

  const formatBRL = useCallback(
    (val: number) => {
      if (isPrivacyMode) return '••••••';
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(val);
    },
    [isPrivacyMode]
  );

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          return true;
        }
      }
      setIsAuthenticated(false);
      return false;
    } catch {
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  const fetchAdminData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin', { cache: 'no-store' });
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (res.ok) {
        const data: AdminDashboardData = await res.json();
        setCloudData(data);
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Falha ao buscar dados administrativos:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Read the external session vault once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalAccounts(getSavedAccounts());
    setActiveAccount(getActiveAccount());
    checkAuth().then((authed) => {
      if (authed) {
        fetchAdminData();
      } else {
        setIsLoading(false);
      }
    });
  }, [checkAuth, fetchAdminData]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      setLoginError('Informe usuário e senha.');
      return;
    }

    triggerHaptic('light');
    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        triggerHaptic('success');
        setIsAuthenticated(true);
        fetchAdminData();
      } else {
        triggerHaptic('error');
        setLoginError(data.error || 'Credenciais inválidas.');
      }
    } catch {
      triggerHaptic('error');
      setLoginError('Falha ao comunicar com o servidor de autenticação.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleLogout = async () => {
    triggerHaptic('light');
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } catch {}
    setIsAuthenticated(false);
    setCloudData(null);
    setLoginPassword('');
  };

  // Unificação Inteligente: Contas da Nuvem (Supabase) + Contas do Aparelho Local (Cofre)
  const unifiedAccounts: AdminAccountOverview[] = useMemo(() => {
    const list: AdminAccountOverview[] = cloudData?.accounts ? [...cloudData.accounts] : [];
    const cloudUserIds = new Set(list.map((a) => a.userId));
    const cloudEmails = new Set(list.map((a) => a.email.toLowerCase()));

    // Verifica se alguma conta salva no aparelho não está listada na nuvem ainda
    for (const local of localAccounts) {
      const alreadyIncluded =
        cloudUserIds.has(local.id) || cloudEmails.has(local.email.toLowerCase());

      if (!alreadyIncluded) {
        // Carrega transações e caixinhas locais desta conta
        let localTxs: Transaction[] = [];
        let localFi: FixedIncomeAsset[] = [];

        try {
          const rawTx = localStorage.getItem(`fii_tracker_transactions_v1_${local.id}`);
          if (rawTx) localTxs = JSON.parse(rawTx);
        } catch {}

        try {
          const rawFi = localStorage.getItem(`fii_tracker_fixed_income_v1_${local.id}`);
          if (rawFi) localFi = JSON.parse(rawFi);
        } catch {}

        const currentYearMonth = new Date().toISOString().slice(0, 7);
        const positions = calculatePortfolioPositions(localTxs, {}, {}, currentYearMonth);
        const unified = calculateUnifiedPortfolioSummary(positions, localFi, null);

        list.push({
          userId: local.id,
          email: local.email,
          displayName: local.displayName,
          avatarUrl: local.avatarUrl,
          createdAt: local.lastUsedAt,
          lastSignInAt: local.lastUsedAt,
          bolsaEquity: unified.bolsaEquity,
          bolsaInvested: unified.bolsaInvested,
          bolsaProfitLoss: unified.bolsaProfitLoss,
          bolsaProfitLossPercent: unified.bolsaProfitLossPercent,
          fixedIncomeEquity: unified.fixedIncomeEquity,
          totalGlobalEquity: unified.totalGlobalEquity,
          totalMonthlyDividends: unified.totalGlobalMonthlyIncome,
          positionsCount: positions.length,
          fixedIncomeCount: localFi.length,
          transactionsCount: localTxs.length,
          positions: positions.map((p) => ({
            ticker: p.ticker,
            totalShares: p.totalShares,
            currentPrice: p.currentPrice,
            currentTotal: p.currentTotal,
            totalMonthlyDividend: p.totalMonthlyDividend,
            averagePrice: p.averagePrice,
            profitLoss: p.profitLoss,
            profitLossPercent: p.profitLossPercent,
          })),
          fixedIncome: localFi,
        });
      }
    }

    // Enriquece contas da nuvem com dados extras do cofre local (como avatar atualizado e nome real)
    for (const acc of list) {
      const matchedLocal = localAccounts.find(
        (l) => l.id === acc.userId || l.email.toLowerCase() === acc.email.toLowerCase()
      );
      if (matchedLocal) {
        if (!acc.avatarUrl && matchedLocal.avatarUrl) acc.avatarUrl = matchedLocal.avatarUrl;
        if (matchedLocal.displayName && matchedLocal.displayName !== 'Investidor') {
          acc.displayName = matchedLocal.displayName;
        }
      }
    }

    return list;
  }, [cloudData, localAccounts]);

  // Filtragem por busca e ordenação selecionada
  const filteredAndSortedAccounts = useMemo(() => {
    let result = [...unifiedAccounts];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((acc) => {
        const matchName = acc.displayName.toLowerCase().includes(q);
        const matchEmail = acc.email.toLowerCase().includes(q);
        const matchTicker = acc.positions.some((p) => p.ticker.toLowerCase().includes(q));
        const matchFi = acc.fixedIncome.some((f) => f.name.toLowerCase().includes(q));
        return matchName || matchEmail || matchTicker || matchFi;
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'equity') return b.totalGlobalEquity - a.totalGlobalEquity;
      if (sortBy === 'income') return b.totalMonthlyDividends - a.totalMonthlyDividends;
      if (sortBy === 'positions') return b.positionsCount - a.positionsCount;
      if (sortBy === 'recent') {
        const dateA = a.lastSignInAt || a.createdAt || '';
        const dateB = b.lastSignInAt || b.createdAt || '';
        return dateB.localeCompare(dateA);
      }
      return 0;
    });

    return result;
  }, [unifiedAccounts, searchQuery, sortBy]);

  // KPIs Globais Consolidados da Plataforma
  const platformKpis = useMemo(() => {
    const totalCustodyEquity = Number(
      unifiedAccounts.reduce((acc, a) => acc + a.totalGlobalEquity, 0).toFixed(2)
    );
    const totalBolsaEquity = Number(
      unifiedAccounts.reduce((acc, a) => acc + a.bolsaEquity, 0).toFixed(2)
    );
    const totalFixedIncomeEquity = Number(
      unifiedAccounts.reduce((acc, a) => acc + a.fixedIncomeEquity, 0).toFixed(2)
    );
    const totalMonthlyDividends = Number(
      unifiedAccounts.reduce((acc, a) => acc + a.totalMonthlyDividends, 0).toFixed(2)
    );
    const totalActiveAccounts = unifiedAccounts.length;
    const totalTransactions = unifiedAccounts.reduce(
      (acc, a) => acc + a.transactionsCount,
      0
    );

    return {
      totalCustodyEquity,
      totalBolsaEquity,
      totalFixedIncomeEquity,
      totalMonthlyDividends,
      totalActiveAccounts,
      totalTransactions,
    };
  }, [unifiedAccounts]);

  const toggleExpand = (userId: string) => {
    triggerHaptic('light');
    setExpandedAccounts((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleSwitchToAccount = async (accountUserId: string) => {
    triggerHaptic('medium');
    const target = localAccounts.find((a) => a.id === accountUserId);
    if (target) {
      await switchAccount(target.id);
      router.push('/');
    }
  };

  // 1. Tela de Carregamento Inicial de Sessão
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#f5b800] animate-spin mb-3" />
        <p className="text-xs text-zinc-400 font-medium tracking-wide">
          Verificando credenciais de acesso...
        </p>
      </div>
    );
  }

  // 2. Tela de Login Administrativo (XP Dark Gate)
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-4 antialiased relative overflow-hidden">
        {/* Glow de fundo sutil */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#f5b800]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-[#121215] border border-white/[0.08] rounded-[24px] p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
          {/* Topo do Card de Login */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#2b2512] border border-[#f5b800]/30 flex items-center justify-center text-[#f5b800] shadow-md shadow-[#f5b800]/10 mb-1">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Acesso Restrito • Painel Admin
            </h1>
            <p className="text-xs text-zinc-400 max-w-xs">
              Digite as credenciais de administrador para visualizar a custódia geral da plataforma.
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Usuário Administrador
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#f5b800]/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#f5b800]/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingLogin}
              className="w-full bg-[#f5b800] hover:bg-[#e5ac00] text-zinc-950 font-bold rounded-full py-3.5 px-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#f5b800]/10 text-sm mt-2 disabled:opacity-50"
            >
              {isSubmittingLogin ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>Entrar no Painel Admin</span>
            </button>
          </form>

          {/* Rodapé do Login */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-500">
            <Link
              href="/"
              onClick={() => triggerHaptic('light')}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Início</span>
            </Link>

            <span className="text-[11px] text-zinc-600">
              Padrão: admin / admin123
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col antialiased selection:bg-[#f5b800]/20 selection:text-[#f5b800] pb-20">
      {/* 1. Header Administrativo XP Dark */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-white/[0.06] px-4 sm:px-6 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              onClick={() => triggerHaptic('light')}
              className="w-9 h-9 rounded-full bg-[#121215] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 shadow-sm"
              title="Voltar para a Carteira"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#f5b800]/10 border border-[#f5b800]/20 text-[#f5b800] text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" />
                  Admin
                </span>
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Painel de Contas • Visão Global
                </h1>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Custódia consolidada, métricas e auditoria em tempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePrivacyMode}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
                isPrivacyMode
                  ? 'bg-[#f5b800]/15 border-[#f5b800]/30 text-[#f5b800]'
                  : 'bg-[#121215] border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
              title={isPrivacyMode ? 'Desativar modo privacidade' : 'Ativar modo privacidade'}
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                fetchAdminData();
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#121215] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-200 transition-all active:scale-95 disabled:opacity-50"
              title="Atualizar dados da nuvem"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#f5b800] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all active:scale-95"
              title="Encerrar sessão de administrador"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full space-y-8">
        {/* 2. KPIs Globais no Topo (Estilo XP Solto no Fundo #0b0b0d) */}
        <div className="space-y-4">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400">
              Patrimônio Sob Custódia Total (Todas as Contas)
            </span>
            <div className="text-[32px] sm:text-[44px] font-bold text-white tracking-tight mt-0.5 tabular-nums flex items-baseline gap-3">
              <span>{formatBRL(platformKpis.totalCustodyEquity)}</span>
              {platformKpis.totalActiveAccounts > 0 && (
                <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  {platformKpis.totalActiveAccounts} contas ativas
                </span>
              )}
            </div>
          </div>

          {/* Grid de Métricas Secundárias */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#121215] border border-white/[0.06] rounded-[20px] p-4 space-y-1">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
                <Users className="w-3.5 h-3.5 text-[#f5b800]" />
                <span>Contas Ativas</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white tabular-nums">
                {platformKpis.totalActiveAccounts}
              </div>
              <p className="text-[11px] text-zinc-500">
                {platformKpis.totalTransactions} transações registradas
              </p>
            </div>

            <div className="bg-[#121215] border border-white/[0.06] rounded-[20px] p-4 space-y-1">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Total em Bolsa</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white tabular-nums">
                {formatBRL(platformKpis.totalBolsaEquity)}
              </div>
              <p className="text-[11px] text-zinc-500">FIIs e Ações B3</p>
            </div>

            <div className="bg-[#121215] border border-white/[0.06] rounded-[20px] p-4 space-y-1">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
                <PiggyBank className="w-3.5 h-3.5 text-purple-400" />
                <span>Total em Caixinhas</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white tabular-nums">
                {formatBRL(platformKpis.totalFixedIncomeEquity)}
              </div>
              <p className="text-[11px] text-zinc-500">Renda Fixa & Reservas</p>
            </div>

            <div className="bg-[#121215] border border-white/[0.06] rounded-[20px] p-4 space-y-1">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Proventos Mensais</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">
                +{formatBRL(platformKpis.totalMonthlyDividends)}
                <span className="text-xs text-zinc-400 font-normal">/mês</span>
              </div>
              <p className="text-[11px] text-zinc-500">Renda passiva estimada</p>
            </div>
          </div>
        </div>

        {/* 3. Barra de Busca e Ordenação */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por nome, e-mail ou ticker (ex: MXRF11)..."
              className="w-full bg-[#121215] border border-white/[0.08] rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#f5b800]/50 transition-colors shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-zinc-400 shrink-0 hidden sm:inline">Ordenar:</span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSortBy('equity');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                sortBy === 'equity'
                  ? 'bg-[#f5b800] text-zinc-950 shadow-sm'
                  : 'bg-[#121215] text-zinc-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              Maior Patrimônio
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSortBy('income');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                sortBy === 'income'
                  ? 'bg-[#f5b800] text-zinc-950 shadow-sm'
                  : 'bg-[#121215] text-zinc-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              Maior Renda
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSortBy('positions');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                sortBy === 'positions'
                  ? 'bg-[#f5b800] text-zinc-950 shadow-sm'
                  : 'bg-[#121215] text-zinc-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              Mais Ativos
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSortBy('recent');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                sortBy === 'recent'
                  ? 'bg-[#f5b800] text-zinc-950 shadow-sm'
                  : 'bg-[#121215] text-zinc-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              Último Acesso
            </button>
          </div>
        </div>

        {/* 4. Lista de Cards de Cada Conta (Molde XP bg-[#121215] rounded-[20px] p-5) */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#f5b800] animate-spin" />
            <p className="text-sm text-zinc-400">Carregando visão geral das contas...</p>
          </div>
        ) : filteredAndSortedAccounts.length === 0 ? (
          <div className="bg-[#121215] border border-white/[0.06] rounded-[20px] p-10 text-center space-y-2">
            <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <h3 className="text-base font-bold text-white">Nenhuma conta encontrada</h3>
            <p className="text-xs text-zinc-400">
              {searchQuery
                ? 'Nenhum resultado corresponde ao termo pesquisado.'
                : 'Nenhuma conta registrada no banco ou cofre local.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredAndSortedAccounts.map((acc) => {
              const isCurrentActive =
                activeAccount?.id === acc.userId ||
                activeAccount?.email.toLowerCase() === acc.email.toLowerCase();
              const isSavedOnDevice = localAccounts.some(
                (l) => l.id === acc.userId || l.email.toLowerCase() === acc.email.toLowerCase()
              );
              const isExpanded = Boolean(expandedAccounts[acc.userId]);

              return (
                <div
                  key={acc.userId}
                  className={`bg-[#121215] border rounded-[20px] p-5 transition-all flex flex-col justify-between ${
                    isCurrentActive
                      ? 'border-[#f5b800]/50 shadow-lg shadow-[#f5b800]/5'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Cabeçalho da Conta */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {acc.avatarUrl ? (
                          <Image width={48} height={48} unoptimized
                            src={acc.avatarUrl}
                            alt={acc.displayName}
                            className="w-12 h-12 rounded-full object-cover border border-white/[0.1] shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#f5b800] text-zinc-950 font-bold flex items-center justify-center text-sm uppercase tracking-tighter shrink-0 shadow-sm">
                            {getInitials(acc.displayName || acc.email)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white text-base truncate">
                              {acc.displayName}
                            </span>
                            {acc.email.includes('@gmail') && (
                              <span title="Conta Google">
                                <GoogleIcon className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 truncate">{acc.email}</p>
                          {acc.lastSignInAt && (
                            <p className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-zinc-600" />
                              Último acesso:{' '}
                              {new Date(acc.lastSignInAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                      </div>

                      {isCurrentActive && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Conta Ativa
                        </span>
                      )}
                    </div>

                    {/* Tabela Key-Value da Conta */}
                    <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.06]">
                        <span className="text-zinc-400 font-medium">Patrimônio Total (Bolsa + RF)</span>
                        <span className="text-base font-bold text-white tabular-nums">
                          {formatBRL(acc.totalGlobalEquity)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-400" />
                          Em Bolsa (FIIs / Ações)
                        </span>
                        <div className="text-right">
                          <span className="text-white font-semibold tabular-nums">
                            {formatBRL(acc.bolsaEquity)}
                          </span>
                          <span className="text-[11px] text-zinc-500 ml-1.5">
                            ({acc.positionsCount} {acc.positionsCount === 1 ? 'ativo' : 'ativos'})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <PiggyBank className="w-3.5 h-3.5 text-purple-400" />
                          Em Caixinhas / Renda Fixa
                        </span>
                        <div className="text-right">
                          <span className="text-white font-semibold tabular-nums">
                            {formatBRL(acc.fixedIncomeEquity)}
                          </span>
                          <span className="text-[11px] text-zinc-500 ml-1.5">
                            ({acc.fixedIncomeCount}{' '}
                            {acc.fixedIncomeCount === 1 ? 'aplicação' : 'aplicações'})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-emerald-400" />
                          Proventos Mensais Estimados
                        </span>
                        <span className="text-emerald-400 font-bold tabular-nums">
                          +{formatBRL(acc.totalMonthlyDividends)}/mês
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          {acc.bolsaProfitLoss >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          Resultado em Bolsa
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            acc.bolsaProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {acc.bolsaProfitLoss >= 0 ? '▲ +' : '▼ '}
                          {formatBRL(acc.bolsaProfitLoss)} ({acc.bolsaProfitLossPercent > 0 ? '+' : ''}
                          {acc.bolsaProfitLossPercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                    {/* Expansão da Carteira Completa */}
                    {isExpanded && (
                      <div className="pt-2 space-y-3 animate-in fade-in duration-200">
                        {/* Lista de Ativos em Bolsa */}
                        <div>
                          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#f5b800]" />
                            <span>Ativos em Carteira ({acc.positions.length})</span>
                          </div>

                          {acc.positions.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic p-2 bg-white/[0.02] rounded-xl text-center">
                              Nenhum ativo de Bolsa cadastrado nesta conta.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {acc.positions.map((pos) => (
                                <div
                                  key={pos.ticker}
                                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs"
                                >
                                  <div>
                                    <span className="font-bold text-white text-sm">
                                      {pos.ticker}
                                    </span>
                                    <div className="text-[11px] text-zinc-400 mt-0.5">
                                      {pos.totalShares} cotas • PM: {formatBRL(pos.averagePrice)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-white">
                                      {formatBRL(pos.currentTotal)}
                                    </div>
                                    <div className="text-[11px] text-emerald-400 font-medium">
                                      +{formatBRL(pos.totalMonthlyDividend)}/mês
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Lista de Caixinhas */}
                        <div>
                          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <PiggyBank className="w-3.5 h-3.5 text-purple-400" />
                            <span>Caixinhas / Renda Fixa ({acc.fixedIncome.length})</span>
                          </div>

                          {acc.fixedIncome.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic p-2 bg-white/[0.02] rounded-xl text-center">
                              Nenhuma caixinha cadastrada nesta conta.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {acc.fixedIncome.map((fi) => (
                                <div
                                  key={fi.id}
                                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs"
                                >
                                  <div>
                                    <span className="font-semibold text-white">{fi.name}</span>
                                    <div className="text-[11px] text-zinc-400 mt-0.5">
                                      {fi.institution} • {fi.ratePercent}% {fi.rateType}
                                    </div>
                                  </div>
                                  <div className="text-right font-bold text-white">
                                    {formatBRL(fi.currentBalance)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rodapé do Card com Ações */}
                  <div className="pt-4 mt-3 border-t border-white/[0.05] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(acc.userId)}
                      className="px-3 py-1.5 rounded-xl bg-[#2b2512] hover:bg-[#3d3419] text-[#f5b800] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>{isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {isSavedOnDevice ? (
                      isCurrentActive ? (
                        <Link
                          href="/"
                          className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-white flex items-center gap-1.5 transition-all"
                        >
                          <span>Gerenciar Carteira</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSwitchToAccount(acc.userId)}
                          className="px-4 py-2 rounded-full bg-[#f5b800] hover:bg-[#e5ac00] text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-[#f5b800]/10"
                        >
                          <span>Acessar Conta</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )
                    ) : (
                      <span className="text-[11px] text-zinc-500 italic">
                        Salva apenas na Nuvem
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

