# Tes integrasi

Tes yang memanggil **database sungguhan**. Ada karena empat trigger dan tiga RPC
di skema ini punya perilaku yang tidak bisa dijalankan Vitest sendiri.

## Prasyarat

```bash
npm run db:start     # Supabase lokal (butuh Docker berjalan)
npm run db:reset     # 37 migration + seed
npm run test:integration
```

`npm test` **tidak** menjalankan berkas ini — ia hanya menjalankan `tests/unit`,
jadi kontributor tanpa Docker tetap bisa bekerja. `npm run test:all` menjalankan
keduanya.

## Kenapa ada

Dua bug 21 Agustus lolos dari `tsc` **dan** 364 unit test:

1. Blok `progress` hilang dari payload `get_public_report`. Pembacanya memakai
   `p.progress?.x ?? 0`, jadi tiga kartu "Status Pelaksanaan" di `/r/{token}`
   dan blok progres di PDF **mencetak 0/0 tanpa satu pun galat**.
2. `branch_name` → `vendor_name`. RPC mengirim nama baru, pembacanya masih
   mendeklarasikan nama lama, jadi nama mitra **tidak pernah sampai**.

Keduanya sejenis: kembaran SQL↔TypeScript yang menyimpang diam-diam, dengan
`?? 0` dan `?? null` menelan buktinya. Penyebabnya struktural — RPC bertipe
`Returns: Json` di `types/database.ts`, jadi `as unknown as RpcPayload` melewati
pemeriksaan apa pun.

`public-report-payload.test.ts` (unit) menutup sebagian celah dengan membaca
berkas migration, tapi **berkas SQL bukan database**: ia tidak membuktikan apa
yang sungguh dikembalikan RPC saat dijalankan.

## Isi

| Berkas                       | Yang diuji                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `stage-checklist.test.ts`    | `generate_stage_checklist` — daftar tahap terbit saat mitra ditugaskan, `sembelih` satu baris per ekor |
| `stage-gates.test.ts`        | `enforce_stage_order` (lompat tahap ditolak) & `enforce_stage_review` (pemisahan tugas)                |
| `vendor-assignment.test.ts`  | `enforce_vendor_assignment`, `is_staff()`, `auth_vendor_id()`                                          |
| `public-report-rpc.test.ts`  | `get_public_report` — kontrak payload, penyebut progres, penjagaan token                               |
| `guest-checkout-rpc.test.ts` | `create_guest_order` (harga tidak pernah dari klien) & `confirm_delivery`                              |
| `full-flow.test.ts`          | Alur penuh kedua percabangan: checkout → bayar → tugaskan → tahap → bukti → laporan → konfirmasi       |
| `rls.test.ts`                | RLS per role — isolasi antar mitra, batas admin↔superadmin, data publik vs internal, view KPI          |

## Dua hal yang membuat tes ini bisa ditulis sebebasnya

**Setiap tes berjalan dalam transaksi yang selalu dibatalkan** (`inRollback`).
Tidak ada yang perlu dibersihkan, dan tidak ada urutan eksekusi yang bisa
membuat satu tes menjatuhkan tes lain.

**`expectFailureInSavepoint` untuk galat yang disengaja.** Di Postgres, galat
apa pun membatalkan seluruh transaksi — perintah berikutnya ditolak dengan
"current transaction is aborted". Savepoint membatasi kerusakan pada satu
perintah, sehingga satu tes bisa memeriksa penolakan **lalu** jalur berhasil.

## Pengaman: hanya lokal

`helpers/db.ts` menolak URL yang bukan `127.0.0.1`/`localhost`. Ini bukan
formalitas: `.env.local` di repo ini justru menunjuk ke **cloud**, dan tes ini
MENULIS baris. Host diperiksa dari hasil parse URL, bukan pencarian substring —
`postgres://user@evil.test/db?host=127.0.0.1` memuat "127.0.0.1" tetapi
tersambung ke tempat lain.

Ganti target lewat `TEST_DB_URL` bila port lokal Anda berbeda.

## Satu jebakan khas RLS

**Operasi yang tidak lolos policy tidak selalu melempar galat.** Bedanya
menentukan bentuk assertion yang benar:

| Operasi                 | Ditolak policy  | Cara mengujinya                |
| ----------------------- | --------------- | ------------------------------ |
| `SELECT`                | array kosong    | `expect(rows).toHaveLength(0)` |
| `UPDATE`/`DELETE`       | 0 baris terkena | `expect(result.count).toBe(0)` |
| `INSERT` (`with check`) | galat 42501     | `expectFailureInSavepoint`     |
| Tanpa grant sama sekali | galat 42501     | `expectFailureInSavepoint`     |

Tes RLS yang menunggu exception pada `SELECT` atau `UPDATE` akan **hijau
selamanya tanpa menguji apa pun**.

## Yang belum tercakup

- **Storage** — path bukti diuji sebagai teks, bukan lewat unggahan sungguhan.
- **RLS `notifications` per penerima** — saat ini staf-saja; belum ada konsep
  "notifikasi milik siapa" karena Tahap 8 belum dibangun.
- **Cloud** — seluruh berkas ini hanya pernah dijalankan di lokal.
