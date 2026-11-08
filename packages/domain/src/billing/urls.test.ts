import { describe, expect, it } from 'vitest';
import { isSafeCheckoutRedirect, resolvePublicAppOrigin } from './urls';

describe('public app origin and checkout redirects', () => {
  it('accepts https origins and localhost http, and rejects other schemes', () => {
    expect(resolvePublicAppOrigin('https://app.oma.example/')).toBe('https://app.oma.example');
    expect(resolvePublicAppOrigin('http://127.0.0.1:3000/')).toBe('http://127.0.0.1:3000');
    expect(resolvePublicAppOrigin('http://oma.example')).toBe('http://127.0.0.1:3000');
    expect(resolvePublicAppOrigin('javascript:alert(1)')).toBe('http://127.0.0.1:3000');
    expect(resolvePublicAppOrigin('https://user:pass@evil.example')).toBe('http://127.0.0.1:3000');
  });

  it('only follows https checkout redirects without credentials', () => {
    expect(isSafeCheckoutRedirect('https://checkout.stripe.com/c/pay/cs_test_123')).toBe(true);
    expect(isSafeCheckoutRedirect('http://checkout.stripe.com/c/pay/cs_test_123')).toBe(false);
    expect(isSafeCheckoutRedirect('javascript:alert(1)')).toBe(false);
    expect(isSafeCheckoutRedirect('https://user:pass@evil.example/pay')).toBe(false);
  });
});
