'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BadgeCheck, Globe, MessageCircle, ShieldQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyGuestOrder } from '@/server/actions/orders';
import { AQIQAH_FOR_LABEL, DISTRIBUTION_MODE_LABEL } from '@/lib/constants/order';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { whatsAppHref } from '@/lib/format/phone';

export type GuestOrderInfo = {
  orderNumber: string;
  participantName: string | null;
  participantPhone: string | null;
  aqiqahFor: string | null;
  /**
   * Data lahir anak yang diaqiqahi. Namanya sendiri tidak di sini — ia tersimpan
   * pada `animals.on_behalf_of` dan sudah tampil di panel hewan.
   */
  childBirthPlace: string | null;
  childBirthDate: string | null;
  /** Tanggal & jam yang diminta pemesan — bahan menyusun jadwal, bukan jadwalnya. */
  requestedDate: string | null;
  requestedTime: string | null;
  distributionMode: string | null;
  deliveryAddress: string | null;
  recipientInstitution: string | null;
  referralCode: string | null;
  verifiedAt: string | null;
  verifierName: string | null;
};

/**
 * Panel order tamu pada halaman detail (`prd.md` FR-C2, TASKS.md section 11).
 *
 * Dua tugas sekaligus:
 *
 * 1. **Menandai asalnya.** Order dari checkout publik hanya bertanda
 *    `created_by is null` di database; tanpa panel ini halaman detail tidak
 *    membedakannya sama sekali dari order yang dibuat staf.
 * 2. **Menampilkan isian yang hanya ada di checkout publik** — cara penyaluran,
 *    alamat kirim, lembaga penerima, kode referral. Sebelumnya kolom-kolom itu
 *    tersimpan tapi tidak pernah muncul di mana pun, jadi admin harus membuka
 *    database untuk tahu ke mana daging harus dikirim.
 *
 * Tombol verifikasinya bukan formalitas: selama `verifiedAt` kosong, trigger
 * `enforce_guest_order_verification` menahan ordernya di status `new`.
 */
export function GuestOrderPanel({
  orderId,
  info,
  canVerify,
}: {
  orderId: string;
  info: GuestOrderInfo;
  canVerify: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const verified = Boolean(info.verifiedAt);

  // Notifikasi WhatsApp otomatis baru ada di Tahap 8, sementara halaman checkout
  // sudah menjanjikannya ke pemesan. Sampai outbox itu jadi, tautan ini yang
  // membuat janji tersebut tetap ditepati — manual, tapi satu klik.
  const waLink = whatsAppHref(
    info.participantPhone,
    `Assalamu'alaikum${info.participantName ? ` ${info.participantName}` : ''}, ` +
      `terima kasih sudah memesan aqiqah di Sukses Aqiqah. ` +
      `Pesanan Anda dengan nomor ${info.orderNumber} sudah kami terima dan sedang kami proses.`,
  );

  function handleVerify() {
    setError(null);
    startTransition(async () => {
      const result = await verifyGuestOrder({ order_id: orderId });
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  const details: Array<{ label: string; value: string }> = [];
  if (info.aqiqahFor) {
    details.push({
      label: 'Aqiqah untuk',
      value: AQIQAH_FOR_LABEL[info.aqiqahFor] ?? info.aqiqahFor,
    });
  }
  // Tempat & tanggal lahir: yang dikonfirmasi ulang saat menelepon pemesan,
  // karena keduanya tercetak di sertifikat dan salah ketik di sini baru
  // ketahuan setelah dokumennya jadi.
  if (info.childBirthPlace || info.childBirthDate) {
    details.push({
      label: 'Tempat, tanggal lahir anak',
      value: [info.childBirthPlace, info.childBirthDate ? formatDate(info.childBirthDate) : null]
        .filter(Boolean)
        .join(', '),
    });
  }
  // Tanggal yang diminta pemesan: inilah yang dikonfirmasi saat menghubunginya,
  // dan yang dipakai admin menyusun baris `schedules` sesudah verifikasi.
  if (info.requestedDate) {
    details.push({
      label: 'Diminta dilaksanakan',
      value: `${formatDate(info.requestedDate)}${
        info.requestedTime ? ` · ${formatTime(info.requestedTime)} WIB` : ''
      }`,
    });
  }
  if (info.distributionMode) {
    details.push({
      label: 'Cara penyaluran',
      value: DISTRIBUTION_MODE_LABEL[info.distributionMode] ?? info.distributionMode,
    });
  }
  if (info.deliveryAddress) details.push({ label: 'Alamat kirim', value: info.deliveryAddress });
  if (info.recipientInstitution) {
    details.push({ label: 'Lembaga penerima', value: info.recipientInstitution });
  }
  if (info.referralCode) details.push({ label: 'Kode referral', value: info.referralCode });

  return (
    <section
      className={`overflow-hidden rounded-2xl border shadow-sm ${
        verified ? 'border-border bg-card' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="flex gap-3">
          <Globe
            className={`mt-0.5 size-5 shrink-0 ${verified ? 'text-muted-foreground' : 'text-amber-600'}`}
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold">Order dari checkout publik</h2>
            <p
              className={`mt-0.5 text-sm ${verified ? 'text-muted-foreground' : 'text-amber-800'}`}
            >
              {verified ? (
                <>
                  Diverifikasi {formatDateTime(info.verifiedAt)}
                  {info.verifierName ? ` oleh ${info.verifierName}` : ''}.
                </>
              ) : (
                <>
                  Belum diverifikasi. Order ini tertahan di status Baru sampai isinya dikonfirmasi
                  ke pemesan.
                </>
              )}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            verified
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-300 bg-white text-amber-800'
          }`}
        >
          {verified ? (
            <BadgeCheck className="size-3.5" aria-hidden="true" />
          ) : (
            <ShieldQuestion className="size-3.5" aria-hidden="true" />
          )}
          {verified ? 'Terverifikasi' : 'Perlu verifikasi'}
        </span>
      </div>

      {details.length > 0 && (
        <dl className="border-border grid gap-3 border-t px-5 py-4 text-sm sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.label}>
              <dt className="text-muted-foreground text-xs">{d.label}</dt>
              <dd className="mt-0.5 font-medium break-words">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="border-border flex flex-wrap items-center gap-2 border-t px-5 py-4">
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Hubungi pemesan
          </a>
        )}

        {!verified &&
          (canVerify ? (
            <Button type="button" onClick={handleVerify} disabled={pending}>
              <BadgeCheck className="size-4" aria-hidden="true" />
              {pending ? 'Memproses…' : 'Tandai terverifikasi'}
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              Verifikasi dilakukan admin atau superadmin.
            </p>
          ))}
      </div>

      {error && (
        <p className="text-destructive border-destructive/30 bg-destructive/5 flex items-start gap-2 border-t px-5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  );
}
