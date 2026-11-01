'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../lib/use-locale';
import { useToast } from '../../../../components/ui/toast';
import './billing.css';

const plans = [
  { id: 'free', en: 'Free', ar: 'مجانية', price: '0', enDesc: 'For trying OMA with a small team', arDesc: 'لتجربة OMA مع فريق صغير', features: ['1 brand workspace', '10 scheduled posts / month', 'Content planning and approvals'] },
  { id: 'pro', en: 'Pro', ar: 'احترافية', price: '29', enDesc: 'For growing content teams', arDesc: 'لفرق المحتوى النامية', features: ['10 brand workspaces', 'Unlimited scheduled posts', 'Social publishing and analytics', 'Media library and approval workflows'] },
  { id: 'business', en: 'Business', ar: 'أعمال', price: '79', enDesc: 'For agencies and organizations', arDesc: 'للوكالات والمؤسسات', features: ['Unlimited workspaces', 'Advanced permissions and audit logs', 'Priority support and team workflows', 'Custom integrations'] },
] as const;

export default function BillingClient() {
  const isAr = useLocale() === 'ar';
  const toast = useToast();
  const [selected, setSelected] = useState('pro');
  const copy = isAr
    ? { title: 'الخطط والأسعار', sub: 'اختر الخطة المناسبة لفريقك. يمكنك تغييرها لاحقاً.', current: 'الخطة الحالية', choose: 'اختيار الخطة', included: 'تتضمن', monthly: 'شهرياً', contact: 'تواصل مع المبيعات', back: 'العودة إلى مساحة العمل', note: 'الفوترة والدفع الإلكتروني غير مفعّلين بعد في هذه النسخة التجريبية.' }
    : { title: 'Plans & pricing', sub: 'Choose the plan that fits your team. You can change it later.', current: 'Current plan', choose: 'Choose plan', included: 'Includes', monthly: 'per month', contact: 'Contact sales', back: 'Back to workspace', note: 'Billing and online payments are not enabled in this preview yet.' };

  function choosePlan(id: string) {
    setSelected(id);
    toast.push(isAr ? 'تم تحديد الخطة للمعاينة' : 'Plan selected for preview', 'success');
  }

  return (
    <main className="oma-planable-page oma-billing" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="oma-planable-page__header oma-billing__header">
        <div>
          <h1 className="oma-planable-page__title">{copy.title}</h1>
          <p className="oma-planable-page__sub">{copy.sub}</p>
        </div>
        <Link className="oma-billing__back" href="/app">{copy.back}</Link>
      </header>
      <div className="oma-billing__notice">{copy.note}</div>
      <section className="oma-billing__grid" aria-label={copy.title}>
        {plans.map((plan) => {
          const active = selected === plan.id;
          return (
            <article key={plan.id} className={`oma-billing__card${active ? ' is-selected' : ''}`}>
              {plan.id === 'pro' ? <span className="oma-billing__badge">{isAr ? 'الأكثر اختياراً' : 'Most popular'}</span> : null}
              <h2>{isAr ? plan.ar : plan.en}</h2>
              <p className="oma-billing__desc">{isAr ? plan.arDesc : plan.enDesc}</p>
              <div className="oma-billing__price"><strong>${plan.price}</strong> <span>/ {copy.monthly}</span></div>
              <p className="oma-billing__included">{copy.included}</p>
              <ul>{plan.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
              <Button type={active ? 'primary' : 'secondary'} onClick={() => choosePlan(plan.id)}>
                {active ? copy.current : copy.choose}
              </Button>
            </article>
          );
        })}
      </section>
      <footer className="oma-billing__footer">
        <span>{isAr ? 'تحتاج خطة مخصصة؟' : 'Need a custom plan?'}</span>
        <Button type="secondary" onClick={() => toast.push(copy.note, 'info')}>{copy.contact}</Button>
      </footer>
    </main>
  );
}
