import { safeFetch } from '@/lib/safeFetch';

export type ReceiptLine = { rawName: string; storeId?: string | null; brandId?: string | null };
export type NormalizedLine = ReceiptLine & { status: 'matched'|'alias_created'|'fallback'; brandId?: string|null; brandName?: string|null; confidence?: number; reason?: string };

export async function normalizeReceiptItems(lines: ReceiptLine[]): Promise<NormalizedLine[]> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/receipt-normalize`;
  const res = await safeFetch<{ items: NormalizedLine[] }>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: lines }),
  });
  return res.items;
}

