// Controle central de versão do FII Tracker
// REGRA: Sempre incrementar APP_VERSION a cada nova alteração ou melhoria aplicada no projeto.

export const APP_VERSION = '2.5.1';
export const APP_UPDATED_AT = '12/10/2026';

export interface VersionRelease {
  version: string;
  date: string;
  highlights: string[];
}

export const APP_CHANGELOG: VersionRelease[] = [
  {
    version: '2.5.1',
    date: '12/10/2026',
    highlights: [
      'Correção de build na Vercel (Next.js 16 Cache Components): elimina leituras diretas de new Date() durante o prerender SSR de Client Components em portfolioEngine.ts, DividendFlow.tsx, PerformanceComparisonChart.tsx e recommendationEngine.ts',
      'Compatibilidade de rota dinâmica em /api/market com connection() do Next.js 16',
    ],
  },
  {
    version: '2.5.0',
    date: '12/10/2026',
    highlights: [
      'Explorador Universal de 100% da B3 (/api/market + UniversalB3Explorer): conecta o app à lista completa de todas as Ações e FIIs negociados na B3 via Brapi + Yahoo Finance Search (.SA)',
      'Raio-X Ao Vivo de Qualquer Ticker da B3: ao tocar em qualquer ativo ou digitar o código na busca, consulta cotação em tempo real, soma os dividendos reais pagos nos últimos 12 meses e calcula automaticamente Preço-Teto de Barsi (6%) e Número Mágico',
    ],
  },
  {
    version: '2.4.0',
    date: '12/10/2026',
    highlights: [
      'Gráfico Interativo da "Escadinha de Dividendos" (Evolução Mês a Mês): mostra o crescimento mensal dos proventos desde o 1º aporte, total acumulado vitalício e detalhamento por ativo em cada barra',
      'Barra de "Payback em Proventos" por Ativo e Global: exibe dentro de cada card (e no topo da Escadinha) quanto do valor investido já retornou ao bolso em dividendos (R$ e % do custo)',
      'Leitura Real de Dividendos via Planilha de "Movimentação" da B3: reconhece automaticamente créditos de Rendimento, Dividendo e JCP (.xlsx/.csv), deduplica contra importações anteriores e sincroniza na nuvem (Supabase)',
    ],
  },
  {
    version: '2.3.0',
    date: '12/10/2026',
    highlights: [
      'Expansão Oficial para Ações de Dividendos da B3 (FIIs + Ações): importa automaticamente Ações ON (3), PN (4/5/6) e Units (11) na mesma planilha da B3, normalizando compras do mercado fracionário (ex: BBAS3F -> BBAS3, ITSA4F -> ITSA4)',
      'Catálogo e Scanner BESST (Luiz Barsi): adiciona 30+ ações pagadoras de dividendos (Bancos, Energia, Saneamento, Seguros, Telecom e Commodities) com cálculo de Preço-Teto de Barsi (mín. 6% a.a.) e VPA',
      'Motor de Proventos 12 Meses para Ações (/api/quote): soma todos os dividendos e JCP pagos nos últimos 12 meses e calcula a Média Mensal Equivalente (Dividendo 12m ÷ 12) para integrar à renda mensal da carteira',
      'Filtro Minimalista na Carteira e no Radar: pílulas seletoras (Todos | FIIs | Ações) sem poluir a interface',
    ],
  },
  {
    version: '2.2.0',
    date: '11/10/2026',
    highlights: [
      'Expansão massiva da base de FIIs e Fiagros da B3: 75+ fundos catalogados no IFIX (fiiDatabase.ts com busca O(1) via Map) e 38+ fundos com tese fundamentalista completa no Radar e Mentores (fiiFundamentals.ts)',
      'Refatoração Arquitetural (Clean Domain): extrai o motor contábil puro para src/domain/portfolioEngine.ts (com normalização automática de Desdobramentos/Splits históricos Base 100 -> Base 10), compartilhado entre Frontend e Backend',
      'Otimização de Banco de Dados (Supabase Batch SQL): substitui loops N+1 por upsertRemoteTransactionsBatch e deleteRemoteTransactionsBatch em transação única',
      'Widget Serverless conectado direto ao Supabase em /api/widget + cache em memória de 30s por ativo em /api/quote',
    ],
  },
  {
    version: '2.1.2',
    date: '11/10/2026',
    highlights: [
      'Documentação completa atualizada no README.md cobrindo Design Minimalista 2.0, Modo 100% Oficial B3, Linha do Tempo de 20 Conquistas (Platina 🏆), Gráfico Diário BCB, Mentores, Widget iPhone e Web Push Anti-Spam',
    ],
  },
  {
    version: '2.1.1',
    date: '11/10/2026',
    highlights: [
      'Detalhamento visual na importação acumulada da B3 (ex: planilha Outubro + Novembro): exibe quais aportes de meses anteriores foram ignorados por já estarem no sistema e marca os novos aportes do mesmo FII como "+ Somar cotas"',
    ],
  },
  {
    version: '2.1.0',
    date: '11/10/2026',
    highlights: [
      'Linha do Tempo de Conquistas (20 Troféus + Sistema de Platina 🏆) com XP, níveis de investidor e datas históricas de desbloqueio calculadas automaticamente',
      'Modo 100% Oficial B3: remove inserção manual de aportes para garantir que todas as conquistas sejam auditadas exclusivamente por planilhas oficiais da B3',
      'Super-Parser B3 2.0 anti-fundo repetido: normaliza códigos com nome do fundo ("MXRF11 - MAXI RENDA"), mercado fracionário ("11F"), ignora ETFs/Units e linhas de proventos, e consolida posições sem duplicar nenhum FII',
    ],
  },
  {
    version: '2.0.4',
    date: '11/10/2026',
    highlights: [
      'Trava tripla anti-spam nas notificações automáticas (runAutoDailyPushCheck): grava bloqueio diário síncrono antes do envio e limita a no máximo 1 notificação automática por dia para nunca disparar vários alertas ao abrir o app',
    ],
  },
  {
    version: '2.0.3',
    date: '11/10/2026',
    highlights: [
      'Remove exportações de segmento dynamic/revalidate incompatíveis com cacheComponents do Next.js 16 em /api/widget/route.ts',
    ],
  },
  {
    version: '2.0.2',
    date: '11/10/2026',
    highlights: [
      'Correção das regras de Hooks e ESLint para garantir deploy limpo em produção (Vercel/Next.js build)',
    ],
  },
  {
    version: '2.0.1',
    date: '11/10/2026',
    highlights: [
      'Correção do Widget do iPhone que ficava travado no horário antigo: adiciona anti-cache (&_t=timestamp), atualização a cada 15 min (inclusive no fim de semana) e sincronização automática entre o app e a API /api/widget',
    ],
  },
  {
    version: '2.0.0',
    date: '11/10/2026',
    highlights: [
      'Novo Design Minimalista 2.0 (inspirado no Nubank e Apple iOS): Dock flutuante translúcida com apenas 4 abas (Início, Proventos, Explorar e Metas), seletores segmentados iOS para dividir cada seção sem poluição visual e ações rápidas integradas no topo',
    ],
  },
  {
    version: '1.9.1',
    date: '11/10/2026',
    highlights: [
      'Gráfico de Linhas ajustado para partir exatamente do 1º dia em que começou a investir, avançando dia após dia em sequência na horizontal até Hoje (atualizado diariamente) e com auto-escala dinâmica no eixo Y',
    ],
  },
  {
    version: '1.9.0',
    date: '10/10/2026',
    highlights: [
      'Gerador de Widget para Tela Inicial e Tela de Bloqueio do iPhone (/api/widget + Scriptable) com prévia ao vivo, cache offline e trava inteligente de bateria fora do pregão da B3 (18h às 10h e fins de semana)',
    ],
  },
  {
    version: '1.8.0',
    date: '10/10/2026',
    highlights: [
      'Novas notificações inteligentes de Oportunidades na B3 (mesmo após bater a meta), Data-Com confirmada, Consenso dos Mentores e Radar de Alertas ao vivo nas Configurações',
    ],
  },
  {
    version: '1.7.3',
    date: '10/10/2026',
    highlights: [
      'Gráfico de Linhas com Valor de Referência selecionável (Minha Carteira, R$ 1 mil, R$ 10 mil), marcadores de escala no eixo Y, etiquetas de % nas pontas e espaçamento ampliado entre as 4 linhas',
    ],
  },
  {
    version: '1.7.2',
    date: '10/10/2026',
    highlights: [
      'Gráfico de Linhas ajustado para exibir exclusivamente o histórico real desde a data do 1º aporte até Hoje (sem projeção futura), comparando Carteira FII vs CDI Líquido vs Poupança vs IPCA',
    ],
  },
  {
    version: '1.7.1',
    date: '10/10/2026',
    highlights: [
      'Mantém a aba Carteira enxuta e deixa o Gráfico de Linhas Comparativo (FII vs CDI vs Poupança vs IPCA) exclusivo na aba Proventos',
    ],
  },
  {
    version: '1.7.0',
    date: '10/10/2026',
    highlights: [
      'Novo Gráfico de Linhas Interativo (6M, 12M e 24M) comparando o desempenho da Sua Carteira FII contra CDI Líquido, Poupança e Inflação (IPCA) mês a mês',
      'Substituição do gráfico de barras pela curva comparativa multi-linhas colorida com toque interativo por mês',
    ],
  },
  {
    version: '1.6.0',
    date: '10/10/2026',
    highlights: [
      'Integração com API Oficial do Banco Central (Selic, CDI Líquido e IPCA 12m ao vivo + cálculo de Ganho Real acima da inflação)',
      'Integração Web Push API (APNs iPhone / PWA) com Service Worker, chaves VAPID e teste para Tela de Bloqueio em 5s',
    ],
  },
  {
    version: '1.5.0',
    date: '10/10/2026',
    highlights: [
      'Nova aba "Mentores": Indicações dinâmicas usando as estratégias de Luiz Barsi, Warren Buffett, Benjamin Graham e Prof. Baroni com dados ao vivo da B3',
      'Painel "Consenso Hoje" destacando FIIs aprovados simultaneamente por múltiplos grandes investidores',
    ],
  },
  {
    version: '1.4.0',
    date: '10/10/2026',
    highlights: [
      'Simulador conectado ao patrimônio real com estimativa de tempo para R$ 5 mil, R$ 10 mil e R$ 50 mil',
      'Detector anti-duplicidade na importação B3 e suporte a Venda de Cotas (mantendo Preço Médio fiscal)',
      'Botões rápidos de cálculo de cotas no Novo Aporte, filtro Data-Com Próxima no Radar e Extrato agrupado por mês',
    ],
  },
  {
    version: '1.3.0',
    date: '10/10/2026',
    highlights: [
      'Sincronizador automático de proventos B3 / StatusInvest / Yahoo (valor anunciado, Data-Com, Data de Pagamento e status automático)',
      'Indicador de versão visível no topo e painel de versão/atualização nas Configurações',
    ],
  },
  {
    version: '1.2.0',
    date: '10/10/2026',
    highlights: [
      'Redesign clean com cards expansíveis (Progressive Disclosure) e Modo Privacidade (Olhinho)',
      'Barra de meta mensal integrada ao resumo da carteira e exclusão sem popups nativos',
    ],
  },
  {
    version: '1.1.0',
    date: '10/10/2026',
    highlights: [
      'Indicadores P/VP, Yield on Cost (YoC), Preço Teto e edição de aportes no histórico',
      'Barra de diversificação por setor e modos Rebalancear vs. Bola de Neve no Radar',
    ],
  },
];

