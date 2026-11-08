export type PaymentCheckoutRequest = {
  checkoutId: string;
  tenantId: string;
  planCode: string;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
  amountExVatCents: number;
  vatRateBps: number;
  vatCents: number;
  amountIncVatCents: number;
  currency: string;
  customerEmail?: string | null;
  customerName?: string | null;
  successUrl: string;
  cancelUrl: string;
  xApiAddon?: boolean;
  addonExVatCents?: number;
  addonIncVatCents?: number;
  metadata: Record<string, string>;
};

export type PaymentCheckoutResult =
  | { configured: false; reason: string }
  | {
      configured: true;
      redirectUrl?: string;
      providerRef?: string;
      mode: 'redirect' | 'instructions';
    };

export type PaymentPortalResult =
  { configured: false; reason: string } | { configured: true; redirectUrl: string };

export type ProviderInfo = {
  id: string;
  name_en: string;
  name_ar: string;
  mode: 'live' | 'manual' | 'unavailable';
  configured: boolean;
  notes_en: string;
  notes_ar: string;
};

export interface PaymentPort {
  id: string;
  isConfigured(): boolean;
  startCheckout(input: PaymentCheckoutRequest): Promise<PaymentCheckoutResult>;
  createPortal?(customerId: string, returnUrl: string): Promise<PaymentPortalResult>;
}
