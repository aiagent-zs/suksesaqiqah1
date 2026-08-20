import type { AnimalSpecies, AnimalStatus, OrderStatus } from '@/lib/constants/order';
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
  status: AnimalStatus;
};

export type ReportDistribution = {
  recipientArea: string | null;
  packagesCount: number;
  distributedAt: string;
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
  branchName: string | null;
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
    packagesTotal: number;
  };
  distributions: ReportDistribution[];
  media: ReportMedia[];
  report: {
    version: number;
    pdfPath: string | null;
    generatedAt: string;
  } | null;
};
