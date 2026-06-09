import { parseISO, isWithinInterval, differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Phase } from '@/domain/types/phase';

export function findActivePhase(phases: Phase[], referenceDate: Date = new Date()): Phase | null {
  const active = phases.filter((p) => p.deletedAt === null);
  return (
    active.find((p) =>
      isWithinInterval(referenceDate, {
        start: parseISO(p.startDate),
        end: parseISO(p.endDate),
      }),
    ) ?? null
  );
}

export function getDayNumber(phaseStartDate: string, referenceDate: Date = new Date()): number {
  const start = parseISO(phaseStartDate);
  return differenceInCalendarDays(referenceDate, start) + 1;
}

export function getDaysRemaining(phaseEndDate: string, referenceDate: Date = new Date()): number {
  const end = parseISO(phaseEndDate);
  return Math.max(0, differenceInCalendarDays(end, referenceDate));
}

export function getTotalDays(startDate: string, endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
}

export function formatDate(isoDate: string, pattern: string = 'dd/MM/yyyy'): string {
  return format(parseISO(isoDate), pattern, { locale: ptBR });
}

export function formatShortDate(isoDate: string): string {
  return format(parseISO(isoDate), 'dd/MM', { locale: ptBR });
}

export function isDateInRange(date: Date, startDate: string, endDate: string): boolean {
  return isWithinInterval(date, {
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
}

export function sortPhasesByOrder(phases: Phase[]): Phase[] {
  return [...phases].sort((a, b) => a.order - b.order);
}
