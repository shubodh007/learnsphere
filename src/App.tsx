import { useEffect, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUIStore } from '@/stores/ui-store';
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';

// Eager load: Landing page should be fast to view
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';

// Lazy load: These are behind auth or not critical for initial load
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Learn = lazy(() => import('./pages/Learn'));
const LearnNew = lazy(() => import('./pages/LearnNew'));
const LessonViewer = lazy(() => import('./pages/LessonViewer'));
const LessonQuiz = lazy(() => import('./pages/LessonQuiz'));
const Chat = lazy(() => import('./pages/Chat'));
const CodePage = lazy(() => import('./pages/CodePage'));
const Videos = lazy(() => import('./pages/Videos'));
const Analytics = lazy(() => import('./pages/Analytics'));
const SettingsPage = lazy(() => import('./pages/Settings'));

// Simple loading component
const PageLoader = () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }} />;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function AppInit() {
  const initialize = useUIStore((s) => s.initialize);
  useEffect(() => {
    initialize();
  }, [initialize]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppInit />
          <Routes>
            {/* Public routes - no lazy loading for fast landing page */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes - lazy loaded */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                <Route path="/learn" element={<Suspense fallback={<PageLoader />}><Learn /></Suspense>} />
                <Route path="/learn/new" element={<Suspense fallback={<PageLoader />}><LearnNew /></Suspense>} />
                <Route path="/learn/:slug" element={<Suspense fallback={<PageLoader />}><LessonViewer /></Suspense>} />
                <Route path="/learn/:slug/quiz" element={<Suspense fallback={<PageLoader />}><LessonQuiz /></Suspense>} />
                <Route path="/chat" element={<Suspense fallback={<PageLoader />}><Chat /></Suspense>} />
                <Route path="/chat/:id" element={<Suspense fallback={<PageLoader />}><Chat /></Suspense>} />
                <Route path="/code" element={<Suspense fallback={<PageLoader />}><CodePage /></Suspense>} />
                <Route path="/videos" element={<Suspense fallback={<PageLoader />}><Videos /></Suspense>} />
                <Route path="/analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
                <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
