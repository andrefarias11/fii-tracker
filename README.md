# 🏢 FII Tracker — Carteira Oficial B3, Proventos & Patrimônio Global (XP Dark iOS)

[![Version](https://img.shields.io/badge/version-4.2.1-f5b800.svg)](https://github.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-iOS%20Standalone-purple)](https://developer.apple.com/)

Aplicativo **PWA (Progressive Web App)** construído no padrão visual **XP Investimentos Dark (iOS)**, desenvolvido para investidores acompanharem **Fundos Imobiliários (FIIs)**, **Fiagros**, **Ações de Dividendos da B3** e **Renda Fixa / Caixinhas Nubank** de forma auditada, com sincronização em tempo real de proventos e gamificação de conquistas financeiras.

---

## ✨ Principais Funcionalidades

### 1. 🎨 Design System XP Investimentos Dark (iOS)
- **Fundo Deep Dark (`#0b0b0d`)** com cards em `#1c1c1e` (`rounded-[20px]`), tipografia financeira com `tabular-nums` e destaques em **Amarelo Ouro XP (`#f5b800`)**.
- **PortfolioSummary 100% Solto no Topo**: patrimônio em destaque (`text-[32px]`), resultado acumulado com indicadores dinâmicos ▲/▼, proventos do mês com Yield on Cost (YoC), valor aplicado e botões de ação rápida (*Importar B3* e *+ Caixinha / RF*).
- **Lista Meus Ativos XP**:
  - Cabeçalho limpo com contagem de ativos e botão de alternância cíclica de ordenação **"Ordenar ↓↑"** (Posição, Resultado e Proventos).
  - Cards individuais de ativos com tabela Key-Value de 6 linhas (Preço Médio, Cotação Atual, Quantidade, Saldo Total, Resultado e Dividendo Mensal).
  - Botões pílula de ação: **"Detalhes"** expansíveis (*P/VP, Preço-Teto, Número Mágico e Payback de Proventos*) e **"Aportar"** integrado diretamente ao modal de compras.
- **Ergonomia Nativa para iPhone 17 (393px–402px)**: fontes mínimas de 16px em campos de formulário para evitar auto-zoom no Safari iOS, modais inferiores (*Bottom Sheets*) com safe area (`pb-safe-modal`), feedback tátil háptico (*Taptic Engine*) e dock flutuante translúcida.

---

### 2. ⚡ Sincronização 100% Fiel de Proventos Reais (B3 & StatusInvest)
- **Eliminação da Confirmação Artificial**: ativos nunca mudam de status apenas por passar o dia do mês no calendário.
  - **`PAID` (Pago)**: marcado apenas se o fundo comprovadamente anunciou na B3 **E** a data de pagamento oficial já chegou ou passou.
  - **`CONFIRMED` (Confirmado)**: comunicado oficial divulgado pela gestora no ciclo do mês corrente, aguardando a data de pagamento.
  - **`ESTIMATED` (Previsto)**: se a gestora ainda não divulgou o fato relevante na B3 para o mês vigente, o provento permanece estritamente como previsto (utilizando o último dividendo pago como referência de cálculo).
- **Multi-Fonte Resiliente (`/api/quote`)**:
  - **StatusInvest JSON Público**: consulta em tempo real `companytickerprovents` extraindo Data-Com (`ed`), Data de Pagamento (`pd`) e Valor por Cota (`v`).
  - **Validação de Ciclo no Fuso `America/Sao_Paulo`**: compara rigorosamente se `pd` ou `ed` pertencem ao mês e ano vigentes.
  - **Compatibilidade Linux / Vercel Serverless**: resolução dinâmica do binário `curl` (`curl.exe` no Windows e `/usr/bin/curl` no Linux da Vercel).
  - **Fallback Oficial Brapi (`dividends=true`)**: suporte nativo a token da Brapi (`BRAPI_TOKEN`) como camada intermediária.
  - **Fallback Yahoo Finance**: validação estrita sem janelas deslizantes arbitrárias de 32 dias.

---

### 3. 💼 Carteira B3 Completa: FIIs, Fiagros e Ações
- **Alimentação Auditada via Planilha da B3**: importe a planilha oficial do Portal do Investidor da B3 (`.xlsx`, `.xls` ou `.csv`).
- **Super-Parser B3 Anti-Duplicidade**:
  - Normaliza códigos longos de movimentação (ex: `"MXRF11 - MAXI RENDA"` $\rightarrow$ `"MXRF11"`, `"ITSA4F"` $\rightarrow$ `"ITSA4"`).
  - Normalização histórica de **Splits / Desdobramentos** (Base 100 $\rightarrow$ Base 10).
  - Filtra proventos e eventos de custódia sem duplicar ativos.
  - **Importação Acumulada**: detector de assinatura digital que ignora compras antigas já cadastradas e adiciona apenas as novas cotas.
- **Scanner BESST para Ações de Dividendos**:
  - Cobertura de Ações dos setores perenes (Bancos, Energia, Saneamento, Seguros, Telecom e Commodities).
  - Cálculo automático de **Preço-Teto de Luiz Barsi (6% a.a.)** e média mensal equivalente (dividendos dos últimos 12 meses ÷ 12).
- **Explorador Universal da B3 (`/api/market`)**: busque e inspecione qualquer ação ou FII negociado na bolsa brasileira com cotação ao vivo, P/VP e cálculo instantâneo de Preço-Teto e Número Mágico.

---

### 4. 🏦 Patrimônio Unificado: Caixinhas Nubank & Renda Fixa
- **Gestão Consolidada**: acompanhe reservas de emergência e renda fixa junto aos ativos da bolsa.
- **Presets de 1 Toque**: Caixinha Nubank (100% CDI), CDB Liquidez Diária (102% CDI), Tesouro Selic 2029, Tesouro IPCA+ e LCI/LCA (com isenção fiscal automática).
- **Rendimento Mensal Líquido em Tempo Real**: integrado às taxas diárias oficiais do Banco Central (`/api/bcb`), calculando exatamente quantos reais rendem por mês na caixinha.
- **Sugestão de "Troco do Aporte"**: ao calcular aportes na bolsa, o saldo que sobra da meta mensal sugere automaticamente guardar na caixinha rendendo juros diários.

---

### 5. 📊 Rentabilidade vs CDI & Escadinha de Dividendos XP
- **Gráfico de Barras Fino Estilo XP (`DividendStaircaseChart`)**:
  - 12 colunas estilizadas (`J F M A M J J A S O N D`) com meses futuros em cinza-escuro e meses com valor em degradê prateado ou amarelo ouro quando selecionado.
  - Seletor anual discreto (`No ano (YYYY) ⌄`) e tabela corrida **"Detalhes da evolução"** integrada ao fundo.
- **Rentabilidade vs CDI no Padrão XP (`PerformanceComparisonChart`)**:
  - Curva de retorno suavizada com seletor de base (Minha Carteira, R\$ 1 mil, R\$ 10 mil).
  - Duas tabelas corridas idênticas ao app da XP: **Comparativo acumulado** (Carteira vs CDI Líquido vs Poupança vs IPCA) e **Detalhes da evolução** com variação em % do CDI e taxas oficiais BCB.

---

### 6. 🏆 Linha do Tempo de Conquistas (20 Troféus rumo à Platina)
- **Gamificação Financeira**: sistema de XP e níveis de investidor (*Iniciante* $\rightarrow$ *Cotista Oficial* $\rightarrow$ *Investidor Consistente* $\rightarrow$ *Construtor de Bola de Neve* $\rightarrow$ *Lenda Platina dos FIIs 🏆*).
- **Data Histórica Real**: calcula as datas exatas de desbloqueio com base na evolução cronológica das suas transações na B3.
- **Troféus Abrangentes**: 20 conquistas cobrindo primeiro aporte, diversificação, reinvestimento, 50% e 100% do Número Mágico e metas de patrimônio (R\$ 1 mil, R\$ 5 mil e R\$ 10 mil).

---

### 7. 🧭 Radar de Oportunidades & Análise de Mentores
- **Cesta de Aportes Inteligente**: calcula a divisão exata do dinheiro do aporte do mês nos modos **Equilibrar Carteira** ou **Acelerar Bola de Neve**.
- **Consenso dos Grandes Investidores**:
  - 👑 **Luiz Barsi**: Preço-Teto (mínimo 6% a.a.) e foco em setores perenes (BESST).
  - 🏛️ **Warren Buffett**: Margem de segurança, fosso competitivo e solidez patrimonial.
  - 🛡️ **Benjamin Graham**: Desconto por P/VP e valor intrínseco.
  - 🎓 **Prof. Baroni**: Equilíbrio estrutural de FIIs de Tijolo e Papel com yield consistente.
- **Painel Consenso Hoje**: destaca ativos aprovados simultaneamente por múltiplos mentores na cotação do pregão.

---

### 8. 📲 Widget para iPhone (Scriptable) & Web Push Anti-Spam
- **Widget iOS (`/api/widget`)**: script pronto para o app *Scriptable* com layout nativo para a **Tela Inicial** e **Tela de Bloqueio** do iPhone, exibindo patrimônio total, proventos do mês e próximo evento de pagamento com atualização automática.
- **Notificações Web Push com Trava Tripla Anti-Spam**: alertas no iPhone (iOS 16.4+) sobre anúncios reais de dividendos, proximidade de Data-Com e ativos em queda abaixo do seu Preço Médio, com bloqueio síncrono diário contra notificações repetidas.
- **Retrospectiva Mensal ("Spotify Wrapped")**: resumo comemorativo mensal de proventos recebidos, cotas acumuladas e avanço da bola de neve com compartilhamento em 1 toque no WhatsApp.

---

## 📱 Instalação no iPhone (PWA + Widget)

1. Abra a URL do app no **Safari** do iPhone.
2. Toque no botão de **Compartilhar** (ícone do quadrado com seta para cima ⬆️) e selecione **"Adicionar à Tela de Início"**.
3. Abra o app pela Tela de Início:
   - Toque no ícone de **Configurações (⚙️)** no topo para ativar as **Notificações Push**.
   - Na seção **Widget no iPhone**, toque em **"Copiar Código do Widget (Scriptable)"** e cole em um novo script no app gratuito *Scriptable* da App Store.

---

## 💻 Comandos de Desenvolvimento

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento (acessível na rede local)
npm run dev

# 3. Verificação de tipos TypeScript
npx tsc --noEmit

# 4. Executar linter ESLint
npm run lint

# 5. Build de produção (Next.js Turbopack)
npm run build

# 6. Iniciar servidor de produção
npm start
```

---

## 🔑 Variáveis de Ambiente Opcionais (`.env.local`)

```env
# Banco de dados na nuvem (opcional - funciona 100% offline se omitido)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon

# Notificações Web Push (opcional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=sua-chave-publica-vapid
VAPID_PRIVATE_KEY=sua-chave-privada-vapid

# Proventos B3 via Brapi (opcional - atua como fallback adicional)
BRAPI_TOKEN=seu-token-gratuito-brapi
```

---

## 📄 Licença

Distribuído sob licença proprietária para uso pessoal. Dados de cotações e proventos são informativos e obtidos de fontes públicas da B3, StatusInvest e Banco Central do Brasil.
