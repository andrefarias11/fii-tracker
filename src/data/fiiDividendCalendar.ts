import { DividendEvent, MonthProventosSummary, DividendStatus } from '../types/dividend';
import { FiiPosition } from '../types/portfolio';
import { FII_DATABASE } from './fiiDatabase';

interface FiiScheduleInfo {
  announcementDay: number; // Dia típico do anúncio
  paymentDay: number; // Dia típico do pagamento
  announcedAmount?: number; // Valor oficial divulgado recentemente
}

const SCHEDULE_MAP: Record<string, FiiScheduleInfo> = {
  MXRF11: { announcementDay: 1, paymentDay: 15, announcedAmount: 0.09 },
  VGIR11: { announcementDay: 1, paymentDay: 14, announcedAmount: 0.10 },
  CPTS11: { announcementDay: 1, paymentDay: 15, announcedAmount: 0.07 },
  KISU11: { announcementDay: 1, paymentDay: 14, announcedAmount: 0.075 },
  GALG11: { announcementDay: 7, paymentDay: 14, announcedAmount: 0.084 },
  SNAG11: { announcementDay: 1, paymentDay: 15, announcedAmount: 0.105 },
  VGIA11: { announcementDay: 1, paymentDay: 15, announcedAmount: 0.11 },
  XPML11: { announcementDay: 15, paymentDay: 25, announcedAmount: 0.92 },
  HGLG11: { announcementDay: 1, paymentDay: 15, announcedAmount: 1.10 },
  BTLG11: { announcementDay: 15, paymentDay: 25, announcedAmount: 0.78 },
  KNCR11: { announcementDay: 1, paymentDay: 14, announcedAmount: 1.05 },
  TRXF11: { announcementDay: 1, paymentDay: 15, announcedAmount: 0.93 },
  VISC11: { announcementDay: 15, paymentDay: 24, announcedAmount: 1.00 },
};

export function getFiiSchedule(ticker: string): FiiScheduleInfo {
  const clean = ticker.toUpperCase().trim();
  return SCHEDULE_MAP[clean] || { announcementDay: 5, paymentDay: 15 };
}

// Calcular os eventos de proventos do mês corrente para a carteira do usuário
export function calculateMonthDividends(
  positions: FiiPosition[],
  currentDate = new Date(),
  customStatusOverrides: Record<string, DividendStatus> = {}
): {
  events: DividendEvent[];
  summary: MonthProventosSummary;
} {
  const currentDay = currentDate.getDate();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentYear = currentDate.getFullYear();

  const events: DividendEvent[] = [];

  for (const pos of positions) {
    if (pos.totalShares <= 0) continue;

    const schedule = getFiiSchedule(pos.ticker);
    const catalogItem = FII_DATABASE.find((f) => f.ticker === pos.ticker);

    // Se a gestora já divulgou o valor oficial ou se usa o dividendo configurado
    const isOfficialAnnounced = Boolean(schedule.announcedAmount);
    const amountPerShare = schedule.announcedAmount ?? pos.monthlyDividendPerShare ?? catalogItem?.estimatedMonthlyDividend ?? 0.09;
    const totalValue = Number((pos.totalShares * amountPerShare).toFixed(2));

    // Determinar Status Automático
    let status: DividendStatus = 'ESTIMATED';

    if (currentDay >= schedule.paymentDay) {
      status = 'PAID'; // Já passou do dia de pagamento -> Já caiu na conta da XP
    } else if (currentDay >= schedule.announcementDay || isOfficialAnnounced) {
      status = 'CONFIRMED'; // Já foi anunciado pela gestora -> Aguardando a data de pagamento
    } else {
      status = 'ESTIMATED'; // Ainda no início do mês -> Estimativa histórica
    }

    // Respeitar override manual se o usuário tiver alterado o status
    if (customStatusOverrides[pos.ticker]) {
      status = customStatusOverrides[pos.ticker];
    }

    const paymentDateFormatted = `${String(schedule.paymentDay).padStart(2, '0')}/${currentMonth}/${currentYear}`;
    const announcementDate = `${String(schedule.announcementDay).padStart(2, '0')}/${currentMonth}/${currentYear}`;

    events.push({
      id: `div-${pos.ticker}-${currentYear}-${currentMonth}`,
      ticker: pos.ticker,
      shares: pos.totalShares,
      dividendPerShare: amountPerShare,
      totalValue,
      status,
      paymentDateFormatted,
      paymentDay: schedule.paymentDay,
      announcementDate,
      isOfficial: isOfficialAnnounced,
    });
  }

  // Ordenar por dia de pagamento (os mais próximos primeiro)
  events.sort((a, b) => a.paymentDay - b.paymentDay);

  // Calcular métricas agregadas
  const totalReceived = Number(
    events.filter((e) => e.status === 'PAID').reduce((acc, e) => acc + e.totalValue, 0).toFixed(2)
  );
  const totalConfirmed = Number(
    events.filter((e) => e.status === 'CONFIRMED').reduce((acc, e) => acc + e.totalValue, 0).toFixed(2)
  );
  const totalEstimated = Number(
    events.filter((e) => e.status === 'ESTIMATED').reduce((acc, e) => acc + e.totalValue, 0).toFixed(2)
  );
  const totalExpected = Number((totalReceived + totalConfirmed + totalEstimated).toFixed(2));

  const receivedCount = events.filter((e) => e.status === 'PAID').length;
  const confirmedCount = events.filter((e) => e.status === 'CONFIRMED').length;
  const estimatedCount = events.filter((e) => e.status === 'ESTIMATED').length;

  return {
    events,
    summary: {
      totalExpected,
      totalReceived,
      totalConfirmed,
      totalEstimated,
      receivedCount,
      confirmedCount,
      estimatedCount,
    },
  };
}
