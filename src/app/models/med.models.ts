/** Optional form / UI label (stored when supported by API). */
export type MedicationKind = 'tablet' | 'capsule' | 'injection' | 'other';

/**
 * Who this profile is for — used for general reminder tips only (not dosing or diagnosis).
 * Stored per profile on the server.
 */
export type PatientGroup = 'infant' | 'child' | 'adult' | 'older_adult' | 'pregnancy';

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  /** Caregiver alert contact (optional) */
  caregiverEmail?: string;
  caregiverPhone?: string;
  /** Context for non-medical tips (defaults to adult if unset). */
  patientGroup?: PatientGroup;
}

export interface Medication {
  id: string;
  profileId: string;
  name: string;
  dosageNote?: string;
  /** 24h times e.g. "08:00", "21:30" */
  times: string[];
  enabled: boolean;
  /** Pills left in the current bottle/pack (optional refill tracking); null clears tracking on save */
  remainingQuantity?: number | null;
  /** Pills consumed each time a dose is marked “taken” (default 1) */
  pillsPerIntake?: number;
  kind?: MedicationKind;
}

export interface DoseLogEntry {
  id: string;
  medicationId: string;
  date: string;
  scheduledTime: string;
  status: 'taken' | 'skipped' | 'missed';
  loggedAt: string;
}

export interface TodayDose {
  key: string;
  medicationId: string;
  profileId: string;
  profileName: string;
  medName: string;
  dosageNote?: string;
  time: string;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
}
