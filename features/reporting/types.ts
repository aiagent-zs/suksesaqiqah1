import type { AnimalSpecies, OrderStatus } from '@/lib/constants/order';
import type { DocStage, DocType } from '@/features/documentation/storage';

/**
 * Bentuk data laporan — dipakai bersama oleh generator PDF dan halaman publik
 * `/r/{token}`, supaya keduanya tidak pernah menampilkan isi yang berbeda.
 *
 * Sengaja tanpa kontak peserta (telepon/email/alamat): laporan dibagikan lewat
 * tautan, jadi isinya dibatasi ke apa yang memang boleh dilihat pemegang tautan
 * (docs/11 section 6 — data minimal).
 */
export type ReportAnimal = {
  species: AnimalSpecies;
  tagCode: string | null;
  onBehalfOf: string | null;
};

export type ReportStage = {
  stage: string;
  occurredAt: string | null;
  notes: string | null;
  packagesCount: number | null;
  recipientName: string | null;
  recipientArea: string | null;
};

export type ReportMedia = {
  type: DocType;
  stage: DocStage;
  caption: string | null;
  storagePath: string | null;
  /** Signed URL berdurasi pendek — hanya diisi untuk tampilan halaman publik. */
  url: string | null;
};

export type ReportData = {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  /** Nama mitra pelaksana. Null selama order belum ditugaskan ke mitra mana pun. */
  vendorName: string | null;
  participantName: string | null;
  /**
   * Data lahir anak yang diaqiqahi — pasangan nama pada `animals[].onBehalfOf`.
   *
   * Termasuk data minimal meski laporan ini dibagikan lewat tautan: yang ditahan
   * dari halaman publik adalah kontak peserta (telepon, email, alamat), sedangkan
   * tempat & tanggal lahir justru pokok ibadah yang sedang dilaporkan.
   *
   * Null untuk order qurban dan untuk order sebelum 19 Agustus 2026.
   */
  childBirthPlace: string | null;
  childBirthDate: string | null;
  services: Array<{ name: string; qty: number }>;
  animals: ReportAnimal[];
  schedule: {
    scheduledDate: string | null;
    scheduledTime: string | null;
    locationName: string | null;
  } | null;
  progress: {
    animalsTotal: number;
    animalsSlaughtered: number;
    animalsDistributed: number;
    stagesTotal: number;
    stagesValidated: number;
  };
  /**
   * Tahap yang sudah tervalidasi, urut pelaksanaan.
   *
   * Menggantikan daftar distribusi: pada order Aqiqah Kirim, cerita yang perlu
   * dibaca pemesan bukan "berapa paket disalurkan", melainkan bahwa pesanannya
   * disembelih, dimasak, diantar, dan sampai.
   */
  stages: ReportStage[];
  media: ReportMedia[];
  report: {
    version: number;
    pdfPath: string | null;
    generatedAt: string;
  } | null;
};
