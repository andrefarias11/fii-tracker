-- ==========================================
-- FII TRACKER - ESTRUTURA DO BANCO DE DADOS
-- Execute este script no SQL Editor do Supabase
-- ==========================================

-- 1. Tabela de Transações (Aportes, Vendas e Proventos B3)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'BUY' CHECK (type IN ('BUY', 'SELL', 'DIVIDEND')),
    date DATE NOT NULL,
    shares NUMERIC NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    broker TEXT NOT NULL DEFAULT 'XP Investimentos',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migração idempotente caso a coluna type ainda não exista em base já criada
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'BUY' CHECK (type IN ('BUY', 'SELL', 'DIVIDEND'));

-- Índices para acelerar busca por ticker, data e tipo
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON public.transactions (ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions (type);

-- 2. Tabela de Metas da Carteira
CREATE TABLE IF NOT EXISTS public.portfolio_goals (
    id TEXT PRIMARY KEY DEFAULT 'default_goals',
    monthly_target NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
    milestone_equity_target NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    monthly_income_target NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir metas padrão se ainda não existirem
INSERT INTO public.portfolio_goals (id, monthly_target, milestone_equity_target, monthly_income_target)
VALUES ('default_goals', 200.00, 1000.00, 10.00)
ON CONFLICT (id) DO NOTHING;

-- 3. Tabela de Dividendos Customizados (para ajuste fino de proventos)
CREATE TABLE IF NOT EXISTS public.custom_dividends (
    ticker TEXT PRIMARY KEY,
    dividend NUMERIC(10, 3) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Renda Fixa e Caixinhas (Reserva de Emergência, Nubank, CDBs e Tesouro Direto)
CREATE TABLE IF NOT EXISTS public.fixed_income_assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    institution TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('CAIXINHA', 'CDB', 'TESOURO_SELIC', 'TESOURO_IPCA', 'TESOURO_PREFIXADO', 'LCI_LCA', 'OUTROS')),
    invested_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    rate_type TEXT NOT NULL DEFAULT 'CDI' CHECK (rate_type IN ('CDI', 'IPCA', 'PREFIXADO')),
    rate_percent NUMERIC(8, 2) NOT NULL DEFAULT 100.00,
    is_exempt BOOLEAN NOT NULL DEFAULT false,
    maturity_date DATE,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fixed_income_type ON public.fixed_income_assets (type);
CREATE INDEX IF NOT EXISTS idx_fixed_income_created_at ON public.fixed_income_assets (created_at);

-- 5. Habilitar Row Level Security (RLS) permitindo leitura e escrita pública para uso pessoal
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_income_assets ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso anônimo (Anon Key) para transactions
CREATE POLICY "Permitir leitura anonima de transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Permitir insercao anonima de transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao anonima de transactions" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Permitir delecao anonima de transactions" ON public.transactions FOR DELETE USING (true);

-- Políticas de acesso para portfolio_goals
CREATE POLICY "Permitir leitura de goals" ON public.portfolio_goals FOR SELECT USING (true);
CREATE POLICY "Permitir insercao de goals" ON public.portfolio_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao de goals" ON public.portfolio_goals FOR UPDATE USING (true);

-- Políticas de acesso para custom_dividends
CREATE POLICY "Permitir leitura de custom_dividends" ON public.custom_dividends FOR SELECT USING (true);
CREATE POLICY "Permitir insercao/update de custom_dividends" ON public.custom_dividends FOR ALL USING (true);

-- Políticas de acesso anônimo para fixed_income_assets
CREATE POLICY "Permitir leitura anonima de fixed_income_assets" ON public.fixed_income_assets FOR SELECT USING (true);
CREATE POLICY "Permitir insercao anonima de fixed_income_assets" ON public.fixed_income_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao anonima de fixed_income_assets" ON public.fixed_income_assets FOR UPDATE USING (true);
CREATE POLICY "Permitir delecao anonima de fixed_income_assets" ON public.fixed_income_assets FOR DELETE USING (true);
