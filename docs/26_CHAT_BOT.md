# CHATBOT UI & HUMAN HANDOFF REQUIREMENTS

## Tujuan

Sukses Aqiqah AI Assistant harus tersedia untuk seluruh pengguna website dalam bentuk chatbot ringan yang tidak mengganggu pengalaman pengguna saat mengakses website.

Chatbot berfungsi sebagai:

* Product Knowledge Assistant
* Business Knowledge Assistant
* Development Copilot
* Customer Support Assistant

---

# UI REQUIREMENTS

## Floating Chat Bubble

Tampilkan chatbot sebagai floating bubble di pojok kanan bawah.

### Requirements

* Ukuran kecil dan tidak mengganggu konten utama.
* Selalu terlihat saat user melakukan scroll.
* Responsive pada desktop dan mobile.
* Menggunakan animasi halus.
* Tidak menutupi tombol CTA utama.
* Tidak menutupi navigasi penting.
* Dapat diminimize.
* Dapat ditutup sementara.

---

## Default State

Saat halaman pertama kali dibuka:

Tampilkan bubble kecil:

```text
💬 Tanya Sukses Aqiqah
```

atau

```text
🤖 Butuh Bantuan?
```

Tidak langsung membuka jendela chat.

---

## Expanded State

Saat bubble diklik:

Buka panel chatbot.

Ukuran:

Desktop:

* Lebar 360px–420px
* Tinggi 500px–650px

Mobile:

* Full width modal style
* Tetap ringan dan nyaman digunakan

---

# CHAT EXPERIENCE

Tampilkan contoh pertanyaan cepat:

* Apa itu Aqiqah Berbagi?
* Bagaimana cara melihat laporan?
* Apa arti Progress Dokumentasi?
* Bagaimana alur Qurban?
* Hubungi Admin

Gunakan quick action button.

---

# KNOWLEDGE BASE PRIORITY

Saat menjawab pertanyaan:

Prioritas pencarian:

1. Product Knowledge Base
2. Business Knowledge Base
3. SOP Knowledge Base
4. Development Knowledge Base

Jangan mengarang jawaban.

Jika informasi tidak ditemukan, lanjutkan ke Human Handoff Flow.

---

# HUMAN HANDOFF FLOW

## Kondisi Eskalasi

AI wajib mengalihkan ke admin manusia jika:

* Tidak menemukan jawaban.
* Tingkat keyakinan jawaban rendah.
* Pertanyaan spesifik terkait order tertentu.
* Pertanyaan sensitif.
* Keluhan pelanggan.
* Permintaan bantuan langsung.
* Permintaan perubahan data.

---

## Fallback Message

Contoh:

"Saya belum memiliki informasi yang cukup untuk menjawab pertanyaan tersebut. Silakan hubungi tim kami agar dapat membantu lebih lanjut."

Tampilkan tombol:

```text
Hubungi Admin
```

---

# WHATSAPP HUMAN HANDOFF

Nomor admin tidak boleh hardcoded.

Wajib menggunakan environment variable.

Contoh:

.env.local

ADMIN_WHATSAPP_NUMBER=628xxxxxxxxxx

---

## Flow

Jika user menekan:

```text
Hubungi Admin
```

Sistem membuka:

```text
https://wa.me/{ADMIN_WHATSAPP_NUMBER}
```

dengan pesan otomatis:

```text
Halo Admin Sukses Aqiqah,

Saya membutuhkan bantuan terkait:

[Pertanyaan User]

Mohon bantuannya.
```

---

# TECHNICAL REQUIREMENTS

## Environment Variables

Gunakan:

```env
ADMIN_WHATSAPP_NUMBER=
NEXT_PUBLIC_CHATBOT_ENABLED=true
NEXT_PUBLIC_CHATBOT_NAME=Sukses Aqiqah AI Assistant
```

---

## Feature Toggle

Chatbot harus dapat diaktifkan atau dinonaktifkan melalui:

* .env.local
* Dashboard Super Admin

---

# SUPER ADMIN SETTINGS

Buat menu:

### AI Assistant Settings

Pengaturan:

* Enable / Disable Chatbot
* Ganti Nama Assistant
* Ganti Welcome Message
* Ganti Prompt System
* Ganti Nomor Admin
* Lihat Riwayat Percakapan
* Export Percakapan
* Kelola Knowledge Base

---

# CHAT LOGGING

Simpan:

* Pertanyaan User
* Jawaban AI
* Waktu
* Halaman Asal
* Status

Status:

* Answered
* Escalated
* Failed

---

# FUTURE READY

Arsitektur harus mendukung:
* OpenAI
* Gemini
* Claude
* OpenRouter

tanpa mengubah UI chatbot.

Gunakan adapter pattern untuk AI Provider.

---

# SUCCESS CRITERIA
Chatbot harus mampu:
* Menjawab minimal 80% pertanyaan umum.
* Mengurangi pertanyaan berulang ke admin.
* Mengarahkan user ke admin manusia jika tidak mampu menjawab.
* Tidak mengganggu pengalaman pengguna website.
* Tetap cepat dan ringan pada desktop maupun mobile.