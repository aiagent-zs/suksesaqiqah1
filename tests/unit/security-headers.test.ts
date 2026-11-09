import { afterEach, describe, expect, it, vi } from 'vitest';

async function headersFor(env: 'production' | 'development') {
  vi.stubEnv('NODE_ENV', env);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');
  vi.resetModules();
  const { default: config } = await import('../../next.config');
  const rules = await config.headers!();
  expect(rules[0].source).toBe('/:path*');
  return Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
}

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

afterEach(() => vi.unstubAllEnvs());

describe('header keamanan', () => {
  it('produksi memasang seluruh header', async () => {
    const h = await headersFor('production');
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/);
    expect(h['Permissions-Policy']).toContain('geolocation=()');
  });

  it('tidak mengiklankan framework', async () => {
    vi.resetModules();
    const { default: config } = await import('../../next.config');
    expect(config.poweredByHeader).toBe(false);
  });

  it('CSP menolak penyematan, plugin, dan eval di produksi', async () => {
    const csp = (await headersFor('production'))['Content-Security-Policy'];
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'self'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'script-src')).not.toContain('unsafe-eval');
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('peramban tetap boleh bicara ke Supabase', async () => {
    const csp = (await headersFor('production'))['Content-Security-Policy'];
    expect(directive(csp, 'connect-src')).toContain('https://*.supabase.co');
    expect(directive(csp, 'connect-src')).toContain('wss://*.supabase.co');
    expect(directive(csp, 'img-src')).toContain('https://*.supabase.co');
    // Unduhan sertifikat & pratinjau foto memakai blob: URL.
    expect(directive(csp, 'img-src')).toContain('blob:');
  });

  it('dev: tanpa HSTS, eval & websocket HMR diizinkan', async () => {
    const h = await headersFor('development');
    expect(h['Strict-Transport-Security']).toBeUndefined();
    const csp = h['Content-Security-Policy'];
    expect(directive(csp, 'script-src')).toContain('unsafe-eval');
    expect(directive(csp, 'connect-src')).toContain('ws:');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});
