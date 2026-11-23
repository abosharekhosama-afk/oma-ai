'use client';

import type { StrategyVersionDetail } from '../../lib/strategy-types';
import type { StrategyAiFocus } from '../../lib/strategy-ai-focus';
import { StrategyAiAssistant } from './strategy-ai-assistant';

type Props = {
  brandId: string;
  strategyId: string;
  version: StrategyVersionDetail | null;
  focus: StrategyAiFocus;
  onApplied?: () => void;
};

export function StrategyPageAi({ brandId, strategyId, version, focus, onApplied }: Props) {
  if (!version) return null;
  if (version.status !== 'DRAFT' && version.status !== 'IN_REVIEW') return null;
  return (
    <StrategyAiAssistant
      brandId={brandId}
      strategyId={strategyId}
      versionId={version.id}
      versionStatus={version.status}
      linkedProfileVersionId={version.linked_approved_profile_version_id}
      organicEnabled={version.organic_enabled}
      paidEnabled={version.paid_enabled}
      focus={focus}
      onApplied={onApplied}
    />
  );
}
