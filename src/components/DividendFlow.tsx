'use client';

import { useState } from 'react';
import {
  Coins,
  CheckCircle2,
  Clock,
  HelpCircle,
  Calendar,
  TrendingUp,
  BarChart3,
  List,
} from 'lucide-react';
import { FiiPosition, Transaction, BcbIndicators } from '../types/portfolio';
import {
  calculateMonthDividends,
  calculateConfirmedDividendAnnouncements,
  formatDividendCalendarDate,
  getDividendEventDates,
} from '../data/fiiDividendCalendar';
import { DividendEvent, DividendStatus } from '../types/dividend';
import { PerformanceComparisonChart } from './PerformanceComparisonChart';
import { DividendStaircaseChart } from './DividendStaircaseChart';
import { Button, SegmentedControl } from './ui/Controls';
import { EmptyState } from './ui/Feedback';
import { formatCurrency } from '../lib/formatFinancial';
import type { PushAlertEventType } from '../lib/pushNavigation';
import { DividendReconciliationPanel } from './DividendReconciliationPanel';

interface DividendFlowProps {
  positions: FiiPosition[];
  transactions?: Transaction[];
  bcbIndicators?: BcbIndicators | null;
  monthlyContributionGoal?: number;
  isPrivacyMode?: boolean;
  focusedTicker?: string | null;
  focusedDate?: string | null;
  focusedEventType?: PushAlertEventType | null;
  onClearFocus?: () => void;
  onOpenB3Modal?: () => void;
  onOpenAsset?: (ticker: string) => void;
}

type EventView = 'timeline' | 'month';
type CalendarGroup = { date: Date; key: string; cutoff: DividendEvent[]; payments: DividendEvent[] };

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);

function formatFocusedEventLabel(eventType?: PushAlertEventType | null): string {
  switch (eventType) {
    case 'DIVIDEND_ANNOUNCED':
      return 'Novo anúncio confirmado';
    case 'DIVIDEND_UPDATED':
      return 'Alteração de provento confirmada';
    case 'EX_DATE_REMINDER':
      return 'Lembrete de Data-Com';
    case 'PAYMENT_REMINDER':
      return 'Pagamento anunciado para hoje';
    default:
      return 'Evento em destaque';
  }
}

export function DividendFlow({
  positions,
  transactions = [],
  bcbIndicators = null,
  monthlyContributionGoal = 200,
  isPrivacyMode = false,
  focusedTicker = null,
  focusedDate = null,
  focusedEventType = null,
  onClearFocus,
  onOpenB3Modal,
  onOpenAsset,
}: DividendFlowProps) {
  const [subView, setSubView] = useState<'calendar' | 'staircase' | 'chart'>('calendar');
  const [eventView, setEventView] = useState<EventView>('timeline');
  const [filterStatus, setFilterStatus] = useState<'ALL' | DividendStatus>('ALL');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(focusedDate);

  const currentDate = typeof window !== 'undefined' ? new Date() : new Date('2026-10-12T12:00:00Z');
  const formatBRL = (val: number) => {
    return formatCurrency(val, isPrivacyMode);
  };

  const currentMonthName = currentDate.toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
  });
  const currentMonthKey = currentDate.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
  const { events, summary } = calculateMonthDividends(positions, currentDate, {}, transactions);

  const filteredEvents = events.filter((event) => (
    filterStatus === 'ALL' || event.status === filterStatus
  ));

  const eventDates = new Map<string, ReturnType<typeof getDividendEventDates>>();
  for (const event of filteredEvents) {
    eventDates.set(event.id, getDividendEventDates(event, currentDate));
  }

  const grouped = new Map<string, CalendarGroup>();
  const getGroup = (date: Date) => {
    const key = dateKey(date);
    let group = grouped.get(key);
    if (!group) {
      group = { date, key, cutoff: [], payments: [] };
      grouped.set(key, group);
    }
    return group;
  };

  for (const event of filteredEvents) {
    const dates = eventDates.get(event.id);
    if (!dates) continue;
    getGroup(dates.paymentDate).payments.push(event);
    if (dates.announcementDate) getGroup(dates.announcementDate).cutoff.push(event);
  }
  const groups = [...grouped.values()].sort((a, b) => a.date.getTime() - b.date.getTime());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => (
    new Date(currentDate.getFullYear(), currentDate.getMonth(), index + 1)
  ));
  const todayKey = dateKey(currentDate);
  const selectedKey = selectedCalendarDay ?? groups.find((group) => (
    group.date.getFullYear() === currentDate.getFullYear() && group.date.getMonth() === currentDate.getMonth()
  ))?.key ?? todayKey;
  const selectedDate = monthDays.find((date) => dateKey(date) === selectedKey);
  const selectedGroup = groups.find((group) => group.key === selectedKey);

  const eventsForDay = (day: Date) => {
    const key = dateKey(day);
    return filteredEvents.filter((event) => {
      const dates = eventDates.get(event.id);
      return dates && (dateKey(dates.paymentDate) === key || (dates.announcementDate && dateKey(dates.announcementDate) === key));
    });
  };

  const renderEventRow = (event: DividendEvent) => {
    const dates = eventDates.get(event.id);
    const estimated = event.status === 'ESTIMATED';
    const isFocused = Boolean(focusedTicker && event.ticker === focusedTicker);
    return (
      <div
        key={event.id}
        className={`flex items-start justify-between gap-3 px-3.5 py-3 transition-colors ${
          isFocused ? 'bg-[#f5b800]/[0.08] ring-1 ring-inset ring-[#f5b800]/35' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {onOpenAsset ? <button type="button" className="ui-asset-trigger text-sm" onClick={() => onOpenAsset(event.ticker)} aria-label={`Abrir ficha de ${event.ticker}`}>{event.ticker}</button> : <span className="text-sm font-semibold text-white">{event.ticker}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              event.status === 'PAID'
                ? 'bg-emerald-400/10 text-emerald-300'
                : event.status === 'CONFIRMED'
                ? 'bg-violet-400/10 text-violet-300'
                : 'border border-dashed border-emerald-400/60 text-emerald-300'
            }`}>
              {event.status === 'PAID' ? 'Pago' : event.status === 'CONFIRMED' ? 'Confirmado' : 'Estimado'}
            </span>
            {isFocused && (
              <span className="rounded-full bg-[#f5b800]/20 px-2 py-0.5 text-[10px] font-semibold text-[#f5b800]">
                Em destaque
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {dates?.announcementDate && (
              <span className="text-[11px] text-zinc-400">
                Data-Com <span className="text-[13px] font-medium tabular-nums text-violet-200">· {formatDividendCalendarDate(dates.announcementDate)}</span>
              </span>
            )}
            <span className="text-[11px] text-zinc-400">
              Pagamento <span className="text-[13px] font-medium tabular-nums text-emerald-200">· {dates ? formatDividendCalendarDate(dates.paymentDate) : `${event.paymentDay}`}</span>
            </span>
          </div>
          {event.shares > 0 && (
            <p className="mt-1 text-[11px] text-zinc-500 tabular-nums">
              {isPrivacyMode ? '••••' : event.shares} {event.shares === 1 ? 'cota' : 'cotas'} × {formatBRL(event.dividendPerShare)}
            </p>
          )}
        </div>
        <div className="shrink-0 pt-0.5 text-right text-sm font-bold tabular-nums text-emerald-300">
          +{formatBRL(event.totalValue)}
          {estimated && <span className="mt-0.5 block text-[10px] font-medium text-zinc-400">estimado</span>}
        </div>
      </div>
    );
  };

  const renderDayGroup = (group: CalendarGroup) => (
    <section key={group.key} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121215]">
      <h3 className="border-b border-white/[0.06] px-3.5 py-2.5 text-xs font-semibold text-white">
        {group.date.toLocaleDateString('pt-BR', {
          weekday: 'short', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo',
        })}
      </h3>
      {group.cutoff.length > 0 && (
        <div className="border-b border-white/[0.06]">
          <div className="flex items-center gap-2 px-3.5 pt-2.5 text-[11px] font-semibold text-violet-200">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-violet-400" /> Data-Com
          </div>
          <div className="divide-y divide-white/[0.04]">{group.cutoff.map(renderEventRow)}</div>
        </div>
      )}
      {group.payments.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-3.5 pt-2.5 text-[11px] font-semibold text-emerald-200">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Pagamentos
          </div>
          <div className="divide-y divide-white/[0.04]">{group.payments.map(renderEventRow)}</div>
        </div>
      )}
    </section>
  );

  if (positions.length === 0 && events.length === 0) {
    return (
      <div className="ui-section"><EmptyState icon={<Coins className="h-5 w-5" />} title="Seus proventos aparecem aqui" description="Importe o extrato da B3 para acompanhar previsões e recebimentos por data." action={onOpenB3Modal && <Button variant="primary" onClick={onOpenB3Modal}>Importar extrato B3</Button>} /></div>
    );
  }

  return (
    <div className="space-y-4">
      {(focusedTicker || focusedDate || focusedEventType) && (
        <div
          role="region"
          aria-label="Evento aberto pela notificação"
          className="rounded-2xl border border-[#f5b800]/30 bg-[#18150c] p-3.5 text-xs text-zinc-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-semibold text-[#f5b800]">
                {formatFocusedEventLabel(focusedEventType)}
                {focusedTicker ? ` • ${focusedTicker}` : ''}
              </p>
              <p className="text-zinc-300">
                {focusedDate
                  ? `Data de referência: ${focusedDate.split('-').reverse().join('/')}. `
                  : ''}
                Confira os eventos destacados abaixo ou abra a ficha detalhada do ativo.
              </p>
            </div>
            {onClearFocus && (
              <button
                type="button"
                onClick={onClearFocus}
                className="shrink-0 text-[11px] font-medium text-zinc-400 underline hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>
          {focusedTicker && onOpenAsset && (
            <div className="mt-2.5">
              <Button
                variant="secondary"
                onClick={() => onOpenAsset(focusedTicker)}
              >
                Ver proventos de {focusedTicker}
              </Button>
            </div>
          )}
        </div>
      )}

      <SegmentedControl label="Conteúdo dos proventos" value={subView} onChange={setSubView} options={[
        { value: 'calendar', label: 'Proventos', icon: <Calendar /> }, { value: 'staircase', label: 'Evolução', icon: <BarChart3 /> }, { value: 'chart', label: 'Simulação', icon: <TrendingUp /> },
      ]} />

      {subView === 'calendar' ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="ui-section">
            <div className="mb-1 flex items-center justify-between">
              <span className="truncate text-xs font-medium text-zinc-400">Proventos • {capitalizedMonth}</span>
              <span className="shrink-0 rounded-full border border-[#f5b800]/30 bg-[#2b2512] px-2 py-0.5 text-[10px] font-medium text-[#f5b800]">Conferir no extrato</span>
            </div>
            <div className="ui-value-lg mb-3 mt-2">{formatBRL(summary.totalExpected)}</div>

            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.06] pb-4 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-zinc-300"><span className="h-2.5 w-2.5 rounded-full border-2 border-[#A78BFA]" />Data-Com</span>
              <span className="inline-flex items-center gap-1.5 text-zinc-300"><span className="h-2.5 w-2.5 rounded-full bg-[#34D399]" />Pagamento</span>
              <span className="inline-flex items-center gap-1.5 text-zinc-300"><span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-dashed border-[#34D399]"><span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" /></span>Estimado</span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
              <button type="button" onClick={() => setFilterStatus(filterStatus === 'PAID' ? 'ALL' : 'PAID')} aria-pressed={filterStatus === 'PAID'} className="pr-2 text-left">
                <div className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Pago</div>
                <div className="truncate text-xs font-bold text-white tabular-nums">{formatBRL(summary.totalReceived)}</div>
              </button>
              <button type="button" onClick={() => setFilterStatus(filterStatus === 'CONFIRMED' ? 'ALL' : 'CONFIRMED')} aria-pressed={filterStatus === 'CONFIRMED'} className="px-2 text-left">
                <div className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-violet-300"><Clock className="h-3.5 w-3.5" /> Confirmado</div>
                <div className="truncate text-xs font-bold text-white tabular-nums">{formatBRL(summary.totalConfirmed)}</div>
              </button>
              <button type="button" onClick={() => setFilterStatus(filterStatus === 'ESTIMATED' ? 'ALL' : 'ESTIMATED')} aria-pressed={filterStatus === 'ESTIMATED'} className="pl-2 text-left">
                <div className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-zinc-300"><HelpCircle className="h-3.5 w-3.5" /> Estimado</div>
                <div className="truncate text-xs font-bold text-white tabular-nums">{formatBRL(summary.totalEstimated)}</div>
              </button>
            </div>
          </div>

          <DividendReconciliationPanel
            positions={positions}
            transactions={transactions}
            confirmedEvents={calculateConfirmedDividendAnnouncements(positions, currentDate, transactions)}
            month={currentMonthKey}
            isPrivacyMode={isPrivacyMode}
          />

          <SegmentedControl label="Visualização dos proventos" value={eventView} onChange={setEventView} options={[{ value: 'timeline', label: 'Lista', icon: <List /> }, { value: 'month', label: 'Mês', icon: <Calendar /> }]} />

          {filterStatus !== 'ALL' && (
            <div className="flex justify-end px-1">
              <button type="button" onClick={() => setFilterStatus('ALL')} className="text-xs font-semibold text-[#f5b800]">Mostrar todos ({events.length})</button>
            </div>
          )}

          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#121215] p-5 text-center text-sm text-zinc-400">Nenhum evento neste filtro.</div>
          ) : eventView === 'timeline' ? (
            <div className="space-y-3">{groups.map(renderDayGroup)}</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-[20px] border border-white/[0.06] bg-[#121215] p-3.5">
                <div className="mb-3 px-1 text-sm font-semibold text-white">{capitalizedMonth}</div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((weekday, index) => <span key={`${weekday}-${index}`} className="pb-1 text-[10px] font-medium text-zinc-500">{weekday}</span>)}
                  {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}
                  {monthDays.map((day) => {
                    const dayEvents = eventsForDay(day);
                    const markers = dayEvents.flatMap((event) => {
                      const dates = eventDates.get(event.id);
                      const marks: Array<{ id: string; kind: 'cutoff' | 'payment'; estimated: boolean }> = [];
                      if (dates?.announcementDate && isSameDay(dates.announcementDate, day)) marks.push({ id: `${event.id}-cutoff`, kind: 'cutoff', estimated: false });
                      if (dates && isSameDay(dates.paymentDate, day)) marks.push({ id: `${event.id}-payment`, kind: 'payment', estimated: event.status === 'ESTIMATED' });
                      return marks;
                    });
                    const past = dayKeyForCompare(day) < todayKey;
                    return (
                      <button key={dateKey(day)} type="button" onClick={() => { setSelectedCalendarDay(dateKey(day)); }} aria-label={`${day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}${dayEvents.length ? `, ${dayEvents.length} evento(s)` : ''}`} aria-pressed={selectedKey === dateKey(day)} className={`flex min-h-[58px] min-w-0 flex-col items-center rounded-xl border px-0.5 py-1.5 transition-colors ${selectedKey === dateKey(day) ? 'border-white/20 bg-white/[0.08]' : 'border-transparent bg-transparent'} ${past ? 'opacity-45' : ''}`}>
                        <span className="text-xs font-semibold tabular-nums text-zinc-200">{day.getDate()}</span>
                        <span className="mt-1 flex h-3 items-center justify-center gap-0.5">
                          {markers.slice(0, 3).map((marker) => marker.kind === 'cutoff' ? (
                            <span key={marker.id} className="h-2 w-2 rounded-full border-[1.5px] border-[#A78BFA]" />
                          ) : marker.estimated ? (
                            <span key={marker.id} className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full border border-dashed border-[#34D399]"><span className="h-1 w-1 rounded-full bg-[#34D399]" /></span>
                          ) : <span key={marker.id} className="h-2 w-2 rounded-full bg-[#34D399]" />)}
                          {markers.length > 3 && <span className="text-[8px] leading-none text-zinc-400">+{markers.length - 3}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121215]">
                <h3 className="border-b border-white/[0.06] px-3.5 py-3 text-xs font-semibold text-white">
                  {selectedDate ? selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Eventos do dia'}
                </h3>
                {selectedGroup ? <>
                  {selectedGroup.cutoff.length > 0 && <div className="border-b border-white/[0.06]"><div className="flex items-center gap-2 px-3.5 pt-2.5 text-[11px] font-semibold text-violet-200"><span className="h-2.5 w-2.5 rounded-full border-2 border-violet-400" />Data-Com</div><div className="divide-y divide-white/[0.04]">{selectedGroup.cutoff.map(renderEventRow)}</div></div>}
                  {selectedGroup.payments.length > 0 && <div><div className="flex items-center gap-2 px-3.5 pt-2.5 text-[11px] font-semibold text-emerald-200"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Pagamentos</div><div className="divide-y divide-white/[0.04]">{selectedGroup.payments.map(renderEventRow)}</div></div>}
                </> : <p className="px-3.5 py-4 text-xs text-zinc-500">Nenhum evento neste dia. Selecione outro dia do mês.</p>}
              </div>
            </div>
          )}
        </div>
      ) : subView === 'staircase' ? (
        <div className="animate-in fade-in duration-150"><DividendStaircaseChart positions={positions} transactions={transactions} isPrivacyMode={isPrivacyMode} /></div>
      ) : (
        <div className="animate-in fade-in duration-150"><PerformanceComparisonChart positions={positions} transactions={transactions} monthlyContribution={monthlyContributionGoal} bcbIndicators={bcbIndicators} isPrivacyMode={isPrivacyMode} /></div>
      )}
    </div>
  );
}

function dayKeyForCompare(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
