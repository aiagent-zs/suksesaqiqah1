'use client';

import { useMemo, useState, useTransition } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import { formatCurrency } from '@/lib/format';
import { createGuestOrderAction } from '@/server/actions/checkout';
import { SPECIES_BY_SERVICE_TYPE } from '../schema';
import type { CheckoutBranch, CheckoutPackage, GuestOrderResult } from '../queries';

const SERVICE_TYPE_LABEL: Record<string, string> = {
  aqiqah: 'Aqiqah',
  qurban: 'Qurban',
};

type Draft = {
  service_id: string;
  branch_id: string;
  species: string;
  qty: string;
  on_behalf_of: string;
  name: string;
  phone: string;
  email: string;
  delivery_address: string;
  recipient_institution: string;
  referral_code: string;
  notes: string;
};

/**
 * Formulir pemesanan mandiri tanpa login (`prd.md` FR-C2 · FR-C3 · FR-C4).
 *
 * Ringkasan biaya di sini murni tampilan. Angka yang mengikat dihitung ulang
 * oleh `create_guest_order` dari tabel `services`; keduanya membaca harga yang
 * sama, jadi tidak bisa berbeda — dan kalaupun form dimanipulasi, yang tercatat
 * tetap harga database.
 */
export function CheckoutForm({
  packages,
  branches,
  initialServiceId,
}: {
  packages: CheckoutPackage[];
  branches: CheckoutBranch[];
  /** Paket yang dibawa dari kartu di landing (`/checkout?paket=<slug>`). */
  initialServiceId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<GuestOrderResult | null>(null);

  const [draft, setDraft] = useState<Draft>({
    service_id: initialServiceId ?? packages[0]?.id ?? '',
    branch_id: branches[0]?.id ?? '',
    species: 'kambing',
    qty: '1',
    on_behalf_of: '',
    name: '',
    phone: '',
    email: '',
    delivery_address: '',
    recipient_institution: '',
    referral_code: '',
    notes: '',
  });

  const selected = useMemo(
    () => packages.find((p) => p.id === draft.service_id),
    [packages, draft.service_id],
  );

  // Aqiqah tidak memakai sapi — aturan yang sama ditegakkan RPC. Menyaringnya
  // di sini supaya form tidak pernah menawarkan pilihan yang pasti ditolak.
  const speciesOptions = selected
    ? (SPECIES_BY_SERVICE_TYPE[selected.type] ?? ['kambing'])
    : ['kambing'];

  const qtyNumber = Number(draft.qty) || 0;
  const total = selected ? selected.price * qtyNumber : 0;

  function set<K extends keyof Draft>(key: K, value: string) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // Ganti paket bisa membuat jenis hewan jadi tidak sah; dikembalikan ke
      // pilihan pertama yang berlaku daripada dibiarkan salah sampai submit.
      if (key === 'service_id') {
        const pkg = packages.find((p) => p.id === value);
        const allowed = pkg ? (SPECIES_BY_SERVICE_TYPE[pkg.type] ?? []) : [];
        if (allowed.length > 0 && !allowed.includes(next.species as 'kambing')) {
          next.species = allowed[0];
        }
      }
      return next;
    });
  }

  function submit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createGuestOrderAction(draft);
      if (!result.ok) {
        setError(result.error.message);
        setFieldErrors(result.error.fields ?? {});
        return;
      }
      setDone(result.data);
    });
  }

  if (done) {
    return (
      <div className="border-border bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Pesanan Anda tercatat</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Simpan nomor pesanan berikut. Tim kami akan menghubungi Anda lewat nomor telepon yang
              didaftarkan untuk konfirmasi dan pembayaran.
            </p>
          </div>
        </div>

        <dl className="border-border mt-5 grid gap-3 border-t pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Nomor pesanan</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{done.order_number}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total tagihan</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatCurrency(done.total_amount)}
            </dd>
          </div>
        </dl>

        <p className="text-muted-foreground border-border mt-5 border-t pt-4 text-xs">
          Tautan laporan pelaksanaan akan dikirimkan setelah ibadah selesai dan dokumentasinya
          tervalidasi.
        </p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-6 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-6 lg:col-span-2">
        {/* --- Paket --- */}
        <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
          <h2 className="text-base font-semibold">Pilih Paket</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="co-service">Paket ibadah</Label>
              <Select
                id="co-service"
                value={draft.service_id}
                onChange={(e) => set('service_id', e.target.value)}
                className="mt-1.5"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {SERVICE_TYPE_LABEL[p.type] ?? p.type} · {p.name} — {formatCurrency(p.price)}
                  </option>
                ))}
              </Select>
              {selected?.description && (
                <p className="text-muted-foreground mt-1 text-xs">{selected.description}</p>
              )}
            </div>

            <div>
              <Label htmlFor="co-species">Jenis hewan</Label>
              <Select
                id="co-species"
                value={draft.species}
                onChange={(e) => set('species', e.target.value)}
                className="mt-1.5"
              >
                {speciesOptions.map((s) => (
                  <option key={s} value={s}>
                    {ANIMAL_SPECIES_LABEL[s as keyof typeof ANIMAL_SPECIES_LABEL]}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="co-qty">Jumlah ekor</Label>
              <Input
                id="co-qty"
                type="number"
                min={1}
                max={20}
                step="1"
                inputMode="numeric"
                value={draft.qty}
                onChange={(e) => set('qty', e.target.value)}
                className="mt-1.5 tabular-nums"
              />
              {fieldErrors.qty && <FieldError message={fieldErrors.qty} />}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="co-behalf">Atas nama ibadah</Label>
              <Input
                id="co-behalf"
                value={draft.on_behalf_of}
                placeholder="Nama anak yang diaqiqahi / nama pequrban"
                onChange={(e) => set('on_behalf_of', e.target.value)}
                className="mt-1.5"
              />
              {fieldErrors.on_behalf_of && <FieldError message={fieldErrors.on_behalf_of} />}
            </div>
          </div>
        </section>

        {/* --- Pemesan --- */}
        <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
          <h2 className="text-base font-semibold">Data Pemesan</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="co-name">Nama lengkap</Label>
              <Input
                id="co-name"
                value={draft.name}
                autoComplete="name"
                onChange={(e) => set('name', e.target.value)}
                className="mt-1.5"
              />
              {fieldErrors.name && <FieldError message={fieldErrors.name} />}
            </div>

            <div>
              <Label htmlFor="co-phone">Nomor WhatsApp / telepon</Label>
              <Input
                id="co-phone"
                value={draft.phone}
                inputMode="tel"
                autoComplete="tel"
                placeholder="0812xxxxxxx"
                onChange={(e) => set('phone', e.target.value)}
                className="mt-1.5"
              />
              {fieldErrors.phone && <FieldError message={fieldErrors.phone} />}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="co-email">Email (opsional)</Label>
              <Input
                id="co-email"
                type="email"
                value={draft.email}
                autoComplete="email"
                onChange={(e) => set('email', e.target.value)}
                className="mt-1.5"
              />
              {fieldErrors.email && <FieldError message={fieldErrors.email} />}
            </div>
          </div>
        </section>

        {/* --- Pengiriman --- */}
        <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
          <h2 className="text-base font-semibold">Pengiriman & Penerima</h2>

          <div className="mt-4 grid gap-3">
            <div>
              <Label htmlFor="co-branch">Wilayah layanan</Label>
              <Select
                id="co-branch"
                value={draft.branch_id}
                onChange={(e) => set('branch_id', e.target.value)}
                className="mt-1.5"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                Cabang yang akan melaksanakan dan mengantar pesanan Anda.
              </p>
            </div>

            <div>
              <Label htmlFor="co-delivery">Lokasi pengiriman</Label>
              <Textarea
                id="co-delivery"
                value={draft.delivery_address}
                placeholder="Alamat lengkap tujuan pengiriman hasil olahan"
                onChange={(e) => set('delivery_address', e.target.value)}
                className="mt-1.5"
              />
              {fieldErrors.delivery_address && (
                <FieldError message={fieldErrors.delivery_address} />
              )}
            </div>

            <div>
              <Label htmlFor="co-institution">Instansi penerima risalah (opsional)</Label>
              <Input
                id="co-institution"
                value={draft.recipient_institution}
                placeholder="Mis. Panti Asuhan Al-Amin, Masjid Nurul Iman"
                onChange={(e) => set('recipient_institution', e.target.value)}
                className="mt-1.5"
              />
              {fieldErrors.recipient_institution && (
                <FieldError message={fieldErrors.recipient_institution} />
              )}
            </div>

            <div>
              <Label htmlFor="co-notes">Catatan tambahan (opsional)</Label>
              <Textarea
                id="co-notes"
                value={draft.notes}
                placeholder="Permintaan khusus, waktu yang diharapkan, dan sebagainya"
                onChange={(e) => set('notes', e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </section>
      </div>

      {/* --- Ringkasan --- */}
      <aside className="lg:col-span-1">
        <div className="border-border bg-card sticky top-6 rounded-2xl border p-5 shadow-sm">
          <h2 className="text-base font-semibold">Ringkasan Biaya</h2>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground min-w-0">
                {selected ? selected.name : 'Paket belum dipilih'}
              </dt>
              <dd className="shrink-0 tabular-nums">
                {selected ? formatCurrency(selected.price) : '-'}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Jumlah</dt>
              <dd className="tabular-nums">{qtyNumber} ekor</dd>
            </div>

            <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
              <dt className="font-medium">Total</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatCurrency(total)}</dd>
            </div>
          </dl>

          <div className="border-border mt-4 border-t pt-4">
            <Label htmlFor="co-referral" className="flex items-center gap-1.5">
              <Tag className="size-3.5" />
              Kode referral (opsional)
            </Label>
            <Input
              id="co-referral"
              value={draft.referral_code}
              placeholder="Mis. SA-BUDI"
              onChange={(e) => set('referral_code', e.target.value)}
              className="mt-1.5 uppercase"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Kode akan tercatat pada pesanan. Potongan atau komisinya dihitung terpisah oleh tim
              kami.
            </p>
            {fieldErrors.referral_code && <FieldError message={fieldErrors.referral_code} />}
          </div>

          {error && (
            <p className="border-destructive/20 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending || !selected} className="mt-4 w-full">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? 'Mengirim pesanan…' : 'Kirim Pesanan'}
          </Button>

          <p className="text-muted-foreground mt-3 text-center text-xs">
            Pembayaran dikonfirmasi setelah tim kami menghubungi Anda. Tidak ada pembayaran di
            halaman ini.
          </p>
        </div>
      </aside>
    </form>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="text-destructive mt-1 text-xs">{message}</p>;
}
