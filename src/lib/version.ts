// Controle central de versão do FII Tracker
// REGRA: Sempre incrementar APP_VERSION a cada nova alteração ou melhoria aplicada no projeto.

export const APP_VERSION = '5.1.13';
export const APP_UPDATED_AT = '20/10/2026';

export interface VersionRelease {
  version: string;
  date: string;
  highlights: string[];
}

export const APP_CHANGELOG: VersionRelease[] = [
  {
    version: '5.1.13', date: '20/10/2026', highlights: [
      'Corrige o filtro do Extrato após excluir a última movimentação de um ativo, retornando a Todos sem alterar os subtotais.',
    ],
  },
  {
    version: '5.1.12', date: '20/10/2026', highlights: [
      'Amplia e identifica as ações de edição e exclusão no Extrato para uso acessível no celular e registra prioridades do produto em backlog.',
    ],
  },
  {
    version: '5.1.11', date: '20/10/2026', highlights: [
      'Padroniza os filtros por ativo do Extrato com alvos de toque maiores e estado selecionado acessível.',
    ],
  },
  {
    version: '5.1.10', date: '20/10/2026', highlights: [
      'Melhora a leitura da Central de Alertas e amplia os alvos de toque das ações de atualizar e carregar mais no celular.',
    ],
  },
  {
    version: '5.1.9', date: '20/10/2026', highlights: [
      'Corrige a conciliação para manter anúncios confirmados visíveis após importar recibos e melhora o isolamento do modo Privacidade no resumo mensal e no compartilhamento/exportação.',
      'Mantém o estado das notificações disponível mesmo quando o histórico falha, exibe horários de detecção/envio e pagina alertas por cursor estável.',
    ],
  },
  {
    version: '5.1.8', date: '20/10/2026', highlights: [
      'Adiciona Central de Alertas com histórico paginado, origem, manchete e estados de processamento/envio, sem expor valores pessoais ou dados de inscrição.',
      'Concilia anúncios confirmados com recibos por ticker, data de pagamento e valor; itens sem ciclo identificável ficam para conferência manual.',
      'Permite exportar o resumo mensal em CSV compatível com Excel e respeita o modo Privacidade.',
    ],
  },
  {
    version: '5.1.7', date: '20/10/2026', highlights: [
      'Adiciona alertas Push de notícias materiais recentes sobre FIIs da carteira, comunicados macro do Banco Central e abertura/fechamento da B3, com deduplicação por evento.',
      'Expõe apenas categorias de notificação processadas no servidor e deixa explícito que a frequência e o atraso dependem do cron externo.',
    ],
  },
  {
    version: '5.1.6', date: '20/10/2026', highlights: [
      'Push automático passa a verificar eventos elegíveis em cada execução do cron e envia novas confirmações ao longo do dia, com deduplicação persistente para evitar repetições.',
      'Configurações esclarecem que a frequência depende do cron externo e mantêm o fuso horário para avaliar corretamente Data-Com e pagamentos.',
    ],
  },
  {
    version: '5.1.5', date: '19/10/2026', highlights: [
      'Adiciona o Fundamentus como fallback gratuito de proventos com campos explícitos e mantém a origem do dado na notificação.',
      'Processa ativos com fontes disponíveis mesmo quando outro ticker falha e retenta dados incompletos sem marcar o dia como verificado.',
    ],
  },
  {
    version: '5.1.4', date: '19/10/2026', highlights: [
      'Atualiza o fallback de proventos Brapi para as rotas v2 autenticadas e interpreta datas ISO com separador de espaço sem inferir Data-Com.',
    ],
  },
  {
    version: '5.1.3', date: '19/10/2026', highlights: [
      'Registra e retorna diagnóstico sanitizado para falhas no processamento do cron Push, sem expor segredos ou dados de usuário.',
    ],
  },
  {
    version: '5.1.2', date: '19/10/2026', highlights: [
      'Adiciona diagnóstico seguro para falhas do cron Push nos logs do servidor, sem registrar tokens, cabeçalhos ou dados de usuário.',
    ],
  },
  {
    version: '5.1.1', date: '19/10/2026', highlights: [
      'Corrige recuperação de notificações Push para respeitar preferências atuais, evitar dados pessoais obsoletos e descartar eventos expirados.',
      'Torna atômica a reserva de resumos e eventos, protege retentativas concorrentes e preserva anúncios confirmados de múltiplos ciclos.',
      'Trata indisponibilidade das fontes de mercado como falha recuperável, sem inventar Data-Com nem marcar consulta incompleta como concluída.',
    ],
  },
  {
    version: '5.1.0', date: '19/10/2026', highlights: [
      'Notificações Web Push no servidor (/api/push/cron e serverPushEngine.ts) com resumo diário no horário e fuso IANA do usuário, funcionando com o PWA fechado.',
      'Detecção exclusiva de anúncios e retificações verificáveis (StatusInvest/Brapi) e lembretes de Data-Com e pagamento, sem alertas sobre estimativas ou catálogo estático.',
      'Deduplicação persistente com lock atômico por usuário, entregas independentes para múltiplos dispositivos, retentativas com backoff e desativação automática em HTTP 404/410.',
      'Modo discreto padrão na tela bloqueada, sincronização autenticada de preferências com RLS estrito e navegação direta da notificação para o ativo na aba Proventos.',
    ],
  },
  {
    version: '5.0.6', date: '19/10/2026', highlights: [
      'Tipografia financeira e controles compartilhados, com seleção neutra, ações principais douradas e cabeçalho adaptado ao mobile.',
      'Ficha única de ativo na Carteira, Radar, Mentores e Proventos, com posição, recebimentos, indicadores e edição de estimativa.',
      'Listas mais leves, skeletons, feedback de importação e sincronização, privacidade e respeito a movimento reduzido.',
    ],
  },
  {
    version: '5.0.5', date: '19/10/2026', highlights: [
      'Mapa imobiliário redesenhado com contorno do IBGE, agrupamento por estado e navegação acessível pelos imóveis.',
      'Ficha de imóvel compacta, busca no catálogo e consultas de CEP e distribuição regional recolhidas.',
    ],
  },
  {
    version: '5.0.4', date: '19/10/2026', highlights: [
      'Radar compacto com saldo, estratégia, sugestão principal, filtros com contadores e análise expansível dos ativos.',
      'Consenso executivo com placar dos mentores e horário das cotações; fundamentos e motivos recolhidos nas fichas.',
      'Troféus com acentos discretos por tier e filtro Na Mira; Número Mágico destaca cotas e quantidade restante.',
    ],
  },
  {
    version: '5.0.3', date: '19/10/2026', highlights: [
      'Gráfico de desempenho com contexto explícito de projeção, metodologia recolhida e hierarquia visual para Carteira, CDI e IPCA.',
      'Interação por toque, cursor e teclado com régua, tooltip fora da curva, grade e rótulos de tempo legíveis.',
    ],
  },
  {
    version: '5.0.2', date: '19/10/2026', highlights: [
      'Superfícies OLED unificadas e dock com material translúcido, safe area somada e alvos de toque de 44px.',
      'Mapa de proventos com timeline padrão e grade mensal, Data-Com e pagamento separados, datas pt-BR e eventos agrupados por dia.',
    ],
  },
  {
    version: '5.0.1', date: '19/10/2026', highlights: [
      'Configuração Supabase automática por variáveis de ambiente, sem sobrescrita por chaves antigas salvas no navegador.',
      'Diagnóstico de nuvem diferencia sessão ausente de falha de configuração ou migração.',
    ],
  },
  {
    version: '5.0.0', date: '19/10/2026', highlights: [
      'Segurança: políticas por usuário, administrador sem credenciais padrão, APIs autenticadas e widget individual revogável.',
      'Integridade: proventos recebidos separados de estimativas, simulação futura transparente e desdobramentos explícitos.',
      'Sincronização: fila persistente, exclusões protegidas, validação de backup e recuperação da última importação.',
      'Qualidade: testes de regressão, acessibilidade de modais, carregamento sob demanda e cache offline do aplicativo.',
    ],
  },
  {
    version: '4.8.0',
    date: '18/10/2026',
    highlights: [
      'Blindagem Institucional Anti-Cilada / Quality Gate (recommendationEngine.ts & mentorEngine.ts): auditoria tripla nas recomendações do Radar e dos 4 Mentores contra armadilhas de dividendo (Value Traps)',
      'Trava de Yield Anômalo Não-Recorrente: bloqueia picos extraordinários de dividendos (>30% acima da média recorrente por venda de imóvel) para nunca inflar artificialmente o Preço-Teto',
      'Filtro de Desconto Suspeito (Distressed Filter): penaliza automaticamente FIIs com P/VP < 0,80 ou vacância física > 12%, excluindo ativos em estresse da cesta automática e do Top 3 dos Mentores',
      'Selo de Solidez Institucional (High Grade 5★ vs Moderado 4★ vs Alerta Value Trap) e novo filtro rápido "High Grade 5★" em OpportunityRadar.tsx e MentorsTab.tsx',
    ],
  },
  {
    version: '4.7.0',
    date: '18/10/2026',
    highlights: [
      'Integração Boletim Focus ao Vivo — API Olinda do Banco Central (/api/bcb): consulta oficial OData (ExpectativasMercadoAnuais) trazendo a projeção mediana do mercado para Selic, IPCA e Juro Real Implícito dos próximos 3 anos',
      'Painel Boletim Focus & Termômetro de Ciclo (InvestmentSimulator.tsx): grade comparativa 3 anos (Selic, IPCA e Juro Real) com leitura automática de fechamento/abertura da curva de juros para orientar entre FIIs de Tijolo e Papel',
      'Simulador com Curva Dinâmica Focus BCB & Poder de Compra Real: novo seletor "Curva Focus BCB" vs "Taxa Fixa Manual" projetando patrimônio nominal e poder de compra real descontado o IPCA Focus ano a ano',
      'Diagnóstico Macroeconômico Enriquecido na IA (/api/ai-insights & AiInsightsTab.tsx): integração das projeções futuras do Boletim Focus na análise de alocação Tijolo vs Papel e veredito macro da carteira',
    ],
  },
  {
    version: '4.6.0',
    date: '17/10/2026',
    highlights: [
      'Mapa Imobiliário Interativo da B3 (RealEstateMap.tsx + fiiProperties.ts): visualização geográfica dos galpões logísticos, shoppings, lajes Triple A, imóveis de renda urbana e fazendas dos FIIs de Tijolo, com filtro entre "Meus Imóveis (Carteira)" e "Todos da B3"',
      'Integração BrasilAPI CEP v2 Ao Vivo (/api/cep): consulta geolocalizada em tempo real de qualquer CEP comercial/logístico com coordenadas de latitude/longitude, fallback automático ViaCEP e plotagem direta no mapa',
      'IA & Fatos Relevantes da Carteira (AiInsightsTab.tsx + /api/ai-insights): Score de Saúde da Carteira (0–100), correlação macroeconômica (Tijolo vs Papel vs Ações vs Caixinhas com Selic/IPCA do Banco Central) e alertas de risco oculto',
      'Tradutor de Fatos Relevantes & Relatórios Gerenciais em 3 Bullets: busca de comunicados/notícias recentes por ticker com resumo executivo de impacto patrimonial e integração opcional com Google Gemini AI e Groq Llama 3.3',
      'Atalhos Diretos nos Cards da Carteira (PositionList.tsx): botões rápidos "Imóveis no Mapa" e "IA & Fatos Relevantes" dentro dos detalhes de cada ativo e novas sub-abas em Explorar',
    ],
  },
  {
    version: '4.5.0',
    date: '16/10/2026',
    highlights: [
      'Redesign XP Investimentos iOS Completo (100% do App): unificação visual de todas as abas, componentes e modais seguindo o Design System Dark da XP (#0b0b0d, #1c1c1e, Amarelo Ouro #f5b800 e #2b2512)',
      'Caixinhas & Renda Fixa no Molde "Meus Ativos" XP (FixedIncomeList.tsx & AllocationCard.tsx): cards com ícone contornado branco, tabela Key-Value limpa (Taxa contratada, Valor aplicado, Posição atual, Rendimento mensal e Resultado total com ▲/▼) e botões pílula de edição e nova aplicação',
      'Explorar B3 no Padrão XP (OpportunityRadar.tsx, UniversalB3Explorer.tsx & MentorsTab.tsx): Scanner B3, Raio-X Ao Vivo e Mentores reconstruídos com tabelas Key-Value limpas, pílulas de filtro em Amarelo Ouro e botões diretos de "Aportar" integrados ao modal de operação',
      'Platina (20 Troféus), Bola de Neve & Simulador (AchievementsTimeline.tsx, GoalsCard.tsx, MagicNumberCard.tsx & InvestmentSimulator.tsx): barras de progresso e badges em Amarelo Ouro XP (#f5b800) e Esmeralda (#22c55e), com superfícies #1c1c1e e #141416',
      'Padronização XP de Todos os 5 Modais & Extrato (AddTransactionModal, AddFixedIncomeModal, B3ImportModal, MonthlyWrappedModal, SettingsModal & TransactionHistory): bottom sheets em #1c1c1e, botões principais pílula em #f5b800 e edição direta de lançamentos pelo Extrato',
    ],
  },
  {
    version: '4.4.1',
    date: '15/10/2026',
    highlights: [
      'Proteção e Autenticação de Acesso ao Admin (/admin e /api/admin): tela de login restrita com usuário e senha (padrão admin / admin123, configurável via variáveis de ambiente)',
      'Segurança de Tokens com HMAC-SHA256 (adminAuth.ts): geração e verificação de sessão protegida com cookies HTTP-Only e suporte a header Bearer',
      'Bloqueio Estrito no Endpoint (/api/admin): rejeição imediata com HTTP 401 Unauthorized para qualquer requisição não autenticada',
      'Encerramento Seguro de Sessão: botão "Sair" no cabeçalho administrativo com revogação instantânea de cookies e retorno à tela de login',
    ],
  },
  {
    version: '4.4.0',
    date: '15/10/2026',
    highlights: [
      'Dashboard Administrativa Completa (/admin): visão global e unificada de todas as contas da plataforma no padrão visual XP Investimentos Dark (#0b0b0d, #1c1c1e, #f5b800)',
      'API de Visão Geral (/api/admin): integração com RPC get_admin_accounts_overview do Supabase (e fallback inteligente) com cálculo contábil em tempo real de patrimônio, cotações ao vivo e proventos mensais',
      'Unificação Nuvem + Cofre Local: contas salvas no aparelho que ainda não sincronizaram aparecem consolidadas lado a lado com as contas da nuvem',
      'KPIs de Custódia da Plataforma: métricas soltas no topo exibindo Patrimônio Total sob custódia, Total em Bolsa, Total em Caixinhas, Proventos Somados e Total de Contas Ativas',
      'Busca, Ordenação e Expansão de Carteiras: filtro rápido por nome/e-mail/ticker, ordenação dinâmica e gaveta "Ver Detalhes" com a lista completa de FIIs, Ações e Caixinhas de cada investidor',
      'Atalho Rápido no Seletor de Contas e Ajustes: botão direto para o Painel Admin com alternância instantânea entre contas',
    ],
  },
  {
    version: '4.3.2',
    date: '15/10/2026',
    highlights: [
      'Isolamento Estrito de Dados Multiconta (Zero Data Leakage): consultas no Supabase (transactions, caixinhas, metas e dividendos) agora filtram obrigatoriamente por user_id (.eq(\'user_id\', userId)) sem risco de exibir dados de outras contas',
      'Escopo de Chaves no LocalStorage por Usuário: cada conta logada possui seu próprio armazenamento local independente (fii_tracker_transactions_v1_${userId}), impedindo compartilhamento de cache com contas novas de teste',
      'Proteção contra Contaminação no Smart Merge (usePortfolio.ts): limpeza instantânea de estado em memória (setTransactions([]), setFixedIncomeAssets([])) ao alternar contas e verificação com useRef (currentSyncUserId) durante o ciclo assíncrono',
      'Migração Segura de Registros Órfãos: registros legados no banco (user_id IS NULL) são vinculados exclusivamente à conta principal inicial e nunca compartilhados com contas secundárias recém-adicionadas',
      'Prefixação de Primary Key por Usuário: chaves primárias salvas no banco são prefixadas com o identificador do usuário para eliminar colisões entre investidores independentes',
    ],
  },
  {
    version: '4.3.1',
    date: '15/10/2026',
    highlights: [
      'Sincronização Inteligente Bidirecional (Smart Merge em usePortfolio.ts): unificação automática de transações B3 e Caixinhas/Renda Fixa entre Celular e Web (itens locais pendentes sobem para o Supabase e itens remotos são baixados simultaneamente sem perdas)',
      'Sincronização Automática por Foco e Sessão (page.tsx): acionamento instantâneo do sync ao reabrir o app no celular (PWA / iOS), ao focar a aba no navegador e após login ou troca de contas no alternador',
      'Ações Rápidas no Cabeçalho (Header.tsx): botão da Nuvem com sincronização direta em 1 toque (ícone animado) e botão Atualizar unificado (cotações ao vivo B3 + sincronização na nuvem)',
      'Blindagem de Conexão e RLS (supabase.ts & schema.sql): suporte transparente a usuários autenticados Google OAuth com fallback resiliente para garantir leitura e escrita contínuas no banco',
    ],
  },
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

