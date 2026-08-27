'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, MapPin, Phone, Plus, UserX } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DISTRIBUTION_MODE_LABEL } from '@/features/stages/sequence';
import { createVendor } from '@/server/actions/vendors';
import type { VendorRow } from '../queries';

const EMPTY = {
  code: '',
  name: '',
  owner_name: '',
  phone: '',
  whatsapp: '',
  email: '',
  address_detail: '',
  postal_code: '',
  agreement_number: '',
  daily_capacity: '',
  bank_name: '',
  bank_account_no: '',
  bank_account_name: '',
  notes: '',
};

/**
 * Master mitra pelaksana.
 *
 * Kolom "Akun" sengaja ikut di sini, bukan hanya di halaman Pengguna: mitra
 * yang terdaftar tapi belum punya akun tidak akan pernah bisa melapor, dan itu
 * paling gampang terlewat kalau kedua daftarnya terpisah.
 */
export function VendorManager({ vendors }: { vendors: VendorRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [modes, setModes] = useState<Array<'salur' | 'kirim'>>(['salur', 'kirim']);
  const [draft, setDraft] = useState(EMPTY);

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error?.message ?? 'Terjadi kesalahan.');
        return;
      }
      done?.();
      router.refresh();
    });
  }

  function toggleMode(mode: 'salur' | 'kirim') {
    setModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Mitra Pelaksana</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Data kerja sama, kontak, dan cara penyaluran yang dilayani
          </p>
        </div>
        <Button type="button" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" />
          Daftarkan mitra
        </Button>
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {showForm && (
        <div className="border-border bg-card grid gap-3 rounded-lg border p-4 shadow-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="v-code">Kode mitra</Label>
            <Input
              id="v-code"
              value={draft.code}
              placeholder="Mis. MITRA1"
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="v-name">Nama usaha</Label>
            <Input
              id="v-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="v-owner">Penanggung jawab</Label>
            <Input
              id="v-owner"
              value={draft.owner_name}
              onChange={(e) => setDraft({ ...draft, owner_name: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="v-phone">Nomor telepon</Label>
            <Input
              id="v-phone"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="v-wa">WhatsApp (opsional)</Label>
            <Input
              id="v-wa"
              value={draft.whatsapp}
              onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="v-email">Email (opsional)</Label>
            <Input
              id="v-email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="v-addr">Alamat</Label>
            <Textarea
              id="v-addr"
              rows={2}
              value={draft.address_detail}
              placeholder="Nama jalan, nomor, patokan"
              onChange={(e) => setDraft({ ...draft, address_detail: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="v-postal">Kode pos (opsional)</Label>
            <Input
              id="v-postal"
              value={draft.postal_code}
              onChange={(e) => setDraft({ ...draft, postal_code: e.target.value })}
              className="mt-1.5 max-w-40"
            />
          </div>

          <div>
            <Label htmlFor="v-capacity">Kapasitas per hari (ekor)</Label>
            <Input
              id="v-capacity"
              type="number"
              value={draft.daily_capacity}
              onChange={(e) => setDraft({ ...draft, daily_capacity: e.target.value })}
              className="mt-1.5 max-w-40"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Cara penyaluran yang dilayani</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {(['salur', 'kirim'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={modes.includes(mode)}
                    onChange={() => toggleMode(mode)}
                    className="border-border accent-primary size-4 rounded"
                  />
                  {DISTRIBUTION_MODE_LABEL[mode]}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Mitra tanpa &ldquo;Aqiqah Kirim&rdquo; tidak akan ditawarkan untuk order yang harus
              diantar — tahap pengiriman akan terbit dan tidak pernah bisa ia penuhi.
            </p>
          </div>

          <div>
            <Label htmlFor="v-bank">Nama bank (opsional)</Label>
            <Input
              id="v-bank"
              value={draft.bank_name}
              onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="v-rek">Nomor rekening (opsional)</Label>
            <Input
              id="v-rek"
              value={draft.bank_account_no}
              onChange={(e) => setDraft({ ...draft, bank_account_no: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={pending || !draft.code || !draft.name || !draft.phone || modes.length === 0}
              onClick={() =>
                run(
                  async () => {
                    const result = await createVendor({
                      ...draft,
                      daily_capacity: draft.daily_capacity
                        ? Number(draft.daily_capacity)
                        : undefined,
                      service_modes: modes,
                    });
                    if (result.ok) {
                      setShowForm(false);
                      setDraft(EMPTY);
                      setModes(['salur', 'kirim']);
                    }
                    return result;
                  },
                )
              }
            >
              Simpan mitra
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setShowForm(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      <ul className="border-border bg-card divide-border divide-y rounded-lg border shadow-sm">
        {vendors.map((v) => (
          <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/vendors/${v.id}`} className="font-medium hover:underline">
                  {v.name}
                </Link>
                <span className="text-muted-foreground text-xs tabular-nums">{v.code}</span>
                {!v.isActive && (
                  <Badge className="border-slate-200 bg-slate-100 text-slate-600">Non-aktif</Badge>
                )}
                {v.serviceModes.map((m) => (
                  <Badge key={m} className="border-slate-200 bg-slate-50 text-slate-600">
                    {DISTRIBUTION_MODE_LABEL[m]}
                  </Badge>
                ))}
              </div>

              <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                <Phone className="size-3" />
                {v.phone}
                {v.ownerName ? ` · ${v.ownerName}` : ''}
              </p>

              {v.address && (
                <p className="text-muted-foreground mt-0.5 flex items-start gap-1.5 text-xs">
                  <MapPin className="mt-0.5 size-3 shrink-0" />
                  {v.address}
                </p>
              )}

              {/* Mitra tanpa akun tidak akan pernah bisa melapor — ditandai di
                  sini supaya tidak perlu membandingkan dua halaman. */}
              {v.accountEmail ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Akun: {v.accountEmail}
                  {v.accountActive === false ? ' (non-aktif)' : ''}
                </p>
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                  <UserX className="size-3" />
                  Belum punya akun login — buatkan di menu Pengguna.
                </p>
              )}

              {v.ordersOpen > 0 && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {v.ordersOpen} order berjalan
                </p>
              )}
            </div>

            {/* Aktif/non-aktif pindah ke halaman detail: di sana jumlah order
                berjalan sudah terbaca, jadi tombolnya bisa menjelaskan diri
                sebelum ditekan alih-alih menolak sesudahnya. */}
            <Link
              href={`/vendors/${v.id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Kelola
            </Link>
          </li>
        ))}

        {vendors.length === 0 && (
          <li className="text-muted-foreground px-5 py-10 text-center text-sm">
            Belum ada mitra terdaftar.
          </li>
        )}
      </ul>
    </div>
  );
}
