'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { deleteVendorService, saveVendorService } from '@/server/actions/vendors';
import type { VendorServiceRow } from '../queries';

type ServiceOption = {
  id: string;
  name: string;
  type: string;
  price: number;
  description: string | null;
  details: string[];
};

/**
 * Daftar modal per paket untuk satu mitra.
 *
 * Panel inilah yang membuat KPI margin punya masukan. `v_vendor_kpi.margin_total`
 * dihitung dari `order_items.vendor_unit_price`, yang jatuhnya dari tabel ini —
 * dan sampai layar ini ada, tabelnya **tidak pernah bisa diisi dari aplikasi**.
 * Akibatnya modal terbaca nol dan dashboard melaporkan margin sebesar seluruh
 * nilai order.
 *
 * Angka di sini internal: pembeli tetap melihat `services.price`. Itu sebabnya
 * kewenangannya berhenti di superadmin — siapa pun yang bisa menurunkannya bisa
 * membuat order tampak untung padahal rugi.
 *
 * ## Apa yang di sini, apa yang di katalog
 *
 * Pembaginya satu pertanyaan: **berbeda tiap mitra atau tidak?**
 *
 *   di sini   modal · minimum · kapasitas · jeda persiapan · catatan
 *   katalog   nama · harga jual · deskripsi · porsi · ragam olahan
 *
 * "Aqiqah Ekonomi, 80 porsi, gulai & sate" adalah paket yang sama entah
 * dikerjakan mitra mana — itu **janji kepada pembeli** di halaman depan. Kalau
 * tiap mitra bisa mengubahnya, pembeli membaca satu janji lalu ordernya
 * ditugaskan ke mitra yang menjanjikan hal lain, dan tidak ada yang bisa
 * menentukan mana yang benar.
 *
 * Sebaliknya "maksimal 100 box" memang milik mitra: satu sanggup 100, yang lain
 * 300. Empat kolomnya (`min_qty`, `max_qty`, `lead_time_hours`, `notes`) sudah
 * ada di database sejak 20 Agustus dan **nol dipakai** sampai 3 September —
 * pola yang sama dengan `vendor_coverage` sebelum 27 Agustus.
 *
 * Deskripsi paket tetap dirender di sini (lewat join, bukan salinan) sebab
 * modal yang wajar untuk 80 porsi tidak wajar untuk 150. Nama paketnya
 * bertaut ke katalog supaya jelas ke mana harus pergi untuk mengubahnya.
 */
export function VendorServicePanel({
  vendorId,
  rows,
  options,
}: {
  vendorId: string;
  rows: VendorServiceRow[];
  options: ServiceOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [price, setPrice] = useState('');
  /** Batas penawaran mitra untuk paket yang sedang ditambahkan. */
  const [offer, setOffer] = useState({ min_qty: '', max_qty: '', lead_time_hours: '', notes: '' });
  /** Baris yang sedang disunting, beserta modal barunya. */
  const { toast, show, dismiss } = useToast();
  const [editing, setEditing] = useState<{
    id: string;
    price: string;
    min_qty: string;
    max_qty: string;
    lead_time_hours: string;
    notes: string;
  } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        const message = result.error?.message ?? 'Terjadi kesalahan.';
        setError(message);
        show('error', message);
        return;
      }
      // `run` dipakai tambah, sunting, dan hapus. Pesannya sengaja umum: yang
      // perlu diketahui operator adalah **tersimpan atau tidak**, dan menebak
      // aksi mana dari dalam helper ini akan menghasilkan pesan yang kadang
      // keliru.
      show('success', 'Perubahan tersimpan.');
      done?.();
      router.refresh();
    });
  }

  /**
   * Satuan pesanan mengikuti jenis paketnya.
   *
   * Aqiqah dipesan per **ekor**, nasi box per **box** — dan keduanya memang
   * pesanan yang terpisah: nasi box adalah paket tersendiri dengan harga
   * sendiri, bukan turunan dari paket aqiqah. Label yang memakai satu satuan
   * untuk keduanya (seperti "maks 100 box" pada paket aqiqah) menyesatkan
   * justru karena terbaca masuk akal.
   */
  const unitOf = (type: string) => (type === 'nasi_box' ? 'box' : 'ekor');

  /**
   * Angka opsional dari medan teks.
   *
   * Kosong jadi `undefined`, bukan 0: `max_qty` kosong berarti **tanpa batas**,
   * dan 0 akan tersimpan sebagai "maksimal 0 box" yang menolak setiap order.
   */
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  // Paket yang modalnya sudah tercatat tidak ditawarkan lagi: upsert-nya memang
  // akan menimpa, tapi menawarkannya sebagai "tambah" menyesatkan — suntingan
  // tempatnya di baris yang sudah ada.
  const taken = new Set(rows.map((r) => r.serviceId));
  const available = options.filter((o) => !taken.has(o.id));

  const selected = options.find((o) => o.id === serviceId) ?? null;
  const previewMargin = selected && price ? selected.price - Number(price) : null;

  return (
    <section className="border-border bg-card rounded-lg border shadow-sm">
      <Toast state={toast} onDismiss={dismiss} />

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Penawaran mitra per paket</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Modal, kapasitas, dan kesepakatan khusus mitra ini. Selisih modal terhadap harga jual
            adalah margin order.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={available.length === 0}
          title={available.length === 0 ? 'Seluruh paket sudah punya modal' : undefined}
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="size-3.5" />
          Tambah paket
        </Button>
      </div>

      {error && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive mx-5 mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {showForm && (
        <div className="border-border bg-muted/30 grid gap-3 border-b p-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="vs-service">Paket</Label>
            <Select
              id="vs-service"
              value={serviceId}
              disabled={pending}
              onChange={(e) => setServiceId(e.target.value)}
              className="mt-1.5"
            >
              <option value="">Pilih paket</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — jual {formatCurrency(o.price)}
                </option>
              ))}
            </Select>

            {/* Isi paket ditampilkan sebelum modalnya diketik: modal yang wajar
                untuk 80 porsi tidak wajar untuk 150, dan tanpa ini angkanya
                diketik tanpa tahu apa yang dibeli. */}
            {selected && <ServiceDetails service={selected} className="mt-2" />}
          </div>

          <div>
            <Label htmlFor="vs-price">Harga modal</Label>
            <Input
              id="vs-price"
              type="number"
              inputMode="numeric"
              value={price}
              disabled={pending}
              placeholder="2325000"
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1.5"
            />
            {/* Margin dihitung di layar sebelum disimpan: modal yang keliru
                ketik satu digit paling gampang tertangkap di sini. */}
            {previewMargin !== null && (
              <p
                className={`mt-1 text-xs ${previewMargin < 0 ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                Margin {formatCurrency(previewMargin)}
                {previewMargin < 0 ? ' — modal melebihi harga jual' : ''}
              </p>
            )}
          </div>

          {/* --- Batas penawaran mitra ---------------------------------------
              Keempatnya berbeda tiap mitra — itulah sebabnya tempatnya di sini
              dan bukan di katalog. Nama paket, harga jual, porsi, dan ragam
              olahan tetap milik katalog, sebab itu yang dijanjikan ke pembeli
              di halaman depan. */}
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
            <div>
              <Label htmlFor="vs-min">
                Minimum pesanan{selected ? ` (${unitOf(selected.type)})` : ''}
              </Label>
              <Input
                id="vs-min"
                type="number"
                min={1}
                inputMode="numeric"
                value={offer.min_qty}
                disabled={pending}
                placeholder="1"
                onChange={(e) => setOffer({ ...offer, min_qty: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="vs-max">
                Maks per hari{selected ? ` (${unitOf(selected.type)})` : ''}
              </Label>
              <Input
                id="vs-max"
                type="number"
                min={1}
                inputMode="numeric"
                value={offer.max_qty}
                disabled={pending}
                placeholder={selected?.type === 'nasi_box' ? '300' : '8'}
                onChange={(e) => setOffer({ ...offer, max_qty: e.target.value })}
                className="mt-1.5"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Berapa banyak yang sanggup dikerjakan mitra ini. Kosong = tanpa batas.
              </p>
            </div>

            <div>
              <Label htmlFor="vs-lead">Jeda persiapan (jam)</Label>
              <Input
                id="vs-lead"
                type="number"
                min={0}
                inputMode="numeric"
                value={offer.lead_time_hours}
                disabled={pending}
                placeholder="48"
                onChange={(e) => setOffer({ ...offer, lead_time_hours: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="vs-notes">Catatan penawaran</Label>
            <Textarea
              id="vs-notes"
              rows={2}
              value={offer.notes}
              disabled={pending}
              placeholder="Kambing jantan saja. Libur Jumat. Antar hanya dalam kota."
              onChange={(e) => setOffer({ ...offer, notes: e.target.value })}
              className="mt-1.5"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Kesepakatan khusus dengan mitra ini — tidak tampil ke pembeli.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || !serviceId || price === ''}
              onClick={() =>
                run(
                  () =>
                    saveVendorService({
                      vendor_id: vendorId,
                      service_id: serviceId,
                      vendor_price: Number(price),
                      is_offered: true,
                      min_qty: num(offer.min_qty),
                      max_qty: num(offer.max_qty),
                      lead_time_hours: num(offer.lead_time_hours),
                      notes: offer.notes,
                    }),
                  () => {
                    setShowForm(false);
                    setServiceId('');
                    setPrice('');
                    setOffer({ min_qty: '', max_qty: '', lead_time_hours: '', notes: '' });
                  },
                )
              }
            >
              Simpan
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setShowForm(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          Belum ada modal tercatat. Selama kosong, margin order mitra ini terbaca sebesar seluruh
          nilai order.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((r) => {
            const edit = editing?.id === r.id ? editing : null;
            // Margin dihitung ulang dari angka yang sedang diketik, bukan dari
            // yang tersimpan: itulah yang membuat suntingan bisa dinilai sebelum
            // disimpan, sama seperti pada form tambah.
            const shownMargin = edit ? r.price - Number(edit.price || 0) : r.margin;

            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-40 flex-1">
                  <p className="font-medium">
                    <Link
                      href={`/vendors/katalog/${r.serviceId}`}
                      className="hover:underline"
                      title="Ubah nama, harga jual, dan isi paket di katalog"
                    >
                      {r.serviceName}
                    </Link>
                    {!r.isOffered && (
                      <Badge className="ml-2 border-slate-200 bg-slate-100 text-slate-600">
                        Tidak ditawarkan
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Jual {formatCurrency(r.price)} · Modal {formatCurrency(r.vendorPrice)}
                  </p>

                  <ServiceDetails service={r} className="mt-1.5" />

                  {/* Batas penawaran mitra ini. Dirender hanya kalau ada
                      isinya: baris "min 1 · tanpa batas" pada mitra yang tidak
                      menetapkan apa pun cuma menambah teks tanpa menambah
                      keterangan. */}
                  {(r.minQty > 1 || r.maxQty !== null || r.leadTimeHours !== null) && (
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      {[
                        r.minQty > 1 ? `Min ${r.minQty} ${unitOf(r.serviceType)}` : null,
                        r.maxQty !== null ? `Maks ${r.maxQty} ${unitOf(r.serviceType)}/hari` : null,
                        r.leadTimeHours !== null ? `Jeda ${r.leadTimeHours} jam` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}

                  {r.notes && (
                    <p className="text-muted-foreground mt-1 text-xs italic">{r.notes}</p>
                  )}
                </div>

                {edit ? (
                  <div className="w-40">
                    <Label htmlFor={`vs-edit-${r.id}`} className="sr-only">
                      Harga modal {r.serviceName}
                    </Label>
                    <Input
                      id={`vs-edit-${r.id}`}
                      type="number"
                      inputMode="numeric"
                      autoFocus
                      value={edit.price}
                      disabled={pending}
                      onChange={(e) => setEditing({ ...edit, price: e.target.value })}
                    />
                  </div>
                ) : null}

                <p
                  className={`text-sm font-medium tabular-nums ${shownMargin < 0 ? 'text-destructive' : ''}`}
                >
                  {formatCurrency(shownMargin)}
                </p>

                <div className="flex items-center gap-2">
                  {edit ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || edit.price === ''}
                        onClick={() =>
                          run(
                            () =>
                              // Keempat batas WAJIB ikut dikirim: `upsert`
                              // menulis seluruh baris, jadi medan yang tidak
                              // disebut akan tertimpa nilai bawaannya —
                              // kapasitas yang sudah diisi akan hilang tiap
                              // kali seseorang mengubah harganya saja.
                              saveVendorService({
                                vendor_id: vendorId,
                                service_id: r.serviceId,
                                vendor_price: Number(edit.price),
                                is_offered: r.isOffered,
                                min_qty: num(edit.min_qty),
                                max_qty: num(edit.max_qty),
                                lead_time_hours: num(edit.lead_time_hours),
                                notes: edit.notes,
                              }),
                            () => setEditing(null),
                          )
                        }
                      >
                        Simpan
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setEditing(null)}
                      >
                        Batal
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setEditing({
                            id: r.id,
                            price: String(r.vendorPrice),
                            min_qty: String(r.minQty),
                            max_qty: r.maxQty === null ? '' : String(r.maxQty),
                            lead_time_hours:
                              r.leadTimeHours === null ? '' : String(r.leadTimeHours),
                            notes: r.notes ?? '',
                          });
                        }}
                      >
                        <Pencil className="size-3.5" />
                        Ubah
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            saveVendorService({
                              vendor_id: vendorId,
                              service_id: r.serviceId,
                              vendor_price: r.vendorPrice,
                              is_offered: !r.isOffered,
                            }),
                          )
                        }
                      >
                        {r.isOffered ? 'Hentikan' : 'Tawarkan'}
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        aria-label={`Hapus modal ${r.serviceName}`}
                        disabled={pending}
                        onClick={() => run(() => deleteVendorService({ id: r.id }))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Medan batas penawaran saat menyunting.
                    Ditaruh sebagai baris penuh di bawah, bukan disisipkan ke
                    baris utama: baris itu sudah memuat nama, harga, isi paket,
                    margin, dan tombol — menambah empat medan lagi ke sana akan
                    membuat semuanya berdesakan di layar sempit. */}
                {edit && (
                  <div className="bg-muted/30 mt-1 w-full rounded-lg border p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label htmlFor={`vs-min-${r.id}`}>
                          Minimum pesanan ({unitOf(r.serviceType)})
                        </Label>
                        <Input
                          id={`vs-min-${r.id}`}
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={edit.min_qty}
                          disabled={pending}
                          placeholder="1"
                          onChange={(e) => setEditing({ ...edit, min_qty: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor={`vs-max-${r.id}`}>
                          Maks per hari ({unitOf(r.serviceType)})
                        </Label>
                        <Input
                          id={`vs-max-${r.id}`}
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={edit.max_qty}
                          disabled={pending}
                          placeholder={r.serviceType === 'nasi_box' ? '300' : '8'}
                          onChange={(e) => setEditing({ ...edit, max_qty: e.target.value })}
                          className="mt-1.5"
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                          Sanggup dikerjakan mitra ini. Kosong = tanpa batas.
                        </p>
                      </div>

                      <div>
                        <Label htmlFor={`vs-lead-${r.id}`}>Jeda persiapan (jam)</Label>
                        <Input
                          id={`vs-lead-${r.id}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={edit.lead_time_hours}
                          disabled={pending}
                          placeholder="48"
                          onChange={(e) => setEditing({ ...edit, lead_time_hours: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <Label htmlFor={`vs-notes-${r.id}`}>Catatan penawaran</Label>
                      <Textarea
                        id={`vs-notes-${r.id}`}
                        rows={2}
                        value={edit.notes}
                        disabled={pending}
                        placeholder="Kambing jantan saja. Libur Jumat."
                        onChange={(e) => setEditing({ ...edit, notes: e.target.value })}
                        className="mt-1.5"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        Kesepakatan khusus dengan mitra ini — tidak tampil ke pembeli.
                      </p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Apa yang didapat pembeli kalau memilih paket ini.
 *
 * Dipakai di dua tempat — pratinjau saat memilih paket baru, dan tiap baris
 * yang sudah tercatat — sebab pertanyaannya sama di keduanya: modal yang wajar
 * untuk "80 porsi, gulai & sate" tidak wajar untuk "150 porsi, empat olahan",
 * dan tanpa ini angkanya diketik tanpa tahu apa yang dibeli.
 *
 * Isinya dirakit di server (`serviceDetails` di `queries.ts`) karena
 * `services.meta` bertipe `Json` bebas dan bentuknya berbeda per jenis paket.
 * Paket tanpa keduanya tidak merender apa pun — baris kosong bukan informasi.
 */
function ServiceDetails({
  service,
  className = '',
}: {
  service: { description: string | null; details: string[] };
  className?: string;
}) {
  if (!service.description && service.details.length === 0) return null;

  return (
    <div className={className}>
      {service.description && (
        <p className="text-muted-foreground text-xs">{service.description}</p>
      )}
      {service.details.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {service.details.map((d) => (
            <li
              key={d}
              className="border-border text-muted-foreground rounded-md border px-1.5 py-0.5 text-xs"
            >
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
