// Controle central de versão do FII Tracker
// REGRA: Sempre incrementar APP_VERSION a cada nova alteração ou melhoria aplicada no projeto.

export const APP_VERSION = '1.4.0';
export const APP_UPDATED_AT = '10/10/2026';

export interface VersionRelease {
  version: string;
  date: string;
  highlights: string[];
}

export const APP_CHANGELOG: VersionRelease[] = [
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

