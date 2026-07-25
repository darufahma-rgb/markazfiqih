import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { RequireAdminRoute } from '@/components/RequireAdminRoute';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ScrollToTop } from '@/components/ScrollToTop';

import LoginPage from '@/pages/LoginPage';
import OnboardingNamaPage from '@/pages/OnboardingNamaPage';
import LandingPage from '@/pages/LandingPage';
import DashboardPage from '@/pages/DashboardPage';
import CatalogPage from '@/pages/CatalogPage';
import ClassDetailPage from '@/pages/ClassDetailPage';
import MyClassesPage from '@/pages/MyClassesPage';
import CartPage from '@/pages/CartPage';
import LearnPage from '@/pages/LearnPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminClassesPage from '@/pages/admin/AdminClassesPage';
import AdminInstructorsPage from '@/pages/admin/AdminInstructorsPage';
import AdminOrdersPage from '@/pages/admin/AdminOrdersPage';
import AdminTestimonialsPage from '@/pages/admin/AdminTestimonialsPage';
import AdminReviewsPage from '@/pages/admin/AdminReviewsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AdminManageAdminsPage from '@/pages/admin/AdminManageAdminsPage';
import AdminDashboardMessagesPage from '@/pages/admin/AdminDashboardMessagesPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminCatalogLayoutPage from '@/pages/admin/AdminCatalogLayoutPage';
import AdminBundlesPage from '@/pages/admin/AdminBundlesPage';
import AdminEbooksPage from '@/pages/admin/AdminEbooksPage';
import AdminNotificationsPage from '@/pages/admin/AdminNotificationsPage';
import AdminCertificatesPage from '@/pages/admin/AdminCertificatesPage';
import AdminCertificateDesignPage from '@/pages/admin/AdminCertificateDesignPage';
import AdminVouchersPage from '@/pages/admin/AdminVouchersPage';
import CertificatePage from '@/pages/CertificatePage';
import InstructorsPage from '@/pages/InstructorsPage';
import InstructorDetailPage from '@/pages/InstructorDetailPage';
import BundlesPage from '@/pages/BundlesPage';
import { AboutUsPage } from '@/pages/AboutUsPage';
import MyEbooksPage from '@/pages/MyEbooksPage';
import EbookDetailPage from '@/pages/EbookDetailPage';
import CheckoutPage from '@/pages/CheckoutPage';
import PaymentPage from '@/pages/PaymentPage';

const queryClient = new QueryClient();

/** Semua halaman non-publik dibungkus ProtectedRoute langsung di sini. */
function P({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function Router() {
  return (
    <Switch>
      {/* Public — tidak butuh login */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/onboarding-nama" component={OnboardingNamaPage} />

      {/* Halaman umum & privat — wajib login */}
      <Route path="/katalog">{() => <P><CatalogPage /></P>}</Route>
      <Route path="/class/:id">{() => <P><ClassDetailPage /></P>}</Route>
      <Route path="/paket-bundle">{() => <P><BundlesPage /></P>}</Route>
      <Route path="/pengajar">{() => <P><InstructorsPage /></P>}</Route>
      <Route path="/pengajar/:id">{() => <P><InstructorDetailPage /></P>}</Route>
      <Route path="/tentang-kami">{() => <P><AboutUsPage /></P>}</Route>
      <Route path="/ebook/:id">{() => <P><EbookDetailPage /></P>}</Route>
      <Route path="/dashboard">{() => <P><DashboardPage /></P>}</Route>
      <Route path="/my-classes">{() => <P><MyClassesPage /></P>}</Route>
      <Route path="/keranjang">{() => <P><CartPage /></P>}</Route>
      <Route path="/learn/:classId">{() => <P><LearnPage /></P>}</Route>
      <Route path="/ebook-saya">{() => <P><MyEbooksPage /></P>}</Route>
      <Route path="/checkout">{() => <P><CheckoutPage /></P>}</Route>
      <Route path="/pembayaran/:invoiceId">{() => <P><PaymentPage /></P>}</Route>
      <Route path="/sertifikat/:id">{() => <P><CertificatePage /></P>}</Route>

      {/* Admin — wajib login + admin */}
      <Route path="/admin/certificates">
        {() => <P><RequireAdminRoute><AdminCertificatesPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/classes">
        {() => <P><RequireAdminRoute><AdminClassesPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/instructors">
        {() => <P><RequireAdminRoute><AdminInstructorsPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/orders">
        {() => <P><RequireAdminRoute><AdminOrdersPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/testimonials">
        {() => <P><RequireAdminRoute><AdminTestimonialsPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/reviews">
        {() => <P><RequireAdminRoute><AdminReviewsPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/settings">
        {() => <P><RequireAdminRoute><AdminSettingsPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/manage-admins">
        {() => <P><RequireAdminRoute><AdminManageAdminsPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/dashboard-messages">
        {() => <P><RequireAdminRoute><AdminDashboardMessagesPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/users">
        {() => <P><RequireAdminRoute><AdminUsersPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/catalog-layout">
        {() => <P><RequireAdminRoute><AdminCatalogLayoutPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/bundles">
        {() => <P><RequireAdminRoute><AdminBundlesPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/ebooks">
        {() => <P><RequireAdminRoute><AdminEbooksPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/notifications">
        {() => <P><RequireAdminRoute><AdminNotificationsPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/certificate-design">
        {() => <P><RequireAdminRoute><AdminCertificateDesignPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin/vouchers">
        {() => <P><RequireAdminRoute><AdminVouchersPage /></RequireAdminRoute></P>}
      </Route>
      <Route path="/admin">
        {() => <P><RequireAdminRoute><AdminDashboardPage /></RequireAdminRoute></P>}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ScrollToTop />
          <AuthProvider>
            <CartProvider>
              <Router />
            </CartProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
