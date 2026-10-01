import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../auth.jsx';

const primaryLinks = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Collection' },
];

const utilityLinks = [
  { to: '/verify', label: 'Verify a piece' },
  { to: '/artisan', label: 'For artisans' },
  { to: '/login', label: 'Sign in' },
];

function DesktopLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative py-2 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:bg-gold-500 after:transition-transform ${
          isActive
            ? 'text-ink-900 after:scale-x-100'
            : 'text-ink-900/58 after:scale-x-0 hover:text-ink-900 hover:after:scale-x-100'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleLinks = user
    ? [
        { to: '/verify', label: 'Verify a piece' },
        user.role === 'admin'
          ? { to: '/admin', label: 'Maintain archive' }
          : { to: '/artisan', label: 'My studio' },
      ]
    : utilityLinks;

  function confirmSignOut() {
    setOpen(false);
    setConfirming(true);
  }

  function handleSignOut() {
    logout().then(() => {
      setConfirming(false);
      navigate('/');
    });
  }

  return (
    <motion.header
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.65, ease: [0.22, 0.65, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b border-ink-900/15 bg-[#eeeae4]"
    >
      <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
          {primaryLinks.map((link) => (
            <DesktopLink key={link.to} to={link.to}>{link.label}</DesktopLink>
          ))}
        </nav>

        <Link
          to="/"
          aria-label="Virasā home"
          className="group md:absolute md:left-1/2 md:-translate-x-1/2"
        >
          <span className="font-serif text-[2.15rem] font-medium leading-none tracking-[-0.035em] text-ink-900">
            Virasā
          </span>
          <span className="mx-auto mt-1 block h-px w-8 bg-gold-500 transition-all duration-300 group-hover:w-14" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Utility navigation">
          {visibleLinks.map((link) => (
            <DesktopLink key={link.to} to={link.to}>{link.label}</DesktopLink>
          ))}
          {user && (
            <button
              type="button"
              onClick={confirmSignOut}
              className="flex items-center gap-1.5 py-2 text-[12px] font-medium uppercase tracking-[0.16em] text-ink-900/58 transition-colors hover:text-ink-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              {user.name} · Sign out
            </button>
          )}
        </nav>

        <button
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center border border-ink-900/35 text-ink-900 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28 }}
            className="paper-sheet border-x-0 border-b-0 md:hidden"
            aria-label="Mobile navigation"
          >
            <div className="grid grid-cols-2 gap-px bg-ink-900/15 p-px">
              {[...primaryLinks, ...visibleLinks].map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-16 items-center justify-center gap-2 bg-[#f8f3ea] px-3 text-center text-xs font-medium uppercase tracking-[0.14em] ${
                      isActive ? 'text-gold-600' : 'text-ink-900/70'
                    }`
                  }
                >
                  {(link.to === '/verify' || link.to === '/admin') && <ShieldCheck className="h-4 w-4" />}
                  {link.label}
                </NavLink>
              ))}
              {user && (
                <button
                  type="button"
                  onClick={confirmSignOut}
                  className="flex min-h-16 items-center justify-center gap-2 bg-[#f8f3ea] px-3 text-center text-xs font-medium uppercase tracking-[0.14em] text-ink-900/70"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/60 px-6 backdrop-blur-[2px]"
            onClick={() => setConfirming(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="signout-title"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 0.65, 0.3, 1] }}
              className="paper-sheet w-full max-w-sm bg-[#fbf7ed] p-8 text-center shadow-[0_30px_80px_rgba(20,14,8,0.45)]"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-gold-500/50 text-gold-600">
                <LogOut className="h-5 w-5" strokeWidth={1.6} />
              </span>

              <h2
                id="signout-title"
                className="mt-5 font-serif text-2xl leading-none text-ink-900"
              >
                Sign out of Virasā?
              </h2>

              <p className="mt-3 text-sm leading-6 text-ink-900/60">
                {user?.name ? `${user.name}, you` : 'You'} will need to sign in again to manage
                or verify records.
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="editorial-button-outline px-4 py-2.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="editorial-button bg-ink-900 px-4 py-2.5 text-xs text-paper-100"
                >
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
