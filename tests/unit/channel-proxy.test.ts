import { describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * `proxy.ts` menentukan kanal dari path. Header `x-channel` kiriman klien
 * tidak boleh lolos, sebab ia menentukan `orders.channel` (laporan per mitra).
 */
const seen: { channel: string | null }[] = [];
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: async (req: NextRequest) => {
    seen.push({ channel: req.headers.get('x-channel') });
    return NextResponse.next();
  },
}));

const { proxy } = await import('@/proxy');

const run = (url: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(new URL(url, 'http://localhost'), { headers }));

describe('proxy kanal', () => {
  it('menyetel kanal dari path', async () => {
    seen.length = 0;
    await run('/aqiqahaja/checkout');
    await run('/checkout');
    expect(seen.map((s) => s.channel)).toEqual(['linkaja', 'web']);
  });

  it('menimpa x-channel palsu dari klien', async () => {
    seen.length = 0;
    await run('/checkout', { 'x-channel': 'linkaja' });
    expect(seen[0].channel).toBe('web');
  });

  it('link lama ?ch=linkaja dialihkan ke kembarannya', async () => {
    const res = await run('/checkout/katering?ch=linkaja&paket=ayam');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/aqiqahaja/checkout/katering?paket=ayam');
  });

  it('halaman tanpa kembaran jatuh ke beranda Aqiqah Aja', async () => {
    const res = await run('/login?ch=linkaja');
    expect(res.headers.get('location')).toBe('http://localhost/aqiqahaja');
  });

  it('?ch= asing hanya dibuang, tidak berpindah area', async () => {
    const res = await run('/paket?ch=gopay');
    expect(res.headers.get('location')).toBe('http://localhost/paket');
  });
});
