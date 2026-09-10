import 'server-only';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { ANIMAL_SPECIES_LABEL } from '@/lib/constants/order';
import type { ReportData } from './types';

/**
 * Sertifikat aqiqah — lembar yang diberikan kepada keluarga.
 *
 * Berbeda tujuan dari laporan peserta, dan itu menentukan seluruh bentuknya.
 * Laporan **membuktikan** pekerjaan: tahap, foto lapangan, penerima manfaat,
 * dibaca sekali lalu diarsipkan. Sertifikat **dikenang**: dicetak, dibingkai,
 * disimpan bertahun-tahun. Jadi ia landscape satu halaman, isinya sedikit, dan
 * tidak memuat satu pun angka operasional.
 *
 * ## Satu per anak, bukan per ekor
 *
 * Aqiqah anak laki-laki memakai dua kambing atas nama anak yang sama — di
 * produksi persis begitu: IA-202609-0002 punya dua baris `animals` dengan
 * `on_behalf_of` identik. Menerbitkan dua sertifikat untuk satu anak akan
 * keliru, jadi hewannya dikelompokkan per nama dan disebut di dalam lembar yang
 * sama ("2 ekor kambing").
 *
 * ## Dua wujud
 *
 * `withPhoto` memilih antara teks saja dan teks beserta foto anaknya. Bukan dua
 * komponen: tata letaknya sama, yang berubah hanya ada-tidaknya satu kolom.
 * Memisahkannya berarti dua salinan yang harus dijaga tetap serupa, dan yang
 * satu diam-diam tertinggal saat yang lain diubah.
 *
 * ## Yang sengaja tidak ada
 *
 * **Tanda tangan.** Tidak ada ruang tanda tangan, tidak ada nama pejabat.
 * Menaruh garis tanda tangan pada berkas yang lahir dari basis data
 * mengesankan seseorang memeriksa dan menekennya — padahal tidak. Yang menjadi
 * bukti adalah laporan pelaksanaannya, dan tautannya tercetak di kaki halaman.
 *
 * **Kutipan ayat atau hadits.** Tidak dicantumkan sampai ada yang memutuskan
 * teksnya. Salah kutip pada dokumen ibadah yang dibingkai keluarga adalah
 * kekeliruan yang bertahan bertahun-tahun.
 */
const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 11,
    color: '#0b1c30',
    fontFamily: 'Helvetica',
  },
  // Bingkai ganda: garis luar tipis, garis dalam tebal. Lazim pada sertifikat,
  // dan memberi lembarannya batas yang jelas saat dicetak tanpa tepi.
  frameOuter: {
    flex: 1,
    margin: 18,
    borderWidth: 1,
    borderColor: '#bdcaba',
    padding: 6,
  },
  frameInner: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#006b2c',
    paddingVertical: 26,
    paddingHorizontal: 34,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  brand: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#006b2c', letterSpacing: 1 },
  title: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#006b2c',
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: 2,
  },
  subtitle: { fontSize: 9, color: '#3e4a3d', textAlign: 'center', marginTop: 4, letterSpacing: 1 },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: '#bdcaba',
    width: 120,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },

  body: { flexDirection: 'row', gap: 26, flex: 1 },
  bodyText: { flex: 1, justifyContent: 'center' },
  intro: { fontSize: 10, color: '#3e4a3d', textAlign: 'center' },

  childName: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  birth: { fontSize: 10, color: '#3e4a3d', textAlign: 'center' },

  detail: { marginTop: 18, alignSelf: 'center', width: 330 },
  detailRow: { flexDirection: 'row', marginBottom: 5 },
  detailLabel: { width: 130, color: '#3e4a3d' },
  detailValue: { flex: 1, fontFamily: 'Helvetica-Bold' },

  // Foto potret: 3:4, mengikuti bentuk foto anak pada umumnya.
  photoColumn: { width: 150, justifyContent: 'center' },
  photo: {
    width: 150,
    height: 200,
    objectFit: 'cover',
    borderRadius: 4,
    borderWidth: 3,
    borderColor: '#e6f4ef',
  },

  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7.5, color: '#3e4a3d' },
  certNo: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#006b2c' },
});

/** Foto anak yang sudah diunduh server-side untuk disematkan. */
export type ChildPhoto = { data: Buffer; format: 'jpg' | 'png' };

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

/**
 * Satu sertifikat per anak, bukan per ekor.
 *
 * Dikelompokkan berdasarkan `onBehalfOf` — dua kambing atas nama yang sama
 * menghasilkan satu lembar yang menyebut "2 ekor kambing", bukan dua lembar
 * yang masing-masing menyebut satu ekor.
 *
 * Diekspor supaya pemanggil bisa tahu berapa lembar yang akan terbit tanpa
 * merender apa pun, dan supaya aturannya bisa diuji sendiri.
 */
export function groupAnimalsByChild(
  animals: ReportData['animals'],
): Array<{ name: string; summary: string }> {
  const byName = new Map<string, Record<string, number>>();

  for (const animal of animals) {
    // Hewan tanpa `on_behalf_of` tidak bisa disertifikatkan: nama anak justru
    // isi pokok lembarannya. Dilewati, bukan diberi nama sandaran — sertifikat
    // bernama "-" lebih buruk daripada tidak ada.
    if (!animal.onBehalfOf) continue;

    const bucket = byName.get(animal.onBehalfOf) ?? {};
    // Huruf kecil: labelnya dirancang untuk badge dan judul kolom ("Kambing"),
    // sedangkan di sini ia masuk ke tengah kalimat — "2 ekor Kambing" salah
    // ejaan pada dokumen yang dibingkai orang.
    const label = ANIMAL_SPECIES_LABEL[animal.species].toLowerCase();
    bucket[label] = (bucket[label] ?? 0) + 1;
    byName.set(animal.onBehalfOf, bucket);
  }

  return [...byName].map(([name, species]) => ({
    name,
    summary: Object.entries(species)
      .map(([label, count]) => `${count} ekor ${label}`)
      .join(' dan '),
  }));
}

/** Nomor sertifikat: nomor order + urutan anaknya. Bisa ditelusuri balik. */
export function certificateNumber(orderNumber: string, index: number): string {
  return `SA/${orderNumber}/${index + 1}`;
}

export function CertificatePages({
  data,
  childPhoto,
  publicUrl,
  withPhoto,
}: {
  data: ReportData;
  /** Null = varian teks saja, meskipun `withPhoto` diminta. */
  childPhoto: ChildPhoto | null;
  publicUrl: string;
  withPhoto: boolean;
}) {
  const children = groupAnimalsByChild(data.animals);
  const showPhoto = withPhoto && childPhoto !== null;

  // Tanggal sembelih diambil dari tahapnya, bukan tanggal order dibuat atau
  // tanggal sertifikat dicetak: yang dicatat sertifikat adalah kapan ibadahnya
  // dilaksanakan.
  const slaughterDate =
    data.stages.find((s) => s.stage === 'sembelih')?.occurredAt ??
    data.schedule?.scheduledDate ??
    null;

  return (
    <>
      {children.map((child, index) => (
        <Page key={child.name} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.frameOuter}>
            <View style={styles.frameInner}>
              <View style={styles.brandRow}>
                <Text style={styles.brand}>SUKSES AQIQAH</Text>
              </View>

              <Text style={styles.title}>SERTIFIKAT AQIQAH</Text>
              <Text style={styles.subtitle}>
                Diterbitkan sebagai keterangan pelaksanaan ibadah aqiqah
              </Text>
              <View style={styles.rule} />

              <View style={styles.body}>
                <View style={styles.bodyText}>
                  <Text style={styles.intro}>
                    Dengan ini menerangkan bahwa ibadah aqiqah atas nama
                  </Text>
                  <Text style={styles.childName}>{child.name}</Text>

                  {(data.childBirthPlace || data.childBirthDate) && (
                    <Text style={styles.birth}>
                      Lahir di {data.childBirthPlace ?? '-'}
                      {data.childBirthDate ? `, ${formatDateId(data.childBirthDate)}` : ''}
                    </Text>
                  )}

                  <View style={styles.detail}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Hewan aqiqah</Text>
                      <Text style={styles.detailValue}>{child.summary}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Tanggal pelaksanaan</Text>
                      <Text style={styles.detailValue}>{formatDateId(slaughterDate)}</Text>
                    </View>
                    {data.vendorName && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Dilaksanakan oleh</Text>
                        <Text style={styles.detailValue}>{data.vendorName}</Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Nomor order</Text>
                      <Text style={styles.detailValue}>{data.orderNumber}</Text>
                    </View>
                  </View>
                </View>

                {showPhoto && (
                  <View style={styles.photoColumn}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- `Image`
                        di sini milik React PDF, bukan HTML: ia menggambar ke
                        kanvas PDF dan tidak mengenal atribut `alt`. */}
                    <Image
                      style={styles.photo}
                      src={{ data: childPhoto.data, format: childPhoto.format }}
                    />
                  </View>
                )}
              </View>

              <View style={styles.footer}>
                <Text style={styles.certNo}>No. {certificateNumber(data.orderNumber, index)}</Text>
                {/* Yang membuktikan pelaksanaannya adalah laporan, bukan lembar
                    ini — jadi tautannya disebut, bukan diklaim sebagai sah
                    dengan sendirinya. */}
                <Text style={styles.footerText}>Dokumentasi lengkap: {publicUrl}</Text>
              </View>
            </View>
          </View>
        </Page>
      ))}
    </>
  );
}

/** Sertifikat sebagai berkas PDF tersendiri. */
export function CertificateDocument(props: Parameters<typeof CertificatePages>[0]) {
  return (
    <Document
      title={`Sertifikat Aqiqah ${props.data.orderNumber}`}
      author="Sukses Aqiqah"
      language="id-ID"
    >
      <CertificatePages {...props} />
    </Document>
  );
}
