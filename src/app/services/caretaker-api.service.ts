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

export interface CaretakerAlert {
  id: string;
  profileId: string;
  medicationId: string;
  profileName: string;
  medicationName: string;
  date: string;
  scheduledTime: string;
  status: string;
  message: string;
  createdAt: string;
  readAt: string | null;
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

  getCaretakingCalendarStatus(
    profileId: string,
    from: string,
    to: string
  ): Promise<{ from: string; to: string; days: { date: string; status: string }[] }> {
    return firstValueFrom(
      withApiTimeout(
        this.http.get<{ from: string; to: string; days: { date: string; status: string }[] }>(
          `${this.base()}/api/caretaker/caretaking/${profileId}/calendar-status?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        )
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

  listAlerts(unreadOnly = false, limit = 25): Promise<{ unreadCount: number; alerts: CaretakerAlert[] }> {
    const unread = unreadOnly ? '1' : '0';
    return firstValueFrom(
      withApiTimeout(
        this.http.get<{ unreadCount: number; alerts: CaretakerAlert[] }>(
          `${this.base()}/api/caretaker/alerts?unread=${unread}&limit=${Math.max(1, Math.min(100, limit))}`
        )
      )
    );
  }

  markAlertRead(id: string): Promise<{ ok: boolean }> {
    return firstValueFrom(
      withApiTimeout(this.http.post<{ ok: boolean }>(`${this.base()}/api/caretaker/alerts/${encodeURIComponent(id)}/read`, {}))
    );
  }

  markProfileAlertsRead(profileId: string): Promise<{ ok: boolean }> {
    return firstValueFrom(
      withApiTimeout(
        this.http.post<{ ok: boolean }>(
          `${this.base()}/api/caretaker/alerts/read-profile/${encodeURIComponent(profileId)}`,
          {}
        )
      )
    );
  }
}
