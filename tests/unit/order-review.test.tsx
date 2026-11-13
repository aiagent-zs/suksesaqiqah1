// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { emptyDraft } from '@/features/checkout/draft';
import { OrderReview } from '@/features/checkout/components/steps/order-review';
import type { CheckoutPackage } from '@/features/checkout/queries';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PKG: CheckoutPackage = {
  id: 'a2000000-0000-4000-8000-000000000001',
  type: 'aqiqah',
  name: 'Aqiqah Ekonomi',
  slug: 'aqiqah-ekonomi',
  description: null,
  price: 2300000,
  features: [],
};

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

function mount(draft: ReturnType<typeof emptyDraft>, onEdit = vi.fn()) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <OrderReview
        draft={draft}
        selected={PKG}
        selectedBox={undefined}
        packageSubtotal={4600000}
        boxSubtotal={0}
        onEdit={onEdit}
      />,
    ),
  );
  return { text: container.textContent ?? '', onEdit };
}

describe('OrderReview', () => {
  it('menampilkan isian yang akan tercetak di sertifikat', () => {
    const { text } = mount({
      ...emptyDraft(PKG.id),
      aqiqah_for: 'laki_laki',
      qty: 2,
      child_name: 'Ahmad',
      bin_binti: 'bin Fulan',
      child_birth_place: 'Bogor',
    });
    expect(text).toContain('Anak Laki-laki');
    expect(text).toContain('Aqiqah Ekonomi, 2');
    expect(text).toContain('Ahmad bin Fulan');
    expect(text).toContain('Lahir di Bogor');
  });

  it('menandai isian kosong alih-alih menampilkan baris hampa', () => {
    const { text } = mount(emptyDraft(PKG.id));
    expect(text).toContain('Belum diisi');
  });

  it('tombol Ubah menunjuk bagian form asalnya', () => {
    const { onEdit } = mount(emptyDraft(PKG.id));
    const btn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Ubah data pemesan & anak',
    );
    act(() => btn!.click());
    expect(onEdit).toHaveBeenCalledWith('bagian-data');
  });
});
