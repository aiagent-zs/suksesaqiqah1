'use client';

import { useEffect, useRef, useState } from 'react';
import { siteConfig } from '@/lib/constants/site';
import { IconChat, IconClose, IconWhatsApp } from './icons';

type Message = { role: 'user' | 'assistant'; content: string; handoff?: boolean };

const QUICK_QUESTIONS = [
  'Berapa harga paket aqiqah?',
  'Apa beda Aqiqah Kirim dan Salur?',
  'Bagaimana cara melacak pesanan?',
  'Saya ada masalah dengan pesanan',
];

/**
 * Gelembung chat di pojok kanan bawah halaman publik (docs/26_CHAT_BOT.md).
 *
 * Pertanyaan umum dijawab bot lewat `/api/chat`. Bila bot menandai `handoff`
 * (komplain, urusan pesanan tertentu, atau pertanyaan di luar pengetahuannya),
 * pesan itu membawa tombol WhatsApp admin berisi pertanyaan terakhir
 * pengunjung, supaya ia tidak perlu mengetik ulang.
 */
export function ChatWidget({ brandName }: { brandName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setPending(true);
    // Server menerima 20 pesan terakhir yang diawali pesan pengunjung.
    const recent = next.slice(-20);
    if (recent[0].role === 'assistant') recent.shift();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recent.map(({ role, content }) => ({ role, content })) }),
      });
      const data = (await res.json()) as { reply?: string; handoff?: boolean };
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: data.reply ?? 'Maaf, terjadi kendala. Silakan hubungi admin lewat WhatsApp.',
          handoff: data.handoff ?? true,
        },
      ]);
    } catch {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: 'Koneksi terputus. Coba lagi, atau hubungi admin lewat WhatsApp.',
          handoff: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const lastQuestion = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const waHref = siteConfig.whatsapp.href(
    `Halo Admin ${brandName},\n\nSaya membutuhkan bantuan terkait:\n\n${lastQuestion}\n\nMohon bantuannya.`,
  );

  return (
    <div className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 sm:right-6">
      {open && (
        <section
          id="chat-panel"
          aria-label={`Tanya ${brandName}`}
          className="border-line animate-in fade-in slide-in-from-bottom-2 flex h-[min(600px,calc(100dvh-12rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border bg-white shadow-lg duration-200 sm:w-[380px]"
        >
          <header className="bg-primary flex items-center justify-between gap-3 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Tanya {brandName}</p>
              <p className="text-xs text-white/80">Jawaban otomatis. Komplain langsung ke admin.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                toggleRef.current?.focus();
              }}
              aria-label="Tutup chat"
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-white/10"
            >
              <IconClose className="size-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <div>
                <p className="text-ink text-sm leading-6">
                  Assalamu&apos;alaikum. Tanyakan soal paket, harga, atau cara memesan. Untuk
                  komplain atau pesanan tertentu, saya hubungkan ke admin.
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => send(q)}
                        className="border-line text-ink hover:border-primary hover:text-primary min-h-11 w-full rounded-md border px-3 text-left text-sm"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-primary text-white' : 'bg-surface-muted text-ink'
                  }`}
                >
                  {m.content}
                  {m.handoff && (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary mt-3 w-full"
                    >
                      <IconWhatsApp className="size-4" />
                      Hubungi admin {siteConfig.whatsapp.display}
                    </a>
                  )}
                </div>
              </div>
            ))}

            {pending && (
              <p className="text-ink-muted text-sm" role="status">
                Sedang mengetik…
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-line flex items-end gap-2 border-t p-3"
          >
            <label htmlFor="chat-input" className="sr-only">
              Tulis pertanyaan
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              maxLength={1000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Tulis pertanyaan…"
              className="border-line text-ink focus:border-primary min-h-11 flex-1 resize-none rounded-md border px-3 py-2.5 text-base sm:text-sm"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="btn btn-primary min-h-11 disabled:opacity-50"
            >
              Kirim
            </button>
          </form>
        </section>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="chat-panel"
        aria-label={open ? 'Tutup chat' : 'Buka chat bantuan'}
        className="bg-primary hover:bg-primary-dark inline-flex size-14 items-center justify-center rounded-full text-white shadow-lg"
      >
        {open ? <IconClose className="size-6" /> : <IconChat className="size-7" />}
      </button>
    </div>
  );
}
