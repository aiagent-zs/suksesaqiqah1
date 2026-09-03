'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { createService, updateService } from '@/server/actions/services';
import type { ServiceRow } from '../queries';

/** Label per jenis; kuncinya sama dengan enum `service_type` di database. */
export const TYPE_LABEL: Record<string, string> = {
  aqiqah: 'Aqiqah',
  nasi_box: 'Nasi Box',
  qurban: 'Qurban',
  sedekah_daging: 'Sedekah Daging',
};

export const TYPE_ORDER = ['aqiqah', 'nasi_box', 'qurban', 'sedekah_daging'] as const;

const EMPTY = {
  type: 'aqiqah',
  name: '',
  slug: '',
  description: '',
  price: '',
  sort_order: '',
  tagline: '',
  /** Satu butir per baris — bentuk yang paling lazim diketik orang. */
  landing_features: '',
  porsi: '',
  jenis_olahan: '',
  cocok_untuk: '',
  /** Nasi box: satu lauk per baris. */
  items: '',
  is_popular: false,
  show_on_landing: false,
};

type Draft = typeof EMPTY;

function draftFrom(s: ServiceRow): Draft {
  return {
    type: s.type,
    name: s.name,
    slug: s.slug,
    description: s.description ?? '',
    price: String(s.price),
    sort_order: String(s.sortOrder),
    tagline: s.tagline ?? '',
    landing_features: s.landingFeatures.join('\n'),
    porsi: s.porsi === null ? '' : String(s.porsi),
    jenis_olahan: s.jenisOlahan ?? '',
    cocok_untuk: s.cocokUntuk ?? '',
    items: s.items.join('\n'),
    is_popular: s.isPopular,
    show_on_landing: s.showOnLanding,
  };
}

/**
 * Formulir paket — dipakai dua tempat, dengan tujuan berbeda.
 *
 * Di `/vendors?tab=katalog` ia membuat paket **baru** (`service` kosong); di
 * `/vendors/katalog/{id}` ia menyunting yang sudah ada. Satu komponen untuk
 * keduanya karena medannya memang sama persis — yang berbeda hanya ke mana
 * hasilnya dikirim dan ke mana perginya sesudah tersimpan.
 *
 * ## Kenapa menyunting pindah ke halaman sendiri
 *
 * Sebelumnya menekan "Sunting" hanya membuka formulir di **atas** daftar —
 * yang pada daftar sepuluh paket berarti formulirnya terbuka di luar layar,
 * dan tombolnya terbaca sebagai tidak berfungsi. Itu keluhan yang tepat, dan
 * jalan keluarnya bukan menggulir otomatis: halaman sendiri juga memberi URL
 * yang bisa dibagikan, tombol kembali yang bekerja, dan ruang untuk hal-hal
 * yang tidak muat di baris daftar (foto, kaitan ke order & mitra).
 */
export function ServiceForm({
  service,
  onCancel,
  onSaved,
}: {
  /** Paket yang disunting; kosongkan untuk membuat baru. */
  service?: ServiceRow;
  onCancel?: () => void;
  /** Dipanggil setelah tersimpan. Tanpa ini, halaman hanya di-refresh. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft>(service ? draftFrom(service) : EMPTY);
  const { toast, show, dismiss } = useToast();

  function submit() {
    setError(null);
    setFieldErrors({});

    // Harga & urutan dikirim sebagai number: schema-nya `z.number()`, dan
    // string kosong yang lolos ke sana akan berbunyi "expected number,
    // received string" — pesan yang tidak berarti apa-apa bagi operator.
    const payload = {
      type: draft.type,
      name: draft.name,
      slug: draft.slug,
      description: draft.description,
      price: draft.price === '' ? Number.NaN : Number(draft.price),
      ...(draft.sort_order === '' ? {} : { sort_order: Number(draft.sort_order) }),
      tagline: draft.tagline,
      // Baris kosong disaring di schema, bukan di sini: aturannya satu tempat
      // dan berlaku juga untuk pemanggil lain.
      landing_features: draft.landing_features.split('\n'),
      // Porsi kosong dikirim sebagai `undefined`, bukan 0: schema-nya opsional,
      // dan 0 akan tersimpan lalu tercetak sebagai "0 porsi" di kartu.
      ...(draft.porsi === '' ? {} : { porsi: Number(draft.porsi) }),
      jenis_olahan: draft.jenis_olahan,
      cocok_untuk: draft.cocok_untuk,
      items: draft.items.split('\n'),
      is_popular: draft.is_popular,
      show_on_landing: draft.show_on_landing,
    };

    startTransition(async () => {
      const result = service
        ? await updateService({ ...payload, id: service.id })
        : await createService(payload);

      if (!result.ok) {
        setError(result.error.message);
        setFieldErrors(result.error.fields ?? {});
        // Toast **dan** pesan menetap di atas form, sengaja: keduanya dipakai
        // bersama karena kelemahannya berlawanan — toast terasa tapi
        // menghilang, pesan bertahan tapi bisa terlewat kalau perhatian sedang
        // di bawah layar. Pola yang sama dengan checkout.
        show('error', result.error.message);
        return;
      }

      // Tanpa ini, penyimpanan yang berhasil tidak meninggalkan tanda apa pun:
      // form tertutup dan data dimuat ulang, persis seperti tampilan gagal.
      show('success', service ? 'Perubahan paket tersimpan.' : 'Paket baru ditambahkan.');
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jenis" error={fieldErrors.type}>
          <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nama paket" error={fieldErrors.name}>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Aqiqah Ekonomi"
          />
        </Field>

        <Field
          label="Slug"
          error={fieldErrors.slug}
          hint={
            service
              ? 'Dipakai sebagai tautan /checkout?paket={slug}. Mengubahnya membuat tautan lama mengarah ke paket pertama, tanpa galat.'
              : 'Huruf kecil, angka, dan tanda hubung. Mis. aqiqah-ekonomi'
          }
        >
          <Input
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            placeholder="aqiqah-ekonomi"
          />
        </Field>

        <Field
          label={`Harga jual (Rp per ${draft.type === 'nasi_box' ? 'box' : 'ekor'})`}
          error={fieldErrors.price}
          hint="Order yang sudah berjalan tidak ikut berubah — harganya sudah tersalin saat order dibuat."
        >
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            placeholder={draft.type === 'nasi_box' ? '21000' : '2300000'}
          />
        </Field>

        <Field label="Urutan tampil" error={fieldErrors.sort_order} hint="Makin kecil makin atas.">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.sort_order}
            onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
            placeholder="1"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Deskripsi (internal)"
            error={fieldErrors.description}
            hint="Dibaca operator & panel modal mitra — bukan yang tampil di halaman depan."
          >
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Paket aqiqah kambing dengan olahan standar, hemat namun tetap syar'i."
            />
          </Field>
        </div>
      </div>

      {/* --- Isi paket (`meta`) --------------------------------------------
          Ditaruh di blok data paket, BUKAN di blok halaman depan: isinya
          dibaca panel modal mitra juga (`/vendors/{id}` menampilkannya persis
          sebelum modal diketik, sebab modal yang wajar untuk 80 porsi tidak
          wajar untuk 150). Jadi ia berguna meski paketnya tidak dipasarkan.

          Sampai 3 September kolom ini dibaca enam tempat dan ditulis nol —
          satu-satunya cara mengubahnya adalah dashboard Supabase. */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold">Isi paket</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {draft.type === 'nasi_box'
            ? 'Isi satu box. Nasi box dipesan terpisah dari paket aqiqah, dengan harganya sendiri.'
            : 'Hasil dari satu ekor — lauk saja. Nasi box adalah paket tersendiri.'}
        </p>

        {/* Bentuknya beda per jenis, dan itu disengaja: "80 porsi, olahan gulai
            & sate" menjawab pertanyaan berbeda dari daftar lauk satu box. */}
        {draft.type === 'nasi_box' ? (
          <div className="mt-3">
            <Field
              label="Isi per box"
              error={fieldErrors.items}
              hint="Satu lauk per baris, maksimal 20. Inilah yang dibaca pengunjung di halaman depan."
            >
              <Textarea
                rows={5}
                value={draft.items}
                onChange={(e) => setDraft({ ...draft, items: e.target.value })}
                placeholder={'nasi putih\ngulai kambing\nsate\nacar\nkerupuk'}
              />
            </Field>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Perkiraan porsi per ekor"
              error={fieldErrors.porsi}
              hint="Keterangan hasil untuk pembeli, bukan batas pesanan — ia tetap bebas memesan berapa ekor."
            >
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.porsi}
                onChange={(e) => setDraft({ ...draft, porsi: e.target.value })}
                placeholder="80"
              />
            </Field>

            <Field label="Ragam olahan" error={fieldErrors.jenis_olahan}>
              <Input
                value={draft.jenis_olahan}
                onChange={(e) => setDraft({ ...draft, jenis_olahan: e.target.value })}
                placeholder="gulai & sate"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Cocok untuk" error={fieldErrors.cocok_untuk}>
                <Input
                  value={draft.cocok_untuk}
                  onChange={(e) => setDraft({ ...draft, cocok_untuk: e.target.value })}
                  placeholder="keluarga kecil"
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* --- Konten halaman depan ------------------------------------------
          Dipisah dengan garis dan judul sendiri: medan di atas menentukan apa
          yang **ditagih**, yang di bawah menentukan apa yang **dibaca calon
          pembeli**. Tanpa pemisahan itu "deskripsi" dan "tagline" terbaca
          sebagai dua kolom yang sama-sama wajib diisi tanpa alasan jelas. */}
      <div className="border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Tampilan di halaman depan</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Yang dilihat pengunjung di kartu paket
            </p>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={draft.show_on_landing}
              onChange={(e) => setDraft({ ...draft, show_on_landing: e.target.checked })}
            />
            Tampilkan di halaman depan
          </label>
        </div>

        {fieldErrors.show_on_landing && (
          <p role="alert" className="text-destructive mt-2 flex items-start gap-1.5 text-xs">
            <AlertCircle className="mt-0.5 size-3 shrink-0" />
            {fieldErrors.show_on_landing}
          </p>
        )}

        {/* Medan berikutnya hanya berarti kalau kartunya memang tampil.
            Disembunyikan, bukan di-disable: formulir ini panjang, dan medan
            mati yang tetap memenuhi layar menyulitkan menemukan yang hidup. */}
        {draft.show_on_landing && (
          <div className="mt-4 grid gap-3">
            <Field label="Tagline" error={fieldErrors.tagline} hint="Satu kalimat di bawah harga.">
              <Input
                value={draft.tagline}
                onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                placeholder="Ibadah aqiqah lengkap dengan harga paling terjangkau."
              />
            </Field>

            {/* Nasi box tidak memakai daftar fitur: lauknya sudah tercatat di
                `meta->items` dan ditampilkan landing dari sana. Dua daftar isi
                yang sama persis adalah kekeliruan yang justru hendak dihapus
                perpindahan katalog ke database. */}
            {draft.type !== 'nasi_box' && (
              <Field
                label="Butir yang dicentang"
                error={fieldErrors.landing_features}
                hint="Satu butir per baris, maksimal 12."
              >
                <Textarea
                  rows={5}
                  value={draft.landing_features}
                  onChange={(e) => setDraft({ ...draft, landing_features: e.target.value })}
                  placeholder={
                    '1 ekor kambing sehat & tersertifikasi\nPemotongan sesuai syariat\nMasakan siap antar'
                  }
                />
              </Field>
            )}

            <div>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={draft.is_popular}
                  onChange={(e) => setDraft({ ...draft, is_popular: e.target.checked })}
                />
                Tandai &ldquo;Terpopuler&rdquo;
              </label>
              <p className="text-muted-foreground mt-1 text-xs">
                Menandai lebih dari satu paket membuat penandanya kehilangan arti.
              </p>
            </div>
          </div>
        )}
      </div>

      <Toast state={toast} onDismiss={dismiss} />

      <div className="flex justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Batal
          </Button>
        )}
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? 'Menyimpan…' : service ? 'Simpan perubahan' : 'Tambah paket'}
        </Button>
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p role="alert" className="text-destructive flex items-start gap-1.5 text-xs">
          <AlertCircle className="mt-0.5 size-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
