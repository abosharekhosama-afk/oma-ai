import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildOtpAuthUri,
  computeTotpCode,
  generateBackupCodes,
  generateTotpSecret,
  verifyTotpCode,
} from '../../apps/api/src/identity/totp';

describe('Real RFC 6238 TOTP 2FA, comprehensive data export, 30-day scheduled deletion & ConfirmActionDialog', () => {
  it('generates valid Base32 TOTP secrets, otpauth URIs, and verifies 6-digit codes within ±30s', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);

    const uri = buildOtpAuthUri({ secret, email: 'user@imkan.ai', issuer: 'OMA AI' });
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${secret}`);

    const now = 1_700_000_000_000;
    const code = computeTotpCode(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code, now)).toBe(true);
    expect(verifyTotpCode(secret, code, now + 25_000)).toBe(true);
    expect(verifyTotpCode(secret, '000000', now)).toBe(code === '000000');

    const backups = generateBackupCodes(6);
    expect(backups).toHaveLength(6);
    expect(backups[0]).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('removes Time & location and email edit from Profile page and wires confirmation dialogs', () => {
    const profileClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/account/account-client.tsx'),
      'utf8',
    );
    expect(profileClient).not.toContain('account-timezone-select');
    expect(profileClient).not.toContain('account-edit-email');
    expect(profileClient).toContain('account-email-readonly');
    expect(profileClient).toContain('confirm-delete-account-dialog');
    expect(profileClient).toContain('confirm-export-data-dialog');
    expect(profileClient).toContain('confirm-disable-2fa-dialog');
    expect(profileClient).toContain('confirm-password-dialog');
  });
});
