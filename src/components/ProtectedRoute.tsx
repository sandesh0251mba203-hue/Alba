import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { firebaseUser, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-600">Verifying session...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/auth" replace />;
  }

  if (requireAdmin && !isSuperAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <h2 className="text-lg font-bold text-slate-900">Super Admin Access Required</h2>
          <p className="text-sm text-slate-600 mt-2">
            Only verified Alba Super Administrators can access the Command Centre. Public Super
            Admin registration is disabled.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
