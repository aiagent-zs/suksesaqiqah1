'use client';

import { Baby, CalendarDays, Mail, MapPin, Phone, User, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CHILD_BIRTH_MIN_DATE } from '../../schema';
import type { Draft } from '../../draft';
import { FieldError } from './field-error';
import { SectionLabel, StepIntro } from './step-header';

/** Langkah 3 — kontak pemesan dan data anak. */
export function StepDataPemesan({
  draft,
  set,
  fieldErrors,
  today,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  fieldErrors: Record<string, string>;
  today: string;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-10 duration-300 ease-out">
      <StepIntro title="Siapa yang memesan, dan untuk anak siapa?">
        Kontak Anda dipakai untuk konfirmasi. Data anak dicetak di sertifikat aqiqah.
      </StepIntro>

      {/* <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900">
              <User className="mt-0.5 size-4 shrink-0 text-blue-600" />
              <span>
                Tim kami menghubungi nomor WhatsApp ini untuk konfirmasi pesanan, bukti transfer,
                dan jadwal pelaksanaan.
              </span>
            </div> */}

      <div>
        <SectionLabel
          index={1}
          done={Boolean(draft.name && draft.phone && draft.email)}
          title="Data Anda"
          hint="Kami menghubungi nomor WhatsApp ini."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="co-name" className="text-ink text-sm font-semibold">
              Nama Pemesan <span className="text-danger">*</span>
            </Label>
            <div className="relative mt-2">
              <User
                aria-hidden
                className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <Input
                id="co-name"
                value={draft.name}
                autoComplete="name"
                required
                aria-required
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                placeholder="Nama sesuai WhatsApp/KTP"
                onChange={(e) => set('name', e.target.value)}
                className="field h-12 pl-10"
              />
            </div>
            {fieldErrors.name && <FieldError id="name-error" message={fieldErrors.name} />}
          </div>

          <div>
            <Label htmlFor="co-phone" className="text-ink text-sm font-semibold">
              No. WhatsApp <span className="text-danger">*</span>
            </Label>
            <div className="relative mt-2">
              <Phone
                aria-hidden
                className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <Input
                id="co-phone"
                value={draft.phone}
                inputMode="tel"
                autoComplete="tel"
                required
                aria-required
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                placeholder="0812xxxxxxxx"
                onChange={(e) => set('phone', e.target.value)}
                className="field h-12 pl-10"
              />
            </div>
            {fieldErrors.phone && <FieldError id="phone-error" message={fieldErrors.phone} />}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="co-email" className="text-ink text-sm font-semibold">
              Email <span className="text-danger">*</span>
            </Label>
            <div className="relative mt-2">
              <Mail
                aria-hidden
                className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <Input
                id="co-email"
                type="email"
                value={draft.email}
                autoComplete="email"
                required
                aria-required
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                placeholder="email@domain.com"
                onChange={(e) => set('email', e.target.value)}
                className="field h-12 pl-10"
              />
            </div>
            <p className="text-ink-muted mt-1.5 text-sm">
              Dipakai mengirim salinan pesanan dan tautan laporan pelaksanaan.
            </p>
            {fieldErrors.email && <FieldError id="email-error" message={fieldErrors.email} />}
          </div>
        </div>
      </div>

      <div className="border-line border-t pt-8">
        <SectionLabel
          index={2}
          done={Boolean(draft.child_name && draft.child_birth_place && draft.child_birth_date)}
          title="Data anak"
          hint="Periksa ejaannya, nama ini tercetak di sertifikat."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="co-child" className="text-ink text-sm font-semibold">
              Nama Anak <span className="text-danger">*</span>
            </Label>
            <div className="relative mt-2">
              <Baby
                aria-hidden
                className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <Input
                id="co-child"
                value={draft.child_name}
                required
                aria-required
                aria-invalid={Boolean(fieldErrors.child_name)}
                aria-describedby={fieldErrors.child_name ? 'child_name-error' : undefined}
                placeholder="Mis. Fatih"
                onChange={(e) => set('child_name', e.target.value)}
                className="field h-12 pl-10"
              />
            </div>
            {fieldErrors.child_name && (
              <FieldError id="child_name-error" message={fieldErrors.child_name} />
            )}
          </div>

          <div>
            <Label htmlFor="co-binbinti" className="text-ink text-sm font-semibold">
              Bin / Binti <span className="text-ink-muted font-normal">(opsional)</span>
            </Label>
            <div className="relative mt-2">
              <Users
                aria-hidden
                className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <Input
                id="co-binbinti"
                value={draft.bin_binti}
                aria-invalid={Boolean(fieldErrors.bin_binti)}
                aria-describedby={fieldErrors.bin_binti ? 'bin_binti-error' : undefined}
                placeholder="Mis. bin Ahmad"
                onChange={(e) => set('bin_binti', e.target.value)}
                className="field h-12 pl-10"
              />
            </div>
            {fieldErrors.bin_binti && (
              <FieldError id="bin_binti-error" message={fieldErrors.bin_binti} />
            )}
          </div>

          <div>
            <Label htmlFor="co-birthplace" className="text-ink text-sm font-semibold">
              Tempat Lahir <span className="text-danger">*</span>
            </Label>
            <div className="relative mt-2">
              <MapPin
                aria-hidden
                className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <Input
                id="co-birthplace"
                value={draft.child_birth_place}
                required
                aria-required
                aria-invalid={Boolean(fieldErrors.child_birth_place)}
                aria-describedby={
                  fieldErrors.child_birth_place ? 'child_birth_place-error' : undefined
                }
                placeholder="Mis. Bandung"
                onChange={(e) => set('child_birth_place', e.target.value)}
                className="field h-12 pl-10"
              />
            </div>
            {fieldErrors.child_birth_place && (
              <FieldError id="child_birth_place-error" message={fieldErrors.child_birth_place} />
            )}
          </div>

          <div>
            <Label htmlFor="co-birthdate" className="text-ink text-sm font-semibold">
              Tanggal Lahir <span className="text-danger">*</span>
            </Label>
            {/* `max` adalah hari ini menurut WIB, dihitung di server. Sama
                    seperti pemilih tanggal pelaksanaan, atribut ini cuma
                    membantu peramban; penolakan sungguhannya di `validateStep`,
                    `guestCheckoutSchema`, dan RPC, karena input `date` bisa
                    diisi lewat keyboard. */}
            <div className="relative mt-2">
              <CalendarDays
                aria-hidden
                className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <Input
                id="co-birthdate"
                type="date"
                min={CHILD_BIRTH_MIN_DATE}
                max={today}
                value={draft.child_birth_date}
                required
                aria-required
                aria-invalid={Boolean(fieldErrors.child_birth_date)}
                aria-describedby={
                  fieldErrors.child_birth_date ? 'child_birth_date-error' : undefined
                }
                onChange={(e) => set('child_birth_date', e.target.value)}
                className="field h-12 pl-10"
              />
            </div>
            <p className="text-ink-muted mt-1.5 text-sm">
              Dicetak di sertifikat aqiqah bersama nama anak.
            </p>
            {fieldErrors.child_birth_date && (
              <FieldError id="child_birth_date-error" message={fieldErrors.child_birth_date} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
