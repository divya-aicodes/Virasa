import { Link, Navigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth.jsx';

export default function RequireAdmin({ children }) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== 'admin') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="mx-auto max-w-md text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-gold-600" />
          <h1 className="mt-5 font-serif text-3xl leading-none text-ink-900">
            Registry access is reserved for keepers.
          </h1>
          <p className="mt-4 text-sm leading-6 text-ink-900/60">
            You&apos;re signed in as {user.name} ({user.role}). The registry can only be
            managed by administrator accounts.
          </p>
          <Link
            to="/"
            className="editorial-button mt-7 inline-flex items-center gap-2 bg-ink-900 px-5 py-2.5 text-xs text-paper-100"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return children;
}