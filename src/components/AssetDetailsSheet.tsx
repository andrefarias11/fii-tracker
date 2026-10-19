'use client';

import { useId, useState } from 'react';
import { Building2, MapPin, Sparkles, X } from 'lucide-react';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import type { FiiPosition, QuoteData, Transaction } from '../types/portfolio';
import { evaluateAllFiis } from '../lib/recommendationEngine';
import { FII_PROPERTIES_CATALOG } from '../data/fiiProperties';
import { normalizeB3Ticker } from '../lib/ticker';
import {
  formatCurrency,
  formatDecimal,
  formatPercent,
  formatQuantity,
} from '../lib/formatFinancial';
import {
  parseDividendCalendarDate,
  formatDividendCalendarDate,
} from '../data/fiiDividendCalendar';
import { Button, SegmentedControl } from './ui/Controls';
import { EmptyState } from './ui/Feedback';

interface AssetDetailsSheetProps {
  ticker: string | null;
  positions: FiiPosition[];
  quotes: Record<string, QuoteData>;
  transactions: Transaction[];
  isPrivacyMode?: boolean;
  onClose: () => void;
  onOpenBuyModal: (ticker: string) => void;
  onUpdateDividend: (ticker: string, dividend: number) => void;
  onOpenMapForTicker: (ticker: string) => void;
  onOpenAiForTicker: (ticker: string) => void;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="ui-label">{label}</dt>
      <dd className="text-right text-sm font-medium text-zinc-100 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export function AssetDetailsSheet({
  ticker,
  positions,
  quotes,
  transactions,
  isPrivacyMode = false,
  onClose,
  onOpenBuyModal,
  onUpdateDividend,
  onOpenMapForTicker,
  onOpenAiForTicker,
}: AssetDetailsSheetProps) {
  const dialogRef = useModalAccessibility(Boolean(ticker), onClose);
  const titleId = useId();
  const inputId = useId();
  const [section, setSection] = useState<
    'summary' | 'dividends' | 'indicators'
  >('summary');
  const [editing, setEditing] = useState(false);
  const [dividendInput, setDividendInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (!ticker) return null;

  const position = positions.find((item) => item.ticker === ticker);
  const evaluated = evaluateAllFiis(quotes, positions).find(
    (item) => item.ticker === ticker,
  );
  const quote = quotes[ticker];
  const price =
    position?.currentPrice ?? evaluated?.currentPrice ?? quote?.price;
  const dividend =
    position?.monthlyDividendPerShare ??
    evaluated?.monthlyDividend ??
    quote?.lastDividend;
  const pvp = position?.pvp ?? evaluated?.pvp ?? quote?.pvp;
  const quoteDate = quote?.updatedAt ? new Date(quote.updatedAt) : null;
  const quoteTimestamp =
    quoteDate && Number.isFinite(quoteDate.getTime()) ? quoteDate : null;
  const receipts = transactions
    .filter(
      (transaction) =>
        transaction.type === 'DIVIDEND' &&
        normalizeB3Ticker(transaction.ticker) === ticker,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const dateLabel = (value?: string, includeYear = false) => {
    const date = parseDividendCalendarDate(value);
    return date
      ? formatDividendCalendarDate(date, includeYear ? { year: 'numeric' } : {})
      : 'Não informada';
  };
  const currency = (value?: number, privateValue = false) =>
    value === undefined
      ? '—'
      : formatCurrency(value, privateValue && isPrivacyMode);
  const openRelated = (callback: (value: string) => void) => {
    onClose();
    callback(ticker);
  };

  return (
    <div
      className="ui-sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="ui-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/15 sm:hidden"
        />
        <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
          <div className="min-w-0">
            <p className="ui-label">
              Ficha do ativo · {position ? 'Na sua carteira' : 'Explorar'}
            </p>
            <h2
              id={titleId}
              className="mt-1 text-2xl font-semibold tracking-tight text-white"
            >
              {ticker}
            </h2>
            <p className="ui-caption mt-1">
              {position?.name ?? evaluated?.name ?? ticker}
            </p>
          </div>
          <Button
            variant="icon"
            aria-label="Fechar ficha do ativo"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="ui-sheet__nav">
          <SegmentedControl
            label="Conteúdo da ficha"
            value={section}
            onChange={setSection}
            options={[
              { value: 'summary', label: 'Resumo' },
              { value: 'dividends', label: 'Proventos' },
              { value: 'indicators', label: 'Indicadores' },
            ]}
          />
        </div>
        <div className="ui-sheet__body">
          {section === 'summary' && (
            <div className="space-y-5">
              <div>
                <p className="ui-label">
                  Preço por{' '}
                  {position?.assetClass === 'ACAO' ||
                  evaluated?.assetClass === 'ACAO'
                    ? 'ação'
                    : 'cota'}
                </p>
                <p className="ui-value-lg mt-1">{currency(price)}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {quoteTimestamp
                    ? `Cotação recebida · ${quoteTimestamp.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                    : 'Cotação de referência; sem atualização verificável.'}
                </p>
              </div>
              {position ? (
                <>
                  <div className="ui-divider">
                    <p className="ui-label">Sua posição</p>
                    <p className="ui-value-lg mt-1">
                      {currency(position.currentTotal, true)}
                    </p>
                  </div>
                  <dl className="divide-y divide-white/[0.06]">
                    <Metric
                      label="Quantidade"
                      value={formatQuantity(
                        position.totalShares,
                        isPrivacyMode,
                      )}
                    />
                    <Metric
                      label="Preço médio"
                      value={currency(position.averagePrice, true)}
                    />
                    <Metric
                      label="Valor aplicado"
                      value={currency(position.totalInvested, true)}
                    />
                    <Metric
                      label="Resultado total"
                      value={`${position.profitLoss >= 0 ? '+' : '−'}${currency(Math.abs(position.profitLoss), true)} · ${formatPercent(position.profitLossPercent, isPrivacyMode)}`}
                    />
                  </dl>
                  <div className="ui-divider">
                    <p className="ui-label">Número Mágico</p>
                    <p className="mt-2 text-sm font-semibold text-white tabular-nums">
                      {formatQuantity(position.totalShares, isPrivacyMode)} /{' '}
                      {formatQuantity(position.magicNumber, isPrivacyMode)}{' '}
                      {position.assetClass === 'ACAO' ? 'ações' : 'cotas'}
                    </p>
                    <p className="ui-caption mt-1">
                      Proventos estimados para adquirir uma nova unidade por
                      mês.
                    </p>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Você ainda não tem este ativo"
                  description="Indicadores e proventos de referência estão disponíveis nas outras seções da ficha."
                  icon={<Building2 className="h-5 w-5" />}
                />
              )}
              <div className="ui-divider flex flex-wrap gap-2">
                {FII_PROPERTIES_CATALOG.some(
                  (property) => property.ticker === ticker,
                ) && (
                  <Button onClick={() => openRelated(onOpenMapForTicker)}>
                    <MapPin className="h-4 w-4" />
                    Ver imóveis
                  </Button>
                )}
                <Button onClick={() => openRelated(onOpenAiForTicker)}>
                  <Sparkles className="h-4 w-4" />
                  Análises e fatos
                </Button>
              </div>
            </div>
          )}

          {section === 'dividends' && (
            <div className="space-y-5">
              <div>
                <p className="ui-label">Provento mensal estimado por unidade</p>
                <p className="ui-value-lg mt-1">{currency(dividend)}</p>
                <p className="ui-caption mt-2">
                  Estimativa de renda; recebimentos ficam no extrato abaixo.
                </p>
              </div>
              {position && (
                <dl className="divide-y divide-white/[0.06]">
                  <Metric
                    label="Renda mensal estimada da posição"
                    value={currency(position.totalMonthlyDividend, true)}
                  />
                  <Metric
                    label="Yield on Cost mensal"
                    value={formatPercent(
                      position.yieldOnCostPercent,
                      isPrivacyMode,
                    )}
                  />
                  {position.paybackReceived !== undefined && (
                    <Metric
                      label="Proventos recebidos da posição"
                      value={currency(position.paybackReceived, true)}
                    />
                  )}
                  {position.isCurrentMonthAnnounced && (
                    <>
                      <Metric
                        label="Data-Com anunciada"
                        value={dateLabel(position.dividendExDate)}
                      />
                      <Metric
                        label="Pagamento anunciado"
                        value={dateLabel(position.dividendPaymentDate)}
                      />
                    </>
                  )}
                </dl>
              )}
              {position && (
                <div className="ui-divider">
                  {editing ? (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const value = Number(
                          dividendInput.trim().replace(',', '.'),
                        );
                        if (
                          !dividendInput.trim() ||
                          !Number.isFinite(value) ||
                          value < 0
                        ) {
                          setInputError(
                            'Informe um valor igual ou maior que zero.',
                          );
                          return;
                        }
                        onUpdateDividend(ticker, value);
                        setEditing(false);
                        setSaved(true);
                        setInputError(null);
                        dialogRef.current?.focus();
                      }}
                    >
                      <label className="ui-label block" htmlFor={inputId}>
                        Provento estimado por unidade
                      </label>
                      <input
                        id={inputId}
                        type="text"
                        autoFocus
                        inputMode="decimal"
                        value={dividendInput}
                        onChange={(event) =>
                          setDividendInput(event.target.value)
                        }
                        className="min-h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base text-white tabular-nums"
                        aria-invalid={Boolean(inputError)}
                        aria-describedby={
                          inputError ? `${inputId}-error` : undefined
                        }
                      />
                      {inputError && (
                        <p
                          id={`${inputId}-error`}
                          role="alert"
                          className="text-xs text-rose-300"
                        >
                          {inputError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button variant="primary" type="submit">
                          Salvar estimativa
                        </Button>
                        <Button
                          onClick={() => {
                            setEditing(false);
                            setInputError(null);
                            dialogRef.current?.focus();
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button
                      onClick={() => {
                        setDividendInput(String(dividend ?? 0));
                        setEditing(true);
                        setSaved(false);
                      }}
                    >
                      Ajustar estimativa por unidade
                    </Button>
                  )}
                  {saved && (
                    <p role="status" className="ui-caption mt-2">
                      Estimativa salva neste dispositivo.
                    </p>
                  )}
                </div>
              )}
              <section className="ui-divider">
                <h3 className="ui-title">Recebimentos registrados</h3>
                {receipts.length ? (
                  <ul className="mt-2 divide-y divide-white/[0.06]">
                    {receipts.map((receipt) => (
                      <li
                        key={receipt.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <span className="ui-caption">
                          {dateLabel(receipt.date, true)}
                        </span>
                        <span className="text-sm font-medium text-white tabular-nums">
                          {currency(Math.abs(receipt.total), true)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="Sem recebimentos registrados"
                    description="Importe a planilha de movimentação da B3 para conferir os créditos deste ativo."
                  />
                )}
              </section>
            </div>
          )}

          {section === 'indicators' && (
            <div className="space-y-5">
              <p className="ui-caption">
                {position?.segment ??
                  evaluated?.segment ??
                  'Sem classificação disponível'}
              </p>
              <dl className="divide-y divide-white/[0.06]">
                <Metric
                  label="P/VP"
                  value={pvp === undefined ? '—' : formatDecimal(pvp)}
                />
                <Metric
                  label="Valor patrimonial por unidade"
                  value={currency(position?.vp ?? evaluated?.vp ?? quote?.vp)}
                />
                <Metric
                  label="Preço-teto de referência"
                  value={currency(
                    position?.ceilingPrice ?? evaluated?.ceilingPrice,
                  )}
                />
                <Metric
                  label="Renda mensal estimada"
                  value={
                    position
                      ? formatPercent(position.currentYieldPercent)
                      : evaluated
                        ? formatPercent(evaluated.monthlyYieldPercent)
                        : '—'
                  }
                />
                {evaluated && (
                  <>
                    <Metric
                      label="DY anual estimado"
                      value={formatPercent(evaluated.annualYieldPercent)}
                    />
                    <Metric label="Gestão" value={evaluated.management} />
                    <Metric
                      label="Diversificação"
                      value={evaluated.diversification}
                    />
                  </>
                )}
              </dl>
              {evaluated && (
                <>
                  <p className="ui-caption">
                    {evaluated.qualityBadgeLabel}
                    {evaluated.isBelowAveragePrice
                      ? ' · Cotação abaixo do seu preço médio.'
                      : ''}
                  </p>
                  {evaluated.daysUntilExDate <= 5 && (
                    <p className="ui-caption">
                      Data-Com de referência:{' '}
                      {evaluated.daysUntilExDate === 0
                        ? 'hoje'
                        : `em ${evaluated.daysUntilExDate} dias`}
                      .
                    </p>
                  )}
                  <div className="ui-divider">
                    <h3 className="ui-title">Leitura dos indicadores</h3>
                    <p className="ui-caption mt-2">{evaluated.rationale}</p>
                    <p className="ui-caption mt-3">{evaluated.thesis}</p>
                  </div>
                  {evaluated.qualityWarnings.length > 0 && (
                    <div className="ui-divider">
                      <h3 className="text-sm font-semibold text-amber-200">
                        Pontos de atenção
                      </h3>
                      <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-relaxed text-zinc-400">
                        {evaluated.qualityWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluated.isYieldNormalized && (
                    <p className="ui-caption">
                      Provento normalizado para reduzir o efeito de pagamentos
                      não recorrentes.
                    </p>
                  )}
                </>
              )}
              <p className="ui-caption text-zinc-500">
                Fundamentos e indicadores são referências do catálogo e dos
                dados recebidos. Confira as fontes antes de decidir.
              </p>
            </div>
          )}
        </div>
        <footer className="ui-sheet__footer">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => openRelated(onOpenBuyModal)}
          >
            Aportar em {ticker}
          </Button>
        </footer>
      </div>
    </div>
  );
}
