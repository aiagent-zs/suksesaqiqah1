'use client';

import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useRegionCascade } from '@/features/checkout/use-region-cascade';
import type { RegionOption } from '@/features/checkout/queries';

export type VendorAddressValue = {
  province_code: string;
  city_code: string;
  district_code: string;
  village_code: string;
};

export const EMPTY_VENDOR_ADDRESS: VendorAddressValue = {
  province_code: '',
  city_code: '',
  district_code: '',
  village_code: '',
};

type Level = 'city' | 'district' | 'village';

const LEVEL_LABEL: Record<Level, string> = {
  city: 'Kabupaten/Kota',
  district: 'Kecamatan',
  village: 'Kelurahan/Desa',
};

const PARENT_OF: Record<Level, keyof VendorAddressValue> = {
  city: 'province_code',
  district: 'city_code',
  village: 'district_code',
};

const PARENT_LABEL: Record<Level, string> = {
  city: 'Provinsi',
  district: 'Kabupaten/Kota',
  village: 'Kecamatan',
};

/**
 * Pemilih wilayah alamat mitra.
 *
 * Bedanya dari `AddressPicker` milik checkout bukan cuma tampilan: **seluruh
 * tingkatnya opsional**. Alamat pemesan wajib lengkap karena ada yang harus
 * diantar ke sana; alamat mitra adalah master data yang boleh diisi bertahap —
 * mendaftarkan mitra baru dengan nomor telepon saja lalu melengkapi belakangan
 * adalah alur yang wajar.
 *
 * Hanya kodenya yang dikirim. Namanya dibaca server dari `regions` lewat
 * `resolveAddress()`, sebab nama yang dipercaya dari klien bisa tidak cocok
 * dengan kodenya.
 */
export function VendorAddressFields({
  provinces,
  value,
  onChange,
  disabled = false,
}: {
  provinces: RegionOption[];
  value: VendorAddressValue;
  onChange: (next: VendorAddressValue) => void;
  disabled?: boolean;
}) {
  const cascade = useRegionCascade([value.province_code, value.city_code, value.district_code]);

  const failedLevel =
    (['city', 'district', 'village'] as const).find((l) =>
      cascade.hasFailed(value[PARENT_OF[l]]),
    ) ?? null;

  /**
   * Memilih satu tingkat selalu mengosongkan tingkat di bawahnya — kalau tidak,
   * mengganti provinsi menyisakan kelurahan dari provinsi lama, kombinasi yang
   * tidak sejalur dan baru ketahuan salah saat alamatnya dirakit.
   */
  function pick(level: 'province' | Level, code: string) {
    if (level === 'province') {
      onChange({ province_code: code, city_code: '', district_code: '', village_code: '' });
    } else if (level === 'city') {
      onChange({ ...value, city_code: code, district_code: '', village_code: '' });
    } else if (level === 'district') {
      onChange({ ...value, district_code: code, village_code: '' });
    } else {
      onChange({ ...value, village_code: code });
    }
  }

  return (
    <>
      <div className="sm:col-span-2">
        <p className="text-sm font-medium">Wilayah</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Opsional, tapi mengisinya membuat alamat mitra terbaca lengkap di layar penugasan. Pilih
          berurutan dari provinsi.
        </p>
      </div>

      <RegionField
        id="v-prov"
        label="Provinsi"
        value={value.province_code}
        options={provinces}
        disabled={disabled}
        onPick={(code) => pick('province', code)}
      />

      {(['city', 'district', 'village'] as const).map((level) => {
        const { parent, options, loading } = cascade.stateOf(value[PARENT_OF[level]]);
        return (
          <RegionField
            key={level}
            id={`v-${level}`}
            label={LEVEL_LABEL[level]}
            value={value[`${level}_code`]}
            options={options}
            loading={loading}
            // Dimatikan selama induknya belum dipilih: daftar kosong yang bisa
            // dibuka membuat orang mengira datanya yang hilang.
            disabled={disabled || !parent}
            placeholder={parent ? undefined : `Pilih ${PARENT_LABEL[level].toLowerCase()} dulu`}
            onPick={(code) => pick(level, code)}
          />
        );
      })}

      {failedLevel && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
          Daftar {LEVEL_LABEL[failedLevel].toLowerCase()} gagal dimuat. Periksa koneksi Anda.
          <button
            type="button"
            onClick={() => cascade.retry(value[PARENT_OF[failedLevel]])}
            className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900"
          >
            Coba lagi
          </button>
        </p>
      )}
    </>
  );
}

function RegionField({
  id,
  label,
  value,
  options,
  onPick,
  loading = false,
  disabled = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  options: RegionOption[];
  onPick: (code: string) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        <Select
          id={id}
          value={value}
          disabled={disabled || loading}
          onChange={(e) => onPick(e.target.value)}
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
          <Loader2 className="text-muted-foreground pointer-events-none absolute top-1/2 right-8 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>
    </div>
  );
}
