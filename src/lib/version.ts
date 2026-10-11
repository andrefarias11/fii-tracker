// Controle central de versão do FII Tracker
// REGRA: Sempre incrementar APP_VERSION a cada nova alteração ou melhoria aplicada no projeto.

export const APP_VERSION = '1.9.0';
export const APP_UPDATED_AT = '10/10/2026';

export interface VersionRelease {
  version: string;
  date: string;
  highlights: string[];
}

export const APP_CHANGELOG: VersionRelease[] = [
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

