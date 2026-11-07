/**
 * Payment boundary. Live providers stay unwired (DEC-005 / DEC-016).
 * A future adapter implements this port and fulfills BillingCheckout rows.
 */
export type PaymentCheckoutRequest = {
  checkoutId: string;
  tenantId: string;
  planCode: string;
  billingCycle: 'monthly' | 'yearly';
  amountUsdCents: number | null;
};

export type PaymentCheckoutResult =
  | { configured: false; reason: 'payment_provider_not_configured' }
  | { configured: true; redirectUrl: string; providerRef: string };

export interface PaymentPort {
  isConfigured(): boolean;
  startCheckout(input: PaymentCheckoutRequest): Promise<PaymentCheckoutResult>;
}

/** Refusing adapter until a payment provider is selected and configured. */
export const deferredPaymentPort: PaymentPort = {
  isConfigured() {
    return false;
  },
  async startCheckout() {
    return { configured: false, reason: 'payment_provider_not_configured' };
  },
};
