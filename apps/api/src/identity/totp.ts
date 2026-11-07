import { createHmac, randomBytes } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generate a 160-bit Base32 TOTP secret (RFC 6238 / Google Authenticator compatible). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function generateBackupCodes(count = 6): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = randomBytes(4).toString('hex').toUpperCase();
    out.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return out;
}

export function buildOtpAuthUri(opts: { secret: string; email: string; issuer?: string }): string {
  const issuer = opts.issuer ?? 'OMA AI';
  const label = encodeURIComponent(`${issuer}:${opts.email}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function computeTotpCode(
  secretBase32: string,
  timestampMs = Date.now(),
  stepSeconds = 30,
): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const otp = binary % 1_000_000;
  return String(otp).padStart(6, '0');
}

/** Verify a 6-digit TOTP code within ±1 time window (30s drift tolerance). */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  timestampMs = Date.now(),
): boolean {
  const normalized = String(code ?? '')
    .trim()
    .replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  for (const offset of [-1, 0, 1]) {
    const expected = computeTotpCode(secretBase32, timestampMs + offset * 30_000);
    if (expected === normalized) return true;
  }
  return false;
}
