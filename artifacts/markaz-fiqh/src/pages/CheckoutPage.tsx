import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Loader2,
  Lock,
  Package2,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PaymentSheet } from '@/components/PaymentSheet';
import { CheckoutAddonOffers } from '@/components/CheckoutAddonOffers';
import { PaymentMethodLogos } from '@/components/PaymentMethodLogos';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/pages/CatalogPage';
import { getUserPhone, updateUserPhone, validateVoucher } from '@/lib/db';
import { startCheckout, type CheckoutSession } from '@/lib/payments';

// ── Indikator langkah ────────────────────────────────────────────────────────
function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Keranjang', 'Pembayaran', 'Selesai'];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={[
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors',
                done
                  ? 'bg-primary text-primary-foreground'
                  : active
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                    : 'bg-muted text-muted-foreground',
              ].join(' ')}
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : n}
            </span>
            <span className={active ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="w-6 h-px bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function CheckoutContent() {
  const { user } = useAuth();
  const { items, isLoading } = useCart();
  const [, setLocation] = useLocation();

  // ── Nomor WhatsApp — Mayar butuh ini untuk mengirim bukti bayar ────────────
  const [savedPhone, setSavedPhone] = useState<string | null | undefined>(undefined);
  const [phoneInput, setPhoneInput] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserPhone(user.id)
      .then((phone) => {
        setSavedPhone(phone);
        if (phone) setPhoneInput(phone);
      })
      .catch(() => setSavedPhone(null));
  }, [user]);

  const handleSavePhone = async () => {
    const cleaned = phoneInput.trim().replace(/\s/g, '');
    if (!/^\+?\d{8,15}$/.test(cleaned)) {
      setPhoneError('Masukkan nomor yang valid, contoh 08123456789.');
      return;
    }
    setPhoneError(null);
    setIsSavingPhone(true);
    try {
      await updateUserPhone(user!.id, cleaned);
      setSavedPhone(cleaned);
      setEditingPhone(false);
    } catch {
      setPhoneError('Nomor gagal disimpan. Coba lagi.');
    } finally {
      setIsSavingPhone(false);
    }
  };

  // ── Kode Kupon ────────────────────────────────────────────────────────────
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ classId: string; discountPrice: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);

  // Reset kupon kalau isi keranjang berubah
  useEffect(() => {
    setAppliedVoucher(null);
    setVoucherError(null);
  }, [items]);

  const handleApplyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;
    setVoucherError(null);
    setAppliedVoucher(null);
    setIsValidatingVoucher(true);
    try {
      for (const item of items) {
        if (item.type !== 'class') continue;
        const result = await validateVoucher(item.class.id, code);
        if (result.valid) {
          setAppliedVoucher({ classId: item.class.id, discountPrice: result.discountPrice });
          setIsValidatingVoucher(false);
          return;
        }
      }
      setVoucherError('Kode akses khusus ini tidak berlaku untuk kelas di keranjang kamu.');
    } catch {
      setVoucherError('Kode akses khusus gagal diperiksa. Coba lagi.');
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
    setVoucherError(null);
  };

  // ── Total ─────────────────────────────────────────────────────────────────
  const { subtotal, savings } = useMemo(() => {
    let subtotal = 0;
    let savings = 0;
    for (const item of items) {
      if (item.type === 'bundle') {
        subtotal += item.bundle.bundlePrice;
      } else if (item.type === 'ebook') {
        subtotal += item.ebook.discountPrice ?? item.ebook.price;
      } else {
        const normal = item.class.discountPrice ?? item.class.basePrice;
        if (appliedVoucher && item.class.id === appliedVoucher.classId) {
          subtotal += appliedVoucher.discountPrice;
          savings += normal - appliedVoucher.discountPrice;
        } else {
          subtotal += normal;
        }
      }
    }
    return { subtotal, savings };
  }, [items, appliedVoucher]);

  // ── Syarat & Ketentuan ────────────────────────────────────────────────────
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // Banyak pembeli membuka link Mayar di email setelah bayar dan mendarat di
  // halaman kosong — tegaskan bahwa kelas langsung ada di menu "Kelas Saya".
  const hasClassItem = items.some((item) => item.type !== 'ebook');
  const [understoodAccess, setUnderstoodAccess] = useState(false);

  // ── Bayar ─────────────────────────────────────────────────────────────────
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const canPay =
    !!savedPhone && items.length > 0 && !isStarting && agreedToTerms && (!hasClassItem || understoodAccess);

  const handlePay = async () => {
    if (!canPay) return;
    setIsStarting(true);
    try {
      const code = appliedVoucher ? voucherCode.trim().toUpperCase() : undefined;
      const created = await startCheckout(code);
      if (created.freeCheckout) {
        toast.success('Pembayaran berhasil — kelas gratis sudah aktif.');
        setLocation(`/pembayaran/${created.id}`);
        return;
      }
      setSession(created);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Pembayaran belum bisa dimulai.';
      // Kalau server menolak karena voucher, reset state kupon
      if (appliedVoucher && msg.toLowerCase().includes('voucher')) {
        setAppliedVoucher(null);
        setVoucherError(msg);
      }
      toast.error(msg);
    } finally {
      setIsStarting(false);
    }
  };

  const hasClassItems = items.some((i) => i.type === 'class');

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-12 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="container mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Tidak ada yang perlu dibayar</h1>
        <p className="text-muted-foreground mb-6">Keranjang kamu kosong. Pilih kelas dulu, lalu kembali ke sini.</p>
        <Button asChild size="lg">
          <Link href="/katalog">Lihat katalog kelas</Link>
        </Button>
      </main>
    );
  }

  return (
    <>
      <div className="border-b bg-muted/30">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <Link
            href="/keranjang"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali ke keranjang
          </Link>
          <div className="hidden sm:block">
            <Steps current={2} />
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground">Pembayaran</h1>
          <p className="text-muted-foreground mt-1">
            Periksa pesanan kamu, lalu pilih metode pembayaran di langkah terakhir.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Kolom kiri */}
          <div className="lg:col-span-3 space-y-6">
            {/* Kontak */}
            <section className="rounded-xl border bg-card shadow-sm p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Nomor WhatsApp</h2>

              {savedPhone === undefined ? (
                <Skeleton className="h-9 w-full" />
              ) : savedPhone && !editingPhone ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                  <span className="text-sm font-medium text-foreground">{savedPhone}</span>
                  <button
                    onClick={() => setEditingPhone(true)}
                    className="text-xs text-primary underline underline-offset-2 shrink-0"
                  >
                    Ubah
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="08123456789"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        setPhoneError(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && void handleSavePhone()}
                      disabled={isSavingPhone}
                      className="h-9"
                    />
                    <Button
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={handleSavePhone}
                      disabled={isSavingPhone || !phoneInput.trim()}
                    >
                      {isSavingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
                    </Button>
                  </div>
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>
              )}
            </section>

            {/* Pesanan */}
            <section className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h2 className="text-sm font-semibold text-foreground">
                  Pesanan kamu <span className="text-muted-foreground font-normal">({items.length})</span>
                </h2>
              </div>
              <ul className="divide-y">
                {items.map((item) => {
                  const isBundle = item.type === 'bundle';
                  const isEbook = item.type === 'ebook';
                  const title = isBundle
                    ? item.bundle.title
                    : isEbook
                      ? item.ebook.title
                      : item.class.title;
                  const cover = isBundle ? null : isEbook ? item.ebook.coverImage : item.class.coverImage;

                  const hasVoucher = !isBundle && !isEbook && appliedVoucher && item.class.id === appliedVoucher.classId;
                  const normalPrice = isBundle
                    ? item.bundle.bundlePrice
                    : isEbook
                      ? (item.ebook.discountPrice ?? item.ebook.price)
                      : (item.class.discountPrice ?? item.class.basePrice);
                  const displayPrice = hasVoucher ? appliedVoucher!.discountPrice : normalPrice;

                  return (
                    <li key={item.id} className="flex gap-3 px-5 py-3.5 items-center">
                      <div className="w-14 h-10 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                        {cover ? (
                          <img src={cover} alt="" className="w-full h-full object-cover" />
                        ) : isBundle ? (
                          <Package2 className="h-4 w-4 text-primary/60" />
                        ) : (
                          <BookOpen className="h-4 w-4 text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground line-clamp-1">{title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isBundle
                            ? `Paket · ${item.bundle.classes.length} kelas`
                            : isEbook
                              ? 'Ebook'
                              : 'Kelas'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-semibold text-foreground block">
                          {formatPrice(displayPrice)}
                        </span>
                        {hasVoucher && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(normalPrice)}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Add-on / upsell */}
            <CheckoutAddonOffers />

            {/* Syarat & Ketentuan */}
            <section className="rounded-xl border bg-card shadow-sm p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Syarat &amp; Ketentuan</h2>
              <Accordion type="single" collapsible>
                <AccordionItem value="terms" className="border-0">
                  <AccordionTrigger className="text-sm text-muted-foreground hover:text-foreground py-0 hover:no-underline">
                    Baca Syarat &amp; Ketentuan Program Kelas Markaz Fiqih
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Program Kelas Markaz Fiqih menggunakan akad jual beli atas hak pemanfaatan (بيع حق الانتفاع), yaitu pemberian hak kepada peserta untuk mengakses dan memanfaatkan materi pembelajaran secara pribadi, tanpa mengalihkan kepemilikan materi maupun hak cipta atas materi tersebut.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Dengan akad tersebut, peserta hanya memperoleh hak pemanfaatan secara pribadi (حق الانتفاع الشخصي). Oleh karena itu, hak akses tidak boleh dipindahtangankan, dipinjamkan, dibagikan, digunakan bersama (termasuk patungan), atau diperjualbelikan tanpa izin dari Markaz Fiqih.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Hak cipta dan seluruh hak kekayaan intelektual atas materi pembelajaran tetap menjadi milik Markaz Fiqih. Kepemilikan tersebut tidak beralih kepada peserta melalui akad ini. Ketentuan ini sejalan dengan Keputusan Majma' al-Fiqh al-Islami No. 43 (5/5) yang menegaskan bahwa hak cipta merupakan hak yang diakui syariat, yaitu:
                    </p>
                    <p dir="rtl" className="text-right font-medium text-foreground leading-loose">
                      الاسم التجاري، والعنوان التجاري، والعلامة التجارية، والتأليف والاختراع أو الابتكار، هي حقوقٌ خاصةٌ لأصحابها، أصبح لها في العُرف المعاصر قيمةٌ ماليةٌ معتبرةٌ؛ لتموُّل الناس لها، وهذه الحقوق يُعتدُّ بها شرعًا، فلا يجوز الاعتداء عليها.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Konsep hak pemanfaatan pribadi (حق الانتفاع الشخصي) ini sejalan dengan penjelasan para fuqaha (madzhab Maliki, juga Syafi'i). Syaikh Wahbah az-Zuhaili menjelaskan bahwa hak pemanfaatan pada hakikatnya merupakan izin untuk memanfaatkan suatu objek secara pribadi dan tidak memberikan kewenangan kepada penerimanya untuk mengalihkan manfaat tersebut kepada pihak lain. Beliau berkata dalam al-Fiqh al-Islāmī wa Adillatuhu (6/4552):
                    </p>
                    <p dir="rtl" className="text-right font-medium text-foreground leading-loose">
                      وأما حق الانتفاع: فهو مجرد رخصة بالانتفاع الشخصي... فليس للمنتفع أن يملك المنفعة لغيره.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>

            {/* Metode */}
            <section className="rounded-xl border bg-card shadow-sm p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Metode pembayaran</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Pilihan metode muncul di langkah berikutnya, tanpa meninggalkan halaman ini.
              </p>
              <PaymentMethodLogos />
            </section>
          </div>

          {/* Kolom kanan — ringkasan */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Ringkasan</h2>

                {/* Akses Khusus — hanya tampil jika ada kelas satuan di keranjang */}
                {hasClassItems && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Punya Akses Khusus? Masukkan disini :</p>
                    {appliedVoucher ? (
                      <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-300">
                          <Tag className="h-3.5 w-3.5" />
                          <span className="font-medium">{voucherCode.trim().toUpperCase()}</span>
                          <span>— hemat {formatPrice(savings)}</span>
                        </div>
                        <button
                          onClick={handleRemoveVoucher}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Hapus kode akses khusus"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Masukkan kode akses khusus"
                            value={voucherCode}
                            onChange={(e) => {
                              setVoucherCode(e.target.value);
                              setVoucherError(null);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && void handleApplyVoucher()}
                            disabled={isValidatingVoucher}
                            className="h-9 text-sm uppercase"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 shrink-0"
                            onClick={handleApplyVoucher}
                            disabled={!voucherCode.trim() || isValidatingVoucher}
                          >
                            {isValidatingVoucher ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pakai'}
                          </Button>
                        </div>
                        {voucherError && <p className="text-xs text-destructive">{voucherError}</p>}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="agree-terms"
                    checked={agreedToTerms}
                    onCheckedChange={(v) => setAgreedToTerms(Boolean(v))}
                    className="mt-0.5 shrink-0"
                  />
                  <label
                    htmlFor="agree-terms"
                    className="text-xs text-foreground/80 leading-relaxed cursor-pointer"
                  >
                    Saya telah membaca, memahami, dan menyetujui Syarat dan Ketentuan Program Kelas Markaz Fiqih.
                  </label>
                </div>

                {hasClassItem && (
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="understand-access"
                      checked={understoodAccess}
                      onCheckedChange={(v) => setUnderstoodAccess(Boolean(v))}
                      className="mt-0.5 shrink-0"
                    />
                    <label
                      htmlFor="understand-access"
                      className="text-xs text-foreground/80 leading-relaxed cursor-pointer"
                    >
                      Saya memahami bahwa setelah melakukan pembayaran kelas, saya dapat langsung mengakses kelas
                      melalui menu <span className="font-semibold text-foreground">“Kelas Saya”</span> di website
                      tanpa perlu membuka email.
                    </label>
                  </div>
                )}

                <Separator />

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal + savings)}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Potongan akses khusus</span>
                      <span>−{formatPrice(savings)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-serif text-xl font-bold text-primary">{formatPrice(subtotal)}</span>
                </div>

                <Button
                  size="lg"
                  className="w-full text-base font-semibold"
                  disabled={!canPay}
                  onClick={handlePay}
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Menyiapkan…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Bayar {formatPrice(subtotal)}
                    </>
                  )}
                </Button>

                {!savedPhone && savedPhone !== undefined && (
                  <p className="text-xs text-destructive text-center">
                    Isi nomor WhatsApp dulu untuk melanjutkan.
                  </p>
                )}

                {(!agreedToTerms || (hasClassItem && !understoodAccess)) && (
                  <p className="text-xs text-destructive text-center">
                    {hasClassItem
                      ? 'Centang kedua pernyataan di atas dulu untuk melanjutkan.'
                      : 'Centang persetujuan Syarat & Ketentuan dulu untuk melanjutkan.'}
                  </p>
                )}

                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Pembayaran diproses aman oleh Mayar
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {session && session.paymentUrl && (
        <PaymentSheet
          invoiceId={session.id}
          paymentUrl={session.paymentUrl}
          totalAmount={session.totalAmount}
          expiresAt={session.expiresAt ?? null}
          onPaid={() => setLocation(`/pembayaran/${session.id}`)}
          onClose={() => setSession(null)}
        />
      )}
    </>
  );
}

export default function CheckoutPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <CheckoutContent />
      </AppShell>
    </ProtectedRoute>
  );
}
