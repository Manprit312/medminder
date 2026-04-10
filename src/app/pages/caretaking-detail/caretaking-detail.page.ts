import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { CaretakerApiService, CaretakingDetailResponse } from '../../services/caretaker-api.service';
import { Medication } from '../../models/med.models';

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-caretaking-detail',
  templateUrl: './caretaking-detail.page.html',
  styleUrls: ['./caretaking-detail.page.scss'],
  standalone: false,
})
export class CaretakingDetailPage implements ViewWillEnter {
  profileId = '';
  data: CaretakingDetailResponse | null = null;
  loading = true;
  error: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly caretakerApi: CaretakerApiService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.profileId = this.route.snapshot.paramMap.get('profileId') ?? '';
    this.loading = true;
    this.error = null;
    this.data = null;
    if (!this.profileId) {
      this.error = 'Missing profile.';
      this.loading = false;
      return;
    }
    try {
      this.data = await this.caretakerApi.getCaretakingDetail(this.profileId, todayStr());
    } catch {
      this.error = 'Could not load this care profile.';
    } finally {
      this.loading = false;
    }
  }

  /** Each scheduled time with log status, or `pending` if not logged yet today. */
  slotsForMed(med: Medication): { scheduledTime: string; status: string }[] {
    if (!this.data) {
      return [];
    }
    const byTime = new Map(
      this.data.logs.filter((l) => l.medicationId === med.id).map((l) => [l.scheduledTime, l.status])
    );
    return med.times.map((t) => ({
      scheduledTime: t,
      status: byTime.get(t) ?? 'pending',
    }));
  }

  formatTime12h(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m ?? 0, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
}
