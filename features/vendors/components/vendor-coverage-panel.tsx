'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useRegionCascade } from '@/features/checkout/use-region-cascade';
import { saveVendorCoverage } from '@/server/actions/vendors';
import type { RegionOption } from '@/features/checkout/queries';
import type { CoverageRow } from '../queries';

const LEVEL_LABEL: Record<number, string> = {
  1: 'Provinsi',
  2: 'Kabupaten/Kota',
  3: 'Kecamatan',
  4: 'Kelurahan',
};

/**
 * Wilayah layanan mitra (`vendor_coverage`).
 *
 * Tabelnya lahir bersama desain ulang 20 Agustus dan sejak itu **nol referensi**
 * di seluruh `server/`, `features/`, dan `app/` — tidak ada satu pun jalan
 * mengisinya, jadi ia kosong selamanya. Padahal gunanya jelas dan sudah tertulis
 * di migration-nya: mencocokkan order "kirim" dengan mitra yang sanggup
 * mengantar ke sana.
 *
 * Tingkat kabupaten/kota adalah yang lazim dipakai, jadi itu yang ditawarkan
 * lebih dulu — provinsi terlalu luas untuk berarti, kelurahan terlalu sempit
 * untuk dirawat.
 */
export function VendorCoveragePanel({
  vendorId,
  rows,
  provinces,
}: {
  vendorId: string;
  rows: CoverageRow[];
  provinces: RegionOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /** Keadaan yang sedang disunting; disimpan sebagai kode + nama untuk dirender. */
  const [picked, setPicked] = useState<Array<{ code: string; name: string; level: number }>>(
    rows.map((r) => ({ code: r.regionCode, name: r.regionName, level: r.level })),
  );
  const [provinceCode, setProvinceCode] = useState('');

  const cascade = useRegionCascade([provinceCode]);
  const { options: cities, loading } = cascade.stateOf(provinceCode);

  const dirty =
    picked.length !== rows.length ||
    picked.some((p) => !rows.some((r) => r.regionCode === p.code));

  function add(code: string) {
    const city = cities.find((c) => c.code === code);
    if (!city || picked.some((p) => p.code === code)) return;
    setPicked((prev) => [...prev, { code, name: city.name, level: 2 }]);
    setSaved(false);
  }

  function remove(code: string) {
    setPicked((prev) => prev.filter((p) => p.code !== code));
    setSaved(false);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveVendorCoverage({
        vendor_id: vendorId,
        region_codes: picked.map((p) => p.code),
      });

      if (!result.ok) {
        setError(result.error.message);
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
          <h2 className="text-base font-semibold">Wilayah layanan</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Ke mana mitra ini sanggup mengantar. Dipakai mencocokkan order Aqiqah Kirim.
          </p>
        </div>
        {saved && !pending && !dirty && (
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

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="cov-prov">Provinsi</Label>
          <Select
            id="cov-prov"
            value={provinceCode}
            disabled={pending}
            onChange={(e) => setProvinceCode(e.target.value)}
            className="mt-1.5"
          >
            <option value="">Pilih provinsi</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="cov-city">Kabupaten/Kota</Label>
          <Select
            id="cov-city"
            value=""
            disabled={pending || !provinceCode || loading}
            onChange={(e) => add(e.target.value)}
            className="mt-1.5"
          >
            <option value="">
              {loading
                ? 'Memuat…'
                : provinceCode
                  ? 'Pilih untuk menambahkan'
                  : 'Pilih provinsi dulu'}
            </option>
            {cities
              .filter((c) => !picked.some((p) => p.code === c.code))
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
          </Select>
        </div>

        {cascade.hasFailed(provinceCode) && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
            Daftar kabupaten/kota gagal dimuat. Periksa koneksi Anda.
            <button
              type="button"
              onClick={() => cascade.retry(provinceCode)}
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900"
            >
              Coba lagi
            </button>
          </p>
        )}

        <div className="sm:col-span-2">
          {picked.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
              Belum ada wilayah. Selama kosong, tidak ada penyaringan otomatis — mitra ini tetap
              bisa ditugaskan ke order kirim mana pun.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {picked.map((p) => (
                <li
                  key={p.code}
                  className="border-border bg-muted/40 flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-3 text-sm"
                >
                  <span>{p.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {LEVEL_LABEL[p.level] ?? '-'}
                  </span>
                  <button
                    type="button"
                    aria-label={`Hapus ${p.name}`}
                    disabled={pending}
                    onClick={() => remove(p.code)}
                    className="hover:bg-background rounded-full p-1"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sm:col-span-2">
          <Button type="button" disabled={pending || !dirty} onClick={submit}>
            <Plus className="size-4" />
            {pending ? 'Menyimpan…' : 'Simpan wilayah'}
          </Button>
        </div>
      </div>
    </section>
  );
}
