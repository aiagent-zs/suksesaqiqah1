/**
 * Normalisasi nomor telepon Indonesia untuk tautan wa.me.
 *
 * Dipakai untuk menghubungi **pemesan** — berbeda dari `siteConfig.whatsapp`
 * yang memegang nomor perusahaan. Nomor pemesan datang dari form checkout
 * publik, jadi bentuknya beragam: `0812-3456-7890`, `+62 812 3456 7890`,
 * `62812...`, atau `812...`.
 *
 * wa.me hanya menerima digit dengan kode negara di depan dan tanpa `+`. Nomor
 * yang tidak bisa dinormalkan mengembalikan `null` supaya pemanggilnya
 * menampilkan nomor apa adanya alih-alih tautan yang pasti gagal dibuka.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // `+` ikut terbuang di sini; kode negara ditentukan dari digit pertamanya.
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;

  let normalized: string;

  if (digits.startsWith('62')) {
    normalized = digits;
  } else if (digits.startsWith('0')) {
    normalized = `62${digits.slice(1)}`;
  } else if (digits.startsWith('8')) {
    // Nomor seluler Indonesia selalu diawali 8 setelah kode negara.
    normalized = `62${digits}`;
  } else {
    return null;
  }

  // 62 + 9..13 digit. Batas bawah menyaring nomor yang jelas terpotong; batas
  // atas menyaring digit acak yang lolos regex form.
  const local = normalized.slice(2);
  if (local.length < 9 || local.length > 13) return null;

  return normalized;
}

/** Tautan wa.me lengkap, atau `null` bila nomornya tidak bisa dinormalkan. */
export function whatsAppHref(raw: string | null | undefined, message?: string): string | null {
  const number = toWhatsAppNumber(raw);
  if (!number) return null;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
