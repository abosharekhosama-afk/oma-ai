'use client';

import { useT } from '../../lib/use-locale';

export function DemoDisclosure({ message }: { message?: string }) {
  const t = useT();
  return (
    <p className="oma-demo-disclosure" data-testid="demo-disclosure" role="note">
      {message ?? t('demo.disclosure')}
    </p>
  );
}
