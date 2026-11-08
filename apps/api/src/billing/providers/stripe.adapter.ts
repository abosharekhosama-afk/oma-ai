import Stripe from 'stripe';
import { formatVatPercent } from '@oma/domain';
import type {
  PaymentCheckoutRequest,
  PaymentCheckoutResult,
  PaymentPortalResult,
} from '../payment-port';
import { stripeConfigured } from './registry';

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export async function startStripeCheckout(
  input: PaymentCheckoutRequest,
): Promise<PaymentCheckoutResult> {
  const stripe = getStripe();
  if (!stripe) return { configured: false, reason: 'stripe_not_configured' };
  const interval = input.billingCycle === 'yearly' ? 'year' : 'month';
  const vatLabel = formatVatPercent(input.vatRateBps);
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: input.currency,
        unit_amount: input.amountIncVatCents,
        recurring: { interval },
        product_data: {
          name: `OMA ${input.planName}`,
          description: `Includes ${vatLabel} VAT`,
        },
      },
    },
  ];
  if (input.xApiAddon && input.addonIncVatCents) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: input.currency,
        unit_amount: input.addonIncVatCents,
        recurring: { interval },
        product_data: {
          name: 'Paid X API access',
          description: `Add-on · includes ${vatLabel} VAT`,
        },
      },
    });
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.tenantId,
    customer_email: input.customerEmail ?? undefined,
    metadata: input.metadata,
    subscription_data: { metadata: input.metadata },
    line_items: lineItems,
  });
  if (!session.url) return { configured: false, reason: 'stripe_session_missing_url' };
  return {
    configured: true,
    redirectUrl: session.url,
    providerRef: session.id,
    mode: 'redirect',
  };
}

export async function createStripePortal(
  customerId: string,
  returnUrl: string,
): Promise<PaymentPortalResult> {
  const stripe = getStripe();
  if (!stripe) return { configured: false, reason: 'stripe_not_configured' };
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { configured: true, redirectUrl: session.url };
}

export { stripeConfigured };
