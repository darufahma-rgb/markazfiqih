import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, Pencil, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRating } from '@/components/StarRating';
import { useAuth } from '@/context/AuthContext';
import { listClassReviews, submitClassReview, listEnrollments } from '@/lib/db';

/** Jumlah review yang muat sebelum daftarnya mulai bisa di-scroll sendiri. */
const REVIEWS_BEFORE_SCROLL = 5;

// ── Review & Ulasan kelas (Prompt 102/116) ───────────────────────────────────
// Dipakai di ClassDetailPage (full-width section, `variant="page"`, default)
// dan sejak Prompt 131 juga di LearnPage mode Video Playlist, dirender di
// dalam card "Tentang Pengajar" (`variant="card"`, tanpa outer wrapper +
// heading lebih kecil supaya menyatu dengan card pembungkusnya).
export function ClassReviewSection({
  classId,
  currentUserId,
  variant = 'page',
}: {
  classId: string;
  currentUserId: string | undefined;
  variant?: 'page' | 'card';
}) {
  const { user: authUser } = useAuth();
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: reviewData, isLoading: reviewsLoading, refetch } = useQuery({
    queryKey: ['class-reviews', classId],
    queryFn: () => listClassReviews(classId),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', currentUserId],
    queryFn: () => listEnrollments(currentUserId!),
    enabled: !!currentUserId,
  });

  const isEnrolled = enrollments.some((e) => e.class.id === classId);
  const myReview = reviewData?.reviews.find((r) => r.userId === currentUserId);

  const startEdit = () => {
    if (myReview) {
      setFormRating(myReview.rating);
      setFormComment(myReview.comment);
      // Gunakan reviewer_name yang sudah tersimpan di DB kalau ada,
      // fallback ke nickname akun kalau belum pernah diisi (review lama).
      setReviewerName(myReview.reviewerNameRaw ?? authUser?.nickname ?? '');
    } else {
      setFormRating(0);
      setFormComment('');
      setReviewerName(authUser?.nickname ?? '');
    }
    setIsEditing(true);
  };

  const handleSubmit = async () => {
    if (formRating === 0) {
      toast.error('Pilih bintang rating terlebih dahulu.');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitClassReview({ classId, rating: formRating, comment: formComment, reviewerName: reviewerName.trim() || (authUser?.nickname ?? '') });
      await refetch();
      setIsEditing(false);
      toast.success('Review berhasil disimpan!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const { averageRating = 0, totalReviews = 0, reviews = [] } = reviewData ?? {};

  const body = (
    <div className={variant === 'page' ? 'space-y-8' : 'space-y-5'}>
      {/* Heading + aggregate */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <h2
            className={
              variant === 'page'
                ? 'font-serif text-xl font-bold text-foreground'
                : 'text-sm font-semibold text-foreground'
            }
          >
            Review &amp; Ulasan
          </h2>
        </div>
        {totalReviews > 0 && (
          <div className="flex items-center gap-2 sm:ml-4">
            <StarRating rating={averageRating} size={variant === 'page' ? 'md' : 'sm'} />
            <span className="font-bold text-foreground">{averageRating}</span>
            <span className="text-sm text-muted-foreground">({totalReviews} ulasan)</span>
          </div>
        )}
      </div>

      {/* Form area — hanya untuk user yang sudah enroll */}
      {currentUserId && isEnrolled && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          {myReview && !isEditing ? (
            /* Tampilkan review milik sendiri + tombol edit */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Review kamu</p>
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              </div>
              <StarRating rating={myReview.rating} size="md" />
              {myReview.comment && (
                <p className="text-sm text-muted-foreground leading-relaxed">{myReview.comment}</p>
              )}
            </div>
          ) : isEditing ? (
            /* Form edit/tambah */
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">
                {myReview ? 'Edit review kamu' : 'Berikan penilaianmu'}
              </p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Klik bintang untuk memberi rating</p>
                <StarRating
                  rating={formRating}
                  size="lg"
                  interactive
                  onChange={setFormRating}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="review-name">Nama</Label>
                <Input
                  id="review-name"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Nama kamu"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="review-comment">Ulasan</Label>
                <Textarea
                  id="review-comment"
                  placeholder="Ceritakan pengalamanmu belajar di kelas ini (opsional)..."
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting || formRating === 0}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Menyimpan...</>
                  ) : (
                    'Simpan Review'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            /* Belum punya review, belum klik tulis */
            <button
              onClick={startEdit}
              className="w-full flex flex-col items-center gap-2 py-4 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <StarRating rating={0} size="lg" />
              <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                Klik untuk memberi review kelas ini
              </p>
            </button>
          )}
        </div>
      )}

      {/* List semua review */}
      {reviewsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Belum ada ulasan. Jadilah yang pertama memberi review!
        </div>
      ) : (
        /* Daftar review dibatasi tinggi ~5 review lalu bisa di-scroll sendiri,
           supaya halaman tidak makin memanjang seiring bertambahnya ulasan. */
        <div
          className={
            reviews.length > REVIEWS_BEFORE_SCROLL
              ? 'space-y-5 max-h-[420px] overflow-y-auto pr-2 -mr-2'
              : 'space-y-5'
          }
        >
          {reviews.map((r) => (
            <div key={r.id} className="flex gap-4">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                {r.userDisplayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">
                    {r.userDisplayName}
                  </p>
                  <StarRating rating={r.rating} size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </div>
                {r.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (variant === 'card') return body;

  return (
    <div className="border-t bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-10">{body}</div>
    </div>
  );
}
