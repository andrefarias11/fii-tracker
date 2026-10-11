import { FiiPosition, PortfolioGoals, QuoteData } from '../types/portfolio';
import { FII_DATABASE } from '../data/fiiDatabase';

export interface WidgetPreviewData {
  equity: number;
  invested: number;
  profit: number;
  profitPct: number;
  monthlyIncome: number;
  incomeGoal: number;
  incomeGoalPct: number;
  yocPct: number;
  nextEvent: string;
  topBargain: string;
  portfolioQuery: string;
}

export function buildWidgetPreviewData(
  positions: FiiPosition[],
  goals: PortfolioGoals,
  quotes: Record<string, QuoteData> = {}
): WidgetPreviewData {
  const activePositions =
    positions.length > 0
      ? positions
      : [
          {
            ticker: 'MXRF11',
            totalShares: 11,
            averagePrice: 9.42,
            currentPrice: 9.55,
            totalInvested: 103.62,
            currentTotal: 105.05,
            monthlyDividendPerShare: 0.1,
            totalMonthlyDividend: 1.1,
            dividendPaymentDay: 15,
            dividendPaymentDate: '15/10/2026',
            isCurrentMonthAnnounced: true,
          } as FiiPosition,
          {
            ticker: 'VGIR11',
            totalShares: 10,
            averagePrice: 9.6,
            currentPrice: 9.72,
            totalInvested: 96.0,
            currentTotal: 97.2,
            monthlyDividendPerShare: 0.11,
            totalMonthlyDividend: 1.1,
            dividendPaymentDay: 18,
            dividendPaymentDate: '18/10/2026',
            isCurrentMonthAnnounced: true,
          } as FiiPosition,
        ];

  const portfolioQuery = activePositions
    .map((p) => `${p.ticker}:${p.totalShares}:${p.averagePrice.toFixed(2)}`)
    .join(',');

  const equity = Number(
    activePositions.reduce((acc, p) => acc + p.currentTotal, 0).toFixed(2)
  );
  const invested = Number(
    activePositions.reduce((acc, p) => acc + p.totalInvested, 0).toFixed(2)
  );
  const profit = Number((equity - invested).toFixed(2));
  const profitPct =
    invested > 0 ? Number(((profit / invested) * 100).toFixed(2)) : 0;
  const monthlyIncome = Number(
    activePositions.reduce((acc, p) => acc + p.totalMonthlyDividend, 0).toFixed(2)
  );
  const incomeGoal = Math.max(1, goals.monthlyIncomeTarget || 10);
  const incomeGoalPct = Math.min(
    100,
    Math.round((monthlyIncome / incomeGoal) * 100)
  );
  const yocPct =
    invested > 0 ? Number(((monthlyIncome / invested) * 100).toFixed(2)) : 0;

  // Próximo evento
  const todayDay = new Date().getDate();
  let nextEvent = 'Aguardando próximos anúncios B3';
  let bestDist = 999;

  for (const p of activePositions) {
    const payDay = p.dividendPaymentDay || 15;
    const dist = payDay >= todayDay ? payDay - todayDay : 30 - todayDay + payDay;
    if (dist < bestDist) {
      bestDist = dist;
      const dateStr = p.dividendPaymentDate
        ? p.dividendPaymentDate.slice(0, 5)
        : `dia ${payDay}`;
      const badge = p.isCurrentMonthAnnounced ? '✓' : 'est.';
      nextEvent = `${p.ticker}: R$ ${p.totalMonthlyDividend
        .toFixed(2)
        .replace('.', ',')} (${dateStr} ${badge})`;
    }
  }

  // Melhor oportunidade do dia no Radar
  let topBargain = 'CPTS11 P/VP 0,91 • Abaixo do Teto';
  let bestScore = -999;
  for (const cat of FII_DATABASE) {
    const q = quotes[cat.ticker];
    const price = q?.price || cat.vp;
    const vp = q?.vp || cat.vp;
    const div =
      q?.lastDividend && q.lastDividend > 0
        ? q.lastDividend
        : cat.estimatedMonthlyDividend;
    const pvp = vp > 0 ? price / vp : 1;
    const dy = price > 0 ? (div / price) * 100 : 0;
    if (pvp <= 0.99 && dy >= 0.8) {
      const score = (1 - pvp) * 100 + dy * 12;
      if (score > bestScore) {
        bestScore = score;
        topBargain = `${cat.ticker} R$ ${price
          .toFixed(2)
          .replace('.', ',')} (P/VP ${pvp.toFixed(2).replace('.', ',')} • DY ${dy
          .toFixed(2)
          .replace('.', ',')}%)`;
      }
    }
  }

  return {
    equity,
    invested,
    profit,
    profitPct,
    monthlyIncome,
    incomeGoal,
    incomeGoalPct,
    yocPct,
    nextEvent,
    topBargain,
    portfolioQuery,
  };
}

/**
 * Gera o script completo para o app gratuito "Scriptable" do iOS,
 * já configurado com a carteira do usuário e com trava inteligente de bateria
 * fora do pregão da B3 (18h às 10h e finais de semana = zero conexões).
 */
export function generateScriptableWidgetCode(
  positions: FiiPosition[],
  goals: PortfolioGoals,
  originUrl?: string
): string {
  const baseOrigin =
    originUrl ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://seu-fii-tracker.vercel.app');

  const preview = buildWidgetPreviewData(positions, goals);
  const apiUrl = `${baseOrigin}/api/widget?p=${encodeURIComponent(
    preview.portfolioQuery
  )}&goal=${encodeURIComponent(String(preview.incomeGoal))}`;

  return `// ============================================================================
// 📱 FII TRACKER — WIDGET INTELIGENTE PARA IPHONE (TELA INICIAL & BLOQUEIO)
// Zero Consumo de Bateria: Congela automaticamente fora do pregão da B3!
// Como usar: Cole este código no app gratuito "Scriptable" no seu iPhone.
// ============================================================================

const APP_URL = "${baseOrigin}";
const WIDGET_API_URL = "${apiUrl}";
const CACHE_FILE = "fii_tracker_widget_cache.json";

// 🔋 Trava Inteligente de Bateria:
// - Seg a Sex (10h às 18h): atualiza a cada 45 min
// - Noite (18h às 10h) e Fim de Semana: dorme até as 10h do próximo pregão!
function getNextB3RefreshDate() {
  const now = new Date();
  const day = now.getDay(); // 0 = Dom, 6 = Sáb
  const hour = now.getHours();

  // Durante o pregão da B3: próxima leitura em 45 minutos
  if (day >= 1 && day <= 5 && hour >= 10 && hour < 18) {
    return new Date(now.getTime() + 45 * 60 * 1000);
  }

  // Fora do pregão: agenda apenas para as 10:05 do próximo dia útil
  const next = new Date(now);
  next.setHours(10, 5, 0, 0);

  if (hour >= 18 || day === 6 || day === 0) {
    let daysToAdd = 1;
    if (day === 5 && hour >= 18) daysToAdd = 3; // Sexta após 18h -> Segunda
    else if (day === 6) daysToAdd = 2;          // Sábado -> Segunda
    else if (day === 0) daysToAdd = 1;          // Domingo -> Segunda
    next.setDate(next.getDate() + daysToAdd);
  }

  return next;
}

async function fetchPortfolioData() {
  const fm = FileManager.local();
  const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);

  try {
    const req = new Request(WIDGET_API_URL);
    req.timeoutInterval = 8;
    const data = await req.loadJSON();
    if (data && typeof data.equity === "number") {
      fm.writeString(cachePath, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    // Sem internet ou no elevador: usa o cache instantâneo sem gastar bateria
  }

  if (fm.fileExists(cachePath)) {
    try {
      return JSON.parse(fm.readString(cachePath));
    } catch (e) {}
  }

  // Fallback inicial com os dados da sua carteira no momento em que gerou o código
  return {
    equity: ${preview.equity},
    invested: ${preview.invested},
    profit: ${preview.profit},
    profitPct: ${preview.profitPct},
    monthlyIncome: ${preview.monthlyIncome},
    incomeGoal: ${preview.incomeGoal},
    incomeGoalPct: ${preview.incomeGoalPct},
    yocPct: ${preview.yocPct},
    nextEvent: "${preview.nextEvent}",
    topBargain: "${preview.topBargain}",
    marketOpen: false,
    updatedAt: "Offline"
  };
}

function brl(val) {
  return "R$ " + Number(val || 0).toFixed(2).replace(".", ",");
}

async function createWidget() {
  const d = await fetchPortfolioData();
  const w = new ListWidget();
  w.url = APP_URL;
  w.refreshAfterDate = getNextB3RefreshDate();

  // Visual Dark Mode idêntico ao FII Tracker (#09090b -> #18181b)
  const bg = new LinearGradient();
  bg.locations = [0, 1];
  bg.colors = [new Color("#09090b"), new Color("#141418")];
  w.backgroundGradient = bg;
  w.setPadding(12, 14, 12, 14);

  const family = config.widgetFamily || "medium";

  // 1. WIDGET DE TELA DE BLOQUEIO DO IPHONE (Retangular)
  if (family === "accessoryRectangular") {
    const t1 = w.addText("📈 FII Tracker • " + brl(d.equity));
    t1.font = Font.boldSystemFont(12);
    const t2 = w.addText("💵 Mês: " + brl(d.monthlyIncome) + " (" + d.incomeGoalPct + "% meta)");
    t2.font = Font.systemFont(11);
    const t3 = w.addText("📅 " + d.nextEvent);
    t3.font = Font.systemFont(10);
    t3.textOpacity = 0.8;
    return w;
  }

  // Cabeçalho
  const header = w.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const title = header.addText("🏢 FII TRACKER");
  title.font = Font.boldSystemFont(10);
  title.textColor = new Color("#10b981");

  header.addSpacer();

  const statusText = d.marketOpen ? "● B3 Aberta" : "🌙 Pregão Fechado";
  const status = header.addText(statusText + " • " + d.updatedAt);
  status.font = Font.mediumSystemFont(9);
  status.textColor = d.marketOpen ? new Color("#34d399") : new Color("#71717a");

  w.addSpacer(6);

  // 2. WIDGET PEQUENO (2x2)
  if (family === "small") {
    const eqLabel = w.addText("Patrimônio B3");
    eqLabel.font = Font.systemFont(10);
    eqLabel.textColor = new Color("#a1a1aa");

    const eqVal = w.addText(brl(d.equity));
    eqVal.font = Font.boldSystemFont(18);
    eqVal.textColor = Color.white();

    const sign = d.profit >= 0 ? "+" : "";
    const prof = w.addText(sign + brl(d.profit) + " (" + sign + d.profitPct + "%)");
    prof.font = Font.semiboldSystemFont(10);
    prof.textColor = d.profit >= 0 ? new Color("#34d399") : new Color("#fb7185");

    w.addSpacer(6);

    const incBox = w.addStack();
    incBox.layoutVertically();
    incBox.backgroundColor = new Color("#18181b");
    incBox.cornerRadius = 8;
    incBox.setPadding(6, 8, 6, 8);

    const incTitle = incBox.addText("💵 Proventos: " + brl(d.monthlyIncome));
    incTitle.font = Font.boldSystemFont(10);
    incTitle.textColor = new Color("#34d399");

    const nextEv = incBox.addText(d.nextEvent);
    nextEv.font = Font.systemFont(9);
    nextEv.textColor = new Color("#d4d4d8");
    nextEv.lineLimit = 1;

    return w;
  }

  // 3. WIDGET MÉDIO / GRANDE (4x2) — Completo com Proventos + Radar de Oportunidades
  const body = w.addStack();
  body.layoutHorizontally();

  // Coluna Esquerda: Patrimônio & Renda Passiva
  const left = body.addStack();
  left.layoutVertically();

  const eqLabel = left.addText("PATRIMÔNIO ATUAL");
  eqLabel.font = Font.boldSystemFont(9);
  eqLabel.textColor = new Color("#71717a");

  const eqVal = left.addText(brl(d.equity));
  eqVal.font = Font.boldSystemFont(20);
  eqVal.textColor = Color.white();

  const sign = d.profit >= 0 ? "+" : "";
  const prof = left.addText(sign + brl(d.profit) + " (" + sign + d.profitPct + "%)");
  prof.font = Font.semiboldSystemFont(10);
  prof.textColor = d.profit >= 0 ? new Color("#34d399") : new Color("#fb7185");

  left.addSpacer(8);

  const incLabel = left.addText("PROVENTOS DO MÊS (YoC " + d.yocPct + "%)");
  incLabel.font = Font.boldSystemFont(9);
  incLabel.textColor = new Color("#71717a");

  const incVal = left.addText(brl(d.monthlyIncome) + " / " + brl(d.incomeGoal));
  incVal.font = Font.boldSystemFont(13);
  incVal.textColor = new Color("#10b981");

  body.addSpacer(12);

  // Coluna Direita: Próximo Pagamento + Oportunidade no Radar da B3
  const right = body.addStack();
  right.layoutVertically();

  const card1 = right.addStack();
  card1.layoutVertically();
  card1.backgroundColor = new Color("#18181b");
  card1.cornerRadius = 8;
  card1.setPadding(6, 8, 6, 8);

  const c1Title = card1.addText("📅 PRÓXIMO PROVENTO");
  c1Title.font = Font.boldSystemFont(8);
  c1Title.textColor = new Color("#a1a1aa");

  const c1Val = card1.addText(d.nextEvent);
  c1Val.font = Font.semiboldSystemFont(10);
  c1Val.textColor = Color.white();
  c1Val.lineLimit = 1;

  right.addSpacer(6);

  const card2 = right.addStack();
  card2.layoutVertically();
  card2.backgroundColor = new Color("#062e22");
  card2.cornerRadius = 8;
  card2.setPadding(6, 8, 6, 8);

  const c2Title = card2.addText("🔥 OPORTUNIDADE NO RADAR B3");
  c2Title.font = Font.boldSystemFont(8);
  c2Title.textColor = new Color("#34d399");

  const c2Val = card2.addText(d.topBargain);
  c2Val.font = Font.semiboldSystemFont(10);
  c2Val.textColor = new Color("#ecfdf5");
  c2Val.lineLimit = 1;

  return w;
}

const widget = await createWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
`;
}

