-- ==========================================
-- FII TRACKER - ESTRUTURA DO BANCO DE DADOS
-- Execute este script no SQL Editor do Supabase
-- ==========================================

-- 1. Tabela de Transações (Aportes)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    date DATE NOT NULL,
    shares NUMERIC NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    broker TEXT NOT NULL DEFAULT 'XP Investimentos',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para acelerar busca por ticker e data
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON public.transactions (ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date);

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

-- 4. Habilitar Row Level Security (RLS) permitindo leitura e escrita pública para uso pessoal
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_dividends ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso anônimo (Anon Key)
CREATE POLICY "Permitir leitura anonima de transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Permitir insercao anonima de transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao anonima de transactions" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Permitir delecao anonima de transactions" ON public.transactions FOR DELETE USING (true);

CREATE POLICY "Permitir leitura de goals" ON public.portfolio_goals FOR SELECT USING (true);
CREATE POLICY "Permitir insercao de goals" ON public.portfolio_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao de goals" ON public.portfolio_goals FOR UPDATE USING (true);

CREATE POLICY "Permitir leitura de custom_dividends" ON public.custom_dividends FOR SELECT USING (true);
CREATE POLICY "Permitir insercao/update de custom_dividends" ON public.custom_dividends FOR ALL USING (true);

