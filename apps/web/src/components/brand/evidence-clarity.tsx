import type { EvidenceItem } from '../../lib/brand-types';

type EvidenceClarityProps = {
  evidence: EvidenceItem;
};

export function EvidenceClarity({ evidence }: EvidenceClarityProps) {
  return (
    <div className="oma-evidence-clarity">
      <dl className="oma-evidence-meta">
        <div>
          <dt>Source</dt>
          <dd>
            <a href={evidence.source_url} target="_blank" rel="noopener noreferrer">
              {evidence.canonical_url}
            </a>
          </dd>
        </div>
        {evidence.page_title ? (
          <div>
            <dt>Page title</dt>
            <dd>{evidence.page_title}</dd>
          </div>
        ) : null}
        <div>
          <dt>Method</dt>
          <dd>{evidence.extraction_method}</dd>
        </div>
        <div>
          <dt>Fetched</dt>
          <dd>{new Date(evidence.fetched_at).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Hash</dt>
          <dd>
            <code>{evidence.content_hash}</code>
          </dd>
        </div>
      </dl>
      <blockquote className="oma-evidence-excerpt" cite={evidence.source_url}>
        {evidence.excerpt_text}
      </blockquote>
    </div>
  );
}
