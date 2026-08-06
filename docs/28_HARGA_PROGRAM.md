# PERBAIKAN MODUL PROGRAM & HARGA

## Issue

Saat ini saya mengalami kendala ketika mengedit data Program.

Ketika melakukan edit harga program muncul notifikasi:

```text
ID tidak valid
```

Mohon lakukan investigasi dan perbaikan pada modul Program agar proses edit dapat berjalan normal.

---

# PERBAIKAN DATA PROGRAM

Silakan update data program dengan rincian berikut.

## PAKET NASI BOX AQIQAH

| Paket           | Harga Vendor | Margin 20% | Harga Jual |
| --------------- | -----------: | ---------: | ---------: |
| Paket A         |     Rp17.500 |    Rp3.500 |   Rp21.000 |
| Paket B         |     Rp22.500 |    Rp4.500 |   Rp27.000 |
| Paket C FAVORIT |     Rp26.500 |    Rp5.300 |   Rp32.000 |
| Paket D         |     Rp37.000 |    Rp7.400 |   Rp45.000 |
| Paket E PREMIUM |     Rp58.000 |   Rp11.600 |   Rp70.000 |

---

## PROGRAM AQIQAH

| Program | Harga Vendor | Margin 20% |  Harga Jual |
| ------- | -----------: | ---------: | ----------: |
| Ekonomi |  Rp1.840.000 |  Rp368.000 | Rp2.300.000 |
| Favorit |  Rp2.325.000 |  Rp465.000 | Rp2.800.000 |
| Premium |  Rp2.975.000 |  Rp595.000 | Rp3.600.000 |

---

# PERBAIKAN STRUKTUR DATA PROGRAM

Pastikan setiap Program memiliki:

* Nama Program
* Slug
* Harga Vendor
* Margin
* Harga Jual
* Status Aktif
* Deskripsi
* Urutan Tampil

---

# SLUG REQUIREMENT

Saat ini slug menggunakan format yang tidak user-friendly seperti:

```text
/b0000001-0000-0000-0000-000000000002
```

Format tersebut tidak boleh digunakan untuk halaman publik.

---

## Format Slug Yang Diinginkan

### Paket Nasi Box

```text
/paket-a
/paket-b
/paket-c-favorit
/paket-d
/paket-e-premium
```

### Program Aqiqah

```text
/aqiqah-ekonomi
/aqiqah-favorit
/aqiqah-premium
```

---

# SEO REQUIREMENT

Slug harus:

* Human readable
* SEO friendly
* Mudah dibagikan
* Mudah diingat
* Tidak menggunakan UUID sebagai URL publik

UUID tetap boleh digunakan sebagai Primary Key di database, tetapi tidak boleh menjadi URL halaman publik.

---

# VALIDATION

Pastikan:

* Edit Program berhasil tanpa error.
* Harga Vendor dapat diubah.
* Margin dapat dihitung otomatis.
* Harga Jual dapat dihitung otomatis atau diisi manual.
* Slug unik.
* Slug otomatis dibuat dari nama program.
* Super Admin dapat mengubah slug jika diperlukan.

---

# EXPECTED RESULT

Setelah perbaikan:
✅ Program dapat diedit tanpa error.
✅ Harga Vendor dapat diperbarui.
✅ Margin tersimpan dengan benar.
✅ Harga Jual tersimpan dengan benar.
✅ URL program menjadi SEO friendly.
✅ Tidak ada lagi URL publik menggunakan UUID.