/**
 * Rem laju sederhana berbasis jendela tetap (fixed window).
 *
 * DIPAKAI UNTUK APA
 * Checkout mandiri adalah satu-satunya jalur tulis milik pengunjung anonim.
 * `create_guest_order` sudah menolak pesanan ke-6 dalam sejam **dari nomor
 * telepon yang sama**, tapi nomor telepon dikirim dari form — satu skrip cukup
 * mengarangnya berbeda tiap kali untuk melewati rem itu sepenuhnya. Rem di sini
 * memakai kunci yang tidak ditentukan pengirim (alamat IP).
 *
 * BATAS YANG DISENGAJA
 * Penghitungnya tinggal di memori proses. Artinya:
 *   - hilang setiap kali server di-restart atau di-deploy;
 *   - tidak dibagi antar instance — di lingkungan serverless, tiap instance
 *     punya hitungannya sendiri, jadi batas efektifnya `limit × jumlah instance`.
 *
 * Itu bukan kelalaian, melainkan pilihan sadar: rem ini menghentikan
 * penyalahgunaan kasar tanpa menambah dependensi baru. Pertahanan yang
 * sesungguhnya untuk serangan terdistribusi adalah rate limit di tepi (WAF /
 * Redis bersama) atau captcha — lihat catatan di `server/actions/checkout.ts`.
 */

export type RateLimitResult = {
  allowed: boolean;
  /** Sisa jatah pada jendela berjalan. */
  remaining: number;
  /** Berapa lama lagi jendela ini berakhir, dalam milidetik. */
  retryAfterMs: number;
};

export type RateLimitOptions = {
  /** Jumlah permintaan yang diizinkan per jendela. */
  limit: number;
  /** Panjang jendela dalam milidetik. */
  windowMs: number;
};

type Bucket = { count: number; resetAt: number };

/**
 * Wadah hitungan. Diekspor sebagai kelas supaya pengujian bisa memakai
 * instance-nya sendiri — modul bersama akan membawa sisa hitungan antar test.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private readonly options: RateLimitOptions) {}

  /**
   * Catat satu permintaan untuk `key`.
   *
   * `now` bisa disuntikkan agar perilaku lintas jendela dapat diuji tanpa
   * menunggu waktu nyata.
   */
  consume(key: string, now: number = Date.now()): RateLimitResult {
    const { limit, windowMs } = this.options;

    // Pembersihan oportunistik: tanpa ini, Map tumbuh selamanya mengikuti
    // jumlah IP unik yang pernah datang — jalur kebocoran memori di server yang
    // hidup lama.
    if (this.buckets.size > 10_000) this.prune(now);

    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfterMs: windowMs };
    }

    bucket.count += 1;
    const retryAfterMs = bucket.resetAt - now;

    if (bucket.count > limit) {
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    return { allowed: true, remaining: limit - bucket.count, retryAfterMs };
  }

  /** Buang jendela yang sudah lewat. */
  prune(now: number = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  /** Hanya untuk pengujian. */
  reset(): void {
    this.buckets.clear();
  }
}

/**
 * Alamat IP pengirim dari header proxy.
 *
 * `x-forwarded-for` berisi rantai `klien, proxy1, proxy2`; entri **pertama**
 * adalah klien asli. Nilai itu bisa dipalsukan kalau permintaan bisa mencapai
 * aplikasi tanpa melewati proxy tepercaya — di belakang platform hosting
 * (Vercel, Cloudflare) header ini ditulis ulang oleh platform, jadi entri
 * pertamanya dapat dipercaya.
 *
 * Mengembalikan `null` bila tidak ada header yang bisa dibaca; pemanggilnya
 * yang memutuskan apa artinya — di sini permintaan tanpa IP tidak dilempar,
 * hanya tidak ikut terhitung.
 */
export function clientIpFrom(headers: {
  get(name: string): string | null;
}): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return headers.get('x-real-ip')?.trim() || null;
}
