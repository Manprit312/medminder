import { Router } from 'express';
import { asyncRoute } from '../async-route.js';
import { queryAll, queryOne } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

type AgentPriority = 'low' | 'medium' | 'high';

interface AgentDefinition {
  id:
    | 'adherence-coach'
    | 'risk-triage'
    | 'drug-education'
    | 'refill-forecast'
    | 'caregiver-summary'
    | 'schedule-optimizer'
    | 'voice-dose-log'
    | 'onboarding-guide';
  title: string;
  purpose: string;
  enabledByDefault: boolean;
}

interface AgentRecommendation {
  agentId: AgentDefinition['id'];
  priority: AgentPriority;
  reason: string;
}

const AGENT_CATALOG: AgentDefinition[] = [
  {
    id: 'adherence-coach',
    title: 'Adherence Coach',
    purpose: 'Summarizes missed patterns and suggests habit improvements.',
    enabledByDefault: true,
  },
  {
    id: 'risk-triage',
    title: 'Risk Triage',
    purpose: 'Flags high-risk dose patterns for quick follow-up.',
    enabledByDefault: true,
  },
  {
    id: 'drug-education',
    title: 'Drug Education',
    purpose: 'Explains medicine purpose and safety notes in plain language.',
    enabledByDefault: true,
  },
  {
    id: 'refill-forecast',
    title: 'Refill Forecast',
    purpose: 'Predicts run-out dates based on stock and consumption.',
    enabledByDefault: true,
  },
  {
    id: 'caregiver-summary',
    title: 'Caregiver Summary',
    purpose: 'Prepares daily/weekly updates for caretakers.',
    enabledByDefault: true,
  },
  {
    id: 'schedule-optimizer',
    title: 'Schedule Optimizer',
    purpose: 'Suggests reminder times from user logging behavior.',
    enabledByDefault: false,
  },
  {
    id: 'voice-dose-log',
    title: 'Voice Dose Log',
    purpose: 'Supports natural language dose logging workflows.',
    enabledByDefault: false,
  },
  {
    id: 'onboarding-guide',
    title: 'Onboarding Guide',
    purpose: 'Improves first-run setup and reminder readiness checks.',
    enabledByDefault: true,
  },
];

export const agentsRouter = Router();
agentsRouter.use(authMiddleware);

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

agentsRouter.get(
  '/catalog',
  asyncRoute(async (_req, res) => {
    res.json({ agents: AGENT_CATALOG });
  })
);

agentsRouter.get(
  '/recommendations',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const profileId = String(req.query.profileId ?? '').trim();
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }

    const profile = await queryOne<{ id: string; name: string; caregiver_email: string | null }>(
      'SELECT id, name, caregiver_email FROM profiles WHERE id = ? AND user_id = ?',
      [profileId, userId]
    );
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const meds = await queryAll<{ id: string; name: string; remaining_quantity: number | null; pills_per_intake: number }>(
      'SELECT id, name, remaining_quantity, pills_per_intake FROM medications WHERE profile_id = ? AND enabled = 1',
      [profileId]
    );

    const medIds = meds.map((m) => m.id);
    let taken = 0;
    let skipped = 0;
    let missed = 0;
    if (medIds.length > 0) {
      const marks = medIds.map(() => '?').join(',');
      const fromDate = isoDateDaysAgo(14);
      const rows = await queryAll<{ status: string; c: number }>(
        `SELECT status, COUNT(*) AS c FROM dose_logs WHERE medication_id IN (${marks}) AND date >= ? GROUP BY status`,
        [...medIds, fromDate]
      );
      for (const r of rows) {
        const count = Number(r.c ?? 0);
        if (r.status === 'taken') {
          taken += count;
        } else if (r.status === 'skipped') {
          skipped += count;
        } else if (r.status === 'missed') {
          missed += count;
        }
      }
    }

    const totalLogged = taken + skipped + missed;
    const missRate = totalLogged > 0 ? missed / totalLogged : 0;
    const lowStockCount = meds.filter((m) => {
      if (m.remaining_quantity == null) {
        return false;
      }
      const p = m.pills_per_intake > 0 ? m.pills_per_intake : 1;
      return m.remaining_quantity <= p * 3;
    }).length;

    const recs: AgentRecommendation[] = [];
    recs.push({
      agentId: 'adherence-coach',
      priority: missRate >= 0.2 ? 'high' : 'medium',
      reason:
        totalLogged === 0
          ? 'No recent logging history. Coaching can help create a consistent routine.'
          : `Recent adherence trend: ${taken} taken, ${missed} missed in last 14 days.`,
    });
    recs.push({
      agentId: 'risk-triage',
      priority: missed >= 3 ? 'high' : missed > 0 ? 'medium' : 'low',
      reason:
        missed >= 3
          ? 'Multiple recent missed doses detected; escalate checks and caregiver visibility.'
          : missed > 0
            ? 'Some missed doses were logged recently.'
            : 'No missed-dose pattern in recent logs.',
    });
    recs.push({
      agentId: 'refill-forecast',
      priority: lowStockCount > 0 ? 'high' : 'medium',
      reason:
        lowStockCount > 0
          ? `${lowStockCount} medication(s) appear near refill threshold.`
          : 'Refill forecasting can still prevent future run-outs.',
    });
    recs.push({
      agentId: 'caregiver-summary',
      priority: profile.caregiver_email ? 'high' : 'low',
      reason: profile.caregiver_email
        ? 'A caregiver contact exists; summary automation can reduce manual updates.'
        : 'Enable when a caregiver contact is configured.',
    });
    recs.push({
      agentId: 'schedule-optimizer',
      priority: totalLogged >= 7 ? 'medium' : 'low',
      reason:
        totalLogged >= 7
          ? 'Sufficient logging history exists to suggest better reminder times.'
          : 'Needs more logging data for quality suggestions.',
    });
    recs.push({
      agentId: 'drug-education',
      priority: 'medium',
      reason: 'Useful for plain-language medicine context and safety reminders.',
    });
    recs.push({
      agentId: 'voice-dose-log',
      priority: 'low',
      reason: 'Optional convenience feature for faster check-ins.',
    });
    recs.push({
      agentId: 'onboarding-guide',
      priority: totalLogged === 0 ? 'high' : 'medium',
      reason:
        totalLogged === 0
          ? 'No logged doses yet; onboarding guidance can reduce first-week drop-off.'
          : 'Can still improve new-profile setup quality.',
    });

    res.json({
      profile: { id: profile.id, name: profile.name },
      context: { taken, skipped, missed, totalLogged, lowStockCount },
      recommendations: recs,
    });
  })
);
