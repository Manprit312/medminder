/** Shared JSON shape for medications API (profiles + medications routes). */

export type MedicationRow = {
  id: string;
  profile_id: string;
  name: string;
  dosage_note: string | null;
  times_json: string;
  enabled: number;
  remaining_quantity: number | null;
  pills_per_intake: number | null;
};

export function mapMedicationRow(row: MedicationRow) {
  let times: string[] = [];
  try {
    times = JSON.parse(row.times_json) as string[];
  } catch {
    times = [];
  }
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    dosageNote: row.dosage_note ?? undefined,
    times,
    enabled: Boolean(row.enabled),
    remainingQuantity: row.remaining_quantity ?? undefined,
    pillsPerIntake: row.pills_per_intake != null ? row.pills_per_intake : 1,
  };
}
