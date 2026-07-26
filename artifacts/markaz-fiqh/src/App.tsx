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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes cache freshness
      gcTime: 60 * 60 * 1000, // 1 hour garbage collection
      refetchOnWindowFocus: false, // DO NOT refetch when switching tabs/windows
      refetchOnReconnect: false, // DO NOT refetch on network reconnect
      refetchOnMount: false, // Use cached data on mount if fresh
      retry: 1,
    },
  },
});

// ── Static route wrappers to prevent wouter from unmounting/remounting pages ──
const withP = (Component: React.ComponentType) => {
  return function ProtectedRouteWrapper() {
    return (
      <ProtectedRoute>
        <Component />
      </ProtectedRoute>
    );
  };
};

const withAdmin = (Component: React.ComponentType) => {
  return function AdminRouteWrapper() {
    return (
      <ProtectedRoute>
        <RequireAdminRoute>
          <Component />
        </RequireAdminRoute>
      </ProtectedRoute>
    );
  };
};

const ProtectedCatalogPage = withP(CatalogPage);
const ProtectedClassDetailPage = withP(ClassDetailPage);
const ProtectedBundlesPage = withP(BundlesPage);
const ProtectedInstructorsPage = withP(InstructorsPage);
const ProtectedInstructorDetailPage = withP(InstructorDetailPage);
const ProtectedAboutUsPage = withP(AboutUsPage);
const ProtectedEbookDetailPage = withP(EbookDetailPage);
const ProtectedDashboardPage = withP(DashboardPage);
const ProtectedMyClassesPage = withP(MyClassesPage);
const ProtectedCartPage = withP(CartPage);
const ProtectedLearnPage = withP(LearnPage);
const ProtectedMyEbooksPage = withP(MyEbooksPage);
const ProtectedCheckoutPage = withP(CheckoutPage);
const ProtectedPaymentPage = withP(PaymentPage);
const ProtectedCertificatePage = withP(CertificatePage);

const AdminCertificates = withAdmin(AdminCertificatesPage);
const AdminClasses = withAdmin(AdminClassesPage);
const AdminInstructors = withAdmin(AdminInstructorsPage);
const AdminOrders = withAdmin(AdminOrdersPage);
const AdminTestimonials = withAdmin(AdminTestimonialsPage);
const AdminReviews = withAdmin(AdminReviewsPage);
const AdminSettings = withAdmin(AdminSettingsPage);
const AdminManageAdmins = withAdmin(AdminManageAdminsPage);
const AdminDashboardMessages = withAdmin(AdminDashboardMessagesPage);
const AdminUsers = withAdmin(AdminUsersPage);
const AdminCatalogLayout = withAdmin(AdminCatalogLayoutPage);
const AdminBundles = withAdmin(AdminBundlesPage);
const AdminEbooks = withAdmin(AdminEbooksPage);
const AdminNotifications = withAdmin(AdminNotificationsPage);
const AdminCertificateDesign = withAdmin(AdminCertificateDesignPage);
const AdminVouchers = withAdmin(AdminVouchersPage);
const AdminDashboard = withAdmin(AdminDashboardPage);

function Router() {
  return (
    <Switch>
      {/* Public — tidak butuh login */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/onboarding-nama" component={OnboardingNamaPage} />

      {/* Halaman umum & privat — wajib login */}
      <Route path="/katalog" component={ProtectedCatalogPage} />
      <Route path="/kelas/:id" component={ProtectedClassDetailPage} />
      <Route path="/class/:id" component={ProtectedClassDetailPage} />
      <Route path="/paket-bundle" component={ProtectedBundlesPage} />
      <Route path="/pengajar" component={ProtectedInstructorsPage} />
      <Route path="/pengajar/:id" component={ProtectedInstructorDetailPage} />
      <Route path="/tentang-kami" component={ProtectedAboutUsPage} />
      <Route path="/ebook/:id" component={ProtectedEbookDetailPage} />
      <Route path="/dashboard" component={ProtectedDashboardPage} />
      <Route path="/my-classes" component={ProtectedMyClassesPage} />
      <Route path="/keranjang" component={ProtectedCartPage} />
      <Route path="/belajar/:classId" component={ProtectedLearnPage} />
      <Route path="/learn/:classId" component={ProtectedLearnPage} />
      <Route path="/ebook-saya" component={ProtectedMyEbooksPage} />
      <Route path="/checkout" component={ProtectedCheckoutPage} />
      <Route path="/pembayaran/:invoiceId" component={ProtectedPaymentPage} />
      <Route path="/sertifikat/:id" component={ProtectedCertificatePage} />

      {/* Admin — wajib login + admin */}
      <Route path="/admin/certificates" component={AdminCertificates} />
      <Route path="/admin/classes" component={AdminClasses} />
      <Route path="/admin/instructors" component={AdminInstructors} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/testimonials" component={AdminTestimonials} />
      <Route path="/admin/reviews" component={AdminReviews} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/manage-admins" component={AdminManageAdmins} />
      <Route path="/admin/dashboard-messages" component={AdminDashboardMessages} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/catalog-layout" component={AdminCatalogLayout} />
      <Route path="/admin/bundles" component={AdminBundles} />
      <Route path="/admin/ebooks" component={AdminEbooks} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/admin/certificate-design" component={AdminCertificateDesign} />
      <Route path="/admin/vouchers" component={AdminVouchers} />
      <Route path="/admin" component={AdminDashboard} />

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
