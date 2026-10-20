# Backlog do FII Tracker

Priorização: impacto para o usuário, frequência, risco e esforço. Revisar após cada entrega.

| Prioridade | Demanda | Objetivo e critérios de aceite |
| --- | --- | --- |
| P2 · média | Confirmação de sincronização de operações | Distinguir operação salva neste dispositivo de operação sincronizada na conta e oferecer recuperação visível quando a sincronização falhar. Definir comportamento offline antes de implementar; não depende de alteração de dados no Supabase. |
| P2 · média | Restaurar fila local após diagnóstico | Oferecer fluxo seguro para validar e restaurar entradas a partir do arquivo exportado, com confirmação do usuário e sem substituir alterações pendentes existentes. |
| P3 · baixa | Diferenciar falha local de falha de sincronização da Renda Fixa | Informar quando a gravação local foi concluída mas o envio à conta ficou pendente, com ação de nova tentativa; definir o estado offline antes de implementar. |

## Concluídos

- 5.1.20: entradas ilegíveis pausam o envio e a conciliação, permanecem intactas no navegador e podem ser exportadas junto com toda a fila pendente para diagnóstico e recuperação manual.
- 5.1.19: falha de gravação ou exclusão local da Renda Fixa aparece no formulário, preserva os dados para nova tentativa e não altera o estado ou inicia envio remoto.
- 5.1.18: formulário de Renda Fixa associa rótulos aos campos e amplia alvos/foco; taxa zero permanece zero após leitura remota.
- 5.1.17: lista de Renda Fixa ganha alvos de 44 px, foco visível e edição contextual; formulário rejeita entradas numéricas inválidas e preserva taxa zero.
- 5.1.16: ações do aviso de instalação no iPhone têm alvos de 44 px, foco visível e nome acessível específico.
- 5.1.15: cabeçalho sticky do iPhone ganhou texto mais nítido e contraste maior na marca.
- 5.1.14: cabeçalhos mensais do Extrato empilham e quebram subtotais no celular sem sobreposição; privacidade preservada.
- 5.1.13: ao desaparecer a última movimentação do ativo filtrado, o Extrato seleciona Todos e mostra as movimentações restantes, sem alterar subtotais.
- 5.1.12: ações de editar, excluir, confirmar e cancelar no Extrato têm alvos de pelo menos 44 px, nomes acessíveis e layout adaptado ao celular.
- 5.1.11: filtro por ativo do Extrato usa Chip acessível com alvo de 44 px.

## Notas da auditoria

- Operações são salvas localmente e enfileiradas para envio; a sincronização tenta novamente ao voltar a conexão e periodicamente. A interface já exibe pendências, erro e ação de nova tentativa. A confirmação por operação ainda precisa de definição para o caso offline e conta ausente.
- `src/app/page.tsx` encaminha a exclusão do Extrato a `deleteTransaction` em `src/hooks/usePortfolio.ts`; o hook atualiza a lista local e agenda exclusão remota. Alterar a apresentação da confirmação não exige mudar esse fluxo.
- A seleção de ativo fica no estado de `TransactionHistory`. Quando o último lançamento do ativo selecionado é removido, a seleção pode permanecer sem resultados; tratar em uma entrega própria para não misturar a mudança de comportamento com a ampliação dos botões.
