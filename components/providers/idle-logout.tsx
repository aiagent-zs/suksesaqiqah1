'use client';

import { useEffect, useRef } from 'react';
import { logoutIdle } from '@/server/actions/auth';
import {
  ACTIVITY_STORAGE_KEY,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_PATH,
  IDLE_CHECK_INTERVAL_MS,
  isIdle,
  parseActivity,
} from '@/lib/auth/idle';

/**
 * Peristiwa yang dihitung sebagai "user sedang memakai website".
 *
 * `mousemove` sengaja **tidak** masuk daftar. Perangkat yang ditinggal pergi
 * masih bisa menghasilkan gerakan kursor dari getaran meja atau trackpad yang
 * tersenggol, dan itu akan memperpanjang sesi tanpa ada orang di depannya —
 * persis keadaan yang ingin dicegah. Menggulir dan menekan tombol sudah
 * mencakup membaca maupun mengetik.
 */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Mengeluarkan user setelah menganggur (`lib/auth/idle.ts`).
 *
 * Ini lapis kenyamanan, bukan lapis keamanan — penegakannya ada di middleware,
 * yang tetap berlaku meski komponen ini tidak pernah jalan. Tugasnya dua:
 *
 * 1. Mengeluarkan tepat waktu. Tab yang menganggur tidak mengirim permintaan
 *    apa pun, jadi tanpa pengawas ini user baru terlempar saat menekan sesuatu.
 * 2. Menjaga user yang **aktif** tetap masuk. Mengisi form panjang tanpa
 *    berpindah halaman juga tidak menghasilkan permintaan; heartbeat berkala
 *    memberi tahu server bahwa orangnya masih ada.
 */
export function IdleLogout() {
  // Sengaja tidak diisi `Date.now()` di sini: pemanggilan tak-murni saat render
  // melanggar aturan kemurnian React (hasilnya bisa berubah tiap render ulang).
  // Keduanya diberi nilai awal di dalam effect, yang jalan setelah mount.
  const lastActivityRef = useRef(0);
  const lastHeartbeatRef = useRef(0);
  /** Cegah logout terpanggil berkali-kali saat redirect masih berjalan. */
  const leavingRef = useRef(false);

  useEffect(() => {
    const mountedAt = Date.now();
    lastActivityRef.current = mountedAt;
    lastHeartbeatRef.current = mountedAt;

    /** Cap waktu terbaru lintas tab — tab diam tidak boleh mengusir tab aktif. */
    function latestActivity(): number {
      let shared: number | null = null;
      try {
        shared = parseActivity(window.localStorage.getItem(ACTIVITY_STORAGE_KEY));
      } catch {
        // localStorage bisa ditolak (mode privat, cookie diblokir). Jatuh ke
        // catatan milik tab ini saja — lebih ketat, bukan lebih longgar.
      }
      return Math.max(lastActivityRef.current, shared ?? 0);
    }

    function markActive() {
      const now = Date.now();
      lastActivityRef.current = now;
      try {
        window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
      } catch {
        // Lihat catatan di latestActivity().
      }
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    const timer = window.setInterval(() => {
      if (leavingRef.current) return;

      const now = Date.now();
      const lastActivity = latestActivity();

      if (isIdle(lastActivity, now)) {
        leavingRef.current = true;
        for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive);
        try {
          window.localStorage.removeItem(ACTIVITY_STORAGE_KEY);
        } catch {
          // Lihat catatan di latestActivity().
        }
        void logoutIdle();
        return;
      }

      // Cap waktu di server hanya ikut bergerak lewat permintaan. Selama masih
      // ada aktivitas sejak heartbeat terakhir, kabari server supaya user yang
      // benar-benar aktif tidak ikut dikeluarkan.
      const heartbeatDue = now - lastHeartbeatRef.current >= HEARTBEAT_INTERVAL_MS;
      if (heartbeatDue && lastActivity > lastHeartbeatRef.current) {
        lastHeartbeatRef.current = now;
        void fetch(HEARTBEAT_PATH, { method: 'POST', cache: 'no-store' }).catch(() => {
          // Jaringan putus bukan alasan mengeluarkan user — middleware yang
          // memutuskan saat permintaan berikutnya benar-benar sampai.
        });
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive);
    };
  }, []);

  return null;
}
