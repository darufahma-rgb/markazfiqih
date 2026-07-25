import { Link } from 'wouter';
import { SEO } from '@/components/SEO';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listActiveInstructors } from '@/lib/db';

function InstructorCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6">
      <Skeleton className="h-24 w-24 rounded-full" />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function InstructorsContent() {
  const { data: instructors, isLoading, isError } = useQuery({
    queryKey: ['active-instructors'],
    queryFn: listActiveInstructors,
  });

  return (
    <AppShell>
      <SEO title="Pengajar" />
      <div className="max-w-5xl mx-auto w-full px-4 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-2xl lg:text-3xl font-bold text-foreground">
            Pengajar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kenali guru-guru kompeten di balik kelas-kelas Markaz Fiqih.
          </p>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <InstructorCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center text-sm text-destructive py-16">
            Gagal memuat daftar pengajar. Silakan coba lagi.
          </div>
        ) : !instructors || instructors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-foreground">Belum ada pengajar</p>
            <p className="text-sm text-muted-foreground">
              Pengajar aktif akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {instructors.map((instructor) => (
              <Link key={instructor.id} href={`/pengajar/${instructor.id}`}>
                <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200 text-center group">
                  <Avatar className="h-24 w-24 border-2 border-border">
                    <AvatarImage src={instructor.photoUrl} alt={instructor.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                      {instructor.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 w-full">
                    <p className="font-semibold text-foreground text-sm leading-snug group-hover:text-primary transition-colors">
                      {instructor.name}
                    </p>
                    {instructor.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {instructor.bio}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function InstructorsPage() {
  return <InstructorsContent />;
}
