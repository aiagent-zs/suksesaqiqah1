# Foto Landing Page

> ## ⚠️ Saat ini kesepuluh slot berisi FOTO STOK sementara
>
> Diunduh dari Pexels (bebas dipakai komersial, tanpa atribusi) dan dipotong ke
> rasio masing-masing slot, semata agar halaman bisa dinilai utuh sebelum foto
> sungguhan siap. **Semuanya menunggu diganti** — daftar di bawah tetap berlaku.
>
> Karena galeri kini berisi foto stok, kalimat **"bukan foto ilustrasi"** sudah
> dicabut dari `app/(site)/page.tsx` (fungsi `GallerySection`). Janji itu bisa
> diperiksa pengunjung, dan melanggarnya merusak persis kepercayaan yang hendak
> dibangun halaman ini.
>
> **Begitu keenam foto galeri asli masuk, kembalikan kalimat itu** — komentar di
> atas `GallerySection` memuat instruksinya.

Taruh foto di folder ini dengan **nama berkas persis seperti daftar di bawah**.
Tidak ada kode yang perlu diubah — begitu berkasnya ada, kotak abu di halaman
otomatis berganti jadi foto Anda.

Selama berkas belum ada, halaman menampilkan kotak abu bertuliskan path yang
ditunggu. Jadi Anda bisa membuka `npm run dev` sekarang dan melihat sendiri
slot mana yang masih kosong.

## Daftar foto yang ditunggu

| Berkas | Dipakai di | Rasio | Ukuran minimal |
|--------|-----------|-------|----------------|
| `hero.webp` | Hero, sebelah kanan judul | **4:3** | 1200 × 900 |
| `paket-ekonomi.webp` | Kartu paket Ekonomi | **3:2** | 600 × 400 |
| `paket-favorit.webp` | Kartu paket Favorit | **3:2** | 600 × 400 |
| `paket-premium.webp` | Kartu paket Premium | **3:2** | 600 × 400 |
| `galeri-1-persiapan.webp` | Galeri — Persiapan & pemeriksaan hewan | **4:3** | 800 × 600 |
| `galeri-2-sembelih.webp` | Galeri — Penyembelihan sesuai syariat | **4:3** | 800 × 600 |
| `galeri-3-masak.webp` | Galeri — Pengolahan di dapur mitra | **4:3** | 800 × 600 |
| `galeri-4-kemas.webp` | Galeri — Pengemasan rapi & higienis | **4:3** | 800 × 600 |
| `galeri-5-kirim.webp` | Galeri — Diantar ke alamat Anda | **4:3** | 800 × 600 |
| `galeri-6-salur.webp` | Galeri — Disalurkan ke penerima manfaat | **4:3** | 800 × 600 |

**Total: 10 foto.**

## Kenapa `.webp`, bukan `.jpg`

WebP memberi mutu setara JPEG pada ukuran berkas ~25-35% lebih kecil, dan yang
disimpan di repo ini pun jadi ikut ringan.

**Anda tidak perlu memikirkan format saat memotret.** Foto dari kamera atau
ponsel hampir selalu JPEG; ubah sekali sebelum menaruhnya di sini. Cara paling
cepat tanpa memasang apa pun: buka <https://squoosh.app> di peramban, jatuhkan
fotonya, pilih **WebP**, mutu **80**, lalu unduh. Mutu 80 praktis tidak
terbedakan dari aslinya pada foto, sementara ukurannya turun jauh.

Yang **sudah** ditangani aplikasi, jadi bukan urusan Anda: `next/image`
mengubah gambar ke AVIF atau WebP sesuai kemampuan peramban pengunjung, dan
membuat beberapa ukuran otomatis supaya ponsel tidak mengunduh versi desktop.
Menaruh `.webp` di sini hanya membuat sumbernya ikut ringan sejak awal.

## Yang perlu diperhatikan

**Rasio lebih penting daripada ukuran.** Foto boleh jauh lebih besar dari ukuran
minimal — Next.js otomatis mengecilkannya. Tapi kalau rasionya berbeda (misal
foto potret 3:4 dipasang di slot 4:3), bagian atas dan bawahnya akan terpotong
karena foto di-crop agar memenuhi kotak.

**Hero paling menentukan.** Ia foto pertama yang dilihat pengunjung dan tampil
paling besar. Pakai foto paling tajam yang Anda punya, dan hindari menaruh
wajah atau objek penting di tepi bawah — di layar kecil bagian itu bisa
tertutup sematan "Setiap tahap berbukti".

**Galeri sebaiknya foto sungguhan, bukan stok.** Halaman itu menulis "bukan foto
ilustrasi", dan janji itu hanya benar kalau fotonya memang dari pelaksanaan Anda
sendiri. Kalau ada tahap yang belum sempat difoto, lebih baik biarkan kotak
abunya dulu daripada diisi foto stok.

**Format.** `.webp` untuk foto (lebih ringan). Kalau berkas Anda `.png` atau
`.webp`, ganti juga ekstensi di `lib/constants/site.ts` bagian `landingPhotos`
dan `aqiqahPrograms[].photo`.

**Ukuran berkas.** Usahakan di bawah ~500 KB per foto sebelum dimasukkan. Next
mengoptimasi saat penyajian, tapi berkas mentah yang besar memperlambat build
dan membengkakkan repo.

**Privasi.** Foto yang memperlihatkan wajah pemesan atau penerima manfaat
sebaiknya seizin mereka — halaman ini publik dan terindeks mesin pencari.
