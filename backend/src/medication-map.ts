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
  kind: string | null;
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
    kind: normalizeKind(row.kind),
  };
}

const KINDS = new Set(['tablet', 'capsule', 'injection', 'other']);

function normalizeKind(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === '') {
    return undefined;
  }
  const s = String(raw).trim();
  return KINDS.has(s) ? s : undefined;
}

/** Accept API body value; invalid values become undefined (omit). */
export function parseMedicationKind(raw: unknown): string | undefined {
  return normalizeKind(raw == null ? null : String(raw));
}
