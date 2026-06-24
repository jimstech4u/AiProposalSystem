import { selectRows } from './supabase';

export type CostEstimateRow = {
  id: string;
  project_id: string;
  currency?: string | null;
  development_cost?: number | null;
  infrastructure_cost?: number | null;
  third_party_cost?: number | null;
  contingency_percent?: number | null;
  contingency_amount?: number | null;
  total_cost?: number | null;
  min_cost?: number | null;
  max_cost?: number | null;
  confidence_score?: number | null;
  created_at?: string | null;
};

export type TechRecommendationRow = {
  id: string;
  project_id: string;
  stack_name: string;
  frontend?: string | null;
  backend?: string | null;
  database_name?: string | null;
  hosting?: string | null;
  match_score?: number | null;
  rationale?: string | null;
  pros?: string[] | null;
  cons?: string[] | null;
  alternatives?: any[] | null;
  created_at?: string | null;
};

export type TimelineRow = {
  id: string;
  project_id: string;
  duration_weeks: number;
  min_weeks?: number | null;
  max_weeks?: number | null;
  risk_level?: string | null;
  confidence_score?: number | null;
  critical_path?: Array<{ name?: string; date?: string; status?: string }> | null;
  created_at?: string | null;
};

export type ProposalPlanning = {
  costs: Record<string, CostEstimateRow>;
  tech: Record<string, TechRecommendationRow>;
  timelines: Record<string, TimelineRow>;
};

const emptyPlanning: ProposalPlanning = { costs: {}, tech: {}, timelines: {} };

function latestByProject<T extends { project_id: string; created_at?: string | null }>(rows: T[]) {
  return rows.reduce<Record<string, T>>((acc, row) => {
    const current = acc[row.project_id];
    if (!current || new Date(row.created_at ?? 0).getTime() > new Date(current.created_at ?? 0).getTime()) {
      acc[row.project_id] = row;
    }
    return acc;
  }, {});
}

function projectFilter(projectIds: string[]) {
  const ids = Array.from(new Set(projectIds.filter(Boolean)));
  return ids.length ? `project_id=in.(${ids.join(',')})` : '';
}

export async function loadProposalPlanning(projectIds: string[]): Promise<ProposalPlanning> {
  const filter = projectFilter(projectIds);
  if (!filter) return emptyPlanning;

  const [costRows, techRows, timelineRows] = await Promise.all([
    selectRows<CostEstimateRow>('cost_estimations', `select=*&${filter}&order=created_at.desc`),
    selectRows<TechRecommendationRow>('tech_recommendations', `select=*&${filter}&order=created_at.desc`),
    selectRows<TimelineRow>('timeline_predictions', `select=*&${filter}&order=created_at.desc`),
  ]);

  return {
    costs: latestByProject(costRows),
    tech: latestByProject(techRows),
    timelines: latestByProject(timelineRows),
  };
}

export function formatCostEstimate(cost?: CostEstimateRow) {
  if (!cost) return 'No cost estimate saved yet.';
  const currency = cost.currency || 'NGN';
  return [
    `Development Cost: ${currency} ${Number(cost.development_cost || 0).toLocaleString()}`,
    `Infrastructure Cost: ${currency} ${Number(cost.infrastructure_cost || 0).toLocaleString()}`,
    `Third Party Cost: ${currency} ${Number(cost.third_party_cost || 0).toLocaleString()}`,
    `Contingency: ${cost.contingency_percent ?? 0}% / ${currency} ${Number(cost.contingency_amount || 0).toLocaleString()}`,
    `Total Cost: ${currency} ${Number(cost.total_cost || 0).toLocaleString()}`,
    `Range: ${currency} ${Number(cost.min_cost || 0).toLocaleString()} - ${currency} ${Number(cost.max_cost || 0).toLocaleString()}`,
    `Confidence: ${cost.confidence_score ?? 'Not set'}`,
  ].join('\n');
}

export function formatTechRecommendation(tech?: TechRecommendationRow) {
  if (!tech) return 'No technology recommendation saved yet.';
  return [
    `Stack: ${tech.stack_name}`,
    `Frontend: ${tech.frontend || 'Not set'}`,
    `Backend: ${tech.backend || 'Not set'}`,
    `Database: ${tech.database_name || 'Not set'}`,
    `Hosting: ${tech.hosting || 'Not set'}`,
    `Match Score: ${tech.match_score ?? 'Not set'}`,
    `Rationale: ${tech.rationale || 'Not provided.'}`,
    `Pros: ${(tech.pros ?? []).join(', ') || 'Not provided.'}`,
    `Cons: ${(tech.cons ?? []).join(', ') || 'Not provided.'}`,
  ].join('\n');
}

export function formatTimelinePrediction(timeline?: TimelineRow) {
  if (!timeline) return 'No timeline prediction saved yet.';
  return [
    `Duration: ${timeline.duration_weeks} weeks`,
    `Range: ${timeline.min_weeks ?? 'Not set'} - ${timeline.max_weeks ?? 'Not set'} weeks`,
    `Risk Level: ${timeline.risk_level ?? 'Not set'}`,
    `Confidence: ${timeline.confidence_score ?? 'Not set'}`,
    `Critical Path:\n${(timeline.critical_path ?? []).map((item) => `- ${item.name || 'Milestone'}${item.date ? ` (${item.date})` : ''}${item.status ? ` - ${item.status}` : ''}`).join('\n') || 'No critical path saved.'}`,
  ].join('\n');
}

