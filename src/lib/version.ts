// Controle central de versão do FII Tracker
// REGRA: Sempre incrementar APP_VERSION a cada nova alteração ou melhoria aplicada no projeto.

export const APP_VERSION = '4.3.0';
export const APP_UPDATED_AT = '15/10/2026';

export interface VersionRelease {
  version: string;
  date: string;
  highlights: string[];
}

export const APP_CHANGELOG: VersionRelease[] = [
  {
    version: '4.3.0',
    date: '15/10/2026',
    highlights: [
      'Login com Conta Google Oficial (OAuth via Supabase): suporte nativo a autenticação com Google (prompt: select_account e acesso offline) permitindo cadastrar e alternar múltiplas contas Google no mesmo aparelho',
      'Seletor de Múltiplas Contas Estilo Instagram (AccountSwitcherModal.tsx): alternância instantânea entre contas salvas em 1 toque, suporte a foto oficial de perfil do Google (avatarUrl) com fallback elegante em Amarelo Ouro (#f5b800)',
      'Cofre Local de Contas (authManager.ts): gerenciamento persistente de sessões (fii_tracker_saved_accounts_v1) com salvamento automático nos eventos de autenticação e suporte a adicionar/remover contas',
      'Header com Foto Real do Usuário (Header.tsx): botão de perfil circular destacando a foto do Google com fallback para iniciais e gatilho direto para o alternador de contas',
    ],
  },
  {
    version: '4.2.1',
    date: '15/10/2026',
    highlights: [
      'Documentação Oficial Completa (README.md): atualização abrangente cobrindo o Redesign XP Investimentos Dark, nova regra de sincronização 100% oficial de proventos B3/StatusInvest, Patrimônio Unificado com Caixinhas e comandos de desenvolvimento',
    ],
  },
  {
    version: '4.2.0',
    date: '15/10/2026',
    highlights: [
      'Simplificação Visual da Carteira (page.tsx): remoção do card "Distribuição por Setor" na tela Inicial, conectando o seletor segmentado diretamente à lista Meus Ativos no padrão XP Investimentos Dark',
    ],
  },
  {
    version: '4.1.1',
    date: '15/10/2026',
    highlights: [
      'Compatibilidade Multi-Plataforma Linux/Vercel Serverless (/api/quote): detecção dinâmica do executável curl (curl.exe no Windows e /usr/bin/curl / PATH no Linux da Vercel)',
      'Fallback Oficial Brapi com dividends=true: suporte nativo a proventos oficiais da B3 via API da Brapi (caso configurado BRAPI_TOKEN) como camada intermediária entre StatusInvest e Yahoo Finance',
    ],
  },
  {
    version: '4.1.0',
    date: '15/10/2026',
    highlights: [
      'Sincronização 100% Fiel de Proventos Reais B3 / StatusInvest: eliminação da confirmação artificial por dia do calendário fixo em fiiDividendCalendar.ts (status "CONFIRMED" ou "PAID" agora exige comprovação de anúncio real do ciclo atual ou inserção manual)',
      'Consulta Ao Vivo de Comunicados Oficiais (/api/quote): integração com a rota JSON pública do StatusInvest (assetEarningsModels) com validação estrita de Data-Com (ed) e Data de Pagamento (pd) no mês/ano vigente (America/Sao_Paulo)',
      'Status Estimado Confiável: fundos ou ações sem comunicado oficial divulgado para o mês corrente permanecem estritamente como "ESTIMATED" (Previsto), utilizando o provento pago anterior apenas como base de cálculo sem antecipar confirmação indevida',
      'Blindagem de Fallback com Detecção de Ciclo: remoção da janela deslizante arbitrária de 32 dias no Yahoo Finance, validando o ciclo com precisão contra falsos positivos e suporte a fallback de conexão TLS no servidor',
    ],
  },
  {
    version: '4.0.0',
    date: '14/10/2026',
    highlights: [
      'Redesign XP Investimentos iOS (Parte 2): reconstrução visual da tela "Evolução e Rentabilidade patrimonial" e simplificação da tela Carteira',
      'Gráfico de Barras Fino Estilo XP (DividendStaircaseChart.tsx): gráfico de 12 colunas ("J F M A M J J A S O N D") com pílulas verticais w-2.5, meses futuros em cinza-escuro h-5 e meses com valor em degradê prateado ou amarelo ouro quando selecionado; seletor discreto "No ano (YYYY) ⌄" e tabela corrida "Detalhes da evolução" direta no fundo #0b0b0d sem card delimitador',
      'Rentabilidade vs CDI no Padrão XP (PerformanceComparisonChart.tsx): curva interativa suavizada com seletor de base em Amarelo Ouro e substituição dos blocos inferiores por duas tabelas corridas idênticas à XP (Comparativo acumulado e Detalhes da evolução com Variação em % do CDI e indicadores BCB)',
      'Simplificação da Carteira e Proventos (page.tsx & DividendFlow.tsx): remoção de excesso de blocos na tela Início deixando o resumo solto no topo + barra de alocação + Meus Ativos; atalho para a Retrospectiva B3 via botão Sparkles circular no Header; segmented controls em estilo XP dark (Calendário, Evolução, vs CDI)',
    ],
  },
  {
    version: '3.2.0',
    date: '14/10/2026',
    highlights: [
      'Redesign XP Investimentos iOS (Parte 1): migração visual completa para o Design System da XP Dark com fundo global #0b0b0d, superfícies de cards em #1c1c1e rounded-[20px] e destaques em Amarelo Ouro (#f5b800 e secundário #2b2512)',
      'PortfolioSummary 100% Solto no Topo: remoção de contêiner delimitador com renderização solta sobre o fundo em 7 linhas limpas (Total Bolsa, Patrimônio em destaque text-[32px], Resultado total com indicadores ▲/▼, Proventos no mês com YoC, divisória sutil, Valor aplicado e botões de ação Importar B3 e Caixinha/Meta)',
      'PositionList no Modelo "Meus Ativos" XP: cabeçalho com contagem de ativos e botão funcional "Ordenar ↓↑" em #f5b800 com alternância cíclica entre Posição, Resultado e Proventos; cards individuais com ícone de gráfico em caixa contornada branca, tabela Key-Value de 6 linhas e botões pílula ("Detalhes" expansíveis com P/VP, Teto, Número Mágico e Payback, e "Aportar" integrado ao modal de compras)',
      'Header Estilo XP: título dinâmico da aba ativa à esquerda (Carteira, Proventos, Explorar, Rentabilidade) e botões de ação circulares w-10 h-10 em bg-[#1c1c1e] text-zinc-200',
    ],
  },
  {
    version: '3.1.0',
    date: '14/10/2026',
    highlights: [
      'Redesign Estrutural para iPhone 17 (v3.1.0): resolução de sobreposições visuais, quebras de linha em botões e listas isoladas identificadas em testes em tela real (393px-402px)',
      'Performance vs CDI (PerformanceComparisonChart.tsx): seletor de valor de referência reestruturado em Segmented Control de largura total (grid grid-cols-3) com whitespace-nowrap; eixo X do gráfico SVG otimizado com exatamente 3 pontos espaçados (Início, Meio, Hoje) eliminando sobreposição da data final; rodapé simplificado e substituição da grade 2x2 por lista compacta vertical unificada (divide-y)',
      'Calendário e Proventos (DividendFlow.tsx): hero card simplificado com 3 colunas limpas em divide-x sem caixas individuais; agrupamento de todos os eventos de proventos em lista contínua em container único (divide-y) estilo Apple Wallet; remoção do badge redundante "Toque p/ status"',
      'Busca B3 Desaninhada (UniversalB3Explorer.tsx): barra de pesquisa posicionada diretamente no topo sem contêineres aninhados; filtros com rolagem horizontal e whitespace-nowrap; lista contínua de ativos em contêiner único (divide-y) com px-4 py-3.5',
      'Resumo da Carteira & Retrospectiva (PortfolioSummary.tsx & monthlyWrapped.ts): botões de ação enxutos ("Importar B3" e "+ Caixinha / RF"); remoção do badge "Ao vivo" e simplificação do resumo da retrospectiva; cálculo de crescimento da Bola de Neve corrigido para evitar distorções percentuais astronômicas; rodapé do Banco Central convertido em barra horizontal minimalista de 1 linha',
      'Controles e Listas Otimizados (page.tsx & PositionList.tsx): nome da aba padronizado para "Busca B3"; inclusão de whitespace-nowrap e truncate em todos os segmented controls das abas e sub-abas; blindagem contra quebra de linha em tags, badges, P/VP e valores monetários nas posições',
    ],
  },
  {
    version: '3.0.0',
    date: '14/10/2026',
    highlights: [
      'Design System 3.0 (Apple Wallet, Linear e Nubank Ultravioleta): unificação absoluta de 100% das superfícies e bordas de cards e modais, padronizados em rounded-[24px] bg-[#121215] border border-white/[0.06] p-5 com inputs elegantes em bg-white/[0.03] border border-white/[0.08]',
      'Eliminação do "AI Dashboard look" e "Sopa de Neon": remoção completa de gradientes coloridos decorativos, círculos blur-3xl difusos e sombras artificiais em todos os módulos',
      'Desaninhamento de Superfícies ("Fim das Caixas dentro de Caixas"): substituição de contêineres aninhados com bordas múltiplas por superfícies planas sutis (bg-white/[0.025] rounded-2xl p-3.5) e separadores horizontais limpos (border-t border-white/[0.05])',
      'Padronização Institucional de Ícones e Cores Semânticas: cabeçalhos de seções unificados no container neutro w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300; uso estrito de emerald-400/500 apenas para proventos/ganho/CTA principal, rose-400/500 para queda/venda e tons de zinc para hierarquia tipográfica',
      'Limpeza de Controles e Tipografia Financeira: remoção de emojis em botões de filtro, chips, opções e status (substituídos por ícones Lucide contextuais como CheckCircle2), elevação de fontes de apoio para no mínimo 11px e aplicação universal de tabular-nums em todos os valores monetários, cotas e percentuais',
    ],
  },
  {
    version: '2.9.0',
    date: '14/10/2026',
    highlights: [
      'Ergonomia e Responsividade Nativa para iPhone 17 (Safari e PWA Standalone): prevenção de auto-zoom indesejado em formulários iOS fixando fontes de <input> e <select> em 16px (text-base sm:text-sm / sm:text-xs) com teclados virtuais otimizados (inputMode="decimal" para dinheiro e inputMode="numeric" para cotas)',
      'Bottom Sheets Nativos no iPhone: padronização de todos os modais (Transações, Renda Fixa, Configurações, Importação B3 e Retrospectiva) com abertura inferior flex items-end sm:items-center, altura dinâmica max-h-[88dvh] e cantos arredondados rounded-t-[28px] sm:rounded-[28px]',
      'Safe Area & Home Indicator (.pb-safe-modal e .bottom-safe-dock): classes utilitárias no globals.css com padding dinâmico via env(safe-area-inset-bottom), garantindo que botões de ação e a dock flutuante inferior nunca fiquem encobertos pela barra do iPhone',
      'Anti-Overflow Horizontal (393px–402px): remoção de larguras fixas rígidas substituídas por flex-1 min-w-0 truncate em PositionList e UniversalB3Explorer, grid adaptativa de filtros em AchievementsTimeline e espaçamentos otimizados em PortfolioSummary e DividendFlow',
    ],
  },
  {
    version: '2.8.0',
    date: '14/10/2026',
    highlights: [
      'Correção do Bug de Split (portfolioEngine.ts): normalização de desdobramento restrita exclusivamente aos tickers mapeados em HISTORICAL_SPLIT_FACTORS com cotação pré-split (eliminando splits indevidos em FIIs genéricos fora do catálogo)',
      'Distinção Rigorosa de Proventos Reais vs Estimados (portfolioEngine.ts): eliminação de dividendos mensais fictícios para Ações (assetClass === "ACAO") em meses passados sem registro de evento DIVIDEND e flag isOfficialB3 estrita para proventos 100% oficiais B3',
      'Evolução do Schema Supabase (schema.sql & supabase.ts): coluna nativa type (BUY, SELL, DIVIDEND) na tabela transactions e criação da tabela fixed_income_assets com políticas de RLS e suporte a maturity_date',
      'Segurança Aprimorada de Web Push (api/push): remoção da chave privada hardcoded, exigindo VAPID_PRIVATE_KEY via variável de ambiente com retorno HTTP 500 no servidor caso não configurada',
    ],
  },
  {
    version: '2.7.1',
    date: '13/10/2026',
    highlights: [
      'Sugestão de "Troco do Aporte" na Caixinha (OpportunityRadar.tsx + recommendationEngine.ts): ao calcular a cesta de compras do mês (ex: R$ 200 de meta), o saldo que sobra (ex: R$ 11,00) agora é destacado em um card inteligente: "Sobrou R$ 11,00? Guarde na Caixinha Nubank (100% CDI) rendendo juros diários até juntar com o aporte do próximo mês!"',
      'Atalho Direto para a Caixinha: botão "Guardar na Caixinha agora →" integrado diretamente ao modal de Renda Fixa e Caixinhas para registro em 1 toque.',
    ],
  },
  {
    version: '2.7.0',
    date: '13/10/2026',
    highlights: [
      'Patrimônio Unificado & Renda Fixa (Caixinhas Nubank, CDBs e Tesouro Direto): suporte completo para acompanhar reservas de emergência e renda fixa junto aos FIIs e Ações da B3',
      'Modal de Cadastro Rápido com Presets de 1 Toque (AddFixedIncomeModal.tsx): Caixinha Nubank (100% CDI), CDB Liquidez Diária (102% CDI), Tesouro Selic 2029, Tesouro IPCA+ e LCI/LCA (com isenção de IR automática)',
      'Cálculo em Tempo Real de Rendimento Mensal Líquido (calculateFixedIncomeMonthlyYield): integração com as taxas oficiais do Banco Central (/api/bcb) para estimar exatamente quantos R$ pingam todo mês na caixinha',
      'Hero Card & Seletor de Escopo (PortfolioSummary.tsx): alternador instantâneo entre "Patrimônio Global" e "Apenas Bolsa (B3)", exibindo soma consolidada de renda passiva mensal (dividendos + rendimentos de renda fixa)',
      'Macro Alocação de Ativos (AllocationCard.tsx): gráfico segmentado consolidado entre FIIs (Imobiliário), Ações (Empresas) e Renda Fixa & Caixinhas',
      'Seletor Segmentado iOS de 3 Vias na Tela Inicial: [ Bolsa (Ativos) ] | [ Caixinhas & Renda Fixa ] | [ Extrato B3 ] com persistência local e espelhamento em nuvem Supabase',
    ],
  },
  {
    version: '2.6.0',
    date: '13/10/2026',
    highlights: [
      'Feedback Tátil Háptico (Web Vibration API + Taptic Engine em src/lib/haptic.ts): leves vibrações táteis no celular ao tocar na dock inferior flutuante, ao alternar sub-segmentos iOS, ao concluir importação da B3 com sucesso e comemoração com clique tátil e confetes ao tocar em troféus desbloqueados',
      'Resumo Mensal Estilo "Spotify Wrapped / Nubank" (MonthlyWrappedModal.tsx + calculateMonthlyWrapped): card comemorativo em destaque no topo da Carteira ("Seu mês de [Mês] na B3: você recebeu R$ X em proventos, aportou em Y cotas e sua bola de neve avançou Z%!") com carrossel de meses, maior pagador, líder do Número Mágico e gerador de mensagem para compartilhar no WhatsApp',
    ],
  },
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

