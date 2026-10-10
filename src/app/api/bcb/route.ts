import { NextResponse } from 'next/server';

export interface BcbIndicatorsResponse {
  selicAnnual: number; // ex: 10.75 (% a.a.)
  cdiAnnual: number; // ex: 10.65 (% a.a.)
  cdiNetAnnual: number; // CDI descontando 17,5% de IR médio da Renda Fixa
  cdiNetMonthly: number; // Equivalente mensal líquido do CDI
  ipca12m: number; // IPCA acumulado nos últimos 12 meses (% a.a.)
  ipcaMonthly: number; // IPCA mensal médio equivalente
  updatedAt: string;
  source: 'BCB_OFICIAL' | 'FALLBACK';
}

interface BcbSgsPoint {
  data: string;
  valor: string;
}

let cachedBcb: { data: BcbIndicatorsResponse; timestamp: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

async function fetchSgsSeries(code: number, lastN: number): Promise<BcbSgsPoint[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${lastN}?formato=json`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FII-Tracker/1.6',
    },
    next: { revalidate: 21600 },
  });
  if (!res.ok) {
    throw new Error(`BCB SGS ${code} returned ${res.status}`);
  }
  return res.json();
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
    };

    cachedBcb = { data: responseData, timestamp: Date.now() };
    return NextResponse.json(responseData);
  } catch (err) {
    console.error('Erro ao buscar indicadores do Banco Central:', err);
    const fallback: BcbIndicatorsResponse = {
      selicAnnual: 10.75,
      cdiAnnual: 10.65,
      cdiNetAnnual: 8.79,
      cdiNetMonthly: 0.70,
      ipca12m: 4.42,
      ipcaMonthly: 0.36,
      updatedAt: new Date().toLocaleDateString('pt-BR'),
      source: 'FALLBACK',
    };
    return NextResponse.json(fallback);
  }
}

