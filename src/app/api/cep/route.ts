import { NextResponse, connection } from 'next/server';
import { STATE_COORDINATES } from '../../../data/fiiProperties';

export interface CepLookupResponse {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  source: 'BRASILAPI_V2' | 'VIACEP_FALLBACK';
}

interface BrasilApiV2Response {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  location?: {
    type?: string;
    coordinates?: {
      longitude?: string | number;
      latitude?: string | number;
    };
  };
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

export async function GET(request: Request) {
  await connection();
  const { searchParams } = new URL(request.url);
  const rawCep = (searchParams.get('cep') || '').replace(/\D/g, '');

  if (rawCep.length !== 8) {
    return NextResponse.json(
      { error: 'Informe um CEP válido com 8 dígitos (ex: 04538-132).' },
      { status: 400 }
    );
  }

  // 1. Consulta Oficial BrasilAPI CEP v2 (inclui geolocalização lat/lng)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${rawCep}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FII-Tracker/4.6',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: BrasilApiV2Response = await res.json();
      const state = (data.state || 'SP').toUpperCase();
      const fallbackCoord = STATE_COORDINATES[state] || STATE_COORDINATES.SP;

      const rawLat = Number(data.location?.coordinates?.latitude);
      const rawLng = Number(data.location?.coordinates?.longitude);

      const lat = !isNaN(rawLat) && rawLat !== 0 ? rawLat : fallbackCoord.lat;
      const lng = !isNaN(rawLng) && rawLng !== 0 ? rawLng : fallbackCoord.lng;

      const formattedCep = `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`;

      const response: CepLookupResponse = {
        cep: formattedCep,
        street: data.street || 'Endereço comercial / logístico',
        neighborhood: data.neighborhood || 'Distrito Industrial / Comercial',
        city: data.city || fallbackCoord.name,
        state,
        lat,
        lng,
        source: 'BRASILAPI_V2',
      };

      return NextResponse.json(response);
    }
  } catch {
    // Continua para o fallback ViaCEP
  }

  // 2. Fallback ViaCEP caso BrasilAPI esteja indisponível
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: ViaCepResponse = await res.json();
      if (!data.erro) {
        const state = (data.uf || 'SP').toUpperCase();
        const fallbackCoord = STATE_COORDINATES[state] || STATE_COORDINATES.SP;
        const formattedCep = `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`;

        const response: CepLookupResponse = {
          cep: formattedCep,
          street: data.logradouro || 'Endereço comercial / logístico',
          neighborhood: data.bairro || 'Centro / Polo Empresarial',
          city: data.localidade || fallbackCoord.name,
          state,
          lat: fallbackCoord.lat,
          lng: fallbackCoord.lng,
          source: 'VIACEP_FALLBACK',
        };

        return NextResponse.json(response);
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json(
    { error: 'Não foi possível localizar o CEP informado na base dos Correios / BrasilAPI.' },
    { status: 404 }
  );
}

