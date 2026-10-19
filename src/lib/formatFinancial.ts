const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quantityFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 4,
});

export const formatCurrency = (value: number, hidden = false) =>
  hidden
    ? 'R$ ••••'
    : Number.isFinite(value)
      ? currencyFormatter.format(value)
      : '—';
export const formatDecimal = (value: number) =>
  Number.isFinite(value) ? decimalFormatter.format(value) : '—';
export const formatPercent = (value: number, hidden = false) =>
  hidden ? '••••' : Number.isFinite(value) ? `${formatDecimal(value)}%` : '—';
export const formatQuantity = (value: number, hidden = false) =>
  hidden
    ? '••••'
    : Number.isFinite(value)
      ? quantityFormatter.format(value)
      : '—';
