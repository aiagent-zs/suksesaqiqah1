import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { whatsAppHref } from '@/lib/format/phone';
import type { Database } from '@/types/database';

type Row = Database['public']['Tables']['notifications']['Row'];
export type NotifChannel = Database['public']['Enums']['notif_channel'];
export type NotifStatus = Database['public']['Enums']['notif_status'];

/**
 * Satu notifikasi yang siap ditampilkan.
 *
 * Bentuknya sengaja berbeda dari baris database: `payload` bertipe `Json` di
 * sana, dan komponen tidak boleh menebak-nebak isinya. Penerjemahan payload
 * menjadi judul & tautan dikerjakan sekali di sini.
 */
export type AlertItem = {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  channel: NotifChannel;
  status: NotifStatus;
  template: string;
  title: string;
  detail: string | null;
  /** Ke mana admin dibawa saat menekannya. `null` bila tidak ada tujuan jelas. */
  href: string | null;
  recipient: string;
  createdAt: string;
  /** Tautan wa.me siap klik — hanya untuk kanal WhatsApp dengan nomor sah. */
  waHref: string | null;
};

/**
 * Judul yang layak dibaca orang, per template.
 *
 * Ditaruh di satu tempat, bukan di komponen: teks yang sama muncul di panel
 * dashboard dan (nanti) di halaman antrian, dan dua salinan yang menyimpang
 * adalah cara paling mudah membuat keduanya membingungkan.
 */
const TEMPLATE_LABEL: Record<string, string> = {
  documentation_uploaded: 'Bukti baru menunggu validasi',
  documentation_rejected: 'Bukti ditolak, vendor perlu mengunggah ulang',
  report_ready: 'Laporan siap dikirim ke pemesan',
  issue_high: 'Kendala berat dilaporkan',
  guest_order_new: 'Order tamu baru menunggu verifikasi',
  delivery_pending: 'Pemesan perlu mengonfirmasi penerimaan',
};

/** Pesan WhatsApp per template. Dirakit di server supaya isinya satu sumber. */
function waMessage(template: string, payload: Record<string, unknown>, appUrl: string): string | null {
  const nama = String(payload.participant_name ?? '').trim() || 'Bapak/Ibu';
  const order = String(payload.order_number ?? '').trim();
  const token = String(payload.public_token ?? '').trim();
  const link = token ? `${appUrl}/r/${token}` : '';

  if (template === 'report_ready') {
    return (
      `Assalamu'alaikum ${nama}. Alhamdulillah ibadah aqiqah Anda ` +
      `(Order ${order}) telah dilaksanakan. Lihat laporan & dokumentasinya di sini:\n${link}\n\n` +
      `— Zakat Sukses · Sukses Aqiqah`
    );
  }

  if (template === 'delivery_pending') {
    return (
      `Assalamu'alaikum ${nama}. Pesanan aqiqah Anda (Order ${order}) sudah kami antar. ` +
      `Mohon konfirmasi penerimaannya lewat tautan berikut:\n${link}\n\n` +
      `— Zakat Sukses · Sukses Aqiqah`
    );
  }

  return null;
}
/**
 * Notifikasi yang masih menunggu tindakan.
 *
 * **Dibatasi `queued`.** Yang sudah `sent` bukan lagi tugas, dan yang `failed`
 * butuh penanganan berbeda — keduanya akan punya tempatnya sendiri saat worker
 * pengirim dibangun. Panel dashboard hanya menjawab satu pertanyaan: apa yang
 * belum ditangani.
 *
 * **RLS yang membatasi, bukan query ini.** Kebijakan `notifications_select`
 * menuntut `is_staff()`, jadi vendor yang membuka dashboard mendapat array
 * kosong tanpa satu baris filter tambahan di sini. Menambahkan filter role di
 * TypeScript hanya akan jadi salinan kedua dari aturan yang sudah ada di
 * database — dan salinan yang menyimpang lebih berbahaya daripada tidak ada.
 */
export async function getPendingAlerts(limit = 8): Promise<AlertItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Gagal memuat notifikasi: ${error.message}`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';

  return (data ?? []).map((row: Row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const template = row.template ?? 'unknown';
    const orderNumber = payload.order_number ? String(payload.order_number) : null;

    // Nomor telepon dari payload/recipient tidak pernah dipercaya bentuknya:
    // `waLink` mengembalikan null bila tidak bisa dinormalkan, dan tombolnya
    // ikut tidak dirender.
    const message = waMessage(template, payload, appUrl);

    return {
      id: row.id,
      orderId: row.order_id,
      orderNumber,
      channel: row.channel,
      status: row.status,
      template,
      title: TEMPLATE_LABEL[template] ?? template,
      detail: detailOf(template, payload),
      href: row.order_id ? hrefOf(template, row.order_id) : null,
      recipient: row.recipient,
      createdAt: row.created_at,
      // `whatsAppHref` mengembalikan null bila nomornya tidak bisa dinormalkan,
      // jadi tombol WA ikut tidak dirender untuk kontak yang tidak valid —
      // lebih baik daripada tautan yang membuka WhatsApp ke nomor kosong.
      waHref: row.channel === 'whatsapp' && message ? whatsAppHref(row.recipient, message) : null,
    };
  });
}

/** Keterangan tambahan yang berbeda per jenis peristiwa. */
function detailOf(template: string, payload: Record<string, unknown>): string | null {
  if (template === 'documentation_rejected' && payload.review_note) {
    return `Alasan: ${String(payload.review_note)}`;
  }
  if (template === 'issue_high' && payload.title) {
    return String(payload.title);
  }
  if (template === 'guest_order_new' && payload.participant_name) {
    return `Dari ${String(payload.participant_name)}`;
  }
  if (template === 'documentation_uploaded' && payload.stage) {
    return `Tahap ${String(payload.stage)}`;
  }
  return null;
}

/**
 * Ke mana admin dibawa. Halaman validasi untuk urusan bukti, halaman order
 * untuk sisanya — sebab di situlah tindakannya benar-benar bisa dilakukan.
 */
function hrefOf(template: string, orderId: string): string {
  if (template === 'documentation_uploaded') return '/validation';
  return `/orders/${orderId}`;
}