'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DISTRIBUTION_MODE_LABEL } from '@/features/stages/sequence';
import { updateVendor } from '@/server/actions/vendors';
import type { RegionOption } from '@/features/checkout/queries';
import type { VendorDetail } from '../queries';
import { VendorAddressFields, type VendorAddressValue } from './vendor-address-fields';

type Mode = 'salur' | 'kirim';

/**
 * Sunting data mitra.
 *
 * Sampai halaman ini ada, `updateVendor()` sudah ditulis lengkap tapi **tidak
 * punya satu pun pemanggil**: mitra yang salah ketik nomor teleponnya hanya bisa
 * dibetulkan lewat dashboard Supabase. Formulir pendaftaran di `/vendors` juga
 * hanya merender 13 dari 22 medan yang diterima skema — delapan sisanya (nama
 * badan hukum, NPWP, periode perjanjian, nama pemilik rekening, dan empat kode
 * wilayah) tidak pernah bisa diisi dari mana pun.
 *
 * `code` sengaja ditampilkan tapi tidak dapat disunting — lihat
 * `updateVendorSchema`.
 */
export function VendorEditForm({
  vendor,
  provinces,
}: {
  vendor: VendorDetail;
  provinces: RegionOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const [modes, setModes] = useState<Mode[]>(vendor.serviceModes as Mode[]);
  const [address, setAddress] = useState<VendorAddressValue>({
    province_code: vendor.provinceCode ?? '',
    city_code: vendor.cityCode ?? '',
    district_code: vendor.districtCode ?? '',
    village_code: vendor.villageCode ?? '',
  });
  const [draft, setDraft] = useState({
    name: vendor.name,
    legal_name: vendor.legalName ?? '',
    owner_name: vendor.ownerName ?? '',
    npwp: vendor.npwp ?? '',
    phone: vendor.phone,
    whatsapp: vendor.whatsapp ?? '',
    email: vendor.email ?? '',
    postal_code: vendor.postalCode ?? '',
    address_detail: vendor.addressDetail ?? '',
    agreement_number: vendor.agreementNumber ?? '',
    agreement_start: vendor.agreementStart ?? '',
    agreement_end: vendor.agreementEnd ?? '',
    daily_capacity: vendor.dailyCapacity ? String(vendor.dailyCapacity) : '',
    bank_name: vendor.bankName ?? '',
    bank_account_no: vendor.bankAccountNo ?? '',
    bank_account_name: vendor.bankAccountName ?? '',
    notes: vendor.notes ?? '',
  });

  function set(key: keyof typeof draft, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toggleMode(mode: Mode) {
    setModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]));
    setSaved(false);
  }

  function submit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateVendor({
        id: vendor.id,
        ...draft,
        ...address,
        daily_capacity: draft.daily_capacity ? Number(draft.daily_capacity) : undefined,
        service_modes: modes,
      });

      if (!result.ok) {
        setError(result.error.message);
        setFieldErrors(result.error.fields ?? {});
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="border-border bg-card rounded-lg border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Data mitra</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Kode <span className="tabular-nums">{vendor.code}</span> tidak dapat diubah
          </p>
        </div>
        {saved && !pending && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-700">
            <Check className="size-4" />
            Tersimpan
          </span>
        )}
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive mx-5 mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field
          id="v-name"
          label="Nama usaha"
          value={draft.name}
          error={fieldErrors.name}
          onChange={(v) => set('name', v)}
        />
        <Field
          id="v-legal"
          label="Nama badan hukum"
          hint="Opsional — dipakai pada dokumen perjanjian"
          value={draft.legal_name}
          error={fieldErrors.legal_name}
          onChange={(v) => set('legal_name', v)}
        />
        <Field
          id="v-owner"
          label="Penanggung jawab"
          value={draft.owner_name}
          error={fieldErrors.owner_name}
          onChange={(v) => set('owner_name', v)}
        />
        <Field
          id="v-npwp"
          label="NPWP"
          value={draft.npwp}
          error={fieldErrors.npwp}
          onChange={(v) => set('npwp', v)}
        />

        <Field
          id="v-phone"
          label="Nomor telepon"
          value={draft.phone}
          error={fieldErrors.phone}
          onChange={(v) => set('phone', v)}
        />
        <Field
          id="v-wa"
          label="WhatsApp"
          value={draft.whatsapp}
          error={fieldErrors.whatsapp}
          onChange={(v) => set('whatsapp', v)}
        />
        <Field
          id="v-email"
          label="Email"
          type="email"
          value={draft.email}
          error={fieldErrors.email}
          onChange={(v) => set('email', v)}
        />
        <Field
          id="v-capacity"
          label="Kapasitas per hari (ekor)"
          type="number"
          value={draft.daily_capacity}
          error={fieldErrors.daily_capacity}
          onChange={(v) => set('daily_capacity', v)}
        />

        <div className="border-border mt-2 border-t pt-4 sm:col-span-2" />

        <VendorAddressFields
          provinces={provinces}
          value={address}
          disabled={pending}
          onChange={(next) => {
            setAddress(next);
            setSaved(false);
          }}
        />

        <div className="sm:col-span-2">
          <Label htmlFor="v-addr">Alamat jalan</Label>
          <Textarea
            id="v-addr"
            rows={2}
            value={draft.address_detail}
            placeholder="Nama jalan, nomor, patokan"
            onChange={(e) => set('address_detail', e.target.value)}
            className="mt-1.5"
          />
        </div>

        <Field
          id="v-postal"
          label="Kode pos"
          value={draft.postal_code}
          error={fieldErrors.postal_code}
          onChange={(v) => set('postal_code', v.replace(/\D/g, '').slice(0, 5))}
        />

        <div className="border-border mt-2 border-t pt-4 sm:col-span-2" />

        <Field
          id="v-agr"
          label="Nomor perjanjian"
          value={draft.agreement_number}
          error={fieldErrors.agreement_number}
          onChange={(v) => set('agreement_number', v)}
        />
        <div />
        <Field
          id="v-agr-start"
          label="Perjanjian mulai"
          type="date"
          value={draft.agreement_start}
          error={fieldErrors.agreement_start}
          onChange={(v) => set('agreement_start', v)}
        />
        <Field
          id="v-agr-end"
          label="Perjanjian berakhir"
          type="date"
          value={draft.agreement_end}
          error={fieldErrors.agreement_end}
          onChange={(v) => set('agreement_end', v)}
        />

        <div className="sm:col-span-2">
          <Label>Cara penyaluran yang dilayani</Label>
          <div className="mt-2 flex flex-wrap gap-4">
            {(['salur', 'kirim'] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={modes.includes(mode)}
                  disabled={pending}
                  onChange={() => toggleMode(mode)}
                  className="border-border accent-primary size-4 rounded"
                />
                {DISTRIBUTION_MODE_LABEL[mode]}
              </label>
            ))}
          </div>
          {/* Mode yang dicabut punya akibat langsung: `assignVendor` menolak
              mitra yang tidak melayani mode order. */}
          <p className="text-muted-foreground mt-1 text-xs">
            Mencabut sebuah mode membuat mitra ini tidak lagi bisa ditugaskan ke order dengan cara
            penyaluran tersebut.
          </p>
          {fieldErrors.service_modes && (
            <p className="text-destructive mt-1 text-xs">{fieldErrors.service_modes}</p>
          )}
        </div>

        <div className="border-border mt-2 border-t pt-4 sm:col-span-2" />

        <Field
          id="v-bank"
          label="Nama bank"
          value={draft.bank_name}
          error={fieldErrors.bank_name}
          onChange={(v) => set('bank_name', v)}
        />
        <Field
          id="v-rek"
          label="Nomor rekening"
          value={draft.bank_account_no}
          error={fieldErrors.bank_account_no}
          onChange={(v) => set('bank_account_no', v)}
        />
        <Field
          id="v-rek-name"
          label="Nama pemilik rekening"
          value={draft.bank_account_name}
          error={fieldErrors.bank_account_name}
          onChange={(v) => set('bank_account_name', v)}
        />
        <div />

        <div className="sm:col-span-2">
          <Label htmlFor="v-notes">Catatan</Label>
          <Textarea
            id="v-notes"
            rows={2}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div className="sm:col-span-2">
          <Button
            type="button"
            disabled={pending || !draft.name.trim() || !draft.phone.trim() || modes.length === 0}
            onClick={submit}
          >
            {pending ? 'Menyimpan…' : 'Simpan perubahan'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5"
      />
      {hint && !error && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  );
}
