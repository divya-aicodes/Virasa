import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Reveal from '../components/ui/Reveal.jsx';
import VirasaLogo from '../components/VirasaLogo.jsx';
import { api } from '../lib/api.js';

function shortHash(hash) {
  if (!hash) return 'GENESIS';
  return `${hash.slice(0, 8)}…${hash.slice(-5)}`;
}

export default function VerifyPage() {
  const [params] = useSearchParams();
  const [input, setInput] = useState(params.get('id') || '');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [chain, setChain] = useState([]);

  useEffect(() => {
    api.verify.chain().then((c) => setChain(c.chain || [])).catch(() => {});
  }, []);

  async function check(id) {
    const clean = id.trim().toUpperCase();
    if (!clean) return;
    setInput(clean);
    setStatus('verifying');
    setResult(null);
    try {
      const res = await api.verify.check(clean);
      setResult(res);
      setStatus(res.valid ? 'valid' : 'invalid');
    } catch {
      setStatus('invalid');
      setResult({ valid: false, reason: 'Not found in the chain' });
    }
  }

  useEffect(() => {
    const id = params.get('id');
    if (id) check(id);
  }, [params]);

  const activeId = input.trim().toUpperCase();

  return (
    <main className="min-h-screen pb-28 pt-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="grid items-end gap-7 md:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <p className="section-eyebrow">Public authenticity register</p>
              <h1 className="mt-4 font-serif text-5xl leading-[0.98] md:text-7xl">
                Trace the mark.
                <span className="block italic text-gold-600">Trust the making.</span>
              </h1>
            </div>
            <p className="text-sm leading-7 text-ink-800 md:pb-1">
              Enter the accession ID printed on a Virasā certificate. The registry recomputes its
              fingerprint and checks every link that came before it.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <section className="paper-sheet paper-texture relative mt-12 border border-[#c9bea8] bg-[#fbf7ed] px-5 py-7 shadow-[0_22px_60px_rgba(54,42,28,0.16)] sm:px-8 sm:py-9 lg:px-12 lg:py-11">
            <header className="flex items-start justify-between gap-8">
              <div>
                <VirasaLogo size="small" />
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.24em] text-ink-900/55">Mithila living archive</p>
                <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">Certificate of Provenance</h2>
                <p className="handwritten mt-1.5 text-base text-ink-800">A public record of hand, place, and process</p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-900/60">Register / 2026</p>
                <p className="mt-2 font-serif text-xl italic text-gold-600">SHA—256</p>
              </div>
            </header>

            <div className="ink-rule my-7 border-t" />

            <div className="grid gap-10">
              <div className="lg:pr-10">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-900/55">
                    01 · Find a certificate
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      check(input);
                    }}
                    className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end"
                  >
                    <label className="block flex-1" htmlFor="certificate-id">
                      <span className="mb-1.5 block text-xs text-ink-800">Accession / product ID</span>
                      <input
                        id="certificate-id"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="e.g. KC-A1B2C3"
                        autoComplete="off"
                        spellCheck="false"
                        className="field-line w-full bg-transparent py-2.5 font-mono text-sm uppercase tracking-[0.08em] text-ink-900 outline-none placeholder:text-ink-900/30"
                      />
                    </label>
                    <button type="submit" className="editorial-button shrink-0 sm:mb-px">
                      <ShieldCheck className="h-4 w-4" /> Verify record
                    </button>
                  </form>
                </div>

                {result?.valid && result?.product && (
                  <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-7 border-y border-[#788064]/45 bg-[#eef0e5]/55 py-4"
                    aria-live="polite"
                  >
                    <Link to={`/product/${result.product.id}`} className="group grid grid-cols-[5.25rem_1fr_auto] items-center gap-4 px-3">
                      <div className="border border-[#bdb29d] bg-[#f8f2e5] p-1.5">
                        <img src={result.product.image} alt="" className="aspect-[4/3] h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="verification-stamp inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#596148]">
                          <ShieldCheck className="h-3.5 w-3.5" /> Record intact
                        </p>
                        <h3 className="mt-1 truncate font-serif text-xl transition-colors group-hover:text-gold-600">
                          {result.product.title}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-ink-800">
                          {result.product.artisan_name} · {result.product.artisan_village}
                        </p>
                      </div>
                      <ArrowRight className="hidden h-5 w-5 text-gold-600 transition-transform group-hover:translate-x-1 sm:block" />
                    </Link>
                  </motion.section>
                )}

                {status === 'invalid' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-7 border-y border-[#9b554a]/45 bg-[#f4e8e2]/60 px-3 py-4"
                    aria-live="polite"
                  >
                    <p className="font-serif text-lg text-[#87483f]">No intact certificate was found.</p>
                    <p className="mt-1 text-xs leading-5 text-ink-800">
                      {result?.reason || result?.verify?.reason || 'The stored record no longer matches its chained fingerprint.'}
                    </p>
                  </motion.div>
                )}

                <div className="mt-10">
                  <div className="flex items-end justify-between gap-4 border-b border-ink-900/25 pb-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-900/55">
                        02 · Chain ledger
                      </p>
                      <p className="mt-1 text-xs text-ink-900/60">Select any registered block to inspect it.</p>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-900/60">
                      {chain.length} linked {chain.length === 1 ? 'entry' : 'entries'}
                    </p>
                  </div>

                  <div className="max-h-[20rem] overflow-y-auto border-b border-ink-900/25">
                    {chain.map((block) => {
                      const selected = activeId === block.id;
                      return (
                        <button
                          type="button"
                          key={`${block.id}-${block.chain_index}`}
                          onClick={() => check(block.id)}
                          className={`grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-ink-900/12 px-2 py-3 text-left transition-colors first:border-t-0 ${
                            selected ? 'bg-[#e9e6d8] text-ink-900' : 'hover:bg-[#f2ecdf]'
                          }`}
                        >
                          <span className={`font-serif text-lg ${selected ? 'text-gold-600' : 'text-ink-900/60'}`}>
                            {String(block.chain_index).padStart(2, '0')}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-serif text-sm">{block.title}</span>
                            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-900/60">
                              {block.id} · revision {block.revision_no}
                            </span>
                          </span>
                          <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-ink-900/55 sm:block">
                            {shortHash(block.hash)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <footer className="mt-9 flex flex-col gap-2 border-t border-ink-900/20 pt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-900/55 sm:flex-row sm:items-center sm:justify-between">
              <span>Canonical record · linked hash · independent verification</span>
              <span>Virasā / Heritage provenance system</span>
            </footer>
          </section>
        </Reveal>
      </div>
    </main>
  );
}
