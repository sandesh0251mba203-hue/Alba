import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { firebaseUser, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Plan Trip', to: '/planner' },
    { label: 'Explore', to: '/explore' },
    { label: 'Reels', to: '/discover-video' },
    { label: 'Partners', to: '/partner' },
    isSuperAdmin
      ? { label: 'Admin', to: '/admin' }
      : { label: 'Account', to: '/account' },
  ];

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-[#0A1428] whitespace-nowrap shrink-0"
        >
          Alba
        </Link>

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`text-sm font-medium whitespace-nowrap shrink-0 transition-colors border-b-2 py-1 ${
                isActive(item.to)
                  ? 'text-blue-700 border-blue-700'
                  : 'text-slate-600 border-transparent hover:text-[#0A1428] hover:border-slate-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center shrink-0">
          {firebaseUser ? (
            <Link
              to="/planner"
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0A1428] rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              Plan My Trip
            </Link>
          ) : (
            <Link
              to="/auth"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          className="md:hidden p-2.5 rounded-lg text-slate-700 hover:bg-slate-100"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                isActive(item.to)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to={firebaseUser ? '/planner' : '/auth'}
            onClick={() => setMobileOpen(false)}
            className="block w-full text-center px-4 py-2.5 mt-2 rounded-lg text-sm font-semibold text-white bg-blue-700"
          >
            {firebaseUser ? 'Plan My Trip' : 'Sign In'}
          </Link>
        </div>
      )}
    </header>
  );
}
