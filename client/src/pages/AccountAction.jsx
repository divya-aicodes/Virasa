import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';

export default function AccountAction() {
  const { pathname, search } = useLocation();
  const token = new URLSearchParams(search).get('token') || '';
  const isVerification = pathname === '/verify-email';
  const [status, setStatus] = useState(isVerification ? 'Verifying your email…' : '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(isVerification);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!isVerification) return;
    if (!token) {
      setStatus('This verification link is incomplete.');
      setBusy(false);
      return;
    }

    let active = true;
    api.auth.verifyEmail(token)
      .then(() => {
        if (active) {
          setComplete(true);
          setStatus('Your email is verified. You can now sign in.');
        }
      })
      .catch((error) => {
        if (active) setStatus(error.message || 'This verification link is invalid or expired.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [isVerification, token]);

  const resetPassword = async (event) => {
    event.preventDefault();
    if (!token) return setStatus('This reset link is incomplete.');
    if (password.length < 10) return setStatus('Use at least 10 characters for your new password.');
    if (password !== confirmation) return setStatus('The passwords do not match.');

    setBusy(true);
    setStatus('');
    try {
      await api.auth.resetPassword(token, password);
      setComplete(true);
      setStatus('Your password has been changed. You can now sign in.');
    } catch (error) {
      setStatus(error.message || 'This reset link is invalid or expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#e9e2d5] px-5 py-12 text-[#29241d]">
      <section className="w-full max-w-lg border border-[#b9a98d] bg-[#f5efe1] p-8 shadow-[10px_12px_0_#c6b48f] sm:p-12" aria-labelledby="account-action-title">
        <div className="mb-7 flex h-12 w-12 items-center justify-center border border-[#9a7b42] text-[#9a7b42]">
          {isVerification ? <ShieldCheck aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
        </div>
        <p className="font-['Space_Mono'] text-[9px] uppercase tracking-[.2em] text-[#927748]">Virasā account security</p>
        <h1 id="account-action-title" className="mt-3 font-['Cormorant_Garamond'] text-5xl font-semibold leading-none">
          {isVerification ? 'Verify your email' : 'Choose a new password'}
        </h1>

        {!isVerification && !complete && (
          <form className="mt-8 space-y-5" onSubmit={resetPassword}>
            <label className="block text-xs uppercase tracking-[.14em] text-[#6f604d]" htmlFor="new-password">
              New password
              <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full border border-[#ad9e86] bg-transparent px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#9b5d48]" />
            </label>
            <label className="block text-xs uppercase tracking-[.14em] text-[#6f604d]" htmlFor="confirm-password">
              Confirm password
              <input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full border border-[#ad9e86] bg-transparent px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#9b5d48]" />
            </label>
            <button type="submit" disabled={busy} className="w-full bg-[#29251f] px-5 py-3.5 text-xs uppercase tracking-[.14em] text-[#f5efe1] disabled:opacity-60">
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        {status && <p role="status" className="mt-7 border-l-2 border-[#b89a57] pl-4 text-sm leading-relaxed text-[#6f5e4a]">{status}</p>}
        {(complete || (isVerification && !busy)) && <Link to="/login" className="mt-7 inline-block text-xs uppercase tracking-[.14em] text-[#8b6338] underline underline-offset-4">Return to sign in</Link>}
      </section>
    </main>
  );
}
