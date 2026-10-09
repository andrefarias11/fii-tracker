# 🏢 FII Tracker — Acompanhamento de Carteira & Metas (PWA)

Aplicativo moderno estilo **PWA (Progressive Web App)** construído especialmente para acompanhamento de investimentos em **Fundos de Investimento Imobiliário (FIIs)**, focado na disciplina de aportes mensais de **R$ 200/mês**, cálculo do **Efeito Bola de Neve (Número Mágico)** e acompanhamento de rentabilidade em tempo real na B3.

---

## ✨ Funcionalidades

1. **Dashboard Financeiro Completo:**
   - Patrimônio total acumulado e valor de custo investido.
   - Lucro/Prejuízo da carteira em R$ e porcentagem (%).
   - Renda passiva estimada a receber no próximo mês.
   - Yield médio mensal.

2. **Acompanhamento da Meta de R$ 200/mês:**
   - Barra de progresso interativa dos aportes realizados no mês vigente.
   - Cálculo automático de quanto falta para bater a meta.
   - Efeito comemorativo com confetes ao atingir ou bater os R$ 200.
   - Marcos de patrimônio (ex: R$ 1.000) e renda mensal (ex: R$ 10/mês).

3. **Efeito Bola de Neve (Número Mágico):**
   - Calcula exatamente quantas cotas de cada fundo você precisa ter para que os dividendos comprem 1 cota nova todo mês sem sair dinheiro do seu bolso.
   - Barra de progresso individual por fundo.

4. **Cotações em Tempo Real (B3):**
   - API integrada com o Yahoo Finance (B3 / `.SA`), sem necessidade de chaves pagas.
   - Atualização ao vivo de preços e variação diária.
   - Suporte aos fundos Base 10 (MXRF11, VGIR11, CPTS11, KISU11, etc.) e Base 100 (XPML11, HGLG11, KNCR11, etc.).

5. **Lançamento Manual Rápido (+):**
   - Botão flutuante para adicionar aportes da XP em poucos toques.
   - Autocomplete com os principais FIIs do mercado brasileiro.
   - Puxa a cotação atual automaticamente ao selecionar o ticker.

6. **Simulador de Juros Compostos:**
   - Projeta a evolução de aportes constantes de R$ 200/mês em 1, 3, 5 e 10 anos com reinvestimento dos dividendos.

7. **Histórico & Backup:**
   - Extrato detalhado de todas as compras realizadas.
   - Exportação e importação de backup em arquivo JSON (seus dados nunca são perdidos).
   - Armazenamento local rápido e privado no dispositivo (`localStorage`).

---

## 📱 Como Usar no iPhone

### 1. Testando pelo Wi-Fi local:
Com o servidor rodando no seu computador:
1. Conecte o iPhone na **mesma rede Wi-Fi** do computador.
2. Abra o **Safari** no iPhone e digite:
   ```
   http://172.16.0.9:3000
   ```
3. Toque no botão de **Compartilhar** do Safari (ícone do quadrado com a seta para cima ⬆️).
4. Role para baixo e selecione **"Adicionar à Tela de Início"**.
5. Pronto! O app aparecerá na tela do seu iPhone com ícone próprio e abrirá em **tela cheia**, sem barra de navegação.

### 2. Publicando na Nuvem (100% Grátis com HTTPS):
Para acessar de qualquer lugar (mesmo no 4G/5G sem o computador ligado):
1. Suba o projeto para o seu GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: fii tracker pwa"
   ```
2. Acesse [vercel.com](https://vercel.com) e importe o repositório.
3. O deploy é automático e você receberá um link HTTPS (ex: `https://seu-fii-tracker.vercel.app`).
4. Abra esse link no Safari do iPhone e adicione à Tela de Início!

---

## 💻 Comandos de Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento (acessível no celular via rede local)
npm run dev

# Gerar build de produção
npm run build

# Iniciar servidor de produção
npm start
```
