/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { ItineraryBuilderPage } from './pages/ItineraryBuilderPage';
import { ExploreVenuesPage } from './pages/ExploreVenuesPage';
import { VideoDiscoveryPage } from './pages/VideoDiscoveryPage';
import { GroupCollaborationPage } from './pages/GroupCollaborationPage';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage';
import { PartnerDashboardPage } from './pages/PartnerDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/planner" element={<ItineraryBuilderPage />} />
                <Route path="/explore" element={<ExploreVenuesPage />} />
                <Route path="/discover-video" element={<VideoDiscoveryPage />} />
                <Route
                  path="/groups/:groupId"
                  element={
                    <ProtectedRoute>
                      <GroupCollaborationPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/invite/:inviteCode" element={<GroupCollaborationPage />} />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <CustomerDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/partner"
                  element={
                    <ProtectedRoute>
                      <PartnerDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
