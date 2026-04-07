/**
 * Refill / supply estimates from pill counts and scheduled intakes.
 */
import { Injectable } from '@angular/core';
import { Medication } from '../models/med.models';

/** Warn when estimated supply is at or below this many days (inclusive). */
export const DEFAULT_REFILL_WARN_DAYS = 7;

/** Pills consumed per calendar day at full adherence (enabled med only). */
export function pillsConsumedPerDay(med: Medication): number {
  if (!med.enabled) {
    return 0;
  }
  const intakesPerDay = med.times.length;
  const perIntake = med.pillsPerIntake ?? 1;
  return intakesPerDay * perIntake;
}

/**
 * Continuous days of supply if taking every scheduled dose.
 * Null when not tracking (no remainingQuantity) or no consumption rate.
 */
export function estimatedDaysOfSupply(med: Medication): number | null {
  if (med.remainingQuantity == null) {
    return null;
  }
  const perDay = pillsConsumedPerDay(med);
  if (perDay <= 0) {
    return null;
  }
  return med.remainingQuantity / perDay;
}

/** Conservative whole days until stock hits zero (floor). */
export function daysUntilOutFloored(med: Medication): number | null {
  const d = estimatedDaysOfSupply(med);
  if (d === null) {
    return null;
  }
  return Math.floor(d);
}

/** User-facing sentence; null when not tracking supply. */
export function runOutMessage(med: Medication): string | null {
  if (med.remainingQuantity == null) {
    return null;
  }
  const days = daysUntilOutFloored(med);
  if (days === null) {
    return null;
  }
  if (med.remainingQuantity <= 0) {
    return 'You have no pills left in your count for this medicine.';
  }
  if (days <= 0) {
    return 'You will run out of this medicine in less than a day at your current schedule.';
  }
  return `You will run out of this medicine in ${days} day${days === 1 ? '' : 's'}.`;
}

export function shouldWarnRefill(
  med: Medication,
  warnBelowDays: number = DEFAULT_REFILL_WARN_DAYS
): boolean {
  if (med.remainingQuantity == null) {
    return false;
  }
  const d = estimatedDaysOfSupply(med);
  if (d === null) {
    return false;
  }
  return d <= warnBelowDays;
}

@Injectable({ providedIn: 'root' })
export class RefillService {
  pillsConsumedPerDay(med: Medication): number {
    return pillsConsumedPerDay(med);
  }

  estimatedDaysOfSupply(med: Medication): number | null {
    return estimatedDaysOfSupply(med);
  }

  daysUntilOutFloored(med: Medication): number | null {
    return daysUntilOutFloored(med);
  }

  runOutMessage(med: Medication): string | null {
    return runOutMessage(med);
  }

  shouldWarnRefill(med: Medication, warnBelowDays?: number): boolean {
    return shouldWarnRefill(med, warnBelowDays);
  }
}
