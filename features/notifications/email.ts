import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { siteConfig } from '@/lib/constants/site';

/**
 * Email ke pemesan, dirakit dari `payload` baris outbox.
 *
 * Payload ditulis trigger `notify_order_email` (`20261018010000`) dan bertipe
 * `Json` di database, jadi setiap medan dibaca dengan curiga: yang kosong
 * diganti teks wajar, bukan "undefined" di kotak masuk pemesan.
 *
 * Tiap email punya versi teks polos. Klien email yang menolak HTML, dan filter
 * spam yang menilai email tanpa versi teks, sama-sama membacanya.
 */
export type OrderEmail = { subject: string; html: string; text: string };

type Item = { name: string; qty: number };

const BRAND = '#0e7c5a';

function str(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function itemsOf(payload: Record<string, unknown>): Item[] {
  if (!Array.isArray(payload.items)) return [];
  return payload.items
    .map((i) => ({ name: str((i as Item)?.name), qty: Number((i as Item)?.qty) || 0 }))
    .filter((i) => i.name);
}

/** Nama pemesan masuk ke HTML; tanpa escape, nama berisi `<` merusak email. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(
  heading: string,
  paragraphs: string[],
  rows: [string, string][],
  cta: { label: string; href: string },
): string {
  const p = paragraphs
    .map(
      (t) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#262626">${esc(t)}</p>`,
    )
    .join('');
  const table = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-collapse:collapse">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e5e5;font-size:14px;color:#525252;width:40%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e5e5e5;font-size:14px;color:#171717;font-weight:600">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px">
<tr><td style="padding:20px 24px;background:${BRAND};border-radius:8px 8px 0 0;color:#ffffff;font-size:16px;font-weight:700">${esc(siteConfig.name)}</td></tr>
<tr><td style="padding:28px 24px 8px">
<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#171717">${esc(heading)}</h1>
${p}${table}
<a href="${esc(cta.href)}" style="display:inline-block;padding:12px 20px;background:${BRAND};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600">${esc(cta.label)}</a>
</td></tr>
<tr><td style="padding:24px;font-size:13px;line-height:20px;color:#525252">Ada pertanyaan? Balas email ini atau hubungi kami di WhatsApp ${esc(siteConfig.whatsapp.display)}.</td></tr>
</table></td></tr></table></body></html>`;
}

function plain(
  heading: string,
  paragraphs: string[],
  rows: [string, string][],
  cta: { label: string; href: string },
): string {
  return [
    heading,
    '',
    ...paragraphs.flatMap((t) => [t, '']),
    ...rows.map(([k, v]) => `${k}: ${v}`),
    rows.length ? '' : null,
    `${cta.label}: ${cta.href}`,
    '',
    `Ada pertanyaan? Balas email ini atau hubungi kami di WhatsApp ${siteConfig.whatsapp.display}.`,
    `${siteConfig.name}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/**
 * `null` untuk template yang bukan email pemesan. Worker menandai barisnya
 * `failed` alih-alih mengirim email kosong.
 */
export function orderEmail(
  template: string,
  payload: Record<string, unknown>,
  appUrl: string,
): OrderEmail | null {
  const name = str(payload.participant_name) || 'Bapak/Ibu';
  const order = str(payload.order_number);
  const token = str(payload.public_token);
  const link = `${appUrl}/r/${token}`;
  const catering = payload.is_catering === true;
  const kind = catering ? 'katering' : 'aqiqah';

  if (!order || !token) return null;

  if (template === 'order_verified') {
    const items = itemsOf(payload);
    const date = str(payload.requested_date);
    const time = str(payload.requested_time);
    const rows: [string, string][] = [
      ['Nomor pesanan', order],
      ...(items.length
        ? [['Paket', items.map((i) => `${i.name} (${i.qty})`).join(', ')] as [string, string]]
        : []),
      ...(date
        ? [
            ['Jadwal', `${formatDate(date)}${time ? `, ${formatTime(time)} WIB` : ''}`] as [
              string,
              string,
            ],
          ]
        : []),
      ['Total', formatCurrency(str(payload.total_amount))],
    ];
    const heading = `Pesanan ${order} sudah kami terima`;
    const paragraphs = [
      `Assalamu'alaikum ${name},`,
      `Pesanan ${kind} Anda sudah kami periksa dan kami terima. Pesanan mulai kami kerjakan setelah pembayarannya lunas; admin kami akan mengabari langkah pembayarannya.`,
      'Kemajuan pesanan bisa Anda pantau kapan saja lewat tautan di bawah.',
    ];
    const cta = { label: 'Pantau pesanan', href: link };
    return {
      subject: `Pesanan ${order} sudah kami terima`,
      html: layout(heading, paragraphs, rows, cta),
      text: plain(heading, paragraphs, rows, cta),
    };
  }

  if (template === 'order_completed') {
    const heading = `Pesanan ${order} sudah selesai`;
    const paragraphs = [
      `Assalamu'alaikum ${name},`,
      catering
        ? `Alhamdulillah, pesanan katering Anda sudah selesai kami kerjakan dan antarkan.`
        : `Alhamdulillah, ibadah aqiqah Anda sudah selesai kami laksanakan.`,
      'Laporan dan foto dokumentasinya bisa Anda lihat dan unduh lewat tautan di bawah.',
      'Terima kasih telah mempercayakan pesanan ini kepada kami.',
    ];
    const cta = { label: 'Lihat laporan', href: link };
    return {
      subject: `Pesanan ${order} sudah selesai`,
      html: layout(heading, paragraphs, [['Nomor pesanan', order]], cta),
      text: plain(heading, paragraphs, [['Nomor pesanan', order]], cta),
    };
  }

  return null;
}
