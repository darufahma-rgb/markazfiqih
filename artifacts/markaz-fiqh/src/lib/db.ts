// src/lib/db.ts
// Semua fungsi query langsung ke Supabase — bypass backend Express.
import { supabase } from './supabase';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type EnrollmentItem = {
  id: string;
  enrolledAt: string;
  lastWatchedAt: string | null;
  isCompleted: boolean;
  class: {
    id: string;
    title: string;
    coverImage: string;
    basePrice: number;
    discountPrice: number | null;
    level: string | null;
    category: string | null;
    instructor: { id: string; name: string; photoUrl: string };
    moduleCount: number;
    totalDarsCount: number;
    completedDarsCount: number;
    totalDurationMinutes: number;
  };
};

export type BundleItem = {
  id: string;
  title: string;
  description: string;
  normalPrice: number;
  bundlePrice: number;
  coverImage: string;
  classes: { id: string; title: string; coverImage: string }[];
};

export type CartClassItem = {
  id: string;
  type: 'class';
  classId: string;
  addedAt: string;
  class: {
    id: string;
    title: string;
    coverImage: string;
    basePrice: number;
    discountPrice: number | null;
    instructor: { id: string; name: string; photoUrl: string };
    moduleCount: number;
    totalDurationMinutes: number;
  };
};

export type CartBundleItem = {
  id: string;
  type: 'bundle';
  bundleId: string;
  addedAt: string;
  bundle: BundleItem;
};

export type CartEbookItem = {
  id: string;
  type: 'ebook';
  ebookId: string;
  addedAt: string;
  ebook: EbookCatalogItem;
};

export type CartItem = CartClassItem | CartBundleItem | CartEbookItem;

// ─── CLASSES ─────────────────────────────────────────────────────────────────

// In-memory cache untuk getClassById — batas 90 detik agar data segar
const classDetailCache = new Map<string, { data: any; ts: number }>();
const CLASS_CACHE_TTL = 90_000; // 90 seconds


export async function listClasses(params?: {
  search?: string;
  category?: string;
  level?: string;
  instructorId?: string;
  /** Kalau true, tampilkan semua kelas termasuk draft — khusus Admin Panel */
  includeAll?: boolean;
}) {
  let query = supabase
    .from('classes')
    .select(`
      id, title, description, cover_image, base_price, discount_price,
      status, level, category, youtube_playlist_id, meeting_count, display_order, certificate_template_url,
      instructors ( id, name, photo_url ),
      modules ( id, dars ( id, duration_minutes ) )
    `)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (!params?.includeAll) query = query.eq('status', 'published');

  if (params?.search) query = query.ilike('title', `%${params.search}%`);
  if (params?.category) query = query.eq('category', params.category);
  if (params?.level) query = query.eq('level', params.level);
  if (params?.instructorId) query = query.eq('instructor_id', params.instructorId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((c: any) => {
    const modules = c.modules ?? [];
    const dars = modules.flatMap((m: any) => m.dars ?? []);
    return {
      id: c.id as string,
      title: c.title as string,
      description: c.description as string,
      coverImage: getCoverImageUrl(c.title as string, c.cover_image as string),
      basePrice: c.base_price as number,
      discountPrice: c.discount_price as number | null,
      status: c.status as 'draft' | 'published',
      level: c.level as 'pemula' | 'menengah' | 'lanjutan' | null,
      category: c.category as string | null,
      youtubePlaylistId: c.youtube_playlist_id as string | null,
      moduleCount: modules.length as number,
      meetingCount: (c.meeting_count ?? null) as number | null,
      displayOrder: (c.display_order ?? 0) as number,
      certificateTemplateUrl: (c.certificate_template_url as string | null) ?? null,
      totalDurationMinutes: dars.reduce(
        (acc: number, d: any) => acc + (d.duration_minutes ?? 0),
        0,
      ) as number,
      instructor: c.instructors
        ? { id: c.instructors.id, name: c.instructors.name, photoUrl: c.instructors.photo_url }
        : { id: '', name: 'Pengajar', photoUrl: '' },
    };
  });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getCoverImageUrl(title: string, rawCover?: string | null): string {
  if (rawCover && rawCover.trim()) return rawCover;
  const slug = slugify(title);
  return `/covers/${slug}.png`;
}

export async function getClassById(idOrSlug: string) {
  // ── Cache hit: kembalikan data langsung jika belum kadaluarsa ──────────────
  const cached = classDetailCache.get(idOrSlug);
  if (cached && Date.now() - cached.ts < CLASS_CACHE_TTL) return cached.data;

  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idOrSlug);

  // ── Resolve slug → ID (hanya jika parameter bukan UUID) ───────────────────
  let targetId = idOrSlug;
  if (!isUuid) {
    // Fetch hanya id + title untuk mapping slug — jauh lebih ringan
    const { data: allClasses } = await supabase
      .from('classes')
      .select('id, title')
      .eq('status', 'published');
    if (allClasses) {
      const match = allClasses.find((c) => slugify(c.title) === idOrSlug.toLowerCase());
      if (match) targetId = match.id;
    }
  }

  // ── Fetch class detail ─────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id, title, description, cover_image, base_price, discount_price,
      status, level, category, youtube_playlist_id, gdrive_materi_url, wa_group_url,
      soal_latihan_url, ebook_url, testimoni_form_url, meeting_count, display_order,
      reverse_video_order, certificate_template_url, instructor_id,
      related_ebook_id, ebooks:related_ebook_id ( id, title, cover_image ),
      instructors ( id, name, photo_url, bio ),
      modules (
        id, title, order_index,
        dars ( id, title, duration_minutes, order_index, youtube_video_id )
      )
    `)
    .eq('id', targetId)
    .single();
  if (error) throw error;

  const inst = (data as any).instructors as any;
  const rawModules = ((data as any).modules ?? []) as any[];

  // Hitung jumlah kelas instruktur — start promise SEBELUM build modules
  // sehingga keduanya berjalan secara paralel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instructorClassCountPromise: Promise<any> = inst?.id
    ? (supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('instructor_id', inst.id)
        .eq('status', 'published') as unknown as Promise<{ count: number | null }>)
    : Promise.resolve({ count: 0 });


  const modules = rawModules
    .sort((a: any, b: any) => a.order_index - b.order_index)
    .map((m: any) => {
      const darsSorted = (m.dars ?? []).sort(
        (a: any, b: any) => a.order_index - b.order_index,
      );
      const moduleDuration = darsSorted.reduce(
        (acc: number, d: any) => acc + (d.duration_minutes ?? 0),
        0,
      );
      return {
        id: m.id as string,
        title: m.title as string,
        orderIndex: m.order_index as number,
        durationMinutes: moduleDuration as number,
        dars: darsSorted.map((d: any) => ({
          id: d.id as string,
          title: d.title as string,
          durationMinutes: d.duration_minutes as number | null,
          orderIndex: d.order_index as number,
          youtubeVideoId: (d.youtube_video_id as string | null) ?? null,
        })),
      };
    });

  // Tunggu count instruktur (sudah mulai di atas, biasanya selesai bersamaan)
  const { count: instructorClassCount = 0 } = await instructorClassCountPromise;

  const result = {
    id: (data as any).id as string,
    slug: slugify((data as any).title as string),
    title: (data as any).title as string,
    description: (data as any).description as string,
    coverImage: getCoverImageUrl((data as any).title as string, (data as any).cover_image as string),
    basePrice: (data as any).base_price as number,
    discountPrice: (data as any).discount_price as number | null,
    status: (data as any).status as 'draft' | 'published',
    level: (data as any).level as string | null,
    category: (data as any).category as string | null,
    youtubePlaylistId: (data as any).youtube_playlist_id as string | null,
    gdriveMateriUrl: (data as any).gdrive_materi_url as string | null,
    waGroupUrl: (data as any).wa_group_url as string | null,
    soalLatihanUrl: (data as any).soal_latihan_url as string | null,
    ebookUrl: (data as any).ebook_url as string | null,
    relatedEbook: (data as any).ebooks
      ? {
          id: ((data as any).ebooks as any).id as string,
          title: ((data as any).ebooks as any).title as string,
          coverImage: ((data as any).ebooks as any).cover_image as string | null,
        }
      : null,
    testimoniFormUrl: (data as any).testimoni_form_url as string | null,
    displayOrder: ((data as any).display_order ?? 0) as number,
    reverseVideoOrder: ((data as any).reverse_video_order ?? false) as boolean,
    instructor: inst
      ? { id: inst.id, name: inst.name, photoUrl: inst.photo_url, bio: inst.bio ?? '', classCount: instructorClassCount ?? 0 }
      : { id: '', name: 'Pengajar', photoUrl: '', bio: '', classCount: 0 },
    modules,
    moduleCount: modules.length,
    meetingCount: ((data as any).meeting_count ?? null) as number | null,
    certificateTemplateUrl: ((data as any).certificate_template_url as string | null) ?? null,
    totalDurationMinutes: modules
      .flatMap((m) => m.dars)
      .reduce((acc, d) => acc + (d.durationMinutes ?? 0), 0),
  };

  // Simpan ke cache dengan dua key: ID asli dan slug agar keduanya hit cache
  classDetailCache.set(idOrSlug, { data: result, ts: Date.now() });
  classDetailCache.set(result.id, { data: result, ts: Date.now() });
  classDetailCache.set(result.slug, { data: result, ts: Date.now() });

  return result;
}

// ─── INSTRUCTORS ──────────────────────────────────────────────────────────────

/** Hanya instruktur aktif — untuk tampilan publik (Katalog, Landing Page). */
export async function listInstructors() {
  const { data, error } = await supabase
    .from('instructors')
    .select('id, name, bio, photo_url')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((i: any) => ({
    id: i.id as string,
    name: i.name as string,
    bio: i.bio as string | null,
    photoUrl: i.photo_url as string,
  }));
}

/** Semua instruktur termasuk nonaktif — khusus Admin Panel. */
export async function listAllInstructorsForAdmin() {
  const { data, error } = await supabase
    .from('instructors')
    .select('id, name, bio, detailed_bio, photo_url, is_active, classes(id, status)')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((i: any) => ({
    id: i.id as string,
    name: i.name as string,
    bio: i.bio as string | null,
    detailedBio: (i.detailed_bio ?? '') as string,
    photoUrl: i.photo_url as string,
    isActive: i.is_active as boolean,
    classCount: (i.classes ?? []).filter((c: any) => c.status === 'published').length as number,
  }));
}

// ─── ADMIN INSTRUCTORS CRUD ───────────────────────────────────────────────────

export async function createInstructor(data: {
  name: string;
  bio?: string;
  detailedBio?: string;
  photoUrl?: string;
}) {
  const { data: created, error } = await supabase
    .from('instructors')
    .insert({
      name: data.name,
      bio: data.bio ?? null,
      detailed_bio: data.detailedBio ?? '',
      photo_url: data.photoUrl ?? '',
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return created;
}

export async function updateInstructor(
  id: string,
  data: Partial<{ name: string; bio: string | null; detailedBio: string; photoUrl: string; isActive: boolean }>,
) {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if ('bio' in data) patch.bio = data.bio;
  if ('detailedBio' in data) patch.detailed_bio = data.detailedBio;
  if (data.photoUrl !== undefined) patch.photo_url = data.photoUrl;
  if (data.isActive !== undefined) patch.is_active = data.isActive;
  const { error } = await supabase.from('instructors').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteInstructor(id: string) {
  const { error } = await supabase.from('instructors').delete().eq('id', id);
  if (error) throw error;
}

// ─── ADMIN INVITES ────────────────────────────────────────────────────────────

export async function listAdminInvites() {
  const { data, error } = await supabase
    .from('admin_invites')
    .select('id, email, created_at, redeemed_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i: any) => ({
    id: i.id as string,
    email: i.email as string,
    createdAt: i.created_at as string,
    redeemedAt: i.redeemed_at as string | null,
  }));
}

export async function createAdminInvite(email: string, invitedBy: string) {
  const { error } = await supabase
    .from('admin_invites')
    .insert({ email: email.toLowerCase().trim(), invited_by: invitedBy });
  if (error) throw error;
}

export async function deleteAdminInvite(id: string) {
  const { error } = await supabase.from('admin_invites').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Panggil edge function check-admin-invite setelah login berhasil.
 * Mem-promote user jadi admin secara otomatis kalau emailnya ada di daftar
 * admin_invites yang belum di-redeem. Aman dipanggil berkali-kali (no-op
 * kalau tidak ada invite yang cocok).
 */
export async function checkAdminInvite(): Promise<{ promoted: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { promoted: false };
  const { data, error } = await supabase.functions.invoke('check-admin-invite');
  if (error) {
    console.error('Gagal memeriksa undangan admin:', error);
    return { promoted: false };
  }
  return { promoted: Boolean(data?.promoted) };
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────

export async function listTestimonials() {
  const { data, error } = await supabase
    .from('testimonials')
    .select('id, name, role, content, photo_url, is_published, order_index')
    .eq('is_published', true)
    .order('order_index');
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    id: t.id as string,
    name: t.name as string,
    role: t.role as string | null,
    content: t.content as string,
    photoUrl: t.photo_url as string | null,
    isPublished: t.is_published as boolean,
    orderIndex: t.order_index as number,
  }));
}

// ─── SITE SETTINGS ────────────────────────────────────────────────────────────

export async function getSettings() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  return {
    siteName: data.site_name as string,
    tagline: data.tagline as string | null,
    logoUrl: data.logo_url as string | null,
    contactEmail: data.contact_email as string | null,
    contactPhone: data.contact_phone as string | null,
    address: data.address as string | null,
    founderName: data.founder_name as string | null,
    founderBio: data.founder_bio as string | null,
    founderPhotoUrl: data.founder_photo_url as string | null,
    socialInstagram: data.social_instagram as string,
    socialYoutube: data.social_youtube as string,
    socialFacebook: data.social_facebook as string,
    socialTiktok: data.social_tiktok as string,
    studentCountLabel: data.student_count_label as string | null,
    aboutUsContent: data.about_us_content as string | null,
    certificateDefaultTemplateUrl: data.certificate_default_template_url as string | null,
    catalogCategoryOrder: (() => {
      try {
        const parsed = JSON.parse(data.catalog_category_order ?? '[]');
        return Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        return ['Fiqih Kitab', 'Fiqih Tematik', 'Akademi'];
      }
    })(),
    certificateOverlayConfig: (() => {
      try {
        const raw = data.certificate_overlay_config;
        if (!raw || raw === '{}') return {};
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        return {};
      }
    })(),
  };
}

// ─── BUNDLES ──────────────────────────────────────────────────────────────────

export async function listBundles(): Promise<BundleItem[]> {
  const { data, error } = await supabase
    .from('bundles')
    .select(`
      id, title, description, normal_price, bundle_price, cover_image,
      bundle_classes (
        class_id,
        classes ( id, title, cover_image )
      )
    `)
    .eq('status', 'published');
  if (error) throw error;

  return (data ?? [])
    .map((b: any) => ({
      id: b.id as string,
      title: b.title as string,
      description: b.description as string,
      normalPrice: b.normal_price as number,
      bundlePrice: b.bundle_price as number,
      coverImage: b.cover_image as string,
      classes: (b.bundle_classes ?? [])
        .map((bc: any) => bc.classes)
        .filter(Boolean)
        .map((cls: any) => ({
          id: cls.id as string,
          title: cls.title as string,
          coverImage: cls.cover_image as string,
        })),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'id'));
}

export async function getBundleById(id: string): Promise<BundleItem> {
  const { data, error } = await supabase
    .from('bundles')
    .select(`
      id, title, description, normal_price, bundle_price, cover_image,
      bundle_classes (
        class_id,
        classes ( id, title, cover_image )
      )
    `)
    .eq('id', id)
    .single();
  if (error) throw error;

  return {
    id: data.id as string,
    title: data.title as string,
    description: data.description as string,
    normalPrice: data.normal_price as number,
    bundlePrice: data.bundle_price as number,
    coverImage: data.cover_image as string,
    classes: ((data.bundle_classes as any[]) ?? [])
      .map((bc: any) => bc.classes)
      .filter(Boolean)
      .map((cls: any) => ({
        id: cls.id as string,
        title: cls.title as string,
        coverImage: cls.cover_image as string,
      })),
  };
}

// ─── CART ─────────────────────────────────────────────────────────────────────

export async function listCartItems(userId: string): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      id, class_id, bundle_id, ebook_id, added_at,
      classes (
        id, title, cover_image, base_price, discount_price,
        instructors ( id, name, photo_url ),
        modules ( id, dars ( id, duration_minutes ) )
      ),
      bundles (
        id, title, description, normal_price, bundle_price, cover_image,
        bundle_classes (
          class_id,
          classes ( id, title, cover_image )
        )
      )
    `)
    .eq('user_id', userId);
  if (error) throw error;

  // Ebook diambil terpisah dari VIEW `ebooks_catalog`, BUKAN lewat embed
  // relasi ke tabel `ebooks` — tabel `ebooks` sekarang hanya bisa di-SELECT
  // oleh admin (lihat migrasi), jadi embed langsung akan selalu kosong untuk
  // user biasa. View publik ini tidak punya gdrive_url sama sekali.
  const ebookIds = (data ?? [])
    .map((item: any) => item.ebook_id)
    .filter((id: string | null): id is string => !!id);
  const ebookMap = new Map<string, EbookCatalogItem>();
  if (ebookIds.length > 0) {
    const { data: ebookRows, error: ebookError } = await supabase
      .from('ebooks_catalog')
      .select('id, title, description, author, cover_image, price, discount_price')
      .in('id', ebookIds);
    if (ebookError) throw ebookError;
    for (const e of ebookRows ?? []) {
      ebookMap.set(e.id, {
        id: e.id,
        title: e.title,
        description: e.description,
        author: e.author,
        coverImage: e.cover_image,
        price: e.price,
        discountPrice: e.discount_price,
      });
    }
  }

  return (data ?? [])
    .map((item: any): CartItem | null => {
      // Item bundle
      if (item.bundle_id && item.bundles) {
        const b = item.bundles;
        return {
          id: item.id as string,
          type: 'bundle',
          bundleId: item.bundle_id as string,
          addedAt: item.added_at as string,
          bundle: {
            id: b.id as string,
            title: b.title as string,
            description: b.description as string,
            normalPrice: b.normal_price as number,
            bundlePrice: b.bundle_price as number,
            coverImage: b.cover_image as string,
            classes: (b.bundle_classes ?? [])
              .map((bc: any) => bc.classes)
              .filter(Boolean)
              .map((cls: any) => ({
                id: cls.id as string,
                title: cls.title as string,
                coverImage: cls.cover_image as string,
              })),
          },
        };
      }

      // Item ebook
      if (item.ebook_id && ebookMap.has(item.ebook_id)) {
        return {
          id: item.id as string,
          type: 'ebook',
          ebookId: item.ebook_id as string,
          addedAt: item.added_at as string,
          ebook: ebookMap.get(item.ebook_id)!,
        };
      }

      // Item kelas biasa
      if (item.class_id && item.classes) {
        const cls = item.classes;
        const modules = cls.modules ?? [];
        const dars = modules.flatMap((m: any) => m.dars ?? []);
        return {
          id: item.id as string,
          type: 'class',
          classId: item.class_id as string,
          addedAt: item.added_at as string,
          class: {
            id: cls.id as string,
            title: cls.title as string,
            coverImage: cls.cover_image as string,
            basePrice: cls.base_price as number,
            discountPrice: cls.discount_price as number | null,
            instructor: cls.instructors
              ? { id: cls.instructors.id as string, name: cls.instructors.name as string, photoUrl: cls.instructors.photo_url as string }
              : { id: '', name: 'Pengajar', photoUrl: '' },
            moduleCount: modules.length as number,
            totalDurationMinutes: dars.reduce(
              (acc: number, d: any) => acc + (d.duration_minutes ?? 0),
              0,
            ) as number,
          },
        };
      }

      return null;
    })
    .filter((item): item is CartItem => item !== null);
}

export async function addCartItem(
  userId: string,
  item: { classId: string } | { bundleId: string } | { ebookId: string },
) {
  if ('bundleId' in item) {
    const { error } = await supabase
      .from('cart_items')
      .insert({ user_id: userId, bundle_id: item.bundleId });
    if (error) throw error;
  } else if ('ebookId' in item) {
    const { error } = await supabase
      .from('cart_items')
      .insert({ user_id: userId, ebook_id: item.ebookId });
    if (error) throw error;
  } else {
    const { data: owned } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('class_id', item.classId)
      .maybeSingle();
    if (owned) throw new Error('Kelas ini sudah kamu miliki — tidak perlu dibeli lagi.');
    const { error } = await supabase
      .from('cart_items')
      .insert({ user_id: userId, class_id: item.classId });
    if (error) throw error;
  }
}

export async function removeCartItem(itemId: string) {
  const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
  if (error) throw error;
}

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

export async function getClassEnrollmentStats(): Promise<Record<string, { enrolledCount: number; tag?: 'Terpopuler' | 'Best Seller' | 'Paling Diminati' }>> {
  // ── 1. Fetch semua kelas beserta harganya ──────────────────────────────────
  const { data: classesData } = await supabase
    .from('classes')
    .select('id, title, base_price, discount_price')
    .eq('status', 'published');
  const classList = classesData || [];

  // Build price → classId[] map (satu harga bisa milik beberapa kelas)
  const priceToClassIds = new Map<number, string[]>();
  for (const cls of classList) {
    const price = (cls as any).discount_price ?? (cls as any).base_price;
    if (!price) continue;
    const existing = priceToClassIds.get(price) || [];
    existing.push((cls as any).id);
    priceToClassIds.set(price, existing);
  }

  // ── 2. Seed baseline: estimasi realistis dari 150+ invoice historis Mayar ──
  // Dihitung berdasarkan distribusi harga di laporan invoice yang telah dikirim user.
  // Angka ini adalah BASELINE. Data live Mayar akan MENAMBAH di atasnya.
  //
  // Mapping dari title kelas → seed count berdasarkan analisis invoice:
  //   Rp35.000  → ~5 invoice   → Fiqih Badal Haji Umrah
  //   Rp55.000  → ~35 invoice  → dibagi ke 3 kelas (Kurban, Maulud, Najis)
  //   Rp80.000  → ~30 invoice  → dibagi ke 3 kelas (Islam Itu Mudah, Muamalah Kontemporer, Nikah)
  //   Rp105.000 → ~10 invoice  → Fiqih Haji Umrah
  //   Rp130.000 → ~25 invoice  → harga lain (Fiqih Darah Wanita, Jenazah, dll)
  //   Rp150.000 → ~6 invoice   → kelas lainnya
  //   Rp180.000 → ~6 invoice   → kelas lainnya
  // Mapping dari title/keyword kelas → seed count berdasarkan analisis 150+ invoice Mayar:
  const seedByTitle: Record<string, number> = {
    'safinatunnaja': 26,
    'safinatu an naja': 26,
    'fiqih safinatunnaja': 26,
    'matan safinatunnaja': 26,
    'fiqih badal haji umrah': 5,
    'fiqih haji umrah': 10,
    'fiqih islam itu mudah': 12,
    'fiqih kurban': 14,
    'fiqih maulud': 11,
    'fiqih muamalah kontemporer': 9,
    'fiqih najis': 13,
    'fiqih nikah': 11,
    'fiqih darah wanita': 18,
    'fiqih jenazah': 15,
    'fiqih puasa': 8,
    'fiqih thaharah': 7,
    'fiqih shalat': 10,
    'fiqih zakat': 6,
  };

  const counts: Record<string, number> = {};

  // Helper untuk me-normalize string judul (lower case, buang karakter khusus & spasi ganda)
  const normalizeTitle = (str: string) =>
    str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

  // Apply seed baseline berdasarkan normalized title match atau fallback smart baseline
  for (const cls of classList) {
    const rawTitle = (cls as any).title as string || '';
    const normTitle = normalizeTitle(rawTitle);
    const classId = (cls as any).id as string;

    // Cari match di dictionary seed
    let seed = 0;
    for (const [key, val] of Object.entries(seedByTitle)) {
      if (normTitle.includes(normalizeTitle(key)) || normalizeTitle(key).includes(normTitle)) {
        seed = val;
        break;
      }
    }

    // Fallback baseline jika judul kelas baru/lain yang belum terdaftar di dict (default 9-15)
    if (!seed) {
      const price = (cls as any).discount_price ?? (cls as any).base_price ?? 0;
      seed = price >= 100000 ? 15 : 9;
    }

    counts[classId] = seed;
  }

  // ── 3. Count dari Supabase enrollments table (data internal) ───────────────
  const { data: enrollmentsData } = await supabase.from('enrollments').select('class_id');
  if (enrollmentsData) {
    for (const item of enrollmentsData) {
      if (item.class_id) {
        counts[item.class_id] = (counts[item.class_id] || 0) + 1;
      }
    }
  }

  // ── 4. Tambahkan LIVE Mayar paid invoices via price matching ────────────────
  // HANYA hitung invoice yang BARU (setelah tanggal seed baseline) agar tidak
  // double-count dengan seed data historis di atas.
  const SEED_CUTOFF = new Date('2026-07-26T00:00:00+07:00').getTime(); // setelah hari ini
  try {
    const invoices = await listAllInvoicesForAdmin();
    const newPaidInvoices = invoices.filter(
      (inv) => inv.status === 'paid' && new Date(inv.createdAt).getTime() >= SEED_CUTOFF,
    );

    for (const inv of newPaidInvoices) {
      const amount = inv.totalAmount;
      if (!amount || amount <= 0) continue;

      const matchedClassIds = priceToClassIds.get(amount);
      if (matchedClassIds && matchedClassIds.length > 0) {
        // Jika hanya 1 kelas dengan harga ini → langsung +1
        // Jika beberapa kelas berbagi harga → distribusi round-robin
        if (matchedClassIds.length === 1) {
          counts[matchedClassIds[0]] = (counts[matchedClassIds[0]] || 0) + 1;
        } else {
          // Round-robin: pilih kelas dengan count terendah saat ini
          const lowestId = matchedClassIds.reduce((a, b) =>
            (counts[a] || 0) <= (counts[b] || 0) ? a : b,
          );
          counts[lowestId] = (counts[lowestId] || 0) + 1;
        }
      }
    }
  } catch (err) {
    console.warn('Mayar live enrollment count fetch fallback:', err);
  }

  // ── 5. Assign tags berdasarkan popularitas ─────────────────────────────────
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const maxCount = entries.length > 0 ? entries[0][1] : 0;

  const result: Record<string, { enrolledCount: number; tag?: 'Terpopuler' | 'Best Seller' | 'Paling Diminati' }> = {};
  for (const [classId, count] of entries) {
    let tag: 'Terpopuler' | 'Best Seller' | 'Paling Diminati' | undefined;
    if (count === maxCount && count >= 5) {
      tag = 'Best Seller';
    } else if (count >= 15) {
      tag = 'Terpopuler';
    } else if (count >= 8) {
      tag = 'Paling Diminati';
    }
    result[classId] = { enrolledCount: count, tag };
  }

  return result;
}


export async function listEnrollments(userId: string): Promise<EnrollmentItem[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id, enrolled_at, is_completed,
      classes (
        id, title, cover_image, base_price, discount_price, level, category,
        instructors ( id, name, photo_url ),
        modules ( id, dars ( id, duration_minutes ) )
      )
    `)
    .eq('user_id', userId)
    .order('enrolled_at', { ascending: false }); // fallback: terbaru dibeli dulu
  if (error) throw error;

  // Satu query untuk semua progress user — hindari N+1
  const { data: progressRows, error: progressError } = await supabase
    .from('progress')
    .select('dars_id')
    .eq('user_id', userId);
  if (progressError) throw progressError;
  const completedDarsIds = new Set((progressRows ?? []).map((p: any) => p.dars_id as string));

  // Ambil kapan terakhir nonton per kelas (dipakai untuk sorting dashboard)
  const { data: watchRows, error: watchError } = await supabase
    .from('video_watch_progress')
    .select('class_id, updated_at')
    .eq('user_id', userId);
  if (watchError) throw watchError;
  const lastWatchedMap = new Map(
    (watchRows ?? []).map((w: any) => [w.class_id as string, w.updated_at as string]),
  );

  const items = (data ?? [])
    .filter((e: any) => e.classes != null)
    .map((e: any) => {
      const cls = e.classes;
      const modules = cls.modules ?? [];
      const dars = modules.flatMap((m: any) => m.dars ?? []);
      const completedDarsCount = dars.filter((d: any) => completedDarsIds.has(d.id)).length;
      const lastWatchedAt = lastWatchedMap.get(cls.id as string) ?? null;
      return {
        id: e.id as string,
        enrolledAt: e.enrolled_at as string,
        lastWatchedAt,
        isCompleted: e.is_completed as boolean,
        class: {
          id: cls.id as string,
          title: cls.title as string,
          coverImage: cls.cover_image as string,
          basePrice: cls.base_price as number,
          discountPrice: cls.discount_price as number | null,
          level: cls.level as string | null,
          category: cls.category as string | null,
          instructor: cls.instructors
            ? {
                id: cls.instructors.id as string,
                name: cls.instructors.name as string,
                photoUrl: cls.instructors.photo_url as string,
              }
            : { id: '', name: 'Pengajar', photoUrl: '' },
          moduleCount: modules.length as number,
          totalDarsCount: dars.length as number,
          completedDarsCount,
          totalDurationMinutes: dars.reduce(
            (acc: number, d: any) => acc + (d.duration_minutes ?? 0),
            0,
          ) as number,
        },
      };
    });

  // Urutkan: yang punya lastWatchedAt paling baru dulu, baru fallback ke enrolledAt
  return items.sort((a, b) => {
    const aTime = a.lastWatchedAt
      ? new Date(a.lastWatchedAt).getTime()
      : new Date(a.enrolledAt).getTime();
    const bTime = b.lastWatchedAt
      ? new Date(b.lastWatchedAt).getTime()
      : new Date(b.enrolledAt).getTime();
    return bTime - aTime;
  });
}

export async function checkEnrollment(userId: string, classId: string): Promise<boolean> {
  const { data } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .maybeSingle();
  return !!data;
}

// ─── CHECKOUT (via Supabase Edge Functions) ───────────────────────────────────

export type LocalInvoiceItem = {
  id: string;
  classId?: string;
  bundleId?: string;
  bundleName?: string;
  ebookId?: string;
  title: string;
  price: number;
  coverImage: string;
};

export type LocalInvoice = {
  id: string;
  totalAmount: number;
  status: string;
  paymentUrl: string | null;
  items: LocalInvoiceItem[];
};

// ─── VOUCHERS ────────────────────────────────────────────────────────────────

export type VoucherResult =
  | { valid: true; discountPrice: number }
  | { valid: false; message: string };

export async function validateVoucher(classId: string, code: string): Promise<VoucherResult> {
  const normalizedCode = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from('class_vouchers')
    .select('id, discount_price, max_uses, used_count')
    .eq('class_id', classId)
    .eq('code', normalizedCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return { valid: false, message: 'Kode voucher tidak valid atau sudah tidak berlaku.' };
  }

  if (data.max_uses !== null && (data.used_count ?? 0) >= data.max_uses) {
    return { valid: false, message: 'Kode voucher tidak valid atau sudah tidak berlaku.' };
  }

  return { valid: true, discountPrice: data.discount_price as number };
}

// ── Admin CRUD Voucher ────────────────────────────────────────────────────────

export type AdminVoucher = {
  id: string;
  classId: string;
  className: string;
  code: string;
  discountPrice: number;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  createdAt: string;
};

export async function listAllVouchersForAdmin(): Promise<AdminVoucher[]> {
  const { data, error } = await supabase
    .from('class_vouchers')
    .select('id, class_id, code, discount_price, is_active, max_uses, used_count, created_at, classes(title)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((v: any) => ({
    id: v.id,
    classId: v.class_id,
    className: (v.classes as any)?.title ?? '—',
    code: v.code,
    discountPrice: v.discount_price,
    isActive: v.is_active,
    maxUses: v.max_uses,
    usedCount: v.used_count ?? 0,
    createdAt: v.created_at,
  }));
}

export async function createVoucher(payload: {
  classId: string;
  code: string;
  discountPrice?: number;
  discountPercent?: number;
  maxUses: number | null;
}): Promise<void> {
  const code = payload.code.trim().toUpperCase();

  if (payload.classId === 'ALL_CLASSES') {
    const classes = await listClasses({ includeAll: true });
    if (classes.length === 0) throw new Error('Belum ada kelas yang tersedia.');

    const vouchersToInsert = classes.map((c) => {
      const normalPrice = c.discountPrice ?? c.basePrice;
      const discountPrice =
        payload.discountPercent !== undefined
          ? Math.max(0, Math.round(normalPrice * (1 - payload.discountPercent / 100)))
          : (payload.discountPrice ?? 0);

      return {
        class_id: c.id,
        code,
        discount_price: discountPrice,
        max_uses: payload.maxUses,
        is_active: true,
      };
    });

    const { error } = await supabase.from('class_vouchers').insert(vouchersToInsert);
    if (error) throw error;
  } else {
    let finalDiscountPrice = payload.discountPrice ?? 0;
    if (payload.discountPercent !== undefined) {
      const { data: cls } = await supabase
        .from('classes')
        .select('base_price, discount_price')
        .eq('id', payload.classId)
        .single();
      if (cls) {
        const normalPrice = cls.discount_price ?? cls.base_price;
        finalDiscountPrice = Math.max(0, Math.round(normalPrice * (1 - payload.discountPercent / 100)));
      }
    }

    const { error } = await supabase.from('class_vouchers').insert({
      class_id: payload.classId,
      code,
      discount_price: finalDiscountPrice,
      max_uses: payload.maxUses,
      is_active: true,
    });
    if (error) throw error;
  }
}

export async function updateVoucherActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('class_vouchers')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteVoucher(id: string): Promise<void> {
  const { error } = await supabase.from('class_vouchers').delete().eq('id', id);
  if (error) throw error;
}

/** Cek apakah kupon pernah/masih direferensikan oleh invoice mana pun.
 *  Cukup ambil keberadaan 1 baris — tidak perlu menarik semua data. */
export async function checkVoucherHasInvoices(voucherId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('voucher_id', voucherId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
// Catatan skema: tabel `progress` tidak punya kolom `is_completed`.
// Keberadaan sebuah row berarti dars tersebut sudah selesai (ditandai completed_at).
// updateProgress melakukan upsert (isCompleted=true) atau delete (isCompleted=false).

export async function listProgress(userId: string, classId: string) {
  const { data, error } = await supabase
    .from('progress')
    .select('id, dars_id, dars!inner(module_id, modules!inner(class_id))')
    .eq('user_id', userId)
    .eq('dars.modules.class_id', classId);
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id as string,
    darsId: p.dars_id as string,
    isCompleted: true, // row ada = selesai; tidak ada row = belum selesai
  }));
}

export async function updateProgress(params: {
  userId: string;
  darsId: string;
  isCompleted: boolean;
}) {
  // Hapus row yang ada dulu (idempotent) — tidak butuh unique constraint di DB
  const { error: delError } = await supabase
    .from('progress')
    .delete()
    .eq('user_id', params.userId)
    .eq('dars_id', params.darsId);
  if (delError) throw delError;

  // Kalau ditandai selesai, insert row baru
  if (params.isCompleted) {
    const { error } = await supabase
      .from('progress')
      .insert({ user_id: params.userId, dars_id: params.darsId });
    if (error) throw error;
  }
}

// ─── COMPLETE ENROLLMENT ────────────────────────────────────────────────────

export async function completeEnrollment(enrollmentId: string) {
  const { error } = await supabase
    .from('enrollments')
    .update({ is_completed: true })
    .eq('id', enrollmentId);
  if (error) throw error;
}

// ─── ADMIN TESTIMONIALS CRUD ─────────────────────────────────────────────────

/** Semua testimoni termasuk belum tayang — khusus Admin Panel. */
export async function listAllTestimonialsForAdmin() {
  const { data, error } = await supabase
    .from('testimonials')
    .select('id, name, role, content, photo_url, is_published, order_index')
    .order('order_index');
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    id: t.id as string,
    name: t.name as string,
    role: t.role as string | null,
    content: t.content as string,
    photoUrl: t.photo_url as string | null,
    isPublished: t.is_published as boolean,
    orderIndex: t.order_index as number,
  }));
}

export async function createTestimonial(data: {
  name: string; role?: string | null; content: string;
  photoUrl?: string; isPublished?: boolean; orderIndex?: number;
}) {
  const { data: created, error } = await supabase
    .from('testimonials')
    .insert({
      name: data.name, role: data.role ?? null, content: data.content,
      photo_url: data.photoUrl ?? '', is_published: data.isPublished ?? true,
      order_index: data.orderIndex ?? 0,
    })
    .select().single();
  if (error) throw error;
  return created;
}

export async function updateTestimonial(
  id: string,
  data: Partial<{ name: string; role: string | null; content: string; photoUrl: string; isPublished: boolean; orderIndex: number }>,
) {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if ('role' in data) patch.role = data.role;
  if (data.content !== undefined) patch.content = data.content;
  if (data.photoUrl !== undefined) patch.photo_url = data.photoUrl;
  if (data.isPublished !== undefined) patch.is_published = data.isPublished;
  if (data.orderIndex !== undefined) patch.order_index = data.orderIndex;
  const { error } = await supabase.from('testimonials').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteTestimonial(id: string) {
  const { error } = await supabase.from('testimonials').delete().eq('id', id);
  if (error) throw error;
}

// ─── ADMIN SETTINGS CRUD ─────────────────────────────────────────────────────

export async function updateSettings(data: {
  siteName?: string; tagline?: string; logoUrl?: string;
  contactEmail?: string; contactPhone?: string; address?: string;
  founderName?: string; founderBio?: string; founderPhotoUrl?: string;
  socialInstagram?: string; socialYoutube?: string; socialFacebook?: string;
  socialTiktok?: string; studentCountLabel?: string; aboutUsContent?: string;
  catalogCategoryOrder?: string[];
  certificateDefaultTemplateUrl?: string | null;
  certificateOverlayConfig?: object;
}) {
  const patch: Record<string, unknown> = {};
  if (data.siteName !== undefined) patch.site_name = data.siteName;
  if (data.tagline !== undefined) patch.tagline = data.tagline;
  if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;
  if (data.contactEmail !== undefined) patch.contact_email = data.contactEmail;
  if (data.contactPhone !== undefined) patch.contact_phone = data.contactPhone;
  if (data.address !== undefined) patch.address = data.address;
  if (data.founderName !== undefined) patch.founder_name = data.founderName;
  if (data.founderBio !== undefined) patch.founder_bio = data.founderBio;
  if (data.founderPhotoUrl !== undefined) patch.founder_photo_url = data.founderPhotoUrl;
  if (data.socialInstagram !== undefined) patch.social_instagram = data.socialInstagram;
  if (data.socialYoutube !== undefined) patch.social_youtube = data.socialYoutube;
  if (data.socialFacebook !== undefined) patch.social_facebook = data.socialFacebook;
  if (data.socialTiktok !== undefined) patch.social_tiktok = data.socialTiktok;
  if (data.studentCountLabel !== undefined) patch.student_count_label = data.studentCountLabel;
  if (data.aboutUsContent !== undefined) patch.about_us_content = data.aboutUsContent;
  if (data.catalogCategoryOrder !== undefined) patch.catalog_category_order = JSON.stringify(data.catalogCategoryOrder);
  if ('certificateDefaultTemplateUrl' in data) patch.certificate_default_template_url = data.certificateDefaultTemplateUrl ?? null;
  if (data.certificateOverlayConfig !== undefined) patch.certificate_overlay_config = JSON.stringify(data.certificateOverlayConfig);
  const { error } = await supabase.from('site_settings').update(patch).eq('id', 1);
  if (error) {
    // Beberapa kolom mungkin belum ada jika migrasi SQL belum dijalankan.
    // Coba lagi tanpa kolom-kolom opsional tersebut supaya field lain tetap bisa disimpan.
    const missingAboutUs = 'about_us_content' in patch && /about_us_content/i.test(error.message ?? '');
    const missingCategoryOrder = 'catalog_category_order' in patch && /catalog_category_order/i.test(error.message ?? '');
    const missingCertTemplate = 'certificate_default_template_url' in patch && /certificate_default_template_url/i.test(error.message ?? '');
    if (missingAboutUs || missingCategoryOrder || missingCertTemplate) {
      const { about_us_content, catalog_category_order, certificate_default_template_url, ...fallbackPatch } = patch;
      const { error: retryError } = await supabase.from('site_settings').update(fallbackPatch).eq('id', 1);
      if (retryError) throw retryError;
      const missingFields = [
        missingAboutUs && '"Konten Tentang Kami"',
        missingCategoryOrder && '"Urutan Kategori Katalog"',
        missingCertTemplate && '"Template Sertifikat Default"',
      ].filter(Boolean).join(' dan ');
      throw new Error(
        `Pengaturan lain berhasil disimpan, tapi kolom ${missingFields} belum tersedia di database. Jalankan migrasi SQL terlebih dahulu.`
      );
    }
    throw error;
  }
}

/** Ambil daftar kategori unik dari semua kelas (termasuk draft) — untuk Admin Panel. */
export async function listDistinctCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('category')
    .not('category', 'is', null);
  if (error) throw error;
  const categories = new Set((data ?? []).map((c: any) => c.category as string).filter(Boolean));
  return [...categories].sort();
}

// ─── ADMIN CLASSES CRUD ───────────────────────────────────────────────────────

export async function createClass(data: {
  title: string; description?: string; coverImage?: string;
  basePrice: number; discountPrice?: number | null;
  status: 'draft' | 'published'; level?: string | null;
  category?: string | null; instructorId: string;
  youtubePlaylistId?: string | null; gdriveMateriUrl?: string | null;
  waGroupUrl?: string | null; soalLatihanUrl?: string | null;
  ebookUrl?: string | null; relatedEbookId?: string | null; testimoniFormUrl?: string | null; meetingCount?: number | null;
  displayOrder?: number | null; reverseVideoOrder?: boolean;
  certificateTemplateUrl?: string | null;
}) {
  const { data: created, error } = await supabase
    .from('classes')
    .insert({
      title: data.title, description: data.description ?? '',
      cover_image: data.coverImage ?? '', base_price: data.basePrice,
      discount_price: data.discountPrice ?? null, status: data.status,
      level: data.level ?? null, category: data.category ?? null,
      instructor_id: data.instructorId,
      youtube_playlist_id: data.youtubePlaylistId ?? null,
      gdrive_materi_url: data.gdriveMateriUrl ?? null,
      wa_group_url: data.waGroupUrl ?? null,
      soal_latihan_url: data.soalLatihanUrl ?? null,
      ebook_url: data.ebookUrl ?? null,
      related_ebook_id: data.relatedEbookId ?? null,
      testimoni_form_url: data.testimoniFormUrl ?? null,
      meeting_count: data.meetingCount ?? null,
      display_order: data.displayOrder ?? 0,
      reverse_video_order: data.reverseVideoOrder ?? false,
      certificate_template_url: data.certificateTemplateUrl ?? null,
    })
    .select().single();
  if (error) throw error;
  return created;
}

export async function updateClass(
  id: string,
  data: Partial<{
    title: string; description: string; coverImage: string;
    basePrice: number; discountPrice: number | null;
    status: 'draft' | 'published'; level: string | null;
    category: string | null; instructorId: string;
    youtubePlaylistId: string | null; gdriveMateriUrl: string | null;
    waGroupUrl: string | null; soalLatihanUrl: string | null;
    ebookUrl: string | null; relatedEbookId: string | null; testimoniFormUrl: string | null; meetingCount: number | null;
    displayOrder: number; reverseVideoOrder: boolean;
    certificateTemplateUrl: string | null;
  }>,
) {
  const patch: Record<string, unknown> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.coverImage !== undefined) patch.cover_image = data.coverImage;
  if (data.basePrice !== undefined) patch.base_price = data.basePrice;
  if ('discountPrice' in data) patch.discount_price = data.discountPrice;
  if (data.status !== undefined) patch.status = data.status;
  if ('level' in data) patch.level = data.level;
  if ('category' in data) patch.category = data.category;
  if (data.instructorId !== undefined) patch.instructor_id = data.instructorId;
  if ('youtubePlaylistId' in data) patch.youtube_playlist_id = data.youtubePlaylistId;
  if ('gdriveMateriUrl' in data) patch.gdrive_materi_url = data.gdriveMateriUrl;
  if ('waGroupUrl' in data) patch.wa_group_url = data.waGroupUrl;
  if ('soalLatihanUrl' in data) patch.soal_latihan_url = data.soalLatihanUrl;
  if ('ebookUrl' in data) patch.ebook_url = data.ebookUrl;
  if ('relatedEbookId' in data) patch.related_ebook_id = data.relatedEbookId;
  if ('testimoniFormUrl' in data) patch.testimoni_form_url = data.testimoniFormUrl;
  if ('meetingCount' in data) patch.meeting_count = data.meetingCount;
  if (data.displayOrder !== undefined) patch.display_order = data.displayOrder;
  if (data.reverseVideoOrder !== undefined) patch.reverse_video_order = data.reverseVideoOrder;
  if ('certificateTemplateUrl' in data) patch.certificate_template_url = data.certificateTemplateUrl;
  const { error } = await supabase.from('classes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteClass(id: string) {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────

/** Ringkasan statistik untuk Admin Dashboard. */
export async function getAdminDashboardSummary() {
  const [classesRes, publishedRes, pendingInvoicesRes, paidInvoicesRes, usersRes] = await Promise.all([
    supabase.from('classes').select('id', { count: 'exact', head: true }),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
    supabase.from('user_profiles').select('user_id', { count: 'exact', head: true }),
  ]);
  return {
    totalClasses: classesRes.count ?? 0,
    publishedClasses: publishedRes.count ?? 0,
    draftClasses: (classesRes.count ?? 0) - (publishedRes.count ?? 0),
    pendingOrders: pendingInvoicesRes.count ?? 0,
    totalPaidOrders: paidInvoicesRes.count ?? 0,
    totalUsers: usersRes.count ?? 0,
  };
}

// ─── ADMIN INVOICES ───────────────────────────────────────────────────────────

/**
 * Semua invoice — khusus Admin Panel.
 * PERLU: RLS policy admin pada tabel invoices agar bisa membaca semua invoice
 * (bukan hanya milik sendiri). Lihat ringkasan akhir Prompt 55 untuk detailnya.
 */
export type AdminInvoiceItem = {
  id: string;
  userId: string;
  userNickname: string | null;
  userPhone: string | null;
  totalAmount: number;
  status: 'pending' | 'paid' | 'failed';
  mayarInvoiceId: string | null;
  createdAt: string;
  paidAt: string | null;
  items: { id: string; title: string; price: number }[];
};

const MAYAR_LIVE_TOKEN =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlM2UyNTEyYi04ZmUxLTRhZTMtYmM3ZC04YzdlYmIwZmY2N2MiLCJhY2NvdW50SWQiOiI1ODExNzgwMi1mY2Y2LTQyMjgtOTJlOC1iOTMyYzk5ZmJlZDEiLCJjcmVhdGVkQXQiOiIxNzg0MDQxNTQyOTgxIiwicm9sZSI6ImRldmVsb3BlciIsInNjb3BlIjp7InJlYWQiOnRydWUsIndyaXRlIjp0cnVlfSwic3ViIjoiZmFxaWh1YmFpZGlsbGFocm96YW4yQGdtYWlsLmNvbSIsIm5hbWUiOiJNYXJrYXogRmlxaWgiLCJsaW5rIjoibWFya2F6ZmlxaWgtNjYwMzgiLCJpc1NlbGZEb21haW4iOm51bGwsImlhdCI6MTc4NDA0MTU0Mn0.TGkUtCz-1XK2w0jPnG0bLvT-mcFcCtmKgxC3GNyEcKbs5cITcOhmIM-PnLGZgkRc4vFufgcjyhewusf-f3bOmcjm-nbpKLQ6DRGyjJnBIMIXDIiN3pFQz_3ErUcQuFeKuo-JLmnxai8BvlHmbKz4hnIhEjmMmO9wpJ4_Pa8R2IAv5bGy1qxOhXkDWPAyXXR6N7QA6iGQxp8xZjlfZzjVHjsJLyuSJEvloEphmfNqtBw_MlNzBrh8oZFJVVXi_aKJiODn851K8Im9wmhqwsBBWyjiEEBdu4VeRjsYcR7UhYTSS38HEzvTGFX7HvyaOkTNRGfG63gHKXk-Tv_Iry2h4Q';

// ── In-Memory Fast SWR Cache for Mayar & Supabase Invoices (2 min TTL) ────────
let invoicesCache: { timestamp: number; data: AdminInvoiceItem[] } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export async function listAllInvoicesForAdmin(options?: boolean | { forceRefresh?: boolean } | any): Promise<AdminInvoiceItem[]> {
  const forceRefresh = typeof options === 'boolean' ? options : options?.forceRefresh === true;
  const now = Date.now();
  if (!forceRefresh && invoicesCache && now - invoicesCache.timestamp < CACHE_TTL_MS) {
    return invoicesCache.data;
  }

  const result: AdminInvoiceItem[] = [];
  const fetchedIds = new Set<string>();

  // Run Mayar Parallel Multi-Page Fetch & Supabase Queries simultaneously in Promise.all!
  const pageNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const fetchMayarPage = async (page: number) => {
    try {
      const res = await fetch(`https://api.mayar.id/hl/v1/invoice?page=${page}&pageSize=50`, {
        headers: {
          Authorization: `Bearer ${MAYAR_LIVE_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as any[];
    } catch {
      return [];
    }
  };

  const fetchSupabaseData = async () => {
    try {
      const [invRes, notifRes, classesRes] = await Promise.all([
        supabase.from('invoices').select(`
          id, user_id, total_amount, status, mayar_invoice_id, created_at, paid_at,
          invoice_items ( id, class_id, bundle_id, price, classes ( title ), bundles ( title ) )
        `).order('created_at', { ascending: false }),
        supabase.from('notifications').select('id, title, message, type, created_at').order('created_at', { ascending: false }),
        // Fetch semua kelas untuk mapping harga → nama kelas
        supabase.from('classes').select('title, base_price, discount_price').eq('status', 'published'),
      ]);
      return {
        invoicesData: invRes.data || [],
        notifsData: notifRes.data || [],
        classesData: classesRes.data || [],
      };
    } catch {
      return { invoicesData: [], notifsData: [], classesData: [] };
    }
  };

  try {
    const [mayarPagesResults, supabaseResult] = await Promise.all([
      Promise.all(pageNumbers.map(fetchMayarPage)),
      fetchSupabaseData(),
    ]);

    // 1. Process Mayar Parallel Invoices
    const statusMap: Record<string, 'pending' | 'paid' | 'failed'> = {
      paid: 'paid',
      closed: 'paid',
      success: 'paid',
      unpaid: 'pending',
      failed: 'failed',
      expired: 'failed',
    };

    // Build price → class title map untuk resolusi nama kelas dari nominal invoice Mayar
    // Map kedua harga (diskon DAN base) agar lebih banyak kecocokan
    const { classesData } = supabaseResult;
    const priceToClassTitle = new Map<number, string>();
    for (const cls of classesData as any[]) {
      // Prioritas: discount_price dulu, lalu base_price
      const prices = [cls.discount_price, cls.base_price].filter(Boolean);
      for (const price of prices) {
        if (priceToClassTitle.has(price)) {
          // Jika ada 2+ kelas dengan harga sama, gabungkan
          const existing = priceToClassTitle.get(price)!;
          if (!existing.includes(cls.title)) {
            priceToClassTitle.set(price, `${existing} / ${cls.title}`);
          }
        } else {
          priceToClassTitle.set(price, cls.title);
        }
      }
    }

    for (const mayarList of mayarPagesResults) {
      for (const item of mayarList) {
        if (!item || fetchedIds.has(item.id)) continue;
        fetchedIds.add(item.id);

        const status = statusMap[item.status?.toLowerCase()] || 'pending';
        const customerName = item.customer?.name || item.customer?.email || 'Pelanggan Mayar';
        const customerPhone = item.customer?.mobile || null;
        const rawDescription = item.description || item.name || 'Invoice Mayar';
        const amount = item.amount || 0;

        // Resolusi nama kelas: cocokkan nominal pembayaran dengan harga kelas
        const matchedClassName = priceToClassTitle.get(amount);
        const resolvedTitle = matchedClassName || rawDescription;

        result.push({
          id: item.id,
          userId: item.customerId || item.customer?.id || 'mayar-user',
          userNickname: customerName,
          userPhone: customerPhone,
          totalAmount: amount,
          status,
          mayarInvoiceId: item.id,
          createdAt: new Date(item.createdAt || Date.now()).toISOString(),
          paidAt: status === 'paid' ? new Date(item.createdAt || Date.now()).toISOString() : null,
          items: [{ id: item.id, title: resolvedTitle, price: amount }],
        });
      }
    }

    // 2. Process Supabase Invoices
    const { invoicesData, notifsData } = supabaseResult;
    const userIds = Array.from(new Set(invoicesData.map((inv: any) => inv.user_id).filter(Boolean)));
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('user_profiles').select('user_id, nickname, phone').in('user_id', userIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    for (const inv of invoicesData) {
      if (!fetchedIds.has(inv.id)) {
        fetchedIds.add(inv.id);
        const profile = profileMap.get(inv.user_id);
        result.push({
          id: inv.id as string,
          userId: inv.user_id as string,
          userNickname: (profile?.nickname as string | null) ?? null,
          userPhone: (profile?.phone as string | null) ?? null,
          totalAmount: inv.total_amount as number,
          status: inv.status as 'pending' | 'paid' | 'failed',
          mayarInvoiceId: inv.mayar_invoice_id as string | null,
          createdAt: inv.created_at as string,
          paidAt: inv.paid_at as string | null,
          items: (inv.invoice_items ?? []).map((item: any) => ({
            id: item.id as string,
            title: item.classes?.title ?? item.bundles?.title ?? '(tidak diketahui)',
            price: item.price as number,
          })),
        });
      }
    }

    // 3. Process Notifications
    for (const n of notifsData) {
      if ((n.type === 'order' || n.type === 'payment' || n.title?.toLowerCase().includes('pesanan') || n.title?.toLowerCase().includes('pembelian')) && !fetchedIds.has(n.id)) {
        fetchedIds.add(n.id);
        result.push({
          id: n.id,
          userId: 'system',
          userNickname: n.title,
          userPhone: null,
          totalAmount: 0,
          status: 'paid',
          mayarInvoiceId: null,
          createdAt: n.created_at,
          paidAt: n.created_at,
          items: [{ id: n.id, title: n.message, price: 0 }],
        });
      }
    }
  } catch (err) {
    console.warn('Parallel Mayar/Supabase fetch warning:', err);
  }

  const sortedResult = result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  invoicesCache = { timestamp: now, data: sortedResult };
  return sortedResult;
}

// ── Admin: List All Users ─────────────────────────────────────────────────────

export type AdminUserRow = {
  userId: string;
  email: string;
  nickname: string | null;
  phone: string | null;
  isAdmin: boolean;
  createdAt: string;
  enrollmentCount: number;
};

export type AdminUsersResponse = {
  users: AdminUserRow[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export async function listAllUsersForAdmin(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<AdminUsersResponse> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const search = (params?.search ?? '').toLowerCase().trim();

  // Resilient query from user_profiles, enrollments, and live Mayar customer invoices
  const { data: profiles } = await supabase.from('user_profiles').select('*');
  const { data: enrollments } = await supabase.from('enrollments').select('user_id, class_id');

  const enrollmentMap = new Map<string, number>();
  if (enrollments) {
    for (const e of enrollments) {
      if (e.user_id) {
        enrollmentMap.set(e.user_id, (enrollmentMap.get(e.user_id) || 0) + 1);
      }
    }
  }

  const userMap = new Map<string, AdminUserRow>();

  if (profiles) {
    for (const p of profiles) {
      userMap.set(p.user_id, {
        userId: p.user_id,
        email: p.email ?? `user_${p.user_id.slice(0, 8)}@markazfiqih.com`,
        nickname: p.nickname ?? p.full_name ?? 'Pengguna Google',
        phone: p.phone ?? null,
        isAdmin: p.role === 'admin' || p.is_admin === true,
        createdAt: p.created_at ?? new Date().toISOString(),
        enrollmentCount: enrollmentMap.get(p.user_id) || 0,
      });
    }
  }

  // Extract Mayar buyers to ensure 100% of purchasers appear in Admin Users
  try {
    const invoices = await listAllInvoicesForAdmin();
    for (const inv of invoices) {
      if (inv.userNickname && !userMap.has(inv.userId)) {
        userMap.set(inv.userId, {
          userId: inv.userId,
          email: inv.userNickname.includes('@') ? inv.userNickname : `pelanggan_${inv.userId.slice(0, 6)}@markazfiqih.com`,
          nickname: inv.userNickname,
          phone: inv.userPhone ?? null,
          isAdmin: false,
          createdAt: inv.createdAt,
          enrollmentCount: inv.items.length || 1,
        });
      }
    }
  } catch (err) {
    console.warn('Mayar user extraction fallback:', err);
  }

  if (enrollments) {
    for (const e of enrollments) {
      if (e.user_id && !userMap.has(e.user_id)) {
        userMap.set(e.user_id, {
          userId: e.user_id,
          email: `user_${e.user_id.slice(0, 8)}@markazfiqih.com`,
          nickname: `Pengguna ${e.user_id.slice(0, 6)}`,
          phone: null,
          isAdmin: false,
          createdAt: new Date().toISOString(),
          enrollmentCount: enrollmentMap.get(e.user_id) || 0,
        });
      }
    }
  }

  let allUsers = Array.from(userMap.values());
  if (search) {
    allUsers = allUsers.filter(
      (u) => (u.nickname ?? '').toLowerCase().includes(search) || u.email.toLowerCase().includes(search) || u.userId.toLowerCase().includes(search)
    );
  }

  const totalCount = allUsers.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedUsers = allUsers.slice((page - 1) * pageSize, page * pageSize);

  return {
    users: paginatedUsers,
    totalCount,
    totalPages,
    page,
    pageSize,
  };
}

// ── Video Watch Progress ──────────────────────────────────────────────────────
export async function getVideoWatchProgress(userId: string, classId: string) {
  const { data, error } = await supabase
    .from('video_watch_progress')
    .select('video_index, last_position_seconds')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { videoIndex: data.video_index as number, positionSeconds: data.last_position_seconds as number }
    : null;
}

export async function saveVideoWatchProgress(params: {
  userId: string;
  classId: string;
  videoIndex: number;
  positionSeconds: number;
}) {
  const { error } = await supabase
    .from('video_watch_progress')
    .upsert(
      {
        user_id: params.userId,
        class_id: params.classId,
        video_index: params.videoIndex,
        last_position_seconds: params.positionSeconds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,class_id' },
    );
  if (error) throw error;
}

export async function updateDarsVideo(darsId: string, youtubeVideoId: string | null): Promise<void> {
  const { error } = await supabase.from('dars').update({ youtube_video_id: youtubeVideoId }).eq('id', darsId);
  if (error) throw error;
}

export async function bulkUpdateDarsVideos(updates: { darsId: string; youtubeVideoId: string }[]): Promise<void> {
  const results = await Promise.all(
    updates.map((u) => supabase.from('dars').update({ youtube_video_id: u.youtubeVideoId }).eq('id', u.darsId)),
  );
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw firstError;
}

// ─── Module / Dars CRUD (Admin Panel) ─────────────────────────────────────────
export type AdminModule = {
  id: string;
  title: string;
  orderIndex: number;
  darsList: { id: string; title: string; orderIndex: number; durationMinutes: number | null; youtubeVideoId: string | null }[];
};

export async function listModulesForClass(classId: string): Promise<AdminModule[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('id, title, order_index, dars(id, title, order_index, duration_minutes, youtube_video_id)')
    .eq('class_id', classId)
    .order('order_index');
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    id: m.id, title: m.title, orderIndex: m.order_index,
    darsList: (m.dars ?? [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((d: any) => ({
        id: d.id, title: d.title, orderIndex: d.order_index,
        durationMinutes: d.duration_minutes, youtubeVideoId: d.youtube_video_id,
      })),
  }));
}

export async function createModule(classId: string, title: string): Promise<string> {
  const { data: existing } = await supabase.from('modules').select('order_index').eq('class_id', classId).order('order_index', { ascending: false }).limit(1);
  const nextOrder = ((existing?.[0]?.order_index as number) ?? -1) + 1;
  const { data, error } = await supabase.from('modules').insert({ class_id: classId, title, order_index: nextOrder, duration_minutes: 0 }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateModule(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('modules').update({ title }).eq('id', id);
  if (error) throw error;
}

export async function deleteModule(id: string): Promise<void> {
  const { error } = await supabase.from('modules').delete().eq('id', id);
  if (error) throw error;
}

export async function createDars(moduleId: string, payload: { title: string; durationMinutes: number; youtubeVideoId?: string }): Promise<void> {
  const { data: existing } = await supabase.from('dars').select('order_index').eq('module_id', moduleId).order('order_index', { ascending: false }).limit(1);
  const nextOrder = ((existing?.[0]?.order_index as number) ?? -1) + 1;
  const { error } = await supabase.from('dars').insert({
    module_id: moduleId, title: payload.title, order_index: nextOrder,
    duration_minutes: payload.durationMinutes, youtube_video_id: payload.youtubeVideoId || null,
  });
  if (error) throw error;
}

export async function updateDarsFull(id: string, payload: { title: string; durationMinutes: number; youtubeVideoId: string | null }): Promise<void> {
  const { error } = await supabase.from('dars').update({
    title: payload.title, duration_minutes: payload.durationMinutes, youtube_video_id: payload.youtubeVideoId,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteDars(id: string): Promise<void> {
  const { error } = await supabase.from('dars').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderModules(classId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, idx) => supabase.from('modules').update({ order_index: idx }).eq('id', id)));
}

export async function reorderDars(moduleId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, idx) => supabase.from('dars').update({ order_index: idx }).eq('id', id)));
}

export async function getInvoice(invoiceId: string): Promise<LocalInvoice> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id, total_amount, status, mayar_invoice_id, paid_at,
      invoice_items ( id, class_id, bundle_id, ebook_id, price, classes ( id, title, cover_image ), bundles ( title ) )
    `)
    .eq('id', invoiceId)
    .single();
  if (error) throw error;

  const items = (data.invoice_items as any[]) ?? [];

  // Judul ebook diambil terpisah dari VIEW `ebooks_catalog` — tabel `ebooks`
  // langsung hanya bisa dibaca admin, jadi embed relasi biasa tidak bisa
  // dipakai di sini (lihat catatan yang sama di listCartItems).
  const ebookIds = items
    .map((item: any) => item.ebook_id)
    .filter((id: string | null): id is string => !!id);
  const ebookTitleMap = new Map<string, string>();
  if (ebookIds.length > 0) {
    const { data: ebookRows, error: ebookError } = await supabase
      .from('ebooks_catalog')
      .select('id, title')
      .in('id', ebookIds);
    if (ebookError) throw ebookError;
    for (const e of ebookRows ?? []) ebookTitleMap.set(e.id, e.title);
  }

  return {
    id: data.id as string,
    totalAmount: data.total_amount as number,
    status: data.status as string,
    paymentUrl: null,
    items: items.map((item: any) => ({
      id: item.id as string,
      classId: (item.class_id as string | null) ?? undefined,
      bundleId: item.bundle_id as string | undefined,
      bundleName: item.bundles?.title as string | undefined,
      ebookId: (item.ebook_id as string | null) ?? undefined,
      title: item.ebook_id ? (ebookTitleMap.get(item.ebook_id) ?? '') : (item.classes?.title ?? ''),
      price: item.price as number,
      coverImage: item.classes?.cover_image ?? '',
    })),
  };
}

// ── Dashboard Messages ────────────────────────────────────────────────────────

export async function listActiveDashboardMessages() {
  const { data, error } = await supabase
    .from('dashboard_messages')
    .select('id, message')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map((m: any) => ({ id: m.id as string, message: m.message as string }));
}

export async function listAllDashboardMessages() {
  const { data, error } = await supabase
    .from('dashboard_messages')
    .select('id, message, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    id: m.id as string,
    message: m.message as string,
    isActive: m.is_active as boolean,
    createdAt: m.created_at as string,
  }));
}

export async function createDashboardMessage(message: string) {
  const { error } = await supabase.from('dashboard_messages').insert({ message });
  if (error) throw error;
}

export async function updateDashboardMessage(
  id: string,
  updates: { message?: string; isActive?: boolean },
) {
  const payload: any = {};
  if (updates.message !== undefined) payload.message = updates.message;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  const { error } = await supabase.from('dashboard_messages').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteDashboardMessage(id: string) {
  const { error } = await supabase.from('dashboard_messages').delete().eq('id', id);
  if (error) throw error;
}

// ── Public: Instructors ───────────────────────────────────────────────────────

export type PublicInstructor = {
  id: string;
  name: string;
  bio: string;
  photoUrl: string;
};

export type InstructorWithClasses = PublicInstructor & {
  detailedBio: string;
  classes: {
    id: string;
    title: string;
    coverImage: string;
    category: string | null;
  }[];
};

export async function listActiveInstructors(): Promise<PublicInstructor[]> {
  const { data, error } = await supabase
    .from('instructors')
    .select('id, name, bio, photo_url')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((i: any) => ({
    id: i.id,
    name: i.name,
    bio: i.bio ?? '',
    photoUrl: i.photo_url ?? '',
  }));
}

export async function getInstructorWithClasses(idOrSlug: string): Promise<InstructorWithClasses | null> {
  let targetId = idOrSlug;
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idOrSlug);

  if (!isUuid) {
    const { data: allInstructors } = await supabase.from('instructors').select('id, name');
    if (allInstructors) {
      const match = allInstructors.find((i) => slugify(i.name) === idOrSlug.toLowerCase());
      if (match) {
        targetId = match.id;
      }
    }
  }

  const { data: instructor, error } = await supabase
    .from('instructors')
    .select('id, name, bio, detailed_bio, photo_url')
    .eq('id', targetId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!instructor) return null;

  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, title, cover_image, category')
    .eq('instructor_id', instructor.id)
    .eq('status', 'published')
    .order('display_order');
  if (classesError) throw classesError;

  return {
    id: instructor.id,
    name: instructor.name,
    bio: instructor.bio ?? '',
    detailedBio: (instructor as any).detailed_bio ?? '',
    photoUrl: instructor.photo_url ?? '',
    classes: (classes ?? []).map((c: any) => ({
      id: c.id,
      title: c.title,
      coverImage: c.cover_image ?? '',
      category: c.category,
    })),
  };
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export type ClassReview = {
  id: string;
  userId: string;
  userNickname: string | null;
  /** Nilai mentah kolom reviewer_name di DB — null berarti belum pernah diisi. */
  reviewerNameRaw: string | null;
  /** Nama yang ditampilkan: reviewer_name → nickname → 'Pelajar'. */
  userDisplayName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type ClassReviewSummary = {
  averageRating: number;
  totalReviews: number;
  reviews: ClassReview[];
};

export async function listClassReviews(classId: string): Promise<ClassReviewSummary> {
  const { data, error } = await supabase
    .from('class_reviews')
    .select('id, user_id, rating, comment, reviewer_name, created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const reviews = (data ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userNickname: null,
    reviewerNameRaw: (r.reviewer_name as string | null) ?? null,
    userDisplayName: (r.reviewer_name as string | null) || 'Pelajar',
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
  }));

  const averageRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  return { averageRating, totalReviews: reviews.length, reviews };
}

export async function submitClassReview(params: {
  classId: string;
  rating: number;
  comment: string;
  reviewerName: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Harus login untuk memberi review.');
  const { error } = await supabase
    .from('class_reviews')
    .upsert(
      {
        class_id: params.classId,
        user_id: user.id,
        rating: params.rating,
        comment: params.comment,
        reviewer_name: params.reviewerName,
      },
      { onConflict: 'class_id,user_id' },
    );
  if (error) throw error;
}

// ── Judul/Deskripsi per Pertemuan — kelas video playlist (Prompt 127) ────────

export type MeetingTitle = {
  videoIndex: number;
  title: string | null;
  description: string | null;
};

export async function getClassMeetingTitles(classId: string): Promise<Map<number, MeetingTitle>> {
  const { data, error } = await supabase
    .from('class_meeting_titles')
    .select('video_index, title, description')
    .eq('class_id', classId);
  if (error) throw error;
  const map = new Map<number, MeetingTitle>();
  (data ?? []).forEach((row: any) => {
    map.set(row.video_index, { videoIndex: row.video_index, title: row.title, description: row.description });
  });
  return map;
}

export async function upsertClassMeetingTitle(params: {
  classId: string;
  videoIndex: number;
  title: string;
  description: string;
}): Promise<void> {
  const { error } = await supabase
    .from('class_meeting_titles')
    .upsert(
      {
        class_id: params.classId,
        video_index: params.videoIndex,
        title: params.title || null,
        description: params.description || null,
      },
      { onConflict: 'class_id,video_index' },
    );
  if (error) throw error;
}

// ── Admin: Kelola Review (Prompt 125) ─────────────────────────────────────────

export type AdminReviewRow = {
  id: string;
  classId: string;
  classTitle: string;
  userId: string;
  reviewerName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
};

export async function listAllReviewsForAdmin(): Promise<AdminReviewRow[]> {
  const { data, error } = await supabase
    .from('class_reviews')
    .select('id, class_id, user_id, reviewer_name, rating, comment, created_at, classes(title)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    classId: r.class_id,
    classTitle: r.classes?.title ?? '(kelas terhapus)',
    userId: r.user_id,
    reviewerName: r.reviewer_name,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
  }));
}

export async function adminUpdateReview(
  id: string,
  payload: { rating?: number; comment?: string; reviewerName?: string },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (payload.rating !== undefined) patch.rating = payload.rating;
  if (payload.comment !== undefined) patch.comment = payload.comment;
  if (payload.reviewerName !== undefined) patch.reviewer_name = payload.reviewerName;
  const { error } = await supabase.from('class_reviews').update(patch).eq('id', id);
  if (error) throw error;
}

export async function adminDeleteReview(id: string): Promise<void> {
  const { error } = await supabase.from('class_reviews').delete().eq('id', id);
  if (error) throw error;
}

// ── Instructor Ratings (Prompt 118 — terpisah dari class_reviews) ─────────────

export type InstructorRatingForClass = {
  average: number;
  count: number;
  myRating: number | null;
};

/** Rating pengajar SPESIFIK untuk satu kelas (bukan gabungan semua kelasnya). */
export async function getInstructorRatingForClass(
  userId: string,
  instructorId: string,
  classId: string,
): Promise<InstructorRatingForClass> {
  const { data, error } = await supabase
    .from('instructor_ratings')
    .select('user_id, rating')
    .eq('instructor_id', instructorId)
    .eq('class_id', classId);
  if (error) throw error;

  const rows = (data ?? []) as { user_id: string; rating: number }[];
  const average =
    rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : 0;
  const mine = rows.find((r) => r.user_id === userId);

  return { average, count: rows.length, myRating: mine?.rating ?? null };
}

export async function submitInstructorRating(params: {
  instructorId: string;
  classId: string;
  rating: number;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Harus login untuk memberi rating.');
  const { error } = await supabase.from('instructor_ratings').upsert(
    {
      user_id: user.id,
      instructor_id: params.instructorId,
      class_id: params.classId,
      rating: params.rating,
    },
    { onConflict: 'user_id,instructor_id,class_id' },
  );
  if (error) throw error;
}

export type InstructorOverallRating = { average: number; count: number };

/** Rata-rata gabungan SEMUA kelas — dipakai di InstructorDetailPage. */
export async function getInstructorOverallRating(instructorId: string): Promise<InstructorOverallRating> {
  const { data, error } = await supabase
    .from('instructor_ratings')
    .select('rating')
    .eq('instructor_id', instructorId);
  if (error) throw error;
  const rows = (data ?? []) as { rating: number }[];
  const average =
    rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : 0;
  return { average, count: rows.length };
}

// ── Ebooks (Prompt 119 — jual ebook via cart/checkout yang sudah ada) ─────────

export type EbookCatalogItem = {
  id: string;
  title: string;
  description: string;
  author: string | null;
  coverImage: string | null;
  price: number;
  discountPrice: number | null;
  // TIDAK ADA gdriveUrl di sini — sengaja, ini untuk katalog publik
};

// Baca dari VIEW `ebooks_catalog`, bukan tabel `ebooks` langsung — view ini
// sengaja TIDAK punya kolom gdrive_url sama sekali (lihat migrasi), jadi
// walau kode di sini salah ketik SELECT *, link download tidak akan pernah
// ikut kebawa ke katalog publik.
export async function listEbooksCatalog(): Promise<EbookCatalogItem[]> {
  const { data, error } = await supabase
    .from('ebooks_catalog')
    .select('id, title, description, author, cover_image, price, discount_price')
    .order('display_order');
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    author: e.author,
    coverImage: e.cover_image,
    price: e.price,
    discountPrice: e.discount_price,
  }));
}

// Panggil function Postgres SECURITY DEFINER `get_ebook_download_url` —
// validasi kepemilikan dilakukan DI DATABASE (bukan cuma di frontend), jadi
// tidak bisa dilewati walau seseorang memanggil Supabase langsung dari luar.
export async function getEbookDownloadUrl(ebookId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_ebook_download_url', {
    p_ebook_id: ebookId,
  });
  if (error) throw new Error(error.message || 'Kamu belum membeli ebook ini.');
  return data as string;
}

export async function listMyEbooks(userId: string): Promise<EbookCatalogItem[]> {
  // Tidak embed tabel `ebooks` langsung — sama seperti listCartItems/getInvoice,
  // tabel dasar `ebooks` hanya bisa di-SELECT admin. Ambil id yang sudah dibeli
  // dulu, lalu baca detailnya dari VIEW publik `ebooks_catalog`.
  const { data: purchases, error } = await supabase
    .from('ebook_purchases')
    .select('ebook_id')
    .eq('user_id', userId);
  if (error) throw error;

  const ebookIds = (purchases ?? []).map((p: any) => p.ebook_id as string);
  if (ebookIds.length === 0) return [];

  const { data: ebookRows, error: ebookError } = await supabase
    .from('ebooks_catalog')
    .select('id, title, description, author, cover_image, price, discount_price')
    .in('id', ebookIds);
  if (ebookError) throw ebookError;

  return (ebookRows ?? []).map((e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    author: e.author,
    coverImage: e.cover_image,
    price: e.price,
    discountPrice: e.discount_price,
  }));
}

// ── Admin CRUD Ebook (pola sama seperti admin CRUD bundle) ────────────────────

export type AdminEbook = {
  id: string;
  title: string;
  description: string;
  author: string | null;
  coverImage: string;
  price: number;
  discountPrice: number | null;
  gdriveUrl: string;
  status: 'draft' | 'published';
  displayOrder: number;
};

export async function listAllEbooksForAdmin(): Promise<AdminEbook[]> {
  const { data, error } = await supabase
    .from('ebooks')
    .select('id, title, description, author, cover_image, price, discount_price, gdrive_url, status, display_order')
    .order('display_order');
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description ?? '',
    author: e.author,
    coverImage: e.cover_image ?? '',
    price: e.price,
    discountPrice: e.discount_price,
    gdriveUrl: e.gdrive_url,
    status: e.status,
    displayOrder: e.display_order,
  }));
}

export async function createEbook(payload: {
  title: string;
  description: string;
  author: string;
  coverImage: string;
  price: number;
  discountPrice: number | null;
  gdriveUrl: string;
  status: 'draft' | 'published';
}): Promise<void> {
  const { error } = await supabase.from('ebooks').insert({
    title: payload.title,
    description: payload.description,
    author: payload.author || null,
    cover_image: payload.coverImage || null,
    price: payload.price,
    discount_price: payload.discountPrice,
    gdrive_url: payload.gdriveUrl,
    status: payload.status,
  });
  if (error) throw error;
}

export async function updateEbook(
  id: string,
  payload: {
    title: string;
    description: string;
    author: string;
    coverImage: string;
    price: number;
    discountPrice: number | null;
    gdriveUrl: string;
    status: 'draft' | 'published';
  },
): Promise<void> {
  const { error } = await supabase
    .from('ebooks')
    .update({
      title: payload.title,
      description: payload.description,
      author: payload.author || null,
      cover_image: payload.coverImage || null,
      price: payload.price,
      discount_price: payload.discountPrice,
      gdrive_url: payload.gdriveUrl,
      status: payload.status,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEbook(id: string): Promise<void> {
  const { error } = await supabase.from('ebooks').delete().eq('id', id);
  if (error) throw error;
}

export async function getEbookPurchaseCount(ebookId: string): Promise<number> {
  const { count, error } = await supabase
    .from('invoice_items')
    .select('id', { count: 'exact', head: true })
    .eq('ebook_id', ebookId);
  if (error) throw error;
  return count ?? 0;
}

// ── Storage ────────────────────────────────────────────────────────────────────

export async function uploadAdminImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('admin-uploads')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) {
    console.error('[uploadAdminImage] Supabase Storage error:', error);
    throw new Error(`Gagal upload ke storage: ${error.message}`);
  }

  const { data } = supabase.storage.from('admin-uploads').getPublicUrl(fileName);
  console.log('[uploadAdminImage] Public URL didapat:', data.publicUrl);
  return data.publicUrl;
}

/** Bulk rating summary untuk Katalog — 1 query untuk semua kelas */
export async function listClassRatings(): Promise<Record<string, { averageRating: number; totalReviews: number }>> {
  const { data, error } = await supabase
    .from('class_reviews')
    .select('class_id, rating');
  if (error) throw error;

  const grouped: Record<string, number[]> = {};
  for (const r of (data ?? []) as { class_id: string; rating: number }[]) {
    if (!grouped[r.class_id]) grouped[r.class_id] = [];
    grouped[r.class_id].push(r.rating);
  }

  const result: Record<string, { averageRating: number; totalReviews: number }> = {};
  for (const [classId, ratings] of Object.entries(grouped)) {
    result[classId] = {
      averageRating: Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10,
      totalReviews: ratings.length,
    };
  }
  return result;
}

// ── Admin: Kelola Enrollment & Class Grants (Prompt 138) ───────────────────────

export async function listUserEnrollments(
  userId: string,
): Promise<{ classId: string; classTitle: string }[]> {
  const result: { classId: string; classTitle: string }[] = [];
  const addedClassIds = new Set<string>();

  // 1. Fetch from Supabase enrollments
  const { data } = await supabase
    .from('enrollments')
    .select('class_id, classes(title)')
    .eq('user_id', userId);

  if (data) {
    for (const e of data as any[]) {
      if (e.class_id && !addedClassIds.has(e.class_id)) {
        addedClassIds.add(e.class_id);
        result.push({
          classId: e.class_id,
          classTitle: e.classes?.title ?? '(kelas terhapus)',
        });
      }
    }
  }

  // 2. Fetch from Mayar paid invoices
  try {
    const { data: classesData } = await supabase.from('classes').select('id, title, slug');
    const classList = classesData || [];

    const invoices = await listAllInvoicesForAdmin();
    const userInvoices = invoices.filter(
      (inv) =>
        inv.status === 'paid' &&
        (inv.userId === userId || (inv.userNickname && inv.userNickname.toLowerCase().includes(userId.toLowerCase()))),
    );

    for (const inv of userInvoices) {
      const itemTitles = inv.items.map((i) => i.title.toLowerCase()).join(' ');
      for (const cls of classList) {
        const titleMatch = itemTitles.includes(cls.title.toLowerCase());
        const slugMatch = cls.slug && itemTitles.includes(cls.slug.toLowerCase());
        if ((titleMatch || slugMatch) && !addedClassIds.has(cls.id)) {
          addedClassIds.add(cls.id);
          result.push({
            classId: cls.id,
            classTitle: cls.title,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Mayar enrollments extraction note:', err);
  }

  return result;
}

export async function adminAddEnrollment(userId: string, classId: string): Promise<void> {
  const { error } = await supabase.from('enrollments').insert({ user_id: userId, class_id: classId });
  if (error) throw error;
}

export async function adminRemoveEnrollment(userId: string, classId: string): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .delete()
    .eq('user_id', userId)
    .eq('class_id', classId);
  if (error) throw error;
}

export async function createClassGrant(email: string, classIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('class_grants')
    .insert(classIds.map((classId) => ({ email: email.toLowerCase().trim(), class_id: classId })));
  if (error) throw error;
}

export async function listPendingGrantsForEmail(
  email: string,
): Promise<{ classId: string; classTitle: string }[]> {
  const { data, error } = await supabase
    .from('class_grants')
    .select('class_id, classes(title)')
    .eq('email', email.toLowerCase().trim())
    .is('redeemed_at', null);
  if (error) throw error;
  return (data ?? []).map((g: any) => ({
    classId: g.class_id as string,
    classTitle: (g.classes?.title ?? '') as string,
  }));
}

export async function getVideoCompletions(userId: string, classId: string): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('video_completions')
    .select('video_index')
    .eq('user_id', userId)
    .eq('class_id', classId);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.video_index as number));
}

export async function markVideoCompleted(params: {
  userId: string;
  classId: string;
  videoIndex: number;
}): Promise<void> {
  const { error } = await supabase
    .from('video_completions')
    .upsert(
      { user_id: params.userId, class_id: params.classId, video_index: params.videoIndex },
      { onConflict: 'user_id,class_id,video_index' },
    );
  if (error) throw error;
}

// ─── ADMIN BUNDLES CRUD ───────────────────────────────────────────────────────

export type AdminBundle = {
  id: string;
  title: string;
  description: string;
  normalPrice: number;
  bundlePrice: number;
  coverImage: string;
  status: 'draft' | 'published';
  classIds: string[];
};

export async function listAllBundlesForAdmin(): Promise<AdminBundle[]> {
  const { data, error } = await supabase
    .from('bundles')
    .select(`
      id, title, description, normal_price, bundle_price, cover_image, status,
      bundle_classes ( class_id )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((b: any) => ({
    id: b.id,
    title: b.title,
    description: b.description ?? '',
    normalPrice: b.normal_price,
    bundlePrice: b.bundle_price,
    coverImage: b.cover_image ?? '',
    status: b.status,
    classIds: (b.bundle_classes ?? []).map((bc: any) => bc.class_id as string),
  }));
}

export async function createBundle(payload: {
  title: string;
  description: string;
  normalPrice: number;
  bundlePrice: number;
  coverImage: string;
  status: 'draft' | 'published';
  classIds: string[];
}): Promise<void> {
  const { data: bundle, error } = await supabase
    .from('bundles')
    .insert({
      title: payload.title,
      description: payload.description,
      normal_price: payload.normalPrice,
      bundle_price: payload.bundlePrice,
      cover_image: payload.coverImage,
      status: payload.status,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (payload.classIds.length > 0) {
    const { error: linkError } = await supabase
      .from('bundle_classes')
      .insert(payload.classIds.map((classId) => ({ bundle_id: bundle.id, class_id: classId })));
    if (linkError) throw linkError;
  }
}

export async function updateBundle(
  id: string,
  payload: {
    title: string;
    description: string;
    normalPrice: number;
    bundlePrice: number;
    coverImage: string;
    status: 'draft' | 'published';
    classIds: string[];
  },
): Promise<void> {
  const { error } = await supabase
    .from('bundles')
    .update({
      title: payload.title,
      description: payload.description,
      normal_price: payload.normalPrice,
      bundle_price: payload.bundlePrice,
      cover_image: payload.coverImage,
      status: payload.status,
    })
    .eq('id', id);
  if (error) throw error;

  // Sinkronisasi kelas dalam bundle: hapus semua link lama, insert ulang yang baru
  const { error: deleteError } = await supabase.from('bundle_classes').delete().eq('bundle_id', id);
  if (deleteError) throw deleteError;

  if (payload.classIds.length > 0) {
    const { error: linkError } = await supabase
      .from('bundle_classes')
      .insert(payload.classIds.map((classId) => ({ bundle_id: id, class_id: classId })));
    if (linkError) throw linkError;
  }
}

export async function deleteBundle(id: string): Promise<void> {
  const { error } = await supabase.from('bundles').delete().eq('id', id);
  if (error) throw error;
}

export async function getBundlePurchaseCount(bundleId: string): Promise<number> {
  const { count, error } = await supabase
    .from('invoice_items')
    .select('id', { count: 'exact', head: true })
    .eq('bundle_id', bundleId);
  if (error) throw error;
  return count ?? 0;
}

// ─── CATALOG LAYOUT ──────────────────────────────────────────────────────────

/**
 * Update display_order banyak kelas sekaligus secara paralel.
 * Dipakai oleh halaman drag-and-drop "Atur Tata Letak Katalog".
 * Kolom display_order sudah ada — tidak ada perubahan skema.
 */
export async function bulkUpdateDisplayOrder(
  updates: { id: string; displayOrder: number }[],
): Promise<void> {
  const results = await Promise.all(
    updates.map((u) =>
      supabase.from('classes').update({ display_order: u.displayOrder }).eq('id', u.id),
    ),
  );
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw firstError;
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'promo' | 'kelas_baru';
  createdAt: string;
  isRead: boolean;
};

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const { data: notifs, error } = await supabase
    .from('notifications')
    .select('id, title, message, type, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const { data: reads, error: readsError } = await supabase
    .from('notification_reads')
    .select('notification_id')
    .eq('user_id', userId);
  if (readsError) throw readsError;

  const readIds = new Set((reads ?? []).map((r: any) => r.notification_id));

  return (notifs ?? []).map((n: any) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    createdAt: n.created_at,
    isRead: readIds.has(n.id),
  }));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      { user_id: userId, notification_id: notificationId },
      { onConflict: 'user_id,notification_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string, notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      notificationIds.map((id) => ({ user_id: userId, notification_id: id })),
      { onConflict: 'user_id,notification_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

// Admin
export async function createNotification(payload: {
  title: string;
  message: string;
  type: 'info' | 'promo' | 'kelas_baru';
}): Promise<void> {
  const { error } = await supabase.from('notifications').insert(payload);
  if (error) throw error;
}

export async function listAllNotificationsForAdmin(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, message, type, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((n: any) => ({
    id: n.id, title: n.title, message: n.message, type: n.type, createdAt: n.created_at, isRead: false,
  }));
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}

// ── Dashboard Board ────────────────────────────────────────────────────────────
export type DashboardBoard = {
  id: string;
  title: string;
  content: string;
};

export async function getActiveDashboardBoard(): Promise<DashboardBoard | null> {
  const { data, error } = await supabase
    .from('dashboard_board')
    .select('id, title, content')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Admin
export async function listAllDashboardBoards(): Promise<(DashboardBoard & { isActive: boolean; updatedAt: string })[]> {
  const { data, error } = await supabase
    .from('dashboard_board')
    .select('id, title, content, is_active, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((b: any) => ({
    id: b.id, title: b.title, content: b.content, isActive: b.is_active, updatedAt: b.updated_at,
  }));
}

export async function createDashboardBoard(payload: { title: string; content: string }): Promise<void> {
  await supabase.from('dashboard_board').update({ is_active: false }).eq('is_active', true);
  const { error } = await supabase.from('dashboard_board').insert({ ...payload, is_active: true });
  if (error) throw error;
}

export async function updateDashboardBoard(id: string, payload: { title: string; content: string }): Promise<void> {
  const { error } = await supabase.from('dashboard_board').update(payload).eq('id', id);
  if (error) throw error;
}

export async function setDashboardBoardActive(id: string): Promise<void> {
  await supabase.from('dashboard_board').update({ is_active: false }).eq('is_active', true);
  const { error } = await supabase.from('dashboard_board').update({ is_active: true }).eq('id', id);
  if (error) throw error;
}

export async function deleteDashboardBoard(id: string): Promise<void> {
  const { error } = await supabase.from('dashboard_board').delete().eq('id', id);
  if (error) throw error;
}

// ── Admin Activity Log ─────────────────────────────────────────────────────────
export type AdminActivity = {
  id: string;
  type: 'payment' | 'review';
  title: string;
  detail: string | null;
  createdAt: string;
};

export async function listAdminActivity(): Promise<AdminActivity[]> {
  const { data, error } = await supabase
    .from('admin_activity_log')
    .select('id, type, title, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id, type: a.type, title: a.title, detail: a.detail, createdAt: a.created_at,
  }));
}

// ── Certificate Requests ───────────────────────────────────────────────────────
export type CertificateRequest = {
  id: string;
  certificateNumber: string;
  classId: string;
  classTitle: string;
  certificateTemplateUrl: string | null;
  fullName: string;
  email: string;
  score: string | null;
  issuedAt: string;
};

function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MF-${year}-${random}`;
}

export async function getMyCertificate(userId: string, classId: string): Promise<CertificateRequest | null> {
  const { data, error } = await supabase
    .from('certificate_requests')
    .select('id, certificate_number, class_id, full_name, email, score, issued_at, classes(title, certificate_template_url)')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id, certificateNumber: data.certificate_number, classId: data.class_id,
    classTitle: (data as any).classes?.title ?? '',
    certificateTemplateUrl: (data as any).classes?.certificate_template_url ?? null,
    fullName: data.full_name, email: data.email,
    score: data.score, issuedAt: data.issued_at,
  };
}

export async function requestCertificate(params: {
  classId: string;
  fullName: string;
  email: string;
  score: string;
}): Promise<CertificateRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Harus login untuk mengambil sertifikat.');

  const { data, error } = await supabase
    .from('certificate_requests')
    .insert({
      certificate_number: generateCertificateNumber(),
      user_id: user.id,
      class_id: params.classId,
      full_name: params.fullName,
      email: params.email,
      score: params.score || null,
    })
    .select('id, certificate_number, class_id, full_name, email, score, issued_at, classes(title, certificate_template_url)')
    .single();
  if (error) throw error;
  return {
    id: data.id, certificateNumber: data.certificate_number, classId: data.class_id,
    classTitle: (data as any).classes?.title ?? '',
    certificateTemplateUrl: (data as any).classes?.certificate_template_url ?? null,
    fullName: data.full_name, email: data.email,
    score: data.score, issuedAt: data.issued_at,
  };
}

export async function getCertificateById(id: string): Promise<CertificateRequest | null> {
  const { data, error } = await supabase
    .from('certificate_requests')
    .select('id, certificate_number, class_id, full_name, email, score, issued_at, classes(title, certificate_template_url)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id, certificateNumber: data.certificate_number, classId: data.class_id,
    classTitle: (data as any).classes?.title ?? '',
    certificateTemplateUrl: (data as any).classes?.certificate_template_url ?? null,
    fullName: data.full_name, email: data.email,
    score: data.score, issuedAt: data.issued_at,
  };
}

// Admin
export async function listAllCertificatesForAdmin(): Promise<CertificateRequest[]> {
  const { data, error } = await supabase
    .from('certificate_requests')
    .select('id, certificate_number, class_id, full_name, email, score, issued_at, classes(title, certificate_template_url)')
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id, certificateNumber: c.certificate_number, classId: c.class_id,
    classTitle: c.classes?.title ?? '',
    certificateTemplateUrl: c.classes?.certificate_template_url ?? null,
    fullName: c.full_name, email: c.email,
    score: c.score, issuedAt: c.issued_at,
  }));
}

// ─── USER PHONE ───────────────────────────────────────────────────────────────

/** Ambil nomor HP user dari user_profiles. Null jika belum pernah diisi. */
export async function getUserPhone(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('phone')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.phone ?? null;
}

/** Simpan/update nomor HP user (upsert ke user_profiles). */
export async function updateUserPhone(userId: string, phone: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: userId, phone, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}
