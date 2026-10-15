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

    // Determinar Status Automático (100% sincronizado com comunicados reais da B3 / StatusInvest)
    let status: DividendStatus = 'ESTIMATED';

    if (pos.isCurrentMonthAnnounced) {
      // Comunicado oficial do mês vigente divulgado pela gestora na B3
      let isPaymentDateReached = currentDay >= paymentDay;

      if (pos.dividendPaymentDate && pos.dividendPaymentDate.includes('/')) {
        const parts = pos.dividendPaymentDate.split('/');
        if (parts.length === 3) {
          const pDay = parseInt(parts[0], 10);
          const pMonth = parseInt(parts[1], 10);
          const pYear = parseInt(parts[2], 10);
          if (!isNaN(pDay) && !isNaN(pMonth) && !isNaN(pYear)) {
            if (pYear === currentYear && pMonth === Number(currentMonth)) {
              isPaymentDateReached = currentDay >= pDay;
            } else {
              const payTimestamp = new Date(pYear, pMonth - 1, pDay, 23, 59, 59).getTime();
              isPaymentDateReached = currentDate.getTime() >= payTimestamp;
            }
          }
        }
      }

      if (isPaymentDateReached) {
        status = 'PAID'; // Data oficial de pagamento do mês já chegou ou passou -> Pago na conta
      } else {
        status = 'CONFIRMED'; // Comunicado oficial divulgado aguardando a data de pagamento -> Confirmado
      }
    } else if (pos.dividendSource === 'MANUAL') {
      // Provento definido ou ajustado manualmente pelo investidor
      if (currentDay >= paymentDay) {
        status = 'PAID';
      } else {
        status = 'CONFIRMED';
      }
    } else {
      // Ainda não há comunicado oficial divulgado pela gestora para o mês corrente na B3.
      // OBRIGATORIAMENTE ESTIMATED, mesmo que o calendário típico já tenha passado do dia de anúncio ou pagamento.
      status = 'ESTIMATED';
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
      pos.isCurrentMonthAnnounced && pos.dividendExDate
        ? pos.dividendExDate
        : `${String(schedule.announcementDay).padStart(2, '0')}/${currentMonth}/${currentYear}`;

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

