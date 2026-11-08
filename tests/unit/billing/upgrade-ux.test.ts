import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeVat, formatVatPercent } from '../../../packages/domain/src/billing/vat';

const read = (rel: string) => readFileSync(resolve(rel), 'utf8');

describe('billing upgrade UX and VAT reflection', () => {
  it('computes VAT from BillingSettings and exposes monthly and yearly totals', () => {
    const service = read('apps/api/src/billing/billing.service.ts');
    expect(service).toContain('computeVat(monthly, settings.vatRateBps)');
    expect(service).toContain('computeVat(yearlyMonthly, settings.vatRateBps)');
    expect(service).toContain('yearly_vat:');
    expect(service).toContain('settings_vat_percent');
    expect(service).toContain('async updateSettings');
    expect(service).toContain('vatRateBps');
    expect(computeVat(7900, 1800).inc_vat_cents).toBe(9322);
    expect(formatVatPercent(1800)).toBe('18%');
    expect(formatVatPercent(1700)).toBe('17%');
  });

  it('shows computed VAT in the billing UI instead of a hardcoded 17%', () => {
    const client = read('apps/web/src/app/(app)/app/billing/billing-client.tsx');
    const admin = read('apps/web/src/app/(app)/app/admin/billing/admin-billing-client.tsx');
    expect(client).toContain('monthly_vat');
    expect(client).toContain('yearly_vat');
    expect(client).toContain('inc_vat_cents');
    expect(client).toContain('vat_percent');
    expect(client).toContain('settings_vat_percent');
    expect(client).not.toMatch(/17%/);
    expect(client).not.toMatch(/1\.17/);
    expect(admin).toContain('vat_rate_bps');
    expect(admin).not.toMatch(/useState\('17'\)/);
  });

  it('opens a provider-selection dialog and collects manual transfer details plus a receipt image', () => {
    const client = read('apps/web/src/app/(app)/app/billing/billing-client.tsx');
    expect(client).toContain('role="dialog"');
    expect(client).toContain('Choose a payment method');
    expect(client).toContain("item.mode === 'live'");
    expect(client).toContain('sender_name');
    expect(client).toContain('txn_ref');
    expect(client).toContain('type="file"');
    expect(client).toContain('image/jpeg,image/png,image/webp,image/gif');
    expect(client).toContain('RECEIPT_MAX_BYTES');
    const service = read('apps/api/src/billing/billing.service.ts');
    expect(service).toContain('validateManualTransfer');
    expect(service).toContain('proofImageBase64');
    expect(service).toContain('transferSenderName');
  });

  it('hides tenant plan-change controls for the platform-owner billing view', () => {
    const client = read('apps/web/src/app/(app)/app/billing/billing-client.tsx');
    const controller = read('apps/api/src/billing/billing.controller.ts');
    expect(controller).toContain('viewer_is_platform_admin');
    expect(controller).toContain('platform.support.access');
    expect(client).toContain('viewer_is_platform_admin');
    expect(client).toContain('Open admin billing');
    expect(client).toContain('Tenant plan cards and plan-change controls are hidden here');
  });

  it('redesigns admin billing with status filters, transfer details, and receipt preview', () => {
    const admin = read('apps/web/src/app/(app)/app/admin/billing/admin-billing-client.tsx');
    const controller = read('apps/api/src/billing/billing-admin.controller.ts');
    expect(admin).toContain('STATUS_FILTERS');
    expect(admin).toContain('transfer_sender_name');
    expect(admin).toContain('View receipt');
    expect(admin).toContain('adminOrderReceipt');
    expect(admin).toContain('Approve or reject note');
    expect(controller).toContain('api/v1/admin/billing/orders/:id/receipt');
    expect(controller).toContain('adminListOrders(status)');
  });
});
