export type StrategyListItem = {
  id: string;
  name: string;
  status: string;
  version: number;
  has_approved_version: boolean;
  is_current: boolean;
  updated_at: string;
};

export type StrategyDetail = {
  id: string;
  name: string;
  status: string;
  version: number;
  has_approved_version: boolean;
  is_current: boolean;
  latest_version: {
    id: string;
    status: string;
    version_number: number;
    row_version: number;
    linked_approved_profile_version_id: string | null;
    organic_enabled: boolean;
    paid_enabled: boolean;
    missing_source: boolean;
    evidence_backed: boolean;
    ai_availability: string;
  } | null;
};

export type StrategyVersionDetail = {
  id: string;
  strategy_id: string;
  status: string;
  version_number: number;
  row_version: number;
  linked_approved_profile_version_id: string | null;
  organic_enabled: boolean;
  paid_enabled: boolean;
  organic_disabled_rationale: string | null;
  paid_disabled_rationale: string | null;
  ai_availability: string;
  foundation: Record<string, unknown>;
  unknowns_acknowledged: boolean;
  missing_source: boolean;
  evidence_backed: boolean;
  organic: Record<string, unknown> | null;
  paid: Record<string, unknown> | null;
  audiences: Array<{ id: string; name: string }>;
  competitors: Array<{ id: string; title: string }>;
  kpis: Array<{ id: string; name: string }>;
  gaps: Array<{ id: string; kind: string; text: string }>;
  evidence_links: Array<{ id: string; label: string | null; evidence_excerpt_id: string | null }>;
  comments: Array<{ id: string; body: string; created_at: string }>;
};
