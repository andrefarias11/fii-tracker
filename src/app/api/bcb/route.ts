import { NextResponse } from 'next/server';
import type { FocusYearlyProjection } from '../../../types/portfolio';

export interface BcbIndicatorsResponse {
  selicAnnual: number; // ex: 10.75 (% a.a.)
  cdiAnnual: number; // ex: 10.65 (% a.a.)
  cdiNetAnnual: number; // CDI descontando 17,5% de IR médio da Renda Fixa
  cdiNetMonthly: number; // Equivalente mensal líquido do CDI
  ipca12m: number; // IPCA acumulado nos últimos 12 meses (% a.a.)
  ipcaMonthly: number; // IPCA mensal médio equivalente
  updatedAt: string;
  source: 'BCB_OFICIAL' | 'FALLBACK';
  focusReportDate?: string;
  focusProjections?: FocusYearlyProjection[];
}

interface BcbSgsPoint {
  data: string;
  valor: string;
}

interface OlindaExpectativaItem {
  Indicador?: string;
  Data?: string;
  DataReferencia?: string;
  Mediana?: number;
}

interface OlindaExpectativaResponse {
  value?: OlindaExpectativaItem[];
}

let cachedBcb: { data: BcbIndicatorsResponse; timestamp: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

async function fetchSgsSeries(code: number, lastN: number): Promise<BcbSgsPoint[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${lastN}?formato=json`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FII-Tracker/4.7',
    },
    signal: controller.signal,
    next: { revalidate: 21600 },
  });
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`BCB SGS ${code} returned ${res.status}`);
  }
  return res.json();
}

function calculateRealRate(nominalAnnual: number, inflationAnnual: number): number {
  const real = ((1 + nominalAnnual / 100) / (1 + inflationAnnual / 100) - 1) * 100;
  return Number(real.toFixed(2));
}

function buildFallbackFocusProjections(
  baseSelic: number,
  baseIpca: number
): FocusYearlyProjection[] {
  const currentYear = new Date().getFullYear();
  const y1Selic = Number(Math.max(8.5, baseSelic - 0.75).toFixed(2));
  const y2Selic = Number(Math.max(8.0, baseSelic - 1.5).toFixed(2));
  const y3Selic = Number(Math.max(7.5, baseSelic - 2.0).toFixed(2));

  const y1Ipca = Number(Math.max(3.5, baseIpca - 0.35).toFixed(2));
  const y2Ipca = Number(Math.max(3.3, baseIpca - 0.6).toFixed(2));
  const y3Ipca = Number(Math.max(3.1, baseIpca - 0.8).toFixed(2));

  return [
    {
      year: currentYear + 1,
      selicMedian: y1Selic,
      ipcaMedian: y1Ipca,
      realRateAnnual: calculateRealRate(y1Selic, y1Ipca),
    },
    {
      year: currentYear + 2,
      selicMedian: y2Selic,
      ipcaMedian: y2Ipca,
      realRateAnnual: calculateRealRate(y2Selic, y2Ipca),
    },
    {
      year: currentYear + 3,
      selicMedian: y3Selic,
      ipcaMedian: y3Ipca,
      realRateAnnual: calculateRealRate(y3Selic, y3Ipca),
    },
  ];
}

async function fetchOlindaFocusExpectations(
  fallbackSelic: number,
  fallbackIpca: number
): Promise<{ reportDate: string; projections: FocusYearlyProjection[] }> {
  const currentYear = new Date().getFullYear();
  const targetYears = [currentYear + 1, currentYear + 2, currentYear + 3];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const url =
      "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=(Indicador%20eq%20'Selic'%20or%20Indicador%20eq%20'IPCA')&$orderby=Data%20desc&$top=60&$format=json";

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FII-Tracker/4.7',
      },
      signal: controller.signal,
      next: { revalidate: 21600 },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: OlindaExpectativaResponse = await res.json();
      const items = data?.value || [];

      if (items.length > 0) {
        const latestDate = items[0]?.Data
          ? new Date(items[0].Data).toLocaleDateString('pt-BR')
          : new Date().toLocaleDateString('pt-BR');

        const selicByYear = new Map<number, number>();
        const ipcaByYear = new Map<number, number>();

        for (const item of items) {
          const refYear = Number(item.DataReferencia);
          const median = Number(item.Mediana);
          if (!targetYears.includes(refYear) || isNaN(median) || median <= 0) continue;

          if (item.Indicador === 'Selic' && !selicByYear.has(refYear)) {
            selicByYear.set(refYear, Number(median.toFixed(2)));
          } else if (item.Indicador === 'IPCA' && !ipcaByYear.has(refYear)) {
            ipcaByYear.set(refYear, Number(median.toFixed(2)));
          }
        }

        const fallbackList = buildFallbackFocusProjections(fallbackSelic, fallbackIpca);
        const projections: FocusYearlyProjection[] = targetYears.map((yr, idx) => {
          const selicMedian = selicByYear.get(yr) ?? fallbackList[idx].selicMedian;
          const ipcaMedian = ipcaByYear.get(yr) ?? fallbackList[idx].ipcaMedian;
          return {
            year: yr,
            selicMedian,
            ipcaMedian,
            realRateAnnual: calculateRealRate(selicMedian, ipcaMedian),
          };
        });

        return {
          reportDate: latestDate,
          projections,
        };
      }
    }
  } catch {
    // Continua para o fallback determinístico caso Olinda esteja indisponível
  }

  return {
    reportDate: new Date().toLocaleDateString('pt-BR'),
    projections: buildFallbackFocusProjections(fallbackSelic, fallbackIpca),
  };
}

export async function GET() {
  if (cachedBcb && Date.now() - cachedBcb.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedBcb.data);
  }

  try {
    const [selicSeries, cdiSeries, ipcaSeries] = await Promise.allSettled([
      fetchSgsSeries(432, 1), // Meta Selic (% a.a.)
      fetchSgsSeries(4389, 1), // Taxa CDI (% a.a.)
      fetchSgsSeries(433, 12), // IPCA mensal últimos 12 meses (%)
    ]);

    let selicAnnual = 10.75;
    let updatedAt = new Date().toLocaleDateString('pt-BR');

    if (selicSeries.status === 'fulfilled' && selicSeries.value.length > 0) {
      const last = selicSeries.value[selicSeries.value.length - 1];
      const parsed = parseFloat(String(last.valor).replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) {
        selicAnnual = Number(parsed.toFixed(2));
        updatedAt = last.data || updatedAt;
      }
    }

    let cdiAnnual = Number(Math.max(0, selicAnnual - 0.1).toFixed(2));
    if (cdiSeries.status === 'fulfilled' && cdiSeries.value.length > 0) {
      const last = cdiSeries.value[cdiSeries.value.length - 1];
      const parsed = parseFloat(String(last.valor).replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) {
        cdiAnnual = Number(parsed.toFixed(2));
      }
    }

    let ipca12m = 4.42;
    if (ipcaSeries.status === 'fulfilled' && ipcaSeries.value.length > 0) {
      const factor = ipcaSeries.value.reduce((acc, pt) => {
        const m = parseFloat(String(pt.valor).replace(',', '.'));
        return isNaN(m) ? acc : acc * (1 + m / 100);
      }, 1);
      const accumulated = (factor - 1) * 100;
      if (accumulated > 0 && accumulated < 40) {
        ipca12m = Number(accumulated.toFixed(2));
      }
    }

    // Consulta o Boletim Focus na API Olinda do Banco Central
    const focusData = await fetchOlindaFocusExpectations(selicAnnual, ipca12m);

    // Renda Fixa tributada (alíquota média 17,5% de IR) vs FII (100% Isento de IR)
    const cdiNetAnnual = Number((cdiAnnual * 0.825).toFixed(2));
    const cdiNetMonthly = Number(
      ((Math.pow(1 + cdiNetAnnual / 100, 1 / 12) - 1) * 100).toFixed(2)
    );
    const ipcaMonthly = Number(
      ((Math.pow(1 + ipca12m / 100, 1 / 12) - 1) * 100).toFixed(2)
    );

    const responseData: BcbIndicatorsResponse = {
      selicAnnual,
      cdiAnnual,
      cdiNetAnnual,
      cdiNetMonthly,
      ipca12m,
      ipcaMonthly,
      updatedAt,
      source:
        selicSeries.status === 'fulfilled' || ipcaSeries.status === 'fulfilled'
          ? 'BCB_OFICIAL'
          : 'FALLBACK',
      focusReportDate: focusData.reportDate,
      focusProjections: focusData.projections,
    };

    cachedBcb = { data: responseData, timestamp: Date.now() };
    return NextResponse.json(responseData);
  } catch (err) {
    console.error('Erro ao buscar indicadores do Banco Central:', err);
    const fallback: BcbIndicatorsResponse = {
      selicAnnual: 10.75,
      cdiAnnual: 10.65,
      cdiNetAnnual: 8.79,
      cdiNetMonthly: 0.7,
      ipca12m: 4.42,
      ipcaMonthly: 0.36,
      updatedAt: new Date().toLocaleDateString('pt-BR'),
      source: 'FALLBACK',
      focusReportDate: new Date().toLocaleDateString('pt-BR'),
      focusProjections: buildFallbackFocusProjections(10.75, 4.42),
    };
    return NextResponse.json(fallback);
  }
}
