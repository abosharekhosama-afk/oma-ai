export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;
export const RECEIPT_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type ReceiptMime = (typeof RECEIPT_ALLOWED_MIME)[number];

export type ManualTransferInput = {
  sender_name?: string;
  contact?: string;
  amount?: string | number | null;
  transfer_date?: string;
  txn_ref?: string;
  proof_image_base64?: string;
  proof_mime?: string;
  proof_file_name?: string;
  proof_note?: string;
};

export type ParsedReceipt = {
  mime: ReceiptMime;
  base64: string;
  bytes: number;
  file_name: string | null;
};

export type ParsedManualTransfer = {
  sender_name: string;
  contact: string;
  amount_cents: number;
  transfer_at: Date;
  txn_ref: string;
  receipt: ParsedReceipt;
  proof_note: string;
};

export type ManualTransferValidation =
  { ok: true; value: ParsedManualTransfer } | { ok: false; message: string; message_ar: string };

const MIME_SET = new Set<string>(RECEIPT_ALLOWED_MIME);

function fail(message: string, message_ar: string): ManualTransferValidation {
  return { ok: false, message, message_ar };
}

export function estimateBase64Bytes(base64: string): number {
  const clean = base64.replace(/\s/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export function parseReceiptImage(
  raw: string | undefined,
  mimeHint?: string,
):
  | { ok: true; mime: string; base64: string; bytes: number }
  | { ok: false; message: string; message_ar: string } {
  if (!raw?.trim()) {
    return {
      ok: false,
      message: 'A receipt image is required',
      message_ar: 'صورة إشعار التحويل مطلوبة',
    };
  }
  const trimmed = raw.trim();
  const dataUrl = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(trimmed);
  const mime = (dataUrl?.[1] ?? mimeHint ?? '').trim().toLowerCase();
  const base64 = (dataUrl?.[2] ?? trimmed).replace(/\s/g, '');
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length < 24) {
    return {
      ok: false,
      message: 'Receipt image is not valid base64',
      message_ar: 'صورة الإشعار غير صالحة',
    };
  }
  if (!MIME_SET.has(mime)) {
    return {
      ok: false,
      message: 'Receipt must be a JPEG, PNG, WebP, or GIF image',
      message_ar: 'يجب أن تكون صورة الإشعار JPEG أو PNG أو WebP أو GIF',
    };
  }
  const bytes = estimateBase64Bytes(base64);
  if (bytes < 32) {
    return {
      ok: false,
      message: 'Receipt image is too small',
      message_ar: 'صورة الإشعار صغيرة جداً',
    };
  }
  if (bytes > RECEIPT_MAX_BYTES) {
    return {
      ok: false,
      message: 'Receipt image must be 4 MB or smaller',
      message_ar: 'يجب ألا يتجاوز حجم صورة الإشعار 4 ميغابايت',
    };
  }
  const sniffed = sniffImageMime(base64);
  if (!sniffed) {
    return {
      ok: false,
      message: 'Receipt image content is not a supported image type',
      message_ar: 'محتوى صورة الإشعار ليس من الأنواع المدعومة',
    };
  }
  if (mime && mime !== sniffed) {
    return {
      ok: false,
      message: 'Receipt image type does not match its contents',
      message_ar: 'نوع صورة الإشعار لا يطابق محتواها',
    };
  }
  return { ok: true, mime: sniffed, base64, bytes };
}

export function sniffImageMime(base64: string): ReceiptMime | null {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  } catch {
    return null;
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function parseAmountCents(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100);
}

function parseTransferDate(value?: string): Date | null {
  const raw = value?.trim() ?? '';
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const iso = new Date(`${raw}T12:00:00.000Z`);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateManualTransfer(input: ManualTransferInput): ManualTransferValidation {
  const sender = input.sender_name?.trim() ?? '';
  const contact = input.contact?.trim() ?? '';
  const txn = input.txn_ref?.trim() ?? '';
  if (sender.length < 2) {
    return fail('Sender name is required', 'اسم المحوِّل مطلوب');
  }
  if (contact.length < 3) {
    return fail(
      'Phone number or account details are required',
      'رقم الهاتف أو بيانات الحساب مطلوبة',
    );
  }
  const amountCents = parseAmountCents(input.amount);
  if (amountCents == null) {
    return fail('Enter the transferred amount', 'أدخل مبلغ التحويل');
  }
  const transferAt = parseTransferDate(input.transfer_date);
  if (!transferAt) {
    return fail('Enter the transfer date', 'أدخل تاريخ التحويل');
  }
  if (txn.length < 2) {
    return fail('Transaction reference is required', 'مرجع المعاملة مطلوب');
  }
  const receipt = parseReceiptImage(input.proof_image_base64, input.proof_mime);
  if (!receipt.ok) return fail(receipt.message, receipt.message_ar);

  const fileName = input.proof_file_name?.trim().slice(0, 200) || null;
  const amountLabel = (amountCents / 100).toFixed(2);
  const dateLabel = transferAt.toISOString().slice(0, 10);
  const composed =
    input.proof_note?.trim() || `${sender} · ${contact} · $${amountLabel} · ${dateLabel} · ${txn}`;

  return {
    ok: true,
    value: {
      sender_name: sender.slice(0, 200),
      contact: contact.slice(0, 200),
      amount_cents: amountCents,
      transfer_at: transferAt,
      txn_ref: txn.slice(0, 200),
      receipt: {
        mime: receipt.mime as ReceiptMime,
        base64: receipt.base64,
        bytes: receipt.bytes,
        file_name: fileName,
      },
      proof_note: composed.slice(0, 2000),
    },
  };
}
