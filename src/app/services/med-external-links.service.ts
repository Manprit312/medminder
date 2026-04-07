import { Injectable } from '@angular/core';

/** NIH DailyMed — human drug labels (opens in browser). */
const DAILYMED_SEARCH_BASE =
  'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=human&query=';

@Injectable({
  providedIn: 'root',
})
export class MedExternalLinksService {
  /** Search DailyMed by medication name; returns null if name is empty. */
  dailyMedSearchUrl(medicationName: string): string | null {
    const q = medicationName.trim();
    if (!q) {
      return null;
    }
    return `${DAILYMED_SEARCH_BASE}${encodeURIComponent(q)}`;
  }

  openUrl(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
