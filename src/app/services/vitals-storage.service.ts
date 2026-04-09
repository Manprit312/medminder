import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const KEY = 'vitals_readings_v1';
const MAX_READINGS = 400;

export interface VitalReading {
  id: string;
  profileId: string;
  /** ISO 8601 local recording time */
  recordedAt: string;
  systolic?: number;
  diastolic?: number;
  heartRateBpm?: number;
}

@Injectable({ providedIn: 'root' })
export class VitalsStorageService {
  async getAll(): Promise<VitalReading[]> {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) {
      return [];
    }
    try {
      const arr = JSON.parse(value) as VitalReading[];
      if (!Array.isArray(arr)) {
        return [];
      }
      return arr
        .filter((r) => r && typeof r.id === 'string' && typeof r.profileId === 'string')
        .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    } catch {
      return [];
    }
  }

  async getForProfile(profileId: string): Promise<VitalReading[]> {
    const all = await this.getAll();
    return all.filter((r) => r.profileId === profileId);
  }

  async add(reading: Omit<VitalReading, 'id'> & { id?: string }): Promise<VitalReading> {
    const all = await this.getAll();
    const id = reading.id ?? crypto.randomUUID();
    const row: VitalReading = {
      id,
      profileId: reading.profileId,
      recordedAt: reading.recordedAt,
      systolic: reading.systolic,
      diastolic: reading.diastolic,
      heartRateBpm: reading.heartRateBpm,
    };
    const next = [row, ...all.filter((x) => x.id !== id)];
    const trimmed = next.slice(0, MAX_READINGS);
    await Preferences.set({ key: KEY, value: JSON.stringify(trimmed) });
    return row;
  }

  async remove(id: string): Promise<void> {
    const all = await this.getAll();
    await Preferences.set({
      key: KEY,
      value: JSON.stringify(all.filter((r) => r.id !== id)),
    });
  }
}
