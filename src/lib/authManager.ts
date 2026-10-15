'use client';

import { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

export interface SavedAccountSession {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  provider: 'google' | 'email' | string;
  accessToken?: string;
  refreshToken?: string;
  lastUsedAt: string;
  isActive?: boolean;
}

export const STORAGE_KEY_SAVED_ACCOUNTS = 'fii_tracker_saved_accounts_v1';
export const STORAGE_KEY_ACTIVE_ACCOUNT_ID = 'fii_tracker_active_account_id_v1';

type AuthListenerCallback = (
  accounts: SavedAccountSession[],
  active: SavedAccountSession | null
) => void;

const listeners = new Set<AuthListenerCallback>();

function notifyAuthSubscribers() {
  if (typeof window === 'undefined') return;
  const accounts = getSavedAccounts();
  const active = getActiveAccount();
  listeners.forEach((callback) => {
    try {
      callback(accounts, active);
    } catch (err) {
      console.error('Erro no listener de authManager:', err);
    }
  });
}

export function subscribeAuthAccounts(callback: AuthListenerCallback): () => void {
  listeners.add(callback);
  // Chamada imediata inicial
  if (typeof window !== 'undefined') {
    callback(getSavedAccounts(), getActiveAccount());
  }
  return () => {
    listeners.delete(callback);
  };
}

export function getSavedAccounts(): SavedAccountSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getActiveAccount(): SavedAccountSession | null {
  const accounts = getSavedAccounts();
  if (accounts.length === 0) return null;

  if (typeof window !== 'undefined') {
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ACCOUNT_ID);
    if (activeId) {
      const found = accounts.find((a) => a.id === activeId);
      if (found) return found;
    }
  }

  const explicitActive = accounts.find((a) => a.isActive);
  return explicitActive || accounts[0] || null;
}

export function saveCurrentSessionToVault(session: Session): SavedAccountSession {
  const user = session.user;
  const email = (user.email || '').trim().toLowerCase();
  const metadata = user.user_metadata || {};

  // Extração automática de dados Google ou e-mail padrão
  const displayName =
    metadata.full_name ||
    metadata.name ||
    metadata.display_name ||
    (email ? email.split('@')[0] : 'Investidor');

  const avatarUrl = metadata.avatar_url || metadata.picture || undefined;

  const provider =
    user.app_metadata?.provider ||
    (metadata.iss && metadata.iss.includes('google') ? 'google' : 'email');

  const newAccount: SavedAccountSession = {
    id: user.id,
    email,
    displayName,
    avatarUrl,
    provider,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    lastUsedAt: new Date().toISOString(),
    isActive: true,
  };

  if (typeof window !== 'undefined') {
    const currentList = getSavedAccounts();
    // Remove duplicatas pelo mesmo id ou mesmo e-mail
    const filtered = currentList.filter(
      (a) => a.id !== user.id && a.email.toLowerCase() !== email
    );

    // Marca as anteriores como inativas e insere a nova no topo
    const updatedList: SavedAccountSession[] = [
      newAccount,
      ...filtered.map((a) => ({ ...a, isActive: false })),
    ];

    try {
      localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(updatedList));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ACCOUNT_ID, user.id);
    } catch (err) {
      console.error('Falha ao salvar conta no cofre de sessões:', err);
    }
  }

  notifyAuthSubscribers();
  return newAccount;
}

export async function signInWithGoogle(): Promise<{ data: any; error: any }> {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: new Error('Cliente Supabase não configurado') };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin,
      queryParams: {
        prompt: 'select_account',
        access_type: 'offline',
      },
    },
  });
}

export async function signInWithEmail(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: new Error('Cliente Supabase não configurado') };
  }

  const res = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (res.data?.session) {
    saveCurrentSessionToVault(res.data.session);
  }

  return res;
}

export async function signUpWithEmail(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: new Error('Cliente Supabase não configurado') };
  }

  const res = await client.auth.signUp({
    email: email.trim(),
    password,
  });

  if (res.data?.session) {
    saveCurrentSessionToVault(res.data.session);
  }

  return res;
}

export async function switchAccount(userId: string): Promise<boolean> {
  const accounts = getSavedAccounts();
  const target = accounts.find((a) => a.id === userId);
  if (!target) return false;

  const client = getSupabaseClient();
  if (!client) return false;

  try {
    if (target.refreshToken) {
      const { data, error } = await client.auth.setSession({
        access_token: target.accessToken || '',
        refresh_token: target.refreshToken,
      });

      if (error) {
        // Tenta refresh se o access token expirou
        const refreshRes = await client.auth.refreshSession({
          refresh_token: target.refreshToken,
        });
        if (refreshRes.data?.session) {
          saveCurrentSessionToVault(refreshRes.data.session);
          return true;
        }
      } else if (data?.session) {
        saveCurrentSessionToVault(data.session);
        return true;
      }
    }
  } catch (err) {
    console.warn('Não foi possível restaurar sessão completa no Supabase:', err);
  }

  // Atualiza apenas marcação local caso offline
  if (typeof window !== 'undefined') {
    const updated = accounts.map((a) => ({
      ...a,
      isActive: a.id === userId,
      lastUsedAt: a.id === userId ? new Date().toISOString() : a.lastUsedAt,
    }));
    localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY_ACTIVE_ACCOUNT_ID, userId);
    notifyAuthSubscribers();
  }

  return true;
}

export function removeAccountFromVault(userId: string): void {
  if (typeof window === 'undefined') return;
  const accounts = getSavedAccounts();
  const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ACCOUNT_ID);
  const filtered = accounts.filter((a) => a.id !== userId);

  localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(filtered));

  if (activeId === userId) {
    if (filtered.length > 0) {
      filtered[0].isActive = true;
      localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(filtered));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ACCOUNT_ID, filtered[0].id);
      switchAccount(filtered[0].id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ACCOUNT_ID);
      const client = getSupabaseClient();
      client?.auth.signOut().catch(() => {});
    }
  }

  notifyAuthSubscribers();
}

export async function signOutCurrentAccount(): Promise<void> {
  const client = getSupabaseClient();
  try {
    await client?.auth.signOut();
  } catch {
    // Silencioso
  }

  if (typeof window !== 'undefined') {
    const active = getActiveAccount();
    if (active) {
      const accounts = getSavedAccounts();
      const updated = accounts.map((a) =>
        a.id === active.id ? { ...a, isActive: false } : a
      );
      localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(updated));
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ACCOUNT_ID);
    }
  }

  notifyAuthSubscribers();
}

let isListenerInitialized = false;

export function initAuthVaultListener(): void {
  if (typeof window === 'undefined' || isListenerInitialized) return;
  isListenerInitialized = true;

  const client = getSupabaseClient();
  if (!client) return;

  // 1. Detectar sessão inicial se o usuário retornou de redirect OAuth
  client.auth.getSession().then(({ data }) => {
    if (data?.session) {
      saveCurrentSessionToVault(data.session);
    }
  }).catch(() => {});

  // 2. Ouvir eventos de autenticação
  client.auth.onAuthStateChange((event, session) => {
    if (
      session &&
      (event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED')
    ) {
      saveCurrentSessionToVault(session);
    }
  });
}

