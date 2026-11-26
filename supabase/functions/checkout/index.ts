import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createMayarInvoice, closeMayarInvoice } from '../_shared/mayar.ts';
import { fulfillInvoice } from '../_shared/fulfillment.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    let voucherCode: string | null = null;
    try {
      const body = await req.json();
      voucherCode = body?.voucherCode ? String(body.voucherCode).toUpperCase().trim() : null;
    } catch {
      // body kosong — tidak apa-apa
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── Ambil isi keranjang ───────────────────────────────────────────────────
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('cart_items')
      .select(`
        id, class_id, bundle_id, ebook_id,
        classes ( id, title, cover_image, base_price, discount_price ),
        bundles (
          id, title, bundle_price,
          bundle_classes ( class_id, classes ( id, title, cover_image ) )
        ),
        ebooks ( id, title, price, discount_price )
      `)
      .eq('user_id', user.id);

    if (cartError) throw cartError;

    console.log(
      `[checkout] user=${user.id} cart_items dari DB: count=${cartItems?.length ?? 0}`,
      JSON.stringify((cartItems ?? []).map((i: any) => ({ id: i.id, class_id: i.class_id, bundle_id: i.bundle_id, ebook_id: i.ebook_id }))),
    );

    if (!cartItems?.length) return json({ error: 'Keranjang kosong.' }, 400);

    // ── Voucher (hanya untuk kelas individual) ────────────────────────────────
    let voucherApplied = false;
    let voucherClassId: string | null = null;
    let voucherDiscountPrice: number | null = null;
    let voucherRowId: string | null = null;

    if (voucherCode) {
      const classIds = (cartItems as any[]).filter((i) => i.class_id).map((i) => i.class_id);

      if (classIds.length > 0) {
        const { data: voucherRow } = await supabaseAdmin
          .from('class_vouchers')
          .select('id, class_id, discount_price, max_uses, used_count')
          .in('class_id', classIds)
          .eq('code', voucherCode)
          .eq('is_active', true)
          .maybeSingle();

        const valid =
          voucherRow &&
          (voucherRow.max_uses === null || (voucherRow.used_count ?? 0) < voucherRow.max_uses);

        if (!valid) {
          return json({ error: 'Kode voucher tidak berlaku untuk kelas di keranjang ini.' }, 400);
        }

        voucherApplied = true;
        voucherClassId = voucherRow.class_id;
        voucherDiscountPrice = voucherRow.discount_price;
        voucherRowId = voucherRow.id;
      }
    }

    // ── Validasi bundle ───────────────────────────────────────────────────────
    for (const item of cartItems as any[]) {
      if (item.bundle_id && item.bundles) {
        const bundleClasses = (item.bundles.bundle_classes ?? []).map((bc: any) => bc.classes).filter(Boolean);
        if (bundleClasses.length === 0) {
          return json(
            { error: `Paket "${item.bundles.title}" belum berisi kelas. Hubungi admin.` },
            400,
          );
        }
      }
    }

    // ── Kelas yang sedang tidak dijual (Revisi Batch 2) ──────────────────────
    // Kelas 'paused' / 'withdrawn' bisa saja sudah ada di keranjang sebelum
    // admin mengubah statusnya. Kalau kolom sales_status belum ada (SQL belum
    // dijalankan), query ini error dan pengecekan dilewati.
    const singleClassIds = (cartItems as any[]).filter((i) => i.class_id).map((i) => i.class_id);
    if (singleClassIds.length > 0) {
      const { data: unsold, error: unsoldError } = await supabaseAdmin
        .from('classes')
        .select('id, title, sales_status')
        .in('id', singleClassIds)
        .neq('sales_status', 'open');
      if (!unsoldError && unsold && unsold.length > 0) {
        const titles = unsold.map((c: any) => c.title).join(', ');
        return json(
          { error: `Kelas berikut sedang tidak dijual: ${titles}. Hapus dari keranjang untuk melanjutkan.` },
          400,
        );
      }
    }

    // ── Kelas individual yang sudah tercakup bundle ───────────────────────────
    const coveredByBundle = new Set<string>();
    for (const item of cartItems as any[]) {
      if (item.bundle_id && item.bundles) {
        for (const bc of item.bundles.bundle_classes ?? []) {
          if (bc.class_id) coveredByBundle.add(bc.class_id);
        }
      }
    }
    const duplicates = (cartItems as any[]).filter((i) => i.class_id && coveredByBundle.has(i.class_id));
    if (duplicates.length > 0) {
      const titles = duplicates.map((i: any) => i.classes?.title ?? i.class_id).join(', ');
      return json(
        { error: `Kelas ini sudah termasuk dalam paket di keranjang: ${titles}. Hapus dulu kelas satuannya.` },
        400,
      );
    }

    // ── Kelas yang sudah dimiliki ─────────────────────────────────────────────
    const allClassIds = new Set<string>();
    for (const item of cartItems as any[]) {
      if (item.class_id) allClassIds.add(item.class_id);
      if (item.bundle_id && item.bundles) {
        for (const bc of item.bundles.bundle_classes ?? []) {
          if (bc.class_id) allClassIds.add(bc.class_id);
        }
      }
    }

    if (allClassIds.size > 0) {
      const { data: owned, error: ownedError } = await supabaseAdmin
        .from('enrollments')
        .select('class_id, classes(title)')
        .eq('user_id', user.id)
        .in('class_id', Array.from(allClassIds));
      if (ownedError) throw ownedError;

      if (owned?.length) {
        const titles = owned.map((e: any) => e.classes?.title ?? e.class_id).join(', ');
        return json({ error: `Kamu sudah punya kelas ini: ${titles}. Hapus dari keranjang dulu.` }, 400);
      }
    }

    // ── Ebook yang sudah dimiliki ─────────────────────────────────────────────
    const ebookIds = (cartItems as any[]).map((i) => i.ebook_id).filter((id): id is string => !!id);
    if (ebookIds.length > 0) {
      const { data: ownedEbooks, error: ownedEbookError } = await supabaseAdmin
        .from('ebook_purchases')
        .select('ebook_id, ebooks(title)')
        .eq('user_id', user.id)
        .in('ebook_id', ebookIds);
      if (ownedEbookError) throw ownedEbookError;

      if (ownedEbooks?.length) {
        const titles = ownedEbooks.map((e: any) => e.ebooks?.title ?? e.ebook_id).join(', ');
        return json({ error: `Kamu sudah punya ebook ini: ${titles}. Hapus dari keranjang dulu.` }, 400);
      }
    }

    // ── Hitung total (harga selalu dihitung di server, tidak pernah dari klien) ─
    let totalAmount = 0;
    for (const item of cartItems as any[]) {
      if (item.bundle_id && item.bundles) {
        totalAmount += item.bundles.bundle_price ?? 0;
      } else if (item.class_id && item.classes) {
        totalAmount +=
          voucherApplied && item.class_id === voucherClassId
            ? voucherDiscountPrice!
            : (item.classes.discount_price ?? item.classes.base_price ?? 0);
      } else if (item.ebook_id && item.ebooks) {
        totalAmount += item.ebooks.discount_price ?? item.ebooks.price ?? 0;
      }
    }

    if (totalAmount < 0) {
      return json({ error: 'Total pembayaran tidak valid. Coba muat ulang keranjang.' }, 400);
    }

    console.log(`[checkout] user=${user.id} totalAmount dihitung dari cart saat ini: ${totalAmount}`);

    // ── Invoice pending yang masih hidup ──────────────────────────────────────
    //
    // Aturan: pakai ulang HANYA kalau isi keranjang identik (fingerprint DAN
    // total sama persis) dengan salah satu invoice pending. SEMUA invoice
    // pending lain untuk user ini dianggap basi dan HARUS dimatikan di DUA
    // tempat:
    //   1. Lokal  → expires_at diset ke masa lalu (tidak akan terpilih lagi).
    //   2. MAYAR  → invoice DITUTUP lewat API (invoice/close) supaya link
    //      pembayaran lamanya tidak bisa dibayar lagi.
    //
    // Poin 2 ini yang sebelumnya bolong: link Mayar lama tetap hidup di tab /
    // jendela popup yang belum ditutup dan di email invoice dari Mayar. User
    // yang membayar link lama itu akan mendapat isi invoice LAMA — inilah akar
    // kasus "beli kelas A, yang terbuka kelas B".
    const buildFingerprint = (rows: Array<{ class_id: string | null; bundle_id: string | null; ebook_id: string | null; price: number }>) =>
      rows
        .map((r) => `${r.bundle_id ? 'bundle' : r.ebook_id ? 'ebook' : 'class'}:${r.bundle_id ?? r.ebook_id ?? r.class_id}:${r.price}`)
        .sort()
        .join('|');

    // Fingerprint keranjang saat ini, dengan harga per-baris yang sama seperti
    // yang nanti dipakai untuk invoice_items (lihat pembentukan itemsToInsert
    // di bawah): kelas satuan pakai harga kelas (voucher-aware), bundle pakai
    // satu baris per bundle_id dengan harga bundle_price, ebook pakai harga ebook.
    const currentFingerprintRows: Array<{ class_id: string | null; bundle_id: string | null; ebook_id: string | null; price: number }> = [];
    for (const item of cartItems as any[]) {
      if (item.bundle_id && item.bundles) {
        currentFingerprintRows.push({ class_id: null, bundle_id: item.bundle_id, ebook_id: null, price: item.bundles.bundle_price ?? 0 });
      } else if (item.class_id && item.classes) {
        const price =
          voucherApplied && item.class_id === voucherClassId
            ? voucherDiscountPrice!
            : (item.classes.discount_price ?? item.classes.base_price ?? 0);
        currentFingerprintRows.push({ class_id: item.class_id, bundle_id: null, ebook_id: null, price });
      } else if (item.ebook_id && item.ebooks) {
        currentFingerprintRows.push({ class_id: null, bundle_id: null, ebook_id: item.ebook_id, price: item.ebooks.discount_price ?? item.ebooks.price ?? 0 });
      }
    }
    const currentFingerprint = buildFingerprint(currentFingerprintRows);

    // Ambil SEMUA invoice pending yang masih hidup (bukan cuma yang terbaru).
    const { data: pendingInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id, total_amount, mayar_payment_url, mayar_invoice_id, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .not('mayar_payment_url', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    let reusedInvoice: { id: string; total_amount: number; mayar_payment_url: string; expires_at: string } | null = null;
    const staleInvoices: Array<{ id: string; mayar_invoice_id: string | null }> = [];

    if (pendingInvoices?.length) {
      // Ambil semua invoice_items kandidat dalam satu query, kelompokkan per invoice.
      const { data: allItems } = await supabaseAdmin
        .from('invoice_items')
        .select('invoice_id, class_id, bundle_id, ebook_id, price')
        .in('invoice_id', pendingInvoices.map((p: any) => p.id));

      const itemsByInvoice = new Map<string, any[]>();
      for (const r of (allItems ?? []) as any[]) {
        const list = itemsByInvoice.get(r.invoice_id) ?? [];
        list.push(r);
        itemsByInvoice.set(r.invoice_id, list);
      }

      for (const candidate of pendingInvoices as any[]) {
        // invoice_items menyimpan bundle sebagai satu baris per kelas anggota
        // (lihat itemsToInsert di bawah), sedangkan fingerprint keranjang punya
        // satu baris per bundle_id. Kelompokkan dulu baris bundle jadi satu baris
        // per bundle_id (harga dijumlahkan) supaya bentuk fingerprint sama.
        const bundleTotals = new Map<string, number>();
        const nonBundleRows: Array<{ class_id: string | null; bundle_id: string | null; ebook_id: string | null; price: number }> = [];
        for (const r of itemsByInvoice.get(candidate.id) ?? []) {
          if (r.bundle_id) {
            bundleTotals.set(r.bundle_id, (bundleTotals.get(r.bundle_id) ?? 0) + (r.price ?? 0));
          } else {
            nonBundleRows.push({ class_id: r.class_id, bundle_id: null, ebook_id: r.ebook_id, price: r.price ?? 0 });
          }
        }
        for (const [bundleId, price] of bundleTotals) {
          nonBundleRows.push({ class_id: null, bundle_id: bundleId, ebook_id: null, price });
        }
        const candidateFingerprint = buildFingerprint(nonBundleRows);

        const matches =
          !reusedInvoice && // hanya satu yang boleh dipakai ulang
          candidate.total_amount === totalAmount &&
          candidateFingerprint === currentFingerprint;

        console.log(
          `[checkout] user=${user.id} invoice pending id=${candidate.id} total=${candidate.total_amount} vs sekarang=${totalAmount}; fingerprint="${candidateFingerprint}" vs "${currentFingerprint}" → ${matches ? 'REUSE' : 'STALE'}`,
        );

        if (matches) {
          reusedInvoice = candidate;
        } else {
          staleInvoices.push({ id: candidate.id, mayar_invoice_id: candidate.mayar_invoice_id });
        }
      }

      // Matikan SEMUA invoice basi: lokal + tutup di Mayar (best-effort).
      if (staleInvoices.length > 0) {
        await supabaseAdmin
          .from('invoices')
          .update({ expires_at: new Date(0).toISOString() })
          .in('id', staleInvoices.map((s) => s.id));

        for (const stale of staleInvoices) {
          if (stale.mayar_invoice_id) {
            const closed = await closeMayarInvoice(stale.mayar_invoice_id);
            console.log(
              `[checkout] user=${user.id} invoice basi ${stale.id} → tutup di Mayar (${stale.mayar_invoice_id}): ${closed ? 'OK' : 'GAGAL (lihat warn di atas)'}`,
            );
          }
        }
      }
    }

    if (reusedInvoice) {
      return json({
        id: reusedInvoice.id,
        paymentUrl: reusedInvoice.mayar_payment_url,
        expiresAt: reusedInvoice.expires_at,
        totalAmount: reusedInvoice.total_amount,
        reused: true,
      });
    }

    // ── Nomor HP wajib (Mayar butuh `mobile`) ─────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('phone, nickname')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.phone) {
      return json({ error: 'Nomor WhatsApp belum diisi. Lengkapi dulu di halaman checkout.' }, 400);
    }

    // ── Simpan invoice lokal (status pending) ─────────────────────────────────
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id: user.id,
        total_amount: totalAmount,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        ...(voucherRowId ? { voucher_id: voucherRowId } : {}),
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // ── Baris invoice_items ───────────────────────────────────────────────────
    const itemsToInsert: any[] = [];
    const itemsForMayar: Array<{ title: string; price: number }> = [];

    for (const item of cartItems as any[]) {
      if (item.bundle_id && item.bundles) {
        const bundle = item.bundles;
        const bundleClasses = (bundle.bundle_classes ?? []).map((bc: any) => bc.classes).filter(Boolean);
        const bundlePrice: number = bundle.bundle_price ?? 0;
        const count = bundleClasses.length;
        if (count === 0) continue;

        // Harga paket dibagi rata ke tiap kelas; sisa pembulatan masuk kelas pertama.
        const per = Math.floor(bundlePrice / count);
        const remainder = bundlePrice - per * count;

        bundleClasses.forEach((cls: any, idx: number) => {
          itemsToInsert.push({
            invoice_id: invoice.id,
            class_id: cls.id,
            bundle_id: item.bundle_id,
            price: idx === 0 ? per + remainder : per,
          });
        });

        // Di Mayar cukup tampil sebagai satu baris paket, bukan pecahan kelas.
        itemsForMayar.push({ title: `Paket: ${bundle.title}`, price: bundlePrice });
      } else if (item.class_id && item.classes) {
        const price =
          voucherApplied && item.class_id === voucherClassId
            ? voucherDiscountPrice!
            : (item.classes.discount_price ?? item.classes.base_price ?? 0);

        itemsToInsert.push({ invoice_id: invoice.id, class_id: item.class_id, price });
        itemsForMayar.push({ title: item.classes.title ?? 'Kelas', price });
      } else if (item.ebook_id && item.ebooks) {
        const price = item.ebooks.discount_price ?? item.ebooks.price ?? 0;
        itemsToInsert.push({ invoice_id: invoice.id, ebook_id: item.ebook_id, price });
        itemsForMayar.push({ title: `Ebook: ${item.ebooks.title ?? ''}`, price });
      }
    }

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabaseAdmin.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;
    }

    console.log(
      `[checkout] user=${user.id} invoice=${invoice.id} itemsForMayar (count=${itemsForMayar.length}):`,
      JSON.stringify(itemsForMayar),
    );

    // ── Validasi anomali: total dari itemsForMayar HARUS sama dengan totalAmount
    // yang sudah dihitung server dari keranjang. Kalau beda, jangan lanjut kirim
    // ke Mayar — ada bug di logic pembentukan itemsForMayar yang harus diketahui
    // segera, bukan baru ketahuan manual dari komplain user.
    const itemsForMayarSum = itemsForMayar.reduce((sum, i) => sum + i.price, 0);
    if (itemsForMayarSum !== totalAmount) {
      console.error(
        `[checkout] ANOMALI: user=${user.id} invoice=${invoice.id} sum(itemsForMayar)=${itemsForMayarSum} != totalAmount=${totalAmount}. itemsForMayar=${JSON.stringify(itemsForMayar)} cartItems=${JSON.stringify((cartItems as any[]).map((i) => ({ id: i.id, class_id: i.class_id, bundle_id: i.bundle_id, ebook_id: i.ebook_id })))}`,
      );
      // Batalkan invoice lokal yang baru dibuat supaya tidak menggantung sebagai 'pending' basi.
      await supabaseAdmin.from('invoices').update({ expires_at: new Date(0).toISOString() }).eq('id', invoice.id);
      return json(
        { error: 'Terjadi kesalahan saat menghitung total pembayaran. Coba muat ulang halaman dan ulangi.' },
        500,
      );
    }

    // ── Checkout gratis (total Rp 0): kelas discount_price=0 atau voucher 100% ─
    // Mayar tidak bisa memproses tagihan di bawah Rp 1.000, jadi untuk total
    // persis 0 kita fulfill langsung di server tanpa pernah membuat tagihan di
    // Mayar sama sekali. fulfillInvoice sudah idempoten (aman dipanggil ulang).
    if (totalAmount === 0) {
      console.log(`[checkout] user=${user.id} invoice=${invoice.id} totalAmount=0 → fulfill langsung tanpa Mayar`);
      await fulfillInvoice(supabaseAdmin, invoice.id);
      return json({
        id: invoice.id,
        freeCheckout: true,
        totalAmount: 0,
        status: 'paid',
      });
    }

    // ── Buat tagihan di Mayar ─────────────────────────────────────────────────
    const frontendUrl = (Deno.env.get('FRONTEND_URL') ?? '').replace(/\/+$/, '');

    const mayarInvoice = await createMayarInvoice({
      name: (profile as any).nickname || user.email?.split('@')[0] || 'Pelajar Markaz Fiqih',
      email: user.email!,
      mobile: (profile as any).phone,
      description: `Markaz Fiqih — Pesanan ${invoice.id.slice(0, 8).toUpperCase()}`,
      redirectUrl: `${frontendUrl}/pembayaran/${invoice.id}`,
      expiredAt: expiresAt.toISOString(),
      items: itemsForMayar.map((i) => ({
        quantity: 1,
        rate: i.price,
        description: i.title.slice(0, 120),
      })),
      // idProd = jembatan balik dari webhook Mayar ke invoice lokal kita.
      extraData: { noCustomer: user.id, idProd: invoice.id },
    });

    await supabaseAdmin
      .from('invoices')
      .update({
        mayar_invoice_id: mayarInvoice.id,
        mayar_payment_url: mayarInvoice.link,
      })
      .eq('id', invoice.id);

    return json({
      id: invoice.id,
      paymentUrl: mayarInvoice.link,
      expiresAt: expiresAt.toISOString(),
      totalAmount,
      voucherApplied,
      reused: false,
    });
  } catch (error) {
    console.error('checkout error:', error);
    return json({ error: (error as Error).message ?? 'Checkout gagal.' }, 500);
  }
});
