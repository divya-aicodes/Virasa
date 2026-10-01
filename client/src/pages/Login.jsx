import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { api } from '../lib/api.js';
import './login.css';

function VirasaMark({ dark = false }) {
  return (
    <div
      className={`flex items-center gap-3 ${
        dark ? 'text-[#f5efe1]' : 'text-[#24211c]'
      }`}
    >
      <span
        className={`relative grid h-9 w-9 place-items-center border ${
          dark ? 'border-[#f5efe1]/55' : 'border-[#24211c]/55'
        }`}
      >
        <span
          className={`absolute inset-[5px] rotate-45 border ${
            dark ? 'border-[#f5efe1]/65' : 'border-[#24211c]/65'
          }`}
        />
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </span>

      <span className="font-['Cormorant_Garamond'] text-[2.35rem] leading-none tracking-[-.035em]">
        Virasā
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  type = 'text',
  icon: Icon,
  value,
  onChange,
  trailing,
}) {
  return (
    <label className="group block" htmlFor={id}>
      <span className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-[.16em] text-[#7c6d58]">
        <span>{label}</span>

        <span className="font-['Space_Mono'] text-[9px] tracking-[.08em] text-[#aa987f]">
          {hint}
        </span>
      </span>

      <span className="virasa-underline flex items-center gap-3 border-b border-[#b6a78f] pb-2.5">
        <Icon
          strokeWidth={1.35}
          className="h-[17px] w-[17px] shrink-0 text-[#8e7e65] transition-colors group-focus-within:text-[#9b5d48]"
        />

        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          autoComplete={id === 'email' ? 'email' : 'current-password'}
          className="min-w-0 flex-1 bg-transparent font-['Space_Grotesk'] text-[13px] text-[#28231d] outline-none placeholder:text-[#b7aa95]"
          placeholder={id === 'email' ? 'your name or studio' : '••••••••••••'}
        />

        {trailing}
      </span>
    </label>
  );
}

export default function Login() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const isRegister = mode === 'register';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    if (!email.trim() || !password) {
      setNotice(isRegister ? 'Fill in your name, email and password to join.' : 'Enter your archive credentials to continue.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      if (isRegister) {
        if (name.trim().length < 2) throw new Error('Name must be at least 2 characters');
        await api.auth.register({ name: name.trim(), email: email.trim(), password });
        setMode('login');
        setNotice('Account created. Sign in to continue.');
      } else {
        const user = await login(email.trim(), password);
        setNotice(user.role === 'admin' ? 'Welcome back. The archive is open.' : 'Signed in. Welcome back.');
        navigate(user.role === 'admin' ? '/admin' : '/artisan', { replace: true });
      }
    } catch (e) {
      setNotice(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="virasa-login-shell min-h-[100dvh] bg-[#e9e2d5] text-[#24211c]">
      <div className="grid min-h-[100dvh] w-full lg:grid-cols-[minmax(0,1.08fr)_minmax(430px,.72fr)]">
        <section className="virasa-grain relative hidden min-h-[590px] overflow-hidden bg-[#211c17] px-12 py-10 text-[#f5efe1] lg:flex lg:flex-col lg:justify-between xl:px-[7vw]">
          <div className="virasa-enter relative z-10">
            <VirasaMark dark />

            <p className="mt-3 max-w-[250px] border-l border-[#b89a57] pl-3 text-[9px] uppercase leading-[1.7] tracking-[.2em] text-[#b9aa8d]">
              Digital provenance for India&apos;s handmade heritage
            </p>
          </div>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-10">
            <div className="virasa-enter virasa-enter-delay-1 relative w-[min(66%,410px)] rotate-[-3deg] border-[10px] border-[#3e3428] bg-[#4a3b2a] p-2 shadow-[12px_18px_0_rgba(0,0,0,.22),0_26px_40px_rgba(0,0,0,.32)]">
              <div className="absolute -top-5 left-1/2 z-10 h-7 w-28 -translate-x-1/2 rotate-[2deg] bg-[#b99a51] opacity-90 shadow-[0_2px_2px_rgba(0,0,0,.25)]" />

              <div className="aspect-[.94] overflow-hidden border border-[#968361]/60 bg-[#d8ccb4]">
                <img
                  src="/uploads/product-KC-A1B2C3-final.svg"
                  alt="Framed Madhubani-inspired mandala artwork"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="pointer-events-none absolute inset-0 border border-[#d4bb81]/20" />
            </div>

            <div className="mt-11 text-center">
              <div className="mx-auto mb-3 h-px w-32 bg-[#b89a57]" />

              <p className="font-['Kalam'] text-[16px] leading-tight text-[#ded1ba]">
                proof should feel as human
                <br />
                as the hands it protects
              </p>

              <p className="mt-2 font-['Noto_Serif_Devanagari'] text-[12px] text-[#ab9c83]">
                प्रमाण उतना ही मानवीय हो, जितने वे हाथ जिन्हें यह बचाता है
              </p>
            </div>
          </div>

          <div className="virasa-enter virasa-enter-delay-2 relative z-10 flex items-end justify-between gap-5 border-t border-[#665542]/65 pt-5 text-[9px] uppercase tracking-[.15em] text-[#82745f]">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-[#b89a57]" />
              Chain verified · SHA-256
            </span>

            <span className="font-['Space_Mono'] text-[8px] text-[#675b4b]">
              VA / 01—26
            </span>
          </div>
        </section>

        <section className="relative flex min-h-[100dvh] flex-col justify-between overflow-hidden bg-[#ede6d9] px-6 py-7 sm:px-12 sm:py-10 lg:px-[clamp(3rem,7vw,7.5rem)] lg:py-12">
          <div className="mx-auto flex w-full max-w-[515px] items-center justify-between lg:justify-end">
            <div className="lg:hidden">
              <VirasaMark />
            </div>

            <div className="flex items-center gap-2 text-[9px] uppercase tracking-[.17em] text-[#927e5c]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9b5d48]" />
              Archive access
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[515px] flex-1 items-center py-10 lg:py-4">
            <div className="virasa-paper virasa-enter virasa-enter-delay-1 w-full bg-[#f5efe1] px-7 py-9 sm:px-11 sm:py-12">
              <div className="virasa-stamp absolute right-7 top-6 z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[#a88b4a] text-center text-[7px] uppercase leading-[1.25] tracking-[.13em] text-[#9b7e41]">
                <span className="absolute inset-1 rounded-full border border-dashed border-[#a88b4a]" />

                <span className="relative">
                  Verified
                  <br />
                  Archive
                  <br />
                  <span className="font-['Noto_Serif_Devanagari'] text-[10px] normal-case tracking-normal">
                    सत्यापित
                  </span>
                </span>
              </div>

              <div className="max-w-[360px]">
                <p className="mb-4 font-['Space_Mono'] text-[9px] uppercase tracking-[.18em] text-[#9a8052]">
                  {isRegister ? '02 / join the archive' : '01 / keeper sign-in'}
                </p>

                <h1 className="font-['Cormorant_Garamond'] text-[clamp(2.45rem,4vw,3.65rem)] font-semibold leading-[.9] tracking-[-.03em] text-[#29241d]">
                  {isRegister ? 'Become a keeper' : 'Welcome back'}

                  <span className="mt-1 block font-['Noto_Serif_Devanagari'] text-[clamp(1.65rem,3vw,2.4rem)] font-normal leading-[1.1]">
                    {isRegister ? 'संग्रहकर्ता बनें' : 'स्वागत है'}
                  </span>
                </h1>

                <p className="mt-5 font-['Kalam'] text-[14px] italic leading-snug text-[#6f5e4a]">
                  {isRegister
                    ? 'Claim your studio. Give your work a verifiable provenance record.'
                    : 'Preserve the trace. Carry the craft forward.'}
                </p>
              </div>

              <form className="mt-9 space-y-6" onSubmit={handleSubmit}>
                {isRegister && (
                  <Field
                    id="name"
                    label="Name"
                    hint="public"
                    icon={UserRound}
                    value={name}
                    onChange={setName}
                  />
                )}

                <Field
                  id="email"
                  label="Email"
                  hint={isRegister ? 'your email' : 'transparent'}
                  icon={Mail}
                  value={email}
                  onChange={setEmail}
                />

                <Field
                  id="password"
                  label="Password"
                  hint="password"
                  type={revealed ? 'text' : 'password'}
                  icon={KeyRound}
                  value={password}
                  onChange={setPassword}
                  trailing={
                    <button
                      type="button"
                      aria-label={revealed ? 'Hide password' : 'Show password'}
                      onClick={() => setRevealed((value) => !value)}
                      className="text-[#8e7e65] transition-colors hover:text-[#9b5d48]"
                    >
                      {revealed ? (
                        <EyeOff className="h-[16px] w-[16px]" strokeWidth={1.35} />
                      ) : (
                        <Eye className="h-[16px] w-[16px]" strokeWidth={1.35} />
                      )}
                    </button>
                  }
                />

                <div className="flex items-center justify-between gap-4 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setRemember((value) => !value)}
                    className="flex items-center gap-2 text-[11px] text-[#5f5345]"
                  >
                    <span
                      className={`grid h-[14px] w-[14px] place-items-center border ${
                        remember
                          ? 'border-[#9b5d48] bg-[#9b5d48] text-[#f5efe1]'
                          : 'border-[#98886f]'
                      } transition-colors`}
                    >
                      {remember && <Check className="h-3 w-3" strokeWidth={2.5} />}
                    </span>

                    Remember me
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNotice(
                        'Resets are handled by the archive team — ask your administrator, or run: npm run reset-password -- <email> <new password>',
                      )
                    }
                    className="text-[11px] text-[#917342] underline decoration-[#c4ae7d] underline-offset-4 transition-colors hover:text-[#9b5d48]"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="group flex w-full items-center justify-center gap-3 bg-[#29251f] px-5 py-3.5 text-[11px] uppercase tracking-[.14em] text-[#f5efe1] shadow-[0_4px_0_#b89a57] transition-transform hover:-translate-y-0.5 hover:bg-[#3b3127] active:translate-y-0 disabled:translate-y-0 disabled:opacity-60"
                >
                  <span>{isRegister ? 'Create your account' : 'Sign in to the archive'}</span>

                  <span className="font-['Noto_Serif_Devanagari'] text-[11px] normal-case tracking-normal text-[#cfb982]">
                    {isRegister ? 'खाता बनाएँ' : 'संग्रह में प्रवेश करें'}
                  </span>

                  <ArrowUpRight className="h-3.5 w-3.5 text-[#b89a57] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>

                {notice && (
                  <p
                    role="status"
                    className="border-l-2 border-[#b89a57] pl-3 text-[10px] leading-relaxed text-[#7a674d]"
                  >
                    {notice}
                  </p>
                )}
              </form>

              <div className="my-8 flex items-center gap-4 text-[9px] uppercase tracking-[.16em] text-[#ad9b7e]">
                <span className="h-px flex-1 bg-[#d6c9b5]" />
                <span>or</span>
                <span className="h-px flex-1 bg-[#d6c9b5]" />
              </div>

              {isRegister ? (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setNotice(''); }}
                  className="group flex w-full items-center justify-center gap-2 border border-[#98866a] px-5 py-3 text-[11px] uppercase tracking-[.13em] text-[#514638] transition-colors hover:border-[#9b5d48] hover:text-[#9b5d48]"
                >
                  <span>Back to sign in</span>

                  <span className="font-['Noto_Serif_Devanagari'] text-[11px] normal-case tracking-normal">
                    साइन इन करें
                  </span>

                  <ArrowUpRight className="h-3.5 w-3.5 opacity-65 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMode('register'); setNotice(''); }}
                  className="group flex w-full items-center justify-center gap-2 border border-[#98866a] px-5 py-3 text-[11px] uppercase tracking-[.13em] text-[#514638] transition-colors hover:border-[#9b5d48] hover:text-[#9b5d48]"
                >
                  <span>Request access</span>

                  <span className="font-['Noto_Serif_Devanagari'] text-[11px] normal-case tracking-normal">
                    पहुँच का अनुरोध
                  </span>

                  <ArrowUpRight className="h-3.5 w-3.5 opacity-65 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              )}
            </div>
          </div>

          <footer className="mx-auto flex w-full max-w-[515px] items-end justify-between gap-4 border-t border-[#d2c5b3] pt-4 text-[9px] uppercase tracking-[.13em] text-[#9e8c70]">
            <span>Virasā · Heritage provenance system</span>

            <span className="font-['Space_Mono'] text-[8px]">Registration 2026</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
