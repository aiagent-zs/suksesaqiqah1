import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  endOfDayExclusiveWib,
  startOfDayWib,
  todayWib,
} from '@/lib/format/date-range';

describe('addCalendarDays', () => {
  it('menambah dan mengurangi hari', () => {
    expect(addCalendarDays('2026-08-19', 7)).toBe('2026-08-26');
    expect(addCalendarDays('2026-08-19', -1)).toBe('2026-08-18');
    expect(addCalendarDays('2026-08-19', 0)).toBe('2026-08-19');
  });

  it('menyeberangi pergantian bulan dan tahun', () => {
    expect(addCalendarDays('2026-08-28', 7)).toBe('2026-09-04');
    expect(addCalendarDays('2026-12-29', 7)).toBe('2027-01-05');
  });

  it('menghitung tahun kabisat', () => {
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('todayWib', () => {
  // Inti masalahnya: pukul 00:30 WIB masih 17:30 UTC hari sebelumnya. Kalau
  // batas bawah pemesanan dihitung di UTC, "hari ini" milik pemesan tertolak
  // sebagai tanggal yang sudah lewat.
  it('memakai tanggal WIB pada dini hari, bukan tanggal UTC', () => {
    expect(todayWib(new Date('2026-08-19T17:30:00.000Z'))).toBe('2026-08-20');
  });

  it('sama dengan tanggal UTC pada siang hari', () => {
    expect(todayWib(new Date('2026-08-19T05:00:00.000Z'))).toBe('2026-08-19');
  });

  it('menyeberangi pergantian bulan', () => {
    expect(todayWib(new Date('2026-08-31T17:00:00.000Z'))).toBe('2026-09-01');
  });
});

describe('startOfDayWib', () => {
  it('menandai tengah malam WIB, bukan UTC', () => {
    expect(startOfDayWib('2026-08-06')).toBe('2026-08-06T00:00:00.000+07:00');
  });

  it('setara dengan 17:00 UTC hari sebelumnya', () => {
    expect(new Date(startOfDayWib('2026-08-06')).toISOString()).toBe('2026-08-05T17:00:00.000Z');
  });
});

describe('endOfDayExclusiveWib', () => {
  it('menunjuk tengah malam WIB hari berikutnya', () => {
    expect(endOfDayExclusiveWib('2026-08-06')).toBe('2026-08-07T00:00:00.000+07:00');
  });

  it('menyeberangi pergantian bulan', () => {
    expect(endOfDayExclusiveWib('2026-08-31')).toBe('2026-09-01T00:00:00.000+07:00');
  });

  it('menyeberangi pergantian tahun', () => {
    expect(endOfDayExclusiveWib('2026-12-31')).toBe('2027-01-01T00:00:00.000+07:00');
  });

  it('menangani tahun kabisat', () => {
    expect(endOfDayExclusiveWib('2028-02-28')).toBe('2028-02-29T00:00:00.000+07:00');
    expect(endOfDayExclusiveWib('2028-02-29')).toBe('2028-03-01T00:00:00.000+07:00');
  });
});

describe('rentang satu hari penuh', () => {
  const from = new Date(startOfDayWib('2026-08-06')).getTime();
  const to = new Date(endOfDayExclusiveWib('2026-08-06')).getTime();

  it('mencakup tepat 24 jam', () => {
    expect(to - from).toBe(24 * 60 * 60 * 1000);
  });

  // Inti bug #9: batas lama `2026-08-06T23:59:59.999Z` memotong rentang pada
  // pukul 06:59 WIB tanggal 7, sehingga order sore hari WIB terhitung di hari
  // yang salah — dan order dini hari 7 Agustus ikut masuk hasil tanggal 6.
  it('memuat order yang dibuat pukul 23:30 WIB', () => {
    const lateNight = new Date('2026-08-06T23:30:00.000+07:00').getTime();

    expect(lateNight).toBeGreaterThanOrEqual(from);
    expect(lateNight).toBeLessThan(to);
  });

  it('menolak order yang dibuat pukul 00:30 WIB hari berikutnya', () => {
    const nextDay = new Date('2026-08-07T00:30:00.000+07:00').getTime();

    expect(nextDay).toBeGreaterThanOrEqual(to);
  });

  it('menolak order yang dibuat pukul 23:30 WIB hari sebelumnya', () => {
    const previousDay = new Date('2026-08-05T23:30:00.000+07:00').getTime();

    expect(previousDay).toBeLessThan(from);
  });
});
