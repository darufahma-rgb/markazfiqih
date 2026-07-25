import { Link, useParams } from 'wouter';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SEO } from '@/components/SEO';
import { slugify, getInstructorWithClasses, getInstructorOverallRating } from '@/lib/db';
import { StarRating } from '@/components/StarRating';
import { useEffect } from 'react';

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <Skeleton className="h-32 w-32 rounded-full shrink-0" />
        <div className="space-y-3 w-full">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border overflow-hidden">
            <Skeleton className="h-36 w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InstructorDetailContent({ id }: { id: string }) {
  const { data: instructor, isLoading, isError } = useQuery({
    queryKey: ['instructor-detail', id],
    queryFn: () => getInstructorWithClasses(id),
    enabled: !!id,
  });

  const { data: overallRating = { average: 0, count: 0 } } = useQuery({
    queryKey: ['instructor-overall-rating', id],
    queryFn: () => getInstructorOverallRating(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (instructor) {
      const slug = slugify(instructor.name);
      if (id !== slug) {
        window.history.replaceState(null, '', `/pengajar/${slug}`);
      }
    }
  }, [instructor, id]);

  return (
    <AppShell>
      <SEO title={instructor ? `Pengajar: ${instructor.name}` : 'Pengajar'} />
      <div className="max-w-4xl mx-auto w-full px-4 lg:px-8 py-8 space-y-8">
        {/* Back */}
        <Link
          href="/pengajar"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Semua Pengajar
        </Link>

        {isLoading ? (
          <DetailSkeleton />
        ) : isError || !instructor ? (
          <div className="text-center text-sm text-destructive py-16">
            {isError
              ? 'Gagal memuat data pengajar. Silakan coba lagi.'
              : 'Pengajar tidak ditemukan.'}
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="bg-card rounded-2xl border p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <Avatar className="h-32 w-32 shrink-0 border-2 border-border">
                <AvatarImage src={instructor.photoUrl} alt={instructor.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold">
                  {instructor.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 text-center sm:text-left">
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  {instructor.name}
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-muted-foreground">
                  <BookOpen className="w-4 h-4" />
                  <span>{instructor.classes.length} kelas diajarkan</span>
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                  <StarRating rating={overallRating.average} size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {overallRating.average > 0
                      ? `${overallRating.average} (${overallRating.count} rating)`
                      : 'Belum ada rating'}
                  </span>
                </div>
                {instructor.bio && (
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                    {instructor.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Biografi Detail */}
            {instructor.detailedBio && (
              <div className="bg-card rounded-2xl border p-6 space-y-2">
                <p className="text-sm font-semibold text-foreground">Biografi</p>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {instructor.detailedBio}
                </p>
              </div>
            )}

            {/* Classes section */}
            <div className="space-y-4">
              <h2 className="font-serif text-lg font-bold text-foreground">
                Kelas yang Diajar
              </h2>

              {instructor.classes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-2xl border bg-card">
                  <BookOpen className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Belum ada kelas yang dipublikasikan.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {instructor.classes.map((cls) => (
                    <Link key={cls.id} href={`/class/${cls.id}`}>
                      <div className="rounded-2xl border bg-card overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200 group">
                        <div className="aspect-video overflow-hidden bg-muted">
                          {cls.coverImage ? (
                            <img
                              src={cls.coverImage}
                              alt={cls.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <div className="p-3 space-y-1.5">
                          <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                            {cls.title}
                          </p>
                          {cls.category && (
                            <Badge variant="secondary" className="text-xs">
                              {cls.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function InstructorDetailPage() {
  const params = useParams<{ id: string }>();
  return <InstructorDetailContent id={params.id ?? ''} />;
}
