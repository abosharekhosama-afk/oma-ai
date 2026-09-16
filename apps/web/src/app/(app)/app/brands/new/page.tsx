'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PermissionDenied } from '../../../../../components/shell/permission-denied';
import { CreateBrandForm } from '../../../../../components/brand/create-brand-form';
import { Dialog } from '../../../../../components/ui/dialog';
import { useT } from '../../../../../lib/use-locale';

export default function NewBrandPage() {
  const t = useT();
  const router = useRouter();
  const [denied, setDenied] = useState(false);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;

  return (
    <Dialog open title={t('brand.create.title')} onClose={() => router.push('/app/brands')}>
      <CreateBrandForm
        onCancel={() => router.push('/app/brands')}
        onDenied={() => setDenied(true)}
      />
    </Dialog>
  );
}
