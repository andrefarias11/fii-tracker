export function normalizeB3Ticker(raw: unknown): string {
  if (!raw) return '';
  const upper = String(raw).toUpperCase().trim();

  // Pega o primeiro token antes de espaço, hífen ou ponto (ex: "BBAS3 - BANCO DO BRASIL" -> "BBAS3")
  const firstToken = upper.split(/[\s\-./]+/)[0] || '';

  // Remove sufixo 'F' de lote fracionário para FIIs e Ações (ex: MXRF11F -> MXRF11, BBAS3F -> BBAS3, ITSA4F -> ITSA4)
  if (/^[A-Z]{4}(?:3|4|5|6|11)F$/.test(firstToken)) {
    return firstToken.slice(0, -1);
  }

  // Busca padrão oficial de ticker na string inteira caso o formato seja "FII MXRF11" ou "ACAO BBAS3F"
  const match = upper.match(/\b([A-Z]{4}(?:3|4|5|6|11)[B]?)F?\b/);
  if (match && match[1]) {
    return match[1];
  }

  return firstToken;
}

