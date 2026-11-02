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

/** Plafon jumlah kunci yang disimpan, supaya memori tetap terbatas. */
const MAX_BUCKETS = 10_000;

/**
 * Wadah hitungan. Diekspor sebagai kelas supaya pengujian bisa memakai
 * instance-nya sendiri — modul bersama akan membawa sisa hitungan antar test.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private lastPrune = 0;

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
    // hidup lama. Paling banyak sekali per jendela: memindai 10.000 entri di
    // setiap permintaan justru jadi beban saat banjir datang.
    if (this.buckets.size > MAX_BUCKETS && now - this.lastPrune >= windowMs) {
      this.lastPrune = now;
      this.prune(now);
    }

    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      // Banjir kunci baru dalam satu jendela tidak bisa diatasi `prune` (semua
      // masih aktif), jadi entri tertua dibuang — Map menyimpan urutan sisip.
      // Kunci yang dibuang mendapat jatah baru; itu harga plafon memori.
      if (bucket) this.buckets.delete(key);
      while (this.buckets.size >= MAX_BUCKETS) {
        this.buckets.delete(this.buckets.keys().next().value as string);
      }
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
 * Alamat IP pengirim.
 *
 * Header mana yang dipercaya bergantung pada jalur masuknya:
 *   - `TRUST_CF_HEADER=1`: domain di-proxy Cloudflare dan origin hanya menerima
 *     koneksi dari IP Cloudflare (firewall). `cf-connecting-ip` ditulis edge-nya.
 *     Tanpa firewall itu, siapa pun yang menembak origin langsung bisa
 *     mengarangnya — karena itu tidak dipercaya secara default.
 *   - selain itu: `x-real-ip` yang ditulis reverse proxy VPS (Traefik/Nginx)
 *     dari alamat koneksi, lalu entri pertama `x-forwarded-for`. Entri itu bisa
 *     dikarang klien bila proxy di depannya tidak membuangnya; ia hanya
 *     cadangan untuk lingkungan tanpa `x-real-ip`.
 *
 * `null` bila tidak ada.
 */
export function clientIpFrom(
  headers: { get(name: string): string | null },
  trustCf: boolean = process.env.TRUST_CF_HEADER === '1',
): string | null {
  return (
    (trustCf ? headers.get('cf-connecting-ip')?.trim() : '') ||
    headers.get('x-real-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  );
}

/**
 * Kunci rem laju untuk satu alamat IP.
 *
 * IPv6 dikunci per prefiks /64: satu pelanggan rumahan biasanya mendapat
 * seluruh /64, jadi mengunci per alamat penuh berarti ia punya 2^64 kunci
 * untuk dirotasi. IPv4 (termasuk bentuk `::ffff:a.b.c.d`) dipakai apa adanya.
 *
 * Tanpa IP, semua permintaan berbagi kunci `unknown`: tidak dihitung sama
 * sekali = tanpa rem. Akibatnya bila proxy salah setel dan header IP hilang,
 * seluruh pengunjung berbagi satu jatah — gejala yang terlihat (banyak 429),
 * bukan celah yang diam-diam terbuka.
 */
export function rateLimitKey(ip: string | null): string {
  if (!ip) return 'unknown';
  const addr = ip.toLowerCase().split('%')[0];
  if (!addr.includes(':')) return addr;

  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];

  const [head, tail] = addr.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? headParts
      : [...headParts, ...Array(8 - headParts.length - tailParts.length).fill('0'), ...tailParts];
  const prefix = groups.slice(0, 4);
  // Bentuk yang tidak terbaca tetap dihitung, hanya tanpa pengelompokan.
  if (prefix.length < 4 || prefix.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return addr;
  return `${prefix.map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

/** Kunci rem laju langsung dari header permintaan. */
export function rateLimitKeyFrom(headers: { get(name: string): string | null }): string {
  return rateLimitKey(clientIpFrom(headers));
}
