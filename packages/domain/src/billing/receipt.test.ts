import { describe, expect, it } from 'vitest';
import {
  RECEIPT_MAX_BYTES,
  estimateBase64Bytes,
  parseReceiptImage,
  validateManualTransfer,
} from './receipt';

const pngPixel =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('manual transfer receipt validation', () => {
  it('accepts a JPEG/PNG receipt with transfer details', () => {
    const result = validateManualTransfer({
      sender_name: 'Osama',
      contact: '0599000000',
      amount: '92.43',
      transfer_date: '2026-11-08',
      txn_ref: 'TX-99',
      proof_mime: 'image/png',
      proof_file_name: 'receipt.png',
      proof_image_base64: `data:image/png;base64,${pngPixel}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sender_name).toBe('Osama');
    expect(result.value.contact).toBe('0599000000');
    expect(result.value.amount_cents).toBe(9243);
    expect(result.value.txn_ref).toBe('TX-99');
    expect(result.value.receipt.mime).toBe('image/png');
    expect(result.value.receipt.bytes).toBeGreaterThan(32);
    expect(result.value.proof_note).toContain('Osama');
  });

  it('rejects missing fields, bad mime types, and oversized images', () => {
    expect(validateManualTransfer({}).ok).toBe(false);
    expect(
      validateManualTransfer({
        sender_name: 'A',
        contact: '0599',
        amount: '10',
        transfer_date: '2026-11-08',
        txn_ref: 'TX',
        proof_image_base64: pngPixel,
        proof_mime: 'application/pdf',
      }).ok,
    ).toBe(false);
    const huge = `${'A'.repeat(Math.ceil(((RECEIPT_MAX_BYTES + 1000) * 4) / 3))}`;
    const oversized = parseReceiptImage(huge, 'image/jpeg');
    expect(oversized.ok).toBe(false);
    expect(estimateBase64Bytes(pngPixel)).toBeGreaterThan(32);
    const mismatched = parseReceiptImage(pngPixel, 'image/jpeg');
    expect(mismatched.ok).toBe(false);
  });
});
