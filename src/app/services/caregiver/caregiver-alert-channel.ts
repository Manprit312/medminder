/**
 * Pluggable channel for caregiver notifications (missed doses).
 * Add SMS/WhatsApp by implementing this interface and wiring the class in {@link CaregiverAlertService}.
 */
export interface CaregiverAlertPayload {
  profileId: string;
  profileName: string;
  medicationName: string;
  scheduledTime: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  caregiverEmail?: string;
  caregiverPhone?: string;
}

export interface CaregiverAlertChannel {
  readonly id: string;
  notifyMissedDose(payload: CaregiverAlertPayload): Promise<void>;
}
