import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, MapPin, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SUPPORTED_CITIES } from '../data/bengaluruCatalog';

export function AuthPage() {
  const {
    firebaseUser,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    refreshAuthUser,
  } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
        navigate('/account');
      } else if (mode === 'register') {
        await registerWithEmail({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          city,
        });
        setNotice(
          'Account created. We sent a verification link to your inbox—please verify your email to unlock bookings and group collaboration.'
        );
      } else {
        await sendPasswordReset(email.trim());
        setNotice('Password reset instructions sent to your email address.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (msg.includes('operation-not-allowed')) {
        setError(
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). Please use Google Sign-In below or enable Email/Password in Firebase Console.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (firebaseUser && !firebaseUser.emailVerified) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 space-y-5">
          <div className="flex items-center gap-3 text-blue-700">
            <Mail className="w-6 h-6 shrink-0" />
            <h1 className="font-display text-xl font-bold text-[#0A1428]">
              Verify Your Email Address
            </h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Signed in as <span className="font-semibold text-slate-900">{firebaseUser.email}</span>.
            Alba requires verified email addresses before creating group trips, itineraries, or
            booking requests.
          </p>
          {notice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              {notice}
            </div>
          )}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={async () => {
                await refreshAuthUser();
                navigate('/account');
              }}
              className="w-full py-2.5 px-4 bg-[#0A1428] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              I Verified My Email — Continue
            </button>
            <button
              type="button"
              onClick={async () => {
                await resendVerificationEmail();
                setNotice('Verification email resent. Please check your inbox.');
              }}
              className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg transition-colors"
            >
              Resend Verification Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-[#0A1428] tracking-tight">
            {mode === 'login'
              ? 'Sign in to Alba'
              : mode === 'register'
              ? 'Create your Alba account'
              : 'Reset your password'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Plan group outings, vote on itineraries, and manage venue bookings.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="w-full py-2.5 px-4 bg-[#0A1428] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2.5"
        >
          <span>Continue with Google</span>
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="flex-1 h-px bg-slate-200" />
          <span>or use email</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setNotice('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setNotice('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setError('');
              setNotice('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === 'forgot' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Reset
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary City
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {SUPPORTED_CITIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
              {error}
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <span>{notice}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign In'
              : mode === 'register'
              ? 'Create Account'
              : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  );
}
