# 🏢 FII Tracker — Carteira Oficial B3, Proventos & Troféu Platina (PWA)

Aplicativo **PWA (Progressive Web App)** com visual minimalista inspirado no **Nubank e Apple iOS**, desenvolvido para o acompanhamento profissional e gamificado de **Fundos de Investimento Imobiliário (FIIs)** na B3.

Conta com **alimentação 100% auditada via planilha oficial da B3**, **Linha do Tempo de 20 Conquistas rumo ao Troféu Platina 🏆**, **sincronização em tempo real com a B3 e Banco Central (Selic, CDI e IPCA)**, **Análise de Mentores (Barsi, Buffett, Graham e Baroni)**, **Web Push Notifications** e **Widget para Tela de Bloqueio/Início do iPhone**.

---

## ✨ Principais Funcionalidades

### 1. 🎨 Visual Minimalista 2.0 (Estilo Nubank & Apple iOS)
- **Preto OLED (`#000000`)** com cards de alto contraste (`#121215`), tipografia limpa e **Modo Privacidade (Olhinho)** para ocultar valores em público.
- **Dock Flutuante Translúcida com 4 Abas Principais**:
  1. **Início**: Patrimônio consolidado, ganho real acima do IPCA, barra de meta mensal, **Meus Ativos** (com *Progressive Disclosure* ao tocar) e **Extrato B3** agrupado por mês.
  2. **Proventos**: Mapa mensal de dividendos (Data-Com e Data de Pagamento) e **Gráfico Diário Comparativo**.
  3. **Explorar**: **Radar de Oportunidades B3** e **Mentores (Barsi & Cia)**.
  4. **Troféus**: **Linha do Tempo de Conquistas (Platina 20/20)**, **Efeito Bola de Neve (Número Mágico)** e **Simulador de Futuro**.

---

### 2. 🔒 Modo 100% Oficial B3 & Super-Parser Anti-Duplicidade
- **Sem inserção manual artificial**: a carteira é alimentada exclusivamente pela planilha oficial exportada do Portal do Investidor da B3 (`.xlsx`, `.xls` ou `.csv`), garantindo que todas as métricas e conquistas sejam 100% reais.
- **Normalização Canônica de Tickers (`normalizeB3Ticker`)**:
  - Limpa descrições longas de abas de Movimentação (ex: `"MXRF11 - MAXI RENDA FDO INV IMOB"` $\rightarrow$ `"MXRF11"`).
  - Converte lotes fracionários (`"MXRF11F"` $\rightarrow$ `"MXRF11"`).
  - Filtra automaticamente linhas de proventos (`Rendimento`, `Dividendo`, `JCP`, `Fração`) e bloqueia ETFs/Units terminados em 11 (`BOVA11`, `IVVB11`, `TAEE11`, `SANB11`, `KLBN11`, etc.).
- **Importação Acumulada Inteligente (Ex: Planilha Outubro + Novembro)**:
  - Você pode subir a planilha do ano inteiro sem medo: o detector de assinatura digital (`Ticker + Data + Cotas + Preço + Tipo`) **ignora automaticamente** os aportes de meses que já estão no sistema e **importa apenas os novos**, somando as novas cotas aos FIIs existentes e recalculando o Preço Médio.

---

### 3. 🏆 Linha do Tempo de Conquistas (20 Troféus + Platina)
Sistema gamificado completo para motivar a evolução constante da carteira:
- **Progresso do Troféu Platina (0 a 20/20)** com sistema de **XP** e **Patentes de Investidor** (*Iniciante na B3* $\rightarrow$ *Cotista Oficial B3* $\rightarrow$ *Investidor Consistente* $\rightarrow$ *Construtor de Bola de Neve* $\rightarrow$ *Viver de Renda* $\rightarrow$ *Lenda Platina dos FIIs 🏆*).
- **Card "Próximo Troféu na Mira"**: destaca automaticamente a conquista mais próxima de ser concluída.
- **Data Histórica Real**: reconstrói a linha do tempo cronológica da B3 e exibe a data exata em que cada conquista foi desbloqueada (`Conquistado em DD/MM/AAAA`).
- **Os 20 Troféus (Bronze, Prata, Ouro e Platina)**:
  - **Bronze**: *#01 Batismo na B3* (1ª planilha), *#02 Dezena de Tijolos* (10 cotas), *#03 Café Pago pelos FIIs* (R\$ 5/mês), *#04 Trindade Imobiliária* (3 FIIs), *#05 Primeiros R\$ 500*.
  - **Prata**: *#06 Meio Centenário* (50 cotas), *#07 Fábrica de Moedas* (R\$ 10/mês), *#08 Clube dos 4 Dígitos* (R\$ 1.000), *#09 Escudo Híbrido* (Papel + Tijolo/Agro), *#10 Hábito Inabalável* (3 meses de aporte), *#11 Centurião das Cotas* (100 cotas).
  - **Ouro**: *#12 Streaming Pago* (R\$ 25/mês), *#13 Carteira Blindada* (5 FIIs), *#14 Reserva de Valor* (R\$ 2.500), *#15 Engrenagem Girando* (50% do Número Mágico), *#16 Conta de Luz/Internet* (R\$ 50/mês), *#17 Patrimônio de R\$ 5.000*.
  - **Platina**: *#18 Bola de Neve Ativada* (100% do Número Mágico em 1 FII), *#19 Barão das Cotas* (500 cotas), *#20 Clube dos 5 Dígitos* (R\$ 10.000 de patrimônio).

---

### 4. 📈 Gráfico Diário Comparativo & API do Banco Central
- **Curva Diária Real**: começa exatamente no **1º dia em que você começou a investir** e avança dia após dia na horizontal até **Hoje**, com auto-escala vertical (zoom automático) para destacar cada variação.
- **Comparativo ao Vivo**: compara o retorno acumulado da **Sua Carteira FII** contra **CDI Líquido (85%)**, **Poupança** e **Inflação (IPCA)** puxados diretamente da API Oficial do Banco Central do Brasil (`/api/bcb`).

---

### 5. 🧭 Radar de Oportunidades B3 & Mentores (Barsi, Buffett, Graham e Baroni)
- **Alocação Inteligente do Mês**: sugere a cesta ideal de compra para o saldo restante da sua meta mensal (com opção de somar os dividendos do mês) em dois modos: **Equilibrar Carteira** ou **Turbo Bola de Neve**.
- **Visão dos Grandes Investidores**: analisa os FIIs da B3 em tempo real segundo os critérios matemáticos de:
  - 👑 **Luiz Barsi** (*Rei dos Dividendos & Preço-Teto*)
  - 🏛️ **Warren Buffett** (*Fosso Competitivo & Qualidade de Tijolo*)
  - 🛡️ **Benjamin Graham** (*Margem de Segurança & Desconto P/VP*)
  - 🎓 **Prof. Baroni** (*Equilíbrio 60/40 Tijolo + Papel & Renda Recorrente*)
- **Consenso Hoje**: destaca os FIIs aprovados simultaneamente por 2 ou mais mentores nas cotações atuais da B3.

---

### 6. 📲 Widget para iPhone (Scriptable) & Web Push Inteligente
- **Widget iOS (`/api/widget`)**: gerador integrado nas Configurações para adicionar um widget nativo na **Tela Inicial** ou **Tela de Bloqueio** do iPhone via app gratuito *Scriptable*, exibindo patrimônio, dividendos do mês e progresso da meta com atualização automática a cada 15 minutos e cache offline.
- **Notificações Web Push com Trava Tripla Anti-Spam**: alertas nativos no iPhone (iOS 16.4+) sobre FIIs descontados abaixo do seu Preço Médio, proximidade de Data-Com, Consenso dos Mentores e pagamento de proventos — com bloqueio diário síncrono para nunca disparar notificações repetidas ao abrir o app.
- **Sincronização Híbrida (Supabase + LocalStorage + Backup JSON)**: funciona 100% offline no dispositivo e sincroniza automaticamente com o banco em nuvem no Supabase quando configurado.

---

## 📱 Como Instalar no iPhone (PWA + Widget)

1. Acesse a URL do projeto publicado na Vercel pelo **Safari** no iPhone.
2. Toque em **Compartilhar** (ícone do quadrado com seta para cima ⬆️) $\rightarrow$ **"Adicionar à Tela de Início"**.
3. Abra o **FII Tracker** pela Tela de Início, toque no ícone de **Configurações (⚙️)** no topo:
   - Ative as **Notificações Push** para receber alertas da B3.
   - Na seção **Widget na Tela do iPhone**, toque em **Copiar Código do Widget (Scriptable)** e cole no app gratuito *Scriptable* da App Store.

---

## 💻 Comandos de Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (acessível na rede local)
npm run dev

# Verificar tipagem TypeScript e ESLint
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint src

# Gerar build de produção (requer Node.js >= 20.9.0)
npm run build

# Iniciar servidor de produção
npm start
```
