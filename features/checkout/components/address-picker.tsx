'use client';

import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRegionCascade } from '../use-region-cascade';
import type { RegionOption } from '../queries';

/**
 * Bagian alamat yang dipegang form. Kode **dan** nama: kodenya yang dikirim ke
 * server, namanya hanya untuk ditampilkan di tahap ringkasan.
 *
 * Nama tidak pernah ikut ke RPC — `create_guest_order` membacanya sendiri dari
 * `regions` berdasarkan kodenya, karena nama yang dikirim klien bisa tidak
 * cocok dengan kodenya dan yang dibaca kurir adalah namanya.
 */
export type DeliveryAddressValue = {
  province_code: string;
  province_name: string;
  city_code: string;
  city_name: string;
  district_code: string;
  district_name: string;
  village_code: string;
  village_name: string;
  postal_code: string;
  detail: string;
};

export const EMPTY_DELIVERY_ADDRESS: DeliveryAddressValue = {
  province_code: '',
  province_name: '',
  city_code: '',
  city_name: '',
  district_code: '',
  district_name: '',
  village_code: '',
  village_name: '',
  postal_code: '',
  detail: '',
};

/** Tingkat yang isinya diambil dari peramban — provinsi sudah datang dari server. */
type Level = 'city' | 'district' | 'village';

const LEVEL_LABEL: Record<Level, string> = {
  city: 'Kabupaten/Kota',
  district: 'Kecamatan',
  village: 'Kelurahan/Desa',
};

/** Induk yang isinya harus dibaca untuk mengisi tiap tingkat. */
const PARENT_OF: Record<Level, keyof DeliveryAddressValue> = {
  city: 'province_code',
  district: 'city_code',
  village: 'district_code',
};

/** Label tingkat induk, dipakai pada teks "pilih X dulu". */
const PARENT_LABEL: Record<Level, string> = {
  city: 'Provinsi',
  district: 'Kabupaten/Kota',
  village: 'Kecamatan',
};

/**
 * Id elemen per tingkat — dipakai `<label htmlFor>` dan `FIELD_ANCHOR` di
 * `checkout-form`, yang melompatkan layar ke medan yang ditolak server.
 */
const FIELD_ID: Record<Level, string> = {
  city: 'co-city',
  district: 'co-dist',
  village: 'co-vill',
};

export function AddressPicker({
  provinces,
  value,
  onChange,
  errors,
}: {
  provinces: RegionOption[];
  value: DeliveryAddressValue;
  onChange: (next: DeliveryAddressValue) => void;
  errors: Record<string, string>;
}) {
  const { province_code, city_code, district_code } = value;

  // Pemuatan bertingkat & penanganan balapannya di `use-region-cascade`, dipakai
  // bersama pemilih alamat mitra.
  const cascade = useRegionCascade([province_code, city_code, district_code]);

  function stateOf(level: Level) {
    return cascade.stateOf(value[PARENT_OF[level]]);
  }

  /** Tingkat yang daftarnya gagal dimuat — untuk pesan & tombol coba lagi. */
  const failedLevel =
    (['city', 'district', 'village'] as const).find((l) =>
      cascade.hasFailed(value[PARENT_OF[l]]),
    ) ?? null;

  function retry() {
    if (!failedLevel) return;
    cascade.retry(value[PARENT_OF[failedLevel]]);
  }

  /**
   * Memilih satu tingkat selalu mengosongkan tingkat di bawahnya.
   *
   * Kalau tidak, mengganti provinsi akan menyisakan kelurahan dari provinsi
   * lama — kombinasi yang tidak sejalur, yang baru ditolak saat dikirim.
   */
  function pick(level: 'province' | Level, code: string, name: string) {
    const next = { ...value };
    if (level === 'province') {
      Object.assign(next, {
        province_code: code,
        province_name: name,
        city_code: '',
        city_name: '',
        district_code: '',
        district_name: '',
        village_code: '',
        village_name: '',
      });
    } else if (level === 'city') {
      Object.assign(next, {
        city_code: code,
        city_name: name,
        district_code: '',
        district_name: '',
        village_code: '',
        village_name: '',
      });
    } else if (level === 'district') {
      Object.assign(next, {
        district_code: code,
        district_name: name,
        village_code: '',
        village_name: '',
      });
    } else {
      Object.assign(next, { village_code: code, village_name: name });
    }
    onChange(next);
  }

  return (
    <div className="animate-in fade-in space-y-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 duration-300 sm:p-5">
      <div>
        <p className="text-base font-bold text-neutral-900">Alamat Pengiriman</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Ke mana hasil olahan diantar. Pilih berurutan dari provinsi.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <RegionField
          id="co-prov"
          label="Provinsi"
          value={value.province_code}
          options={provinces}
          error={errors.delivery_province_code}
          onPick={(code, name) => pick('province', code, name)}
        />

        {(['city', 'district', 'village'] as const).map((level) => {
          const { parent, options, loading } = stateOf(level);
          return (
            <RegionField
              key={level}
              id={FIELD_ID[level]}
              label={LEVEL_LABEL[level]}
              value={value[`${level}_code`]}
              options={options}
              loading={loading}
              // Dimatikan selama induknya belum dipilih: daftar yang kosong tapi
              // bisa dibuka membuat pemesan mengira datanya yang hilang.
              disabled={!parent}
              placeholder={parent ? undefined : `Pilih ${PARENT_LABEL[level].toLowerCase()} dulu`}
              error={errors[`delivery_${level}_code`]}
              onPick={(code, name) => pick(level, code, name)}
            />
          );
        })}
      </div>

      {failedLevel && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Daftar {LEVEL_LABEL[failedLevel].toLowerCase()} gagal dimuat. Periksa koneksi Anda.
          <button
            type="button"
            onClick={retry}
            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900"
          >
            Coba lagi
          </button>
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="co-postal" className="text-sm font-semibold text-neutral-800">
            Kode Pos <span className="text-red-500">*</span>
          </Label>
          <Input
            id="co-postal"
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
            placeholder="40125"
            value={value.postal_code}
            aria-invalid={Boolean(errors.delivery_postal_code)}
            // Disaring saat diketik, bukan hanya ditolak saat kirim: kolomnya
            // memang hanya menerima angka, jadi huruf tidak perlu bisa masuk.
            onChange={(e) =>
              onChange({ ...value, postal_code: e.target.value.replace(/\D/g, '').slice(0, 5) })
            }
            className="mt-2 h-12 max-w-40 rounded-xl border-neutral-200 bg-white text-sm tabular-nums shadow-sm"
          />
          {errors.delivery_postal_code && <FieldError message={errors.delivery_postal_code} />}
        </div>
      </div>

      <div>
        <Label htmlFor="co-detail" className="text-sm font-semibold text-neutral-800">
          Nama Jalan, Nomor Rumah, RT/RW <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="co-detail"
          value={value.detail}
          aria-invalid={Boolean(errors.delivery_detail)}
          placeholder="Jl. Cikutra Barat No. 12, RT 003/RW 007, sebelah Masjid Al-Ikhlas"
          onChange={(e) => onChange({ ...value, detail: e.target.value })}
          className="mt-2 rounded-xl border-neutral-200 bg-white text-sm shadow-sm"
        />
        <p className="mt-1.5 text-xs text-neutral-500">
          Sertakan patokan yang mudah dikenali — ini yang dipakai kurir mencari lokasi.
        </p>
        {errors.delivery_detail && <FieldError message={errors.delivery_detail} />}
      </div>
    </div>
  );
}

function RegionField({
  id,
  label,
  value,
  options,
  onPick,
  error,
  loading = false,
  disabled = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  options: RegionOption[];
  onPick: (code: string, name: string) => void;
  error?: string;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold text-neutral-800">
        {label} <span className="text-red-500">*</span>
      </Label>
      <div className="relative mt-2">
        <Select
          id={id}
          value={value}
          disabled={disabled || loading}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            const code = e.target.value;
            onPick(code, options.find((o) => o.code === code)?.name ?? '');
          }}
          className="h-12 rounded-xl border-neutral-200 bg-white pl-3 text-sm shadow-sm"
        >
          <option value="">
            {loading ? 'Memuat…' : (placeholder ?? `Pilih ${label.toLowerCase()}`)}
          </option>
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </Select>
        {loading && (
          <Loader2 className="pointer-events-none absolute top-1/2 right-8 size-4 -translate-y-1/2 animate-spin text-neutral-400" />
        )}
      </div>
      {error && <FieldError message={error} />}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}
