import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { getApiUrl } from '../../environments/api-url';
import { withApiTimeout } from '../shared/http-api-timeout';

export type AgentPriority = 'low' | 'medium' | 'high';

export interface AgentDefinition {
  id: string;
  title: string;
  purpose: string;
  enabledByDefault: boolean;
}

export interface AgentRecommendation {
  agentId: string;
  priority: AgentPriority;
  reason: string;
}

export interface AgentRecommendationsResponse {
  profile: { id: string; name: string };
  context: {
    taken: number;
    skipped: number;
    missed: number;
    totalLogged: number;
    lowStockCount: number;
  };
  recommendations: AgentRecommendation[];
}

@Injectable({ providedIn: 'root' })
export class AiAgentsService {
  constructor(private readonly http: HttpClient) {}

  private base(): string {
    return getApiUrl();
  }

  async getCatalog(): Promise<AgentDefinition[]> {
    const res = await firstValueFrom(
      withApiTimeout(this.http.get<{ agents: AgentDefinition[] }>(`${this.base()}/api/agents/catalog`))
    );
    return res.agents;
  }

  async getRecommendations(profileId: string): Promise<AgentRecommendationsResponse> {
    return firstValueFrom(
      withApiTimeout(
        this.http.get<AgentRecommendationsResponse>(
          `${this.base()}/api/agents/recommendations?profileId=${encodeURIComponent(profileId)}`
        )
      )
    );
  }
}
