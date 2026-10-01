import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Search, ShieldCheck } from 'lucide-react';
import Reveal from '../components/ui/Reveal.jsx';
import { api } from '../lib/api.js';

function archiveNumber(index) {
  return String(index || 0).padStart(3, '0');
}

export default function Gallery() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.products.list()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) => {
    const q = query.trim().toLowerCase();
    return (
      !q ||
      (p.title || '').toLowerCase().includes(q) ||
      (p.artisan_name || '').toLowerCase().includes(q) ||
      (p.artisan_village || '').toLowerCase().includes(q) ||
      (p.materials || []).some((m) => m.toLowerCase().includes(q))
    );
  });

  return (
    <main className="min-h-screen pb-28 pt-32">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="grid items-end gap-8 border-b border-ink-900/25 pb-10 md:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <p className="section-eyebrow">The living archive · India</p>
              <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[0.98] md:text-7xl">
                Collected by hand.
                <span className="block italic text-gold-600">Verified by record.</span>
              </h1>
            </div>
            <div className="md:pb-1">
              <p className="max-w-sm text-sm leading-7 text-ink-800">
                Each entry preserves its maker, materials, and making process in a tamper-evident
                chain — a public catalogue of India's living craft practice.
              </p>
              <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-900/50">
                Registry 2026 · {products.length} {products.length === 1 ? 'work' : 'works'} held
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="relative block w-full max-w-xl" htmlFor="archive-search">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-900/55">
                Search the catalogue
              </span>
              <Search className="pointer-events-none absolute bottom-3 left-0 h-4 w-4 text-gold-600" />
              <input
                id="archive-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, artisan, village or material"
                className="field-line w-full bg-transparent py-2.5 !pl-7 pr-2 text-sm text-ink-900 outline-none placeholder:text-ink-900/35"
              />
            </label>
            {!loading && (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-900/60">
                Showing {filtered.length} / {products.length}
              </p>
            )}
          </div>
        </Reveal>

        {loading ? (
          <div className="mt-20 border-y border-ink-900/15 py-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-900/60">
              Opening the archive…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="paper-sheet paper-texture mx-auto mt-16 max-w-xl border border-ink-900/15 px-8 py-12 text-center">
            <p className="section-eyebrow">No matching record</p>
            <p className="mt-3 font-serif text-2xl">Nothing is catalogued under “{query}”.</p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="editorial-button-outline mt-7"
            >
              Clear search
            </button>
          </div>
        ) : (
          <motion.div layout className="mt-14 grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <motion.article
                key={p.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.45 }}
              >
                <Link
                  to={`/product/${p.id}`}
                  className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-600"
                  aria-label={`View catalogue record for ${p.title}`}
                >
                  <div className="paper-sheet paper-texture relative border border-[#cfc5b1] bg-[#fbf7ed] p-3 shadow-[0_12px_30px_rgba(54,42,28,0.10)] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_18px_38px_rgba(54,42,28,0.16)] sm:p-4">
                    <div className="border border-[#c8bda7] bg-[#e9e0ce] p-2.5">
                      <div className="aspect-[4/3] overflow-hidden border border-[#b8aa91] bg-[#d9cfbb]">
                        <img
                          src={p.image}
                          alt={p.title}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                          loading="lazy"
                        />
                      </div>
                    </div>

                    <div className="px-1 pb-1 pt-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-900/60">
                            VRS / 2026 / {archiveNumber(p.chain_index)}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-gold-600">
                            {p.category || p.artisan_craft}
                          </p>
                        </div>
                        <span className="verification-stamp inline-flex shrink-0 items-center gap-1.5 border border-[#6f775c]/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#596148]">
                          <ShieldCheck className="h-3.5 w-3.5" /> Verified
                        </span>
                      </div>

                      <div className="ink-rule my-4 border-t" />

                      <h2 className="font-serif text-2xl leading-tight transition-colors group-hover:text-gold-600">
                        {p.title}
                      </h2>
                      <p className="handwritten mt-2 text-base text-ink-800">
                        {p.artisan_name} · {p.artisan_village}
                      </p>

                      <dl className="mt-5 grid grid-cols-[1fr_auto] items-end gap-x-5 border-t border-ink-900/15 pt-4">
                        <div className="min-w-0">
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-900/60">
                            Materials
                          </dt>
                          <dd className="mt-1 truncate text-xs text-ink-800">
                            {(p.materials || []).slice(0, 3).join(' / ') || 'Not recorded'}
                          </dd>
                        </div>
                        <div className="text-right">
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-900/60">
                            Valuation
                          </dt>
                          <dd className="mt-0.5 font-serif text-xl">₹{Number(p.price || 0).toLocaleString('en-IN')}</dd>
                        </div>
                      </dl>

                      <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.17em] text-ink-900/60">
                        <span>{(p.steps || []).length} documented steps</span>
                        <span className="inline-flex items-center gap-1 text-ink-900/65 transition group-hover:text-gold-600">
                          Open record <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </motion.div>
        )}
      </div>
    </main>
  );
}
