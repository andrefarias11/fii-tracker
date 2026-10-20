# FII Tracker — v5.1.0

Aplicativo Next.js para acompanhar FIIs, ações, proventos e renda fixa, com armazenamento local, sincronização autenticada no Supabase e notificações Web Push processadas no servidor.

## Executar

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## Configuração segura e Variáveis de Ambiente

Copie `.env.example` para `.env.local` e preencha suas configurações. Nunca publique chaves privadas (`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `ADMIN_SECRET`) nem use o prefixo `NEXT_PUBLIC_` nelas.

Variáveis principais (sem valores secretos):
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`: URL e chave pública do projeto Supabase para login e sincronização.
- `SUPABASE_SERVICE_ROLE_KEY`: chave administrativa exclusiva do servidor para limites compartilhados, widget, administração e processamento de notificações Push em background.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: chave pública VAPID (P-256 não comprimida, 65 bytes em `base64url`) usada pelo navegador para assinar o PushManager.
- `VAPID_PRIVATE_KEY`: chave privada VAPID (escalar P-256 de 32 bytes em `base64url`) mantida exclusivamente no servidor para assinar tokens JWT ES256 (RFC 8292).
- `VAPID_SUBJECT`: contato do emissor VAPID (ex.: `mailto:seu-email@example.com`).
- `CRON_SECRET`: segredo exclusivo com pelo menos 16 caracteres (distinto de `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET` e `VAPID_PRIVATE_KEY`) para autenticar o endpoint `/api/push/cron`.
- `BRAPI_TOKEN` (opcional): usado por recursos de cotação e análise que consultam a Brapi. O cron de notificações Push não depende desse token nem do plano Pro.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` (mín. 12 caracteres) e `ADMIN_SECRET` (mín. 32 caracteres): credenciais do painel administrativo.

### Banco de Dados e Migrations

- **Instalação nova:** execute `supabase/schema.sql` no SQL Editor do seu Supabase.
- **Atualização de banco existente:** faça backup do banco e aplique em ordem:
  1. `supabase/migrations/20261019_security_and_sync.sql` (caso ainda não aplicada)
  2. `supabase/migrations/20261020_server_web_push.sql` (cria as tabelas, políticas RLS e funções de lock do Web Push).
  3. `supabase/migrations/20261021_push_recovery_fixes.sql` (reserva cada resumo e seus eventos em uma única transação).

Consulte [o roteiro de atualização](docs/upgrade-5.0.0.md) para detalhes adicionais de segurança.

## Web Push no Servidor e Configuração do Cron

### 1. Geração das Chaves VAPID
Você pode gerar um par de chaves VAPID compatível (P-256 em `base64url`) com Node.js:
```sh
node -e "const crypto = require('crypto'); const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + ecdh.getPublicKey().toString('base64url')); console.log('VAPID_PRIVATE_KEY=' + ecdh.getPrivateKey().toString('base64url'));"
```

### 2. Agendador Externo (Cron)
O endpoint portátil `/api/push/cron` aceita requisições `GET` ou `POST` autenticadas exclusivamente pelo cabeçalho `Authorization`:
```sh
curl -X POST "https://seu-dominio.com/api/push/cron" \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```
- Se `CRON_SECRET` não estiver configurado, for curto (< 16 caracteres) ou reutilizar outra chave do servidor, o endpoint falha fechado com `HTTP 503`. Requisições sem o token correto recebem `HTTP 401`.
- **Frequência recomendada:** a cada **5 a 15 minutos** em qualquer serviço de agendamento (GitHub Actions, cron-job.org, Cloudflare Triggers, Vercel Cron, servidor Linux `crontab`).
- **Janela de entrega:** o usuário escolhe seu horário diário (padrão `08:00`) e fuso IANA (padrão `America/Sao_Paulo`). O resumo é processado na primeira execução do agendador no ou após o horário escolhido daquele dia local. A interface informa que o envio ocorre na janela do agendador, sem prometer entrega no minuto exato.

### 3. Escopo de Eventos, Fontes e Sincronização
- **Dependência de sincronização:** o servidor processa exclusivamente as carteiras sincronizadas no Supabase (`public.transactions`). Alterações locais ainda pendentes na fila offline não participam dos alertas até que a sincronização seja concluída.
- **Fontes verificáveis:** StatusInvest (primária) e a tabela pública de proventos do Fundamentus (fallback) são consultados. O alerta só é criado quando a fonte retorna Data-Com, pagamento e valor positivos explícitos; a origem é identificada na notificação. O fallback Fundamentus lê uma página pública sem API contratada e pode atrasar ou mudar de formato. Estimativas, catálogo estático (`fiiDividendCalendar.ts`), Yahoo Finance e lançamentos manuais nunca geram alertas.
- **Falhas parciais de fonte:** um ativo indisponível não cancela o lote. O cron processa os demais e volta a tentar o ativo pendente em execuções seguintes, sem marcá-lo como verificado naquele dia.
- **Pagamento anunciado vs. recebido:** no dia `paymentDate`, o alerta informa *"pagamento anunciado para hoje"* (`PAYMENT_DATE_REMINDER`) com base nas cotas elegíveis até a Data-Com. Só é considerado *"recebido"* quando houver lançamento correspondente `DIVIDEND` no extrato sincronizado.
- **Privacidade na tela bloqueada:** por padrão (`privacyMode: 'discreet'`), a notificação não exibe patrimônio, quantidade de cotas nem valores pessoais em R\$. Ao tocar na notificação, o Service Worker abre/foca o app em **Proventos** e destaca o ativo correspondente usando uma URL limpa (`/?tab=proventos&ticker=...&date=...&event=...`), sem tokens ou valores financeiros na URL.

### 4. Deduplicação, Retentativas e Limites de Entrega
- **Deduplicação e concorrência:** o banco utiliza `claim_push_user_lock` (lease atômico por usuário), chave única por resumo diário (`user_id, local_date, digest_key`), chave única por versão de evento (`user_id, ticker, event_type, event_reference, data_version`) e entregas independentes por dispositivo (`push_device_deliveries`).
- **Falhas e inscrições expiradas:** uma entrega só é marcada como `accepted` após confirmação HTTP `2xx` do serviço Push (APNs/FCM/Mozilla). Respostas `404`/`410` desativam automaticamente apenas a inscrição expirada sem bloquear os demais aparelhos da conta. Falhas transitórias (`429`/`5xx`/rede) têm até 3 tentativas com backoff exponencial, e processamentos interrompidos após expiração do lease são recuperados na execução seguinte.
- **Limitações de entrega:** o protocolo Web Push não oferece garantia absoluta de entrega nem semântica *exactly-once* ponta a ponta. *"Envio aceito pelo serviço Push"* indica que a operadora (APNs/FCM) recebeu o pacote criptografado; a exibição final no aparelho depende de conectividade e políticas de bateria do sistema operacional, e uma queda abrupta de rede após o envio HTTP pode causar reenvio em retentativa.

### 5. Procedimento de Teste com o PWA Fechado
1. No iPhone (iOS 16.4+, adicionado à Tela de Início), Android ou Desktop, faça login na conta, aguarde o status **Sincronizado** e abra **Configurações → Notificações Push (PWA)**.
2. Ative as notificações e confirme que o card exibe **Dispositivo inscrito**.
3. **Teste rápido de entrega:** toque em **Testar com App Fechado (5s)** e bloqueie a tela ou feche o PWA imediatamente. A notificação deve chegar na tela de bloqueio e, ao ser tocada, abrir a aba **Proventos**.
4. **Teste completo do processamento no servidor:** feche completamente o PWA e acione o endpoint de cron com seu segredo:
   ```sh
   curl -i -X POST "http://localhost:3000/api/push/cron" \
     -H "Authorization: Bearer SEU_CRON_SECRET"
   ```
   Reabra as Configurações para conferir o **Último processamento** e o **Último envio Push** registrados pelo servidor.

## Comportamentos dos dados

- **Recebido:** somente lançamentos `DIVIDEND` do extrato/backup. A passagem da data de pagamento não confirma crédito em conta.
- **Anunciado:** evento com data e posição elegível reconstruída pelo histórico; ainda depende da conciliação com o extrato.
- **Estimado:** projeção de renda. Não é somado ao payback histórico nem dispara alertas Push.
- **Simulação:** projeção dos próximos 12 meses com hipóteses constantes, não uma série de rentabilidade passada.
- **Desdobramentos:** exigem data, fator e fonte explícitos no lançamento; não são inferidos pelo preço.
- **Fundamentos:** catálogo de referência, sem garantia de atualização automática. Cotações e valores patrimoniais podem ter datas distintas.
- **Renda fixa:** rendimento mensal estimado; a hipótese tributária simplificada não substitui o saldo da instituição.

## Sincronização, Widget, Offline e Validação

- **Sincronização e recuperação:** alterações são armazenadas em fila por conta, com tentativa de reenvio ao reconectar e a cada 30 segundos. Uma cópia anterior à importação é guardada por conta e pode ser recuperada em **Qualidade dos dados e recuperação → Desfazer última importação**.
- **Widget:** o código Scriptable usa um token individual de leitura enviado no cabeçalho e consulta os dados sincronizados da conta sem expor a carteira na URL.
- **Offline e acessibilidade:** o Service Worker guarda a página inicial e arquivos estáticos já visitados, sem armazenar respostas de APIs ou dados de carteira em cache de rede. Modais têm identificação acessível, foco inicial, contenção de Tab e fechamento por Escape.
- **Validação:** os testes cobrem contabilidade, importação duplicada, validação de backups, fila de sincronização, políticas reais de PostgreSQL via PGlite e motor de Web Push no servidor (autenticação do cron, fuso/horário, deduplicação, alteração de anúncio, rejeição de estimativas, retentativas e expiração 404/410).

