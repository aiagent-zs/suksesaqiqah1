-- =============================================================================
-- Konten landing pindah ke `services`
--
-- Sampai hari ini halaman depan **tidak membaca database sama sekali**: nama,
-- harga, tagline, daftar fitur, dan foto ketiga paket aqiqah beserta kelima
-- nasi box semuanya hardcode di `lib/constants/site.ts`. Keputusan yang wajar
-- waktu itu (halaman statis, nol query), tetapi konsekuensinya dua daftar
-- dijaga sinkron oleh tangan — dan keduanya **sudah pernah menyimpang**:
-- `paket-c-favorit` & `paket-e-premium` membawa akhiran yang tidak pernah ada
-- di katalog.
--
-- Penyimpangan slug lebih senyap daripada salah harga: `?paket=` dicocokkan
-- sebagai slug, dan `checkout/page.tsx` sengaja mengabaikan slug tak dikenal
-- lalu jatuh ke paket pertama. Jadi tombol "Pesan" yang salah arah tidak
-- menghasilkan galat apa pun — pengunjung mengira memesan Premium dan mendapat
-- Ekonomi.
--
-- Satu sumber menghapus seluruh kelas kekeliruan itu, sekaligus membuat
-- pemilik usaha bisa mengubah katalog tanpa memanggil developer.
--
-- **Kolom eksplisit, bukan menumpang `meta`.** `meta` sudah dipakai untuk
-- `hasil`, `items`, dan `cocok_untuk` yang dibaca panel modal mitra; mencampur
-- konten pemasaran ke sana membuat satu kolom bebas menjawab dua pertanyaan
-- berbeda, dan tidak ada yang bisa divalidasi database.
-- =============================================================================

alter table public.services
  add column if not exists tagline          text,
  add column if not exists landing_features text[] not null default '{}',
  add column if not exists photo_path       text,
  add column if not exists photo_alt        text,
  add column if not exists is_popular       boolean not null default false,
  add column if not exists show_on_landing  boolean not null default false;

comment on column public.services.tagline is
  'Satu kalimat di bawah harga pada kartu landing. Bukan `description` yang dipakai layar internal.';

comment on column public.services.landing_features is
  'Butir yang dicentang di kartu landing. Kosong = kartu tampil tanpa daftar, bukan galat.';

comment on column public.services.photo_path is
  'Foto kartu. Diawali "images/" = berkas di public/ (bawaan repo); selain itu = object path di bucket public-assets.';

comment on column public.services.is_popular is
  'Menandai kartu "Terpopuler"/"Favorit". Tidak dipaksa unik: yang menandai dua paket sekaligus sedang keliru, tapi itu bukan kerusakan data.';

comment on column public.services.show_on_landing is
  'Dipasarkan di halaman depan. Terpisah dari `is_active`: paket bisa tetap bisa dipesan lewat tautan langsung tanpa dipajang.';

-- --- Isi dari lib/constants/site.ts -----------------------------------------
--
-- Disalin apa adanya supaya halaman depan tidak berubah sedikit pun oleh
-- migration ini. Yang berpindah hanyalah tempat tinggalnya.

update public.services set
  tagline = 'Ibadah aqiqah lengkap dengan harga paling terjangkau.',
  landing_features = array[
    '1 ekor kambing sehat & tersertifikasi',
    'Pemotongan sesuai syariat',
    'Masakan siap antar',
    'Dokumentasi foto proses',
    'Laporan digital untuk keluarga'
  ],
  photo_path = 'images/landing/paket-ekonomi.webp',
  photo_alt = 'Sajian masakan paket Aqiqah Ekonomi',
  is_popular = false,
  show_on_landing = true
where slug = 'aqiqah-ekonomi';

update public.services set
  tagline = 'Pilihan paling diminati — seimbang antara porsi dan nilai.',
  landing_features = array[
    'Kambing ukuran lebih besar',
    'Pemotongan sesuai syariat',
    'Menu masakan lebih variatif',
    'Dokumentasi foto & video',
    'Laporan digital + sertifikat aqiqah'
  ],
  photo_path = 'images/landing/paket-favorit.webp',
  photo_alt = 'Sajian masakan paket Aqiqah Favorit',
  is_popular = true,
  show_on_landing = true
where slug = 'aqiqah-favorit';

update public.services set
  tagline = 'Porsi lebih besar dan layanan paling lengkap.',
  landing_features = array[
    'Kambing premium ukuran besar',
    'Pemotongan sesuai syariat',
    'Menu masakan premium & variatif',
    'Dokumentasi foto & video profesional',
    'Laporan digital + sertifikat + prioritas jadwal'
  ],
  photo_path = 'images/landing/paket-premium.webp',
  photo_alt = 'Sajian masakan paket Aqiqah Premium',
  is_popular = false,
  show_on_landing = true
where slug = 'aqiqah-premium';

-- Nasi box: lauknya sudah tercatat di `meta->items` sejak awal dan dibaca
-- panel modal mitra. Tidak disalin ulang ke `landing_features` — dua salinan
-- isi yang sama persis adalah kekeliruan yang baru saja dihapus migration ini.
update public.services
set show_on_landing = true,
    is_popular = (slug = 'paket-c')
where type = 'nasi_box' and slug in ('paket-a', 'paket-b', 'paket-c', 'paket-d', 'paket-e');

-- Qurban sengaja TIDAK dipasarkan (keputusan 21 Agustus): checkout hanya
-- melayani aqiqah (`.eq('type','aqiqah')`), jadi memajangnya berarti menawarkan
-- sesuatu yang tidak bisa dipesan. Kemampuannya tetap utuh — yang dicabut
-- keputusan pemasarannya, bukan barisnya.
update public.services set show_on_landing = false where type = 'qurban';

-- --- Gerbang isi kartu ------------------------------------------------------
--
-- Kartu landing tanpa harga atau tanpa nama bukan kartu; ia lubang di halaman
-- yang dilihat calon pembeli. Nama & harga sudah `not null`, jadi yang perlu
-- dijaga hanya bahwa paket yang dipasarkan benar-benar aktif — memajang paket
-- non-aktif berarti tombol "Pesan" yang membawa ke checkout tanpa paketnya.
alter table public.services
  add constraint services_landing_requires_active
  check (not show_on_landing or is_active);
