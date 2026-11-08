import type { ProviderInfo } from '../payment-port';

function flag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function lahzaConfigured(): boolean {
  return Boolean(process.env.LAHZA_SECRET_KEY?.trim());
}

export function listPaymentProviders(): ProviderInfo[] {
  const providers: ProviderInfo[] = [
    {
      id: 'stripe',
      name_en: 'Stripe',
      name_ar: 'سترايب',
      mode: stripeConfigured() ? 'live' : 'unavailable',
      configured: stripeConfigured(),
      notes_en:
        'Card checkout, subscriptions, customer portal, and signed webhooks. Requires a Stripe account, secret key, and webhook signing secret.',
      notes_ar:
        'دفع بالبطاقة واشتراكات وبوابة العميل وويب هوك موقّع. يلزم حساب سترايب ومفتاح سرّي وسر توقيع الويب هوك.',
    },
    {
      id: 'lahza',
      name_en: 'Lahza / Bank of Palestine',
      name_ar: 'لحظة / بنك فلسطين',
      mode: lahzaConfigured() ? 'live' : 'unavailable',
      configured: lahzaConfigured(),
      notes_en:
        'Bank of Palestine’s public payment gateway is Lahza (docs.lahza.io). Uses only documented endpoints: initialize, verify, charge_authorization, and x-lahza-signature webhooks.',
      notes_ar:
        'بوابة بنك فلسطين العلنية هي لحظة (docs.lahza.io). نستخدم فقط المسارات الموثّقة: تهيئة العملية والتحقق والتحصيل المتكرر وويب هوك x-lahza-signature.',
    },
    {
      id: 'bank_transfer',
      name_en: 'Bank transfer',
      name_ar: 'تحويل بنكي',
      mode: flag('BILLING_BANK_TRANSFER_DISABLED') ? 'unavailable' : 'manual',
      configured: !flag('BILLING_BANK_TRANSFER_DISABLED'),
      notes_en:
        'You receive a reference number and transfer instructions, upload proof, and the platform owner activates the plan.',
      notes_ar: 'تصلك تعليمات التحويل ورقم مرجع، ترفع إثبات الدفع، ثم يفعّل مالك المنصة الخطة.',
    },
  ];

  if (flag('JAWWAL_PAY_ENABLED')) {
    providers.push({
      id: 'jawwal_pay',
      name_en: 'Jawwal Pay',
      name_ar: 'جوال باي',
      mode: 'manual',
      configured: true,
      notes_en:
        'No public merchant REST API or sandbox is documented (jawwalpay.ps lists an online merchant gateway and mobile SDKs). This method uses the manual proof flow until Jawwal Pay issues API credentials.',
      notes_ar:
        'لا توجد وثائق علنية لواجهة تاجر REST أو بيئة تجريبية (الموقع يعرض بوابة للمتاجر ومجموعات تطوير للجوال). هذه الطريقة تستخدم إثبات الدفع اليدوي حتى يصدر جوال باي مفاتيح واجهة.',
    });
  }
  if (flag('PALPAY_ENABLED')) {
    providers.push({
      id: 'palpay',
      name_en: 'PalPay',
      name_ar: 'بال بي',
      mode: 'manual',
      configured: true,
      notes_en:
        'PalPay publishes merchant products (POS, e-commerce, SoftPOS) but no public checkout API. Manual transfer / proof until a merchant API is provided.',
      notes_ar:
        'بال بي يعرض خدمات للتاجر (نقاط بيع وتجارة إلكترونية) دون واجهة دفع علنية. التحويل وإثبات الدفع يدوياً حتى تتوفر واجهة تاجر.',
    });
  }
  if (flag('REFLECT_ENABLED')) {
    providers.push({
      id: 'reflect',
      name_en: 'Reflect',
      name_ar: 'ريفلكت',
      mode: 'manual',
      configured: true,
      notes_en:
        'Reflect Palestine (pal.reflectapp.com) is a consumer neo-bank with QR payments and no public merchant API. docs.reflect.money belongs to a different product. Manual proof flow only.',
      notes_ar:
        'ريفلكت فلسطين تطبيق مصرفي للأفراد مع دفع عبر رمز QR دون واجهة تاجر علنية. docs.reflect.money يخص منتجاً مختلفاً. إثبات دفع يدوي فقط.',
    });
  }
  return providers;
}

export function providerIsManual(id: string): boolean {
  return ['bank_transfer', 'jawwal_pay', 'palpay', 'reflect'].includes(id);
}
