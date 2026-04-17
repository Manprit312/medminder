import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export type DoseCheckinLevel = 'none' | 'mild' | 'concerning';

export interface AssistantPrefs {
  aiEnabled: boolean;
  strictMedicalGuardrails: boolean;
}

export interface SymptomEntry {
  id: string;
  profileId: string;
  recordedAt: string;
  tag: string;
  severity: 1 | 2 | 3 | 4 | 5;
  notes: string;
}

const KEY_ASSISTANT_PREFS = 'assistant_prefs_v1';
const KEY_DOSE_CHECKINS = 'assistant_dose_checkins_v1';
const KEY_SYMPTOMS = 'assistant_symptoms_v1';
const MAX_SYMPTOMS = 500;

@Injectable({ providedIn: 'root' })
export class HealthAssistantService {
  async getPrefs(): Promise<AssistantPrefs> {
    const { value } = await Preferences.get({ key: KEY_ASSISTANT_PREFS });
    if (!value) {
      return { aiEnabled: false, strictMedicalGuardrails: true };
    }
    try {
      const o = JSON.parse(value) as Partial<AssistantPrefs>;
      return {
        aiEnabled: Boolean(o.aiEnabled),
        strictMedicalGuardrails: o.strictMedicalGuardrails !== false,
      };
    } catch {
      return { aiEnabled: false, strictMedicalGuardrails: true };
    }
  }

  async savePrefs(next: AssistantPrefs): Promise<void> {
    await Preferences.set({
      key: KEY_ASSISTANT_PREFS,
      value: JSON.stringify({
        aiEnabled: Boolean(next.aiEnabled),
        strictMedicalGuardrails: next.strictMedicalGuardrails !== false,
      }),
    });
  }

  async getDoseCheckin(key: string): Promise<DoseCheckinLevel | null> {
    const all = await this.readDoseCheckins();
    return all[key] ?? null;
  }

  async setDoseCheckin(key: string, value: DoseCheckinLevel): Promise<void> {
    const all = await this.readDoseCheckins();
    all[key] = value;
    await Preferences.set({ key: KEY_DOSE_CHECKINS, value: JSON.stringify(all) });
  }

  async listSymptoms(profileId: string): Promise<SymptomEntry[]> {
    const all = await this.readSymptoms();
    return all
      .filter((s) => s.profileId === profileId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async addSymptom(entry: Omit<SymptomEntry, 'id'> & { id?: string }): Promise<SymptomEntry> {
    const all = await this.readSymptoms();
    const id = entry.id ?? crypto.randomUUID();
    const row: SymptomEntry = { ...entry, id };
    const next = [row, ...all.filter((x) => x.id !== id)].slice(0, MAX_SYMPTOMS);
    await Preferences.set({ key: KEY_SYMPTOMS, value: JSON.stringify(next) });
    return row;
  }

  async removeSymptom(id: string): Promise<void> {
    const all = await this.readSymptoms();
    await Preferences.set({
      key: KEY_SYMPTOMS,
      value: JSON.stringify(all.filter((s) => s.id !== id)),
    });
  }

  buildAiReply(query: string, ctx: { taken: number; pending: number; missed: number; nextDose: string | null }): string {
    const q = query.trim().toLowerCase();
    if (!q) {
      return 'Ask me about your reminders, missed doses, refill readiness, or symptom logging.';
    }
    if (q.includes('miss')) {
      return ctx.missed > 0
        ? `You have ${ctx.missed} missed dose(s) today. Open a medicine card and use the missed-dose checklist to confirm/correct logs.`
        : 'No missed doses logged today. Keep using the check-ins to track how you feel.';
    }
    if (q.includes('next') || q.includes('when')) {
      return ctx.nextDose
        ? `Your next scheduled dose is at ${ctx.nextDose}.`
        : 'No upcoming pending doses right now.';
    }
    if (q.includes('progress') || q.includes('adherence')) {
      return `Today: ${ctx.taken} taken, ${ctx.pending} pending, ${ctx.missed} missed.`;
    }
    return 'I can help summarize your day, highlight missed doses, and guide what to do next. I do not diagnose or replace clinician advice.';
  }

  private async readDoseCheckins(): Promise<Record<string, DoseCheckinLevel>> {
    const { value } = await Preferences.get({ key: KEY_DOSE_CHECKINS });
    if (!value) {
      return {};
    }
    try {
      const o = JSON.parse(value) as Record<string, DoseCheckinLevel>;
      return o && typeof o === 'object' ? o : {};
    } catch {
      return {};
    }
  }

  private async readSymptoms(): Promise<SymptomEntry[]> {
    const { value } = await Preferences.get({ key: KEY_SYMPTOMS });
    if (!value) {
      return [];
    }
    try {
      const arr = JSON.parse(value) as SymptomEntry[];
      if (!Array.isArray(arr)) {
        return [];
      }
      return arr.filter((s) => s && typeof s.id === 'string' && typeof s.profileId === 'string');
    } catch {
      return [];
    }
  }
}

