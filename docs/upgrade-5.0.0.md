# Atualização 5.0.0 — 19/10/2026

## Antes de publicar

1. Exporte um backup JSON em cada conta/dispositivo que contenha alterações ainda não sincronizadas. Faça também um backup do banco.
2. Execute a migração `supabase/migrations/20261019_security_and_sync.sql` no SQL Editor do projeto correto. Instalações novas podem executar apenas `supabase/schema.sql`, que já inclui a migração.
3. Confirme a propriedade dos registros legados sem `user_id`. Eles são preservados, mas ficam invisíveis para usuários normais. A aplicação não atribui mais dados órfãos automaticamente à primeira pessoa que entrar. Atribua-os no banco somente após comprovar a qual conta pertencem.
4. Configure as variáveis abaixo no servidor e publique o aplicativo. Atualize todos os dispositivos: clientes antigos que dependiam de acesso anônimo deixarão de sincronizar.
5. Entre em duas contas de teste distintas e confira isolamento, criação, edição e exclusão. Verifique a fila com um dispositivo sem rede e depois reconectado.
6. Gere novamente o widget em Configurações. Scripts antigos sem token deixam de funcionar.

## Variáveis

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`: projeto de autenticação e dados.
- `SUPABASE_SERVICE_ROLE_KEY`: somente no servidor. Usada para administração, tokens de widget e limites compartilhados.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` (mínimo 12 caracteres), `ADMIN_SECRET` (mínimo 32 caracteres aleatórios).
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: entrega de notificações.
- `GEMINI_API_KEY` ou `GROQ_API_KEY`: opcionais para geração externa da análise.
- `BRAPI_TOKEN`: opcional para cotações/proventos.

Nenhuma credencial de serviço foi encontrada na configuração local durante a implementação. A migração foi testada em PostgreSQL embarcado, mas **não aplicada ao Supabase remoto**. Os recursos de servidor falham de forma fechada até receberem a configuração e a migração.

## Mudanças de comportamento

- O gráfico antigo foi removido porque construía valores históricos artificiais. A substituição é uma simulação futura identificada; rentabilidade histórica real exige uma fonte e armazenamento de séries históricas e permanece uma funcionalidade futura.
- Payback e evolução recebida consideram apenas lançamentos de proventos. Valores menores após atualizar podem refletir a remoção de estimativas antigas.
- O calendário distingue evento anunciado e recebimento; alterações manuais antigas de status não comprovam pagamento.
- Desdobramentos agora são explícitos. Revise operações históricas que dependiam da heurística antiga, informando fator, data e fonte na edição da transação. O arquivo original não foi reescrito automaticamente.
- Mentores respeitam o orçamento real e não reintroduzem ativos reprovados quando faltam candidatos.
- A fila salva cada operação separadamente, preserva a conta proprietária durante trocas e mantém tentativas que falharam. Registros de exclusão impedem ressurreição por dispositivos antigos. Reimportações intencionais por backup recebem novas identidades.
- O cache offline é do aplicativo e arquivos estáticos, não das respostas privadas das APIs.

## Verificações

Execute `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e `npm audit --omit=dev`.

A auditoria completa ainda aponta a cadeia de desenvolvimento `eslint-config-next → fast-glob → micromatch → braces` (GHSA-vfj7-8cjw-p6xm). A versão mais recente encontrada de braces no registry continua sendo 3.0.3. Não foi aplicado o downgrade incompatível do Next/ESLint sugerido por `npm audit fix --force`. A dependência de produção SheetJS foi atualizada pela distribuição oficial.

## Limitações verificáveis

A validação local não comprova as políticas instaladas no banco remoto, os provedores de autenticação, a entrega em APNs/FCM ou os serviços de IA. Esses testes dependem das credenciais e do ambiente implantado. Não houve publicação ou alteração de dados de produção.
