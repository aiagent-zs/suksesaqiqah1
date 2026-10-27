// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from '@/components/site/chat-widget';

/**
 * Yang dijaga: jawaban bertanda `handoff` (komplain, pesanan tertentu) membawa
 * tombol WhatsApp admin berisi pertanyaan pengunjung, dan jawaban biasa tidak.
 */
async function ask(reply: { reply: string; handoff: boolean }, question: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(reply), { status: 200 })),
  );
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<ChatWidget brandName="Aqiqah Aja" />));
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-controls="chat-panel"]')!.click(),
  );
  const quick = [...host.querySelectorAll('button')].find((b) => b.textContent === question)!;
  await act(async () => quick.click());
  return host;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('ChatWidget', () => {
  it('komplain: menampilkan tombol WhatsApp berisi pertanyaan pengunjung', async () => {
    const host = await ask(
      { reply: 'Mohon maaf atas kendalanya.', handoff: true },
      'Saya ada masalah dengan pesanan',
    );
    const wa = host.querySelector<HTMLAnchorElement>('a[href^="https://wa.me/"]');
    expect(wa).not.toBeNull();
    const text = decodeURIComponent(new URL(wa!.href).searchParams.get('text') ?? '');
    expect(text).toContain('Halo Admin Aqiqah Aja');
    expect(text).toContain('Saya ada masalah dengan pesanan');
  });

  it('pertanyaan biasa: dijawab tanpa tombol admin', async () => {
    const host = await ask(
      { reply: 'Paket mulai dari Rp2.000.000.', handoff: false },
      'Berapa harga paket aqiqah?',
    );
    expect(host.textContent).toContain('Paket mulai dari');
    expect(host.querySelector('a[href^="https://wa.me/"]')).toBeNull();
  });
});
