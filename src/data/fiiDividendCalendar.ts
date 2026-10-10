import { DividendEvent, MonthProventosSummary, DividendStatus } from '../types/dividend';
import { FiiPosition } from '../types/portfolio';
import { findFiiInfo } from './fiiDatabase';

interface FiiScheduleInfo {
  announcementDay: number; // Dia típico do anúncio
  paymentDay: number; // Dia típico do pagamento
  announcedAmount?: number; // Valor de referência do catálogo
}

export function getFiiSchedule(ticker: string): FiiScheduleInfo {
  const info = findFiiInfo(ticker);
  return {
    announcementDay: info.announcementDay ?? 1,
    paymentDay: info.paymentDay ?? 15,
    announcedAmount: info.estimatedMonthlyDividend,
  };
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
    const catalogItem = findFiiInfo(pos.ticker);

    // Prioriza o dividendo da posição (que já inclui edição manual do usuário ou dado real da API)
    const amountPerShare =
      pos.monthlyDividendPerShare > 0
        ? pos.monthlyDividendPerShare
        : schedule.announcedAmount ?? catalogItem.estimatedMonthlyDividend ?? 0.09;
    const totalValue = Number((pos.totalShares * amountPerShare).toFixed(2));

    // Usar o dia de pagamento real retornado pela API (se for do ciclo atual) ou o dia típico do catálogo
    const paymentDay =
      pos.isCurrentMonthAnnounced && pos.dividendPaymentDay
        ? pos.dividendPaymentDay
        : schedule.paymentDay;

    // Determinar Status Automático (100% sincronizado com comunicado da B3/StatusInvest + calendário)
    let status: DividendStatus = 'ESTIMATED';

    if (currentDay >= paymentDay) {
      status = 'PAID'; // Já chegou ou passou do dia de pagamento -> Pago na conta
    } else if (pos.isCurrentMonthAnnounced || currentDay >= schedule.announcementDay) {
      status = 'CONFIRMED'; // Comunicado oficial do mês já divulgado -> Confirmado a receber
    } else {
      status = 'ESTIMATED'; // Aguardando anúncio oficial da gestora neste mês
    }

    // Respeitar override manual se o usuário tiver alterado o status
    if (customStatusOverrides[pos.ticker]) {
      status = customStatusOverrides[pos.ticker];
    }

    const paymentDateFormatted =
      pos.isCurrentMonthAnnounced && pos.dividendPaymentDate
        ? pos.dividendPaymentDate
        : `${String(paymentDay).padStart(2, '0')}/${currentMonth}/${currentYear}`;

    const announcementDate =
      pos.dividendExDate ||
      `${String(schedule.announcementDay).padStart(2, '0')}/${currentMonth}/${currentYear}`;

    events.push({
      id: `div-${pos.ticker}-${currentYear}-${currentMonth}`,
      ticker: pos.ticker,
      shares: pos.totalShares,
      dividendPerShare: amountPerShare,
      totalValue,
      status,
      paymentDateFormatted,
      paymentDay,
      announcementDate,
      isOfficial: status !== 'ESTIMATED' || Boolean(pos.isCurrentMonthAnnounced),
      dividendSource: pos.dividendSource,
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

