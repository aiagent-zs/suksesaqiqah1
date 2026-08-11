import { describe, expect, it } from 'vitest';
import {
  reportIssueSchema,
  updateIssueSchema,
  updateIssueStatusSchema,
} from '@/features/issues/schema';
import {
  ISSUE_OPEN_STATUSES,
  ISSUE_SEVERITY_META,
  ISSUE_SEVERITY_ORDER,
  ISSUE_STATUS_META,
  ISSUE_STATUS_ORDER,
} from '@/lib/constants/order';

const ORDER_ID = '3f1a9c62-5f4b-4c1e-9a2d-8e7b6c5d4a3f';
const ISSUE_ID = '9d8c7b6a-5e4f-4321-8a9b-0c1d2e3f4a5b';

describe('reportIssueSchema', () => {
  it('menerima laporan kendala lengkap', () => {
    const result = reportIssueSchema.parse({
      order_id: ORDER_ID,
      title: 'Hewan datang terlambat dari supplier',
      description: 'Estimasi mundur 3 jam.',
      severity: 'high',
    });

    expect(result.title).toBe('Hewan datang terlambat dari supplier');
    expect(result.severity).toBe('high');
  });

  it('membolehkan deskripsi kosong — kolomnya nullable', () => {
    expect(
      reportIssueSchema.safeParse({
        order_id: ORDER_ID,
        title: 'Akses jalan tertutup',
        description: '',
        severity: 'low',
      }).success,
    ).toBe(true);
  });

  it('memangkas spasi dan menolak judul yang terlalu pendek', () => {
    // Judul dipangkas dulu, jadi "  ab  " tetap dihitung 2 karakter.
    expect(
      reportIssueSchema.safeParse({ order_id: ORDER_ID, title: '  ab  ', severity: 'medium' })
        .success,
    ).toBe(false);

    expect(
      reportIssueSchema.parse({ order_id: ORDER_ID, title: '  Air mati  ', severity: 'medium' })
        .title,
    ).toBe('Air mati');
  });

  it('menolak tingkat keparahan di luar enum database', () => {
    expect(
      reportIssueSchema.safeParse({ order_id: ORDER_ID, title: 'Kendala', severity: 'kritis' })
        .success,
    ).toBe(false);
  });

  it('menolak order_id yang bukan uuid', () => {
    expect(
      reportIssueSchema.safeParse({ order_id: 'IA-202608-0001', title: 'Kendala', severity: 'low' })
        .success,
    ).toBe(false);
  });

  it('tidak menerima status dari klien — kendala selalu lahir open', () => {
    const result = reportIssueSchema.parse({
      order_id: ORDER_ID,
      title: 'Kendala baru',
      severity: 'medium',
      status: 'resolved',
    });

    expect(result).not.toHaveProperty('status');
  });
});

describe('updateIssueSchema', () => {
  it('menyunting isi tanpa membawa status', () => {
    const result = updateIssueSchema.parse({
      id: ISSUE_ID,
      title: 'Judul terkoreksi',
      description: 'Detail baru',
      severity: 'medium',
      status: 'resolved',
    });

    // Penyelesaian kendala adalah aksi terpisah: hanya jalur itu yang boleh
    // menulis resolved_by / resolved_at.
    expect(result).not.toHaveProperty('status');
  });

  it('menolak judul kosong', () => {
    expect(updateIssueSchema.safeParse({ id: ISSUE_ID, title: '', severity: 'low' }).success).toBe(
      false,
    );
  });
});

describe('updateIssueStatusSchema', () => {
  it('menerima seluruh status yang dikenal database', () => {
    for (const status of ISSUE_STATUS_ORDER) {
      expect(updateIssueStatusSchema.safeParse({ id: ISSUE_ID, status }).success).toBe(true);
    }
  });

  it('menolak status di luar enum', () => {
    expect(updateIssueStatusSchema.safeParse({ id: ISSUE_ID, status: 'closed' }).success).toBe(
      false,
    );
  });
});

describe('konstanta kendala', () => {
  it('setiap severity & status punya label tampilan', () => {
    for (const severity of ISSUE_SEVERITY_ORDER) {
      expect(ISSUE_SEVERITY_META[severity]?.label).toBeTruthy();
    }
    for (const status of ISSUE_STATUS_ORDER) {
      expect(ISSUE_STATUS_META[status]?.label).toBeTruthy();
    }
  });

  it('"terbuka" berarti open + in_progress, sama dengan v_open_orders', () => {
    // Kalau daftar ini bergeser, hitungan di panel order akan berbeda dari
    // angka Kendala Terbuka di dashboard untuk data yang sama.
    expect(ISSUE_OPEN_STATUSES).toEqual(['open', 'in_progress']);
    expect(ISSUE_OPEN_STATUSES).not.toContain('resolved');
  });

  it('severity terurut dari yang paling mendesak', () => {
    expect(ISSUE_SEVERITY_ORDER).toEqual(['high', 'medium', 'low']);
  });
});
