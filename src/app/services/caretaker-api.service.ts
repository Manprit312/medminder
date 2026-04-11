import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { getApiUrl } from '../../environments/api-url';
import { withApiTimeout } from '../shared/http-api-timeout';
import { Medication } from '../models/med.models';

export interface CaretakingProfileRef {
  id: string;
  name: string;
}

export interface CaretakingDetailResponse {
  profile: { id: string; name: string };
  date: string;
  medications: Medication[];
  logs: {
    id: string;
    medicationId: string;
    date: string;
    scheduledTime: string;
    status: string;
    loggedAt: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class CaretakerApiService {
  constructor(private readonly http: HttpClient) {}

  private base(): string {
    return getApiUrl();
  }

  async listCaretakingProfiles(): Promise<CaretakingProfileRef[]> {
    const res = await firstValueFrom(
      withApiTimeout(this.http.get<{ profiles: CaretakingProfileRef[] }>(`${this.base()}/api/caretaker/caretaking`))
    );
    return res.profiles;
  }

  async getCaretakingDetail(profileId: string, date?: string): Promise<CaretakingDetailResponse> {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    return firstValueFrom(
      withApiTimeout(
        this.http.get<CaretakingDetailResponse>(`${this.base()}/api/caretaker/caretaking/${profileId}${q}`)
      )
    );
  }

  previewInvite(token: string): Promise<{ inviteeEmail: string; profileName: string }> {
    return firstValueFrom(
      withApiTimeout(
        this.http.get<{ inviteeEmail: string; profileName: string }>(
          `${this.base()}/api/caretaker/invites/preview?token=${encodeURIComponent(token)}`
        )
      )
    );
  }

  acceptInvite(token: string): Promise<{ ok: boolean; profileId: string }> {
    return firstValueFrom(
      withApiTimeout(this.http.post<{ ok: boolean; profileId: string }>(`${this.base()}/api/caretaker/invites/accept`, { token }))
    );
  }

  sendInvite(profileId: string, inviteeEmail: string): Promise<{
    invite: { id: string; expiresAt: string; emailed: boolean };
    acceptUrl?: string;
    /** Why email was not sent (missing config or SMTP error). */
    mailHint?: string;
  }> {
    return firstValueFrom(
      withApiTimeout(
        this.http.post<{
          invite: { id: string; expiresAt: string; emailed: boolean };
          acceptUrl?: string;
          mailHint?: string;
        }>(`${this.base()}/api/caretaker/invites`, { profileId, inviteeEmail })
      )
    );
  }
}
