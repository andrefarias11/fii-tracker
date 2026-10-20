# Backlog do FII Tracker

Priorização: impacto para o usuário, frequência, risco e esforço. Revisar após cada entrega.

| Prioridade | Demanda | Objetivo e critérios de aceite |
| --- | --- | --- |
| P2 · pequena | Cabeçalhos mensais do Extrato no celular | Subtotais de compras, vendas e proventos devem quebrar linha sem sobrepor mês ou selo de meta em telas estreitas; modo Privacidade deve continuar ocultando valores. |
| P2 · média | Confirmação de sincronização de operações | Distinguir operação salva neste dispositivo de operação sincronizada na conta e oferecer recuperação visível quando a sincronização falhar. Definir comportamento offline antes de implementar; não depende de alteração de dados no Supabase. |

## Concluídos

- 5.1.13: ao desaparecer a última movimentação do ativo filtrado, o Extrato seleciona Todos e mostra as movimentações restantes, sem alterar subtotais.
- 5.1.12: ações de editar, excluir, confirmar e cancelar no Extrato têm alvos de pelo menos 44 px, nomes acessíveis e layout adaptado ao celular.
- 5.1.11: filtro por ativo do Extrato usa Chip acessível com alvo de 44 px.

## Notas da auditoria

- `src/app/page.tsx` encaminha a exclusão do Extrato a `deleteTransaction` em `src/hooks/usePortfolio.ts`; o hook atualiza a lista local e agenda exclusão remota. Alterar a apresentação da confirmação não exige mudar esse fluxo.
- A seleção de ativo fica no estado de `TransactionHistory`. Quando o último lançamento do ativo selecionado é removido, a seleção pode permanecer sem resultados; tratar em uma entrega própria para não misturar a mudança de comportamento com a ampliação dos botões.
