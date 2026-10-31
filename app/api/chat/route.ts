import Anthropic from '@anthropic-ai/sdk';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { buildSystemPrompt } from '@/features/chatbot/knowledge';
import { getBrand } from '@/lib/brand-server';
import { RateLimiter, clientIpFrom } from '@/lib/security/rate-limit';

/**
 * Chatbot halaman publik. Pertanyaan umum dijawab Claude dari isi situs;
 * komplain dan urusan pesanan tertentu dikembalikan dengan `handoff: true`,
 * dan widget menampilkan tombol WhatsApp admin.
 *
 * Riwayat percakapan hidup di peramban dan dikirim utuh tiap giliran: tidak
 * ada yang disimpan di server.
 */

const client = new Anthropic();

// ponytail: hitungan di memori satu proses — cukup untuk satu server VPS,
// hilang saat restart. Tambah aturan rate limit WAF Cloudflare untuk /api/chat
// bila biaya API menunjukkan penyalahgunaan terdistribusi.
const chatLimiter = new RateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(20)
    .refine((m) => m[0]?.role === 'user' && m.at(-1)?.role === 'user', {
      message: 'Percakapan harus diawali dan diakhiri pesan pengunjung',
    }),
});

const replySchema = z.object({ reply: z.string().min(1), handoff: z.boolean() });

const REPLY_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      reply: { type: 'string', description: 'Jawaban untuk pengunjung.' },
      handoff: {
        type: 'boolean',
        description: 'true bila pengunjung harus diarahkan ke admin WhatsApp.',
      },
    },
    required: ['reply', 'handoff'],
    additionalProperties: false,
  },
};

const HANDOFF_FALLBACK = {
  reply: 'Maaf, saya belum bisa menjawab sekarang. Silakan hubungi admin kami lewat WhatsApp.',
  handoff: true,
};

export async function POST(request: NextRequest) {
  if (!chatLimiter.consume(clientIpFrom(request.headers) ?? 'unknown').allowed) {
    return NextResponse.json(
      {
        reply: 'Terlalu banyak pesan dalam waktu singkat. Silakan hubungi admin lewat WhatsApp.',
        handoff: true,
      },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Pesan tidak valid' }, { status: 400 });
  }

  try {
    const brand = await getBrand();
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      // Jawaban chat pendek; batas ini juga plafon biaya per pesan dari
      // endpoint publik. Opus 5.5 selalu berpikir, jadi tetap ada ruang untuk itu.
      max_tokens: 1500,
      // Obrolan layanan pelanggan pendek: effort rendah cukup dan lebih cepat.
      output_config: { effort: 'low', format: REPLY_FORMAT },
      // Penolakan oleh pengaman model dialihkan ke model cadangan, bukan
      // langsung jadi jawaban kosong.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        {
          type: 'text',
          text: await buildSystemPrompt(brand.name),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: parsed.data.messages,
    });

    // `max_tokens` = JSON terpotong; JSON.parse akan gagal.
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      return NextResponse.json(HANDOFF_FALLBACK);
    }

    const text = response.content.find((b) => b.type === 'text');
    const reply = replySchema.safeParse(text ? JSON.parse(text.text) : null);
    return NextResponse.json(reply.success ? reply.data : HANDOFF_FALLBACK);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.error('[chat] rate limit Anthropic', error.message);
    } else if (error instanceof Anthropic.APIError) {
      console.error(`[chat] Anthropic ${error.status}`, error.message);
    } else {
      console.error('[chat] gagal', error);
    }
    return NextResponse.json(HANDOFF_FALLBACK, { status: 502 });
  }
}
