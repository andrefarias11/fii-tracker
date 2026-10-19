# FII Tracker — v5.0.0

Aplicativo Next.js para acompanhar FIIs, ações, proventos e renda fixa, com armazenamento local e sincronização autenticada no Supabase.

## Executar

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## Configuração segura

Copie `.env.example` para `.env.local` e preencha suas configurações. Nunca publique a chave `SUPABASE_SERVICE_ROLE_KEY` ou use prefixo `NEXT_PUBLIC_` nela.

- Instalação nova: execute `supabase/schema.sql` no SQL Editor do seu Supabase.
- Atualização: faça um backup do banco e execute `supabase/migrations/20261019_security_and_sync.sql`.
- Configure URL e chave pública para login/sincronização. A chave de serviço é necessária para limites compartilhados, administração e widget.
- O administrador exige usuário, senha com pelo menos 12 caracteres e segredo de assinatura com pelo menos 32 caracteres. Não existe senha padrão.
- Configure os provedores de autenticação e URLs de redirecionamento no Supabase.

Consulte [o roteiro de atualização](docs/upgrade-5.0.0.md) antes de publicar a versão.

## Comportamentos dos dados

- **Recebido:** somente lançamentos `DIVIDEND` do extrato/backup. A passagem da data de pagamento não confirma crédito em conta.
- **Anunciado:** evento com data e posição elegível reconstruída pelo histórico; ainda depende da conciliação com o extrato.
- **Estimado:** projeção de renda. Não é somado ao payback histórico.
- **Simulação:** projeção dos próximos 12 meses com hipóteses constantes, não uma série de rentabilidade passada.
- **Desdobramentos:** exigem data, fator e fonte explícitos no lançamento; não são inferidos pelo preço.
- **Fundamentos:** catálogo de referência, sem garantia de atualização automática. Cotações e valores patrimoniais podem ter datas distintas.
- **Renda fixa:** rendimento mensal estimado; a hipótese tributária simplificada não substitui o saldo da instituição.

## Sincronização e recuperação

Alterações são armazenadas em fila por conta, com tentativa de reenvio ao reconectar e a cada 30 segundos. A interface mostra pendências e erros. Exclusões deixam registros no banco para impedir que outro dispositivo restaure dados antigos. Atualizações concorrentes de transações/renda fixa usam a data da alteração, com a mais recente prevalecendo; o relógio do dispositivo deve estar correto.

Backups são validados antes da alteração. Uma cópia anterior à importação é guardada por conta e pode ser recuperada em **Qualidade dos dados e recuperação → Desfazer última importação**. Restaurar um backup substitui a carteira e gera novas identidades para os registros, preservando a proteção contra reenvios antigos.

## Widget e notificações

O código Scriptable usa um token individual de leitura enviado no cabeçalho. Gerar outro código ou revogar o acesso invalida o anterior. O widget consulta os dados sincronizados da conta; a carteira não é enviada pela URL. Dados locais ainda não sincronizados não aparecem nele.

Push e análises de IA exigem login e limites de uso no banco. A entrega de push depende das chaves VAPID. O processamento automático de alertas continua ocorrendo quando o aplicativo está aberto; esta versão não inclui um agendador no servidor.

## Offline e acessibilidade

O service worker guarda a página inicial e arquivos estáticos já visitados. APIs, administração e respostas com dados da carteira não são guardadas no cache de rede. Recursos ainda não carregados precisam de conexão na primeira utilização. As carteiras locais continuam separadas por usuário.

Modais têm identificação acessível, foco inicial, contenção de Tab, fechamento por Escape e restauração do foco. O zoom do navegador permanece habilitado.

## Validação

Os testes incluem contabilidade, importação duplicada, validação de backups, fila de sincronização, limites de orçamento e políticas reais de PostgreSQL via PGlite. O teste de banco não acessa o Supabase de produção.

SheetJS atualizado para 0.20.3 pela [distribuição oficial](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). A auditoria das dependências de produção está separada das dependências das ferramentas de desenvolvimento.
