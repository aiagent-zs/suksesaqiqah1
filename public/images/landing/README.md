# Foto Landing Page

Taruh foto di folder ini dengan **nama berkas persis seperti daftar di bawah**.
Tidak ada kode yang perlu diubah — begitu berkasnya ada, kotak abu di halaman
otomatis berganti jadi foto Anda.

Selama berkas belum ada, halaman menampilkan kotak abu bertuliskan path yang
ditunggu. Jadi Anda bisa membuka `npm run dev` sekarang dan melihat sendiri
slot mana yang masih kosong.

## Daftar foto yang ditunggu

| Berkas | Dipakai di | Rasio | Ukuran minimal |
|--------|-----------|-------|----------------|
| `hero.jpg` | Hero, sebelah kanan judul | **4:3** | 1200 × 900 |
| `paket-ekonomi.jpg` | Kartu paket Ekonomi | **3:2** | 600 × 400 |
| `paket-favorit.jpg` | Kartu paket Favorit | **3:2** | 600 × 400 |
| `paket-premium.jpg` | Kartu paket Premium | **3:2** | 600 × 400 |
| `galeri-1-persiapan.jpg` | Galeri — Persiapan & pemeriksaan hewan | **4:3** | 800 × 600 |
| `galeri-2-sembelih.jpg` | Galeri — Penyembelihan sesuai syariat | **4:3** | 800 × 600 |
| `galeri-3-masak.jpg` | Galeri — Pengolahan di dapur mitra | **4:3** | 800 × 600 |
| `galeri-4-kemas.jpg` | Galeri — Pengemasan rapi & higienis | **4:3** | 800 × 600 |
| `galeri-5-kirim.jpg` | Galeri — Diantar ke alamat Anda | **4:3** | 800 × 600 |
| `galeri-6-salur.jpg` | Galeri — Disalurkan ke penerima manfaat | **4:3** | 800 × 600 |

**Total: 10 foto.**

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

**Format.** `.jpg` untuk foto (lebih ringan). Kalau berkas Anda `.png` atau
`.webp`, ganti juga ekstensi di `lib/constants/site.ts` bagian `landingPhotos`
dan `aqiqahPrograms[].photo`.

**Ukuran berkas.** Usahakan di bawah ~500 KB per foto sebelum dimasukkan. Next
mengoptimasi saat penyajian, tapi berkas mentah yang besar memperlambat build
dan membengkakkan repo.

**Privasi.** Foto yang memperlihatkan wajah pemesan atau penerima manfaat
sebaiknya seizin mereka — halaman ini publik dan terindeks mesin pencari.
