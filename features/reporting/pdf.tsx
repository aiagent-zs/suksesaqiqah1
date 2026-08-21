import 'server-only';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { ANIMAL_SPECIES_LABEL, DOC_STAGE_LABEL } from '@/lib/constants/order';
import type { ReportData } from './types';

/**
 * Laporan peserta (docs/11 section 3).
 *
 * Font sengaja memakai Helvetica bawaan React PDF, bukan Inter dari design.md:
 * mendaftarkan font kustom menuntut berkas TTF ikut ter-deploy dan diunduh saat
 * render. Untuk dokumen satu halaman berisi teks pendek, ketergantungan itu
 * lebih mahal daripada nilainya.
 */
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: '#0b1c30', fontFamily: 'Helvetica' },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#006b2c',
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#006b2c' },
  tagline: { fontSize: 9, color: '#3e4a3d', marginTop: 2 },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 10 },
  orderNumber: { fontSize: 10, color: '#3e4a3d', marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#0b1c30',
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 120, color: '#3e4a3d' },
  value: { flex: 1 },
  statusRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  statusPill: {
    fontSize: 9,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#e6f4ef',
    color: '#006b2c',
  },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { width: 150, marginBottom: 8 },
  photo: { width: 150, height: 110, objectFit: 'cover', borderRadius: 4 },
  caption: { fontSize: 7, color: '#3e4a3d', marginTop: 2 },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#bdcaba',
    paddingBottom: 3,
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: { flexDirection: 'row', paddingVertical: 2 },
  footer: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#bdcaba',
    paddingTop: 8,
    fontSize: 8,
    color: '#3e4a3d',
  },
});

/** Foto bukti yang sudah diunduh server-side untuk disematkan ke PDF. */
export type EmbeddedPhoto = { data: Buffer; format: 'jpg' | 'png'; caption: string | null };

function formatDateId(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(d);
}

/** Label tahap untuk PDF. Sengaja lokal: modul UI tidak perlu ikut ke bundel PDF. */
const STAGE_LABEL_PDF: Record<string, string> = {
  persiapan: 'Persiapan',
  sembelih: 'Sembelih',
  masak: 'Masak',
  salur: 'Salur ke penerima',
  kirim: 'Pengiriman',
  terkirim: 'Terkirim',
};

export function ReportDocument({
  data,
  photos,
  publicUrl,
}: {
  data: ReportData;
  photos: EmbeddedPhoto[];
  publicUrl: string;
}) {
  const animalSummary = data.animals.length
    ? Object.entries(
        data.animals.reduce<Record<string, number>>((acc, a) => {
          const label = ANIMAL_SPECIES_LABEL[a.species];
          acc[label] = (acc[label] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([label, count]) => `${count} ${label}`)
        .join(', ')
    : '-';

  const onBehalf = data.animals.map((a) => a.onBehalfOf).filter((v): v is string => Boolean(v));

  return (
    <Document
      title={`Laporan Pelaksanaan ${data.orderNumber}`}
      author="Sukses Aqiqah"
      subject="Laporan pelaksanaan aqiqah/qurban"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Sukses Aqiqah</Text>
          <Text style={styles.tagline}>Tunaikan Ibadah, Tebarkan Manfaat</Text>
          <Text style={styles.title}>Laporan Pelaksanaan</Text>
          <Text style={styles.orderNumber}>
            {data.orderNumber}
            {data.report ? ` · versi ${data.report.version}` : ''}
            {data.vendorName ? ` · ${data.vendorName}` : ''}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Peserta</Text>
            <Text style={styles.value}>{data.participantName ?? '-'}</Text>
          </View>
          {onBehalf.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Atas nama</Text>
              <Text style={styles.value}>{onBehalf.join(', ')}</Text>
            </View>
          )}
          {/* Barisnya hilang sama sekali bila kosong, bukan tercetak "-":
              order qurban tidak punya anak, dan order sebelum 19 Agustus 2026
              tidak pernah menanyakannya. */}
          {(data.childBirthPlace || data.childBirthDate) && (
            <View style={styles.row}>
              <Text style={styles.label}>Tempat, tanggal lahir</Text>
              <Text style={styles.value}>
                {[
                  data.childBirthPlace,
                  data.childBirthDate ? formatDateId(data.childBirthDate) : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Layanan</Text>
            <Text style={styles.value}>
              {data.services.map((s) => `${s.name} (${s.qty})`).join(', ') || '-'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Hewan</Text>
            <Text style={styles.value}>{animalSummary}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Lokasi</Text>
            <Text style={styles.value}>{data.schedule?.locationName ?? '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tanggal pelaksanaan</Text>
            <Text style={styles.value}>{formatDateId(data.schedule?.scheduledDate)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Pelaksanaan</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusPill}>
              Dipotong {data.progress.animalsSlaughtered}/{data.progress.animalsTotal} ekor
            </Text>
            <Text style={styles.statusPill}>
              Distribusi {data.progress.animalsDistributed}/{data.progress.animalsTotal} ekor
            </Text>
            <Text style={styles.statusPill}>
              {data.progress.stagesValidated}/{data.progress.stagesTotal} tahap tervalidasi
            </Text>
          </View>
        </View>

        {/* Tahap pelaksanaan, urut kejadian. Inilah yang membuat laporan
            bercerita runtut: pemesan melihat pesanannya disembelih, dimasak,
            lalu disalurkan atau diantar sampai tujuan. */}
        {data.stages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tahap Pelaksanaan</Text>
            <View style={styles.tableHead}>
              <Text style={{ flex: 2 }}>Tahap</Text>
              <Text style={{ flex: 2 }}>Keterangan</Text>
              <Text style={{ flex: 1 }}>Waktu</Text>
            </View>
            {data.stages.map((s, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={{ flex: 2 }}>{STAGE_LABEL_PDF[s.stage] ?? s.stage}</Text>
                <Text style={{ flex: 2 }}>
                  {s.recipientName ?? s.recipientArea ?? s.notes ?? '-'}
                  {s.packagesCount ? ` (${s.packagesCount} paket)` : ''}
                </Text>
                <Text style={{ flex: 1 }}>
                  {s.occurredAt ? formatDateId(s.occurredAt) : '-'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Galeri Bukti</Text>
            <View style={styles.gallery}>
              {photos.map((photo, i) => (
                <View style={styles.photoWrap} key={i}>
                  {/* `Image` di sini milik React PDF, bukan elemen HTML — tidak
                      punya prop `alt`, dan keterangan foto dirender sebagai
                      <Text> di bawahnya. */}
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image style={styles.photo} src={{ data: photo.data, format: photo.format }} />
                  {photo.caption && <Text style={styles.caption}>{photo.caption}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {data.media.some((m) => m.type === 'note') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Catatan Lapangan</Text>
            {data.media
              .filter((m) => m.type === 'note' && m.caption)
              .map((m, i) => (
                <Text key={i} style={{ marginBottom: 2 }}>
                  • [{DOC_STAGE_LABEL[m.stage]}] {m.caption}
                </Text>
              ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text>
            Terima kasih atas kepercayaan Anda. Seluruh bukti pada laporan ini telah melalui
            validasi dua tingkat.
          </Text>
          <Text style={{ marginTop: 3 }}>Laporan daring: {publicUrl}</Text>
          <Text style={{ marginTop: 3 }}>Zakat Sukses · Sukses Aqiqah</Text>
        </View>
      </Page>
    </Document>
  );
}
