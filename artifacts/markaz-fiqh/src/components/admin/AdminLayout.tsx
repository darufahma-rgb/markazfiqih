import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { BookOpen, LayoutDashboard, GraduationCap, Receipt, Users, ExternalLink, MessageSquareQuote, MessageSquareText, Settings, UserCog, ShieldPlus, StickyNote, LayoutGrid, Package, Bell, Award, Palette, Ticket } from 'lucide-react';
import { AdminActivityBell } from '@/components/admin/AdminActivityBell';

const NAV_ITEMS = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Manajemen Kelas', url: '/admin/classes', icon: GraduationCap },
  { title: 'Kelola Bundle', url: '/admin/bundles', icon: Package },
  { title: 'Kelola Ebook', url: '/admin/ebooks', icon: BookOpen },
  { title: 'Atur Tata Letak Katalog', url: '/admin/catalog-layout', icon: LayoutGrid },
  { title: 'Manajemen Pengajar', url: '/admin/instructors', icon: UserCog },
  { title: 'Pesanan', url: '/admin/orders', icon: Receipt },
  { title: 'Akses Khusus', url: '/admin/vouchers', icon: Ticket },
  { title: 'Sertifikat', url: '/admin/certificates', icon: Award },
  { title: 'Tampilan Sertifikat', url: '/admin/certificate-design', icon: Palette },
  { title: 'Testimoni', url: '/admin/testimonials', icon: MessageSquareQuote },
  { title: 'Kelola Review', url: '/admin/reviews', icon: MessageSquareText },
  { title: 'Pesan Dashboard', url: '/admin/dashboard-messages', icon: StickyNote },
  { title: 'Notifikasi', url: '/admin/notifications', icon: Bell },
  { title: 'Pengguna & Akses', url: '/admin/users', icon: Users },
  { title: 'Kelola Admin', url: '/admin/manage-admins', icon: ShieldPlus },
  { title: 'Pengaturan', url: '/admin/settings', icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <img src="/logo.png" alt="Markaz Fiqih" className="h-8 w-auto group-data-[collapsible=icon]:hidden" />
            <span className="text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">Panel Admin</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    item.url === '/admin' ? location === '/admin' : location.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <Link href={item.url} data-testid={`link-admin-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Lihat situs">
                <Link href="/" data-testid="link-admin-back-to-site">
                  <ExternalLink />
                  <span>Kembali ke Situs</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <Separator className="my-1" />
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="h-7 w-7 border border-border">
              <AvatarImage src={user?.avatar_url} alt={user?.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {(user?.name ?? 'Admin').split(' ').map((n) => n[0]).join('').substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-medium leading-tight truncate">{user?.name ?? 'Admin'}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email ?? 'admin@markazfiqh.id'}</span>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="font-serif text-lg font-semibold text-foreground flex-1">
            {NAV_ITEMS.find((item) =>
              item.url === '/admin' ? location === '/admin' : location.startsWith(item.url)
            )?.title ?? 'Panel Admin'}
          </h1>
          <AdminActivityBell />
        </header>
        <main className="flex-1 p-4 md:p-6 bg-muted/30 min-h-[calc(100vh-3.5rem)]">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
