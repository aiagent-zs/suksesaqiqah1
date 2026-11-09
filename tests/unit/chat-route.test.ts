import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Gerbang `/api/chat` sebelum biaya API terpakai: flag chatbot mati = 404,
 * dan riwayat wajib bergantian user/assistant.
 */
const create = vi.fn(async () => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify({ reply: 'Halo', handoff: false }) }],
}));

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    beta = { messages: { create } };
    static RateLimitError = class extends Error {};
    static APIError = class extends Error {};
  }
  return { default: Anthropic };
});
vi.mock('@/features/chatbot/knowledge', () => ({ buildSystemPrompt: async () => 'sistem' }));


const { POST } = await import('@/app/api/chat/route');

let ip = 0;
function post(messages: { role: string; content: string }[]) {
  // IP berbeda tiap panggilan supaya rem laju tidak ikut menentukan hasil.
  ip += 1;
  return POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': `10.0.0.${ip}` },
      body: JSON.stringify({ messages }),
    }) as never,
  );
}

const u = (content = 'tanya') => ({ role: 'user', content });
const a = (content = 'jawab') => ({ role: 'assistant', content });

beforeEach(() => {
  create.mockClear();
  delete process.env.NEXT_PUBLIC_CHATBOT_ENABLED;
});

describe('/api/chat', () => {
  it('404 tanpa memanggil model bila chatbot dimatikan', async () => {
    process.env.NEXT_PUBLIC_CHATBOT_ENABLED = 'false';
    const res = await post([u()]);
    expect(res.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('menerima percakapan yang bergantian', async () => {
    expect((await post([u()])).status).toBe(200);
    expect((await post([u(), a(), u()])).status).toBe(200);
  });

  it('menolak giliran berderet atau tidak diakhiri pengunjung', async () => {
    for (const messages of [
      [u(), u()],
      [u(), a(), a(), u()],
      [u(), a()],
      [a(), u()],
    ]) {
      expect((await post(messages)).status).toBe(400);
    }
    expect(create).not.toHaveBeenCalled();
  });
});
