// Units de Ações que terminam em 11 (ex: Taesa, Santander, Klabin, Sanepar, Alupar, Energisa, BTG, Iguatemi)
export const STOCK_UNIT_11_TICKERS = new Set([
  'TAEE11',
  'SANB11',
  'KLBN11',
  'BPAC11',
  'ENGI11',
  'ALUP11',
  'SAPR11',
  'IGTI11',
  'STBP11',
  'AESB11',
  'MODL11',
  'RNEW11',
  'BRBI11',
]);

/**
 * Valida se uma string já normalizada representa um ticker válido da B3
 * (suporta prefixos alfanuméricos como B3SA3 e sufixos como 3, 4, 5, 6, 11, 11B).
 */
export function isValidB3Ticker(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z][A-Z0-9]{3}\d{1,2}B?$/.test(value);
}

export function normalizeB3Ticker(raw: unknown): string {
  if (!raw) return '';
  const upper = String(raw).toUpperCase().trim();

  // Pega o primeiro token antes de espaço, hífen, barra ou ponto (ex: "BBAS3 - BANCO DO BRASIL" -> "BBAS3")
  const firstToken = upper.split(/[\s\-./]+/)[0] || '';

  // Remove sufixo 'F' de lote fracionário para FIIs e Ações (ex: MXRF11F -> MXRF11, B3SA3F -> B3SA3, SHPH11BF -> SHPH11B)
  if (/^[A-Z][A-Z0-9]{3}(?:3|4|5|6|11B?)F$/.test(firstToken)) {
    return firstToken.slice(0, -1);
  }

  if (isValidB3Ticker(firstToken)) {
    return firstToken;
  }

  // Busca padrão oficial de ticker na string inteira caso o formato seja "FII MXRF11" ou "ACAO B3SA3F"
  const match = upper.match(/\b([A-Z][A-Z0-9]{3}(?:3|4|5|6|11)[B]?)F?\b/);
  if (match && match[1]) {
    return match[1];
  }

  return firstToken;
}
