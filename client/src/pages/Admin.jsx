import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Pencil, Trash2, X, Check, ShieldCheck, ArrowLeft, ArrowRight, Loader2, Users, Package, MapPin,
} from 'lucide-react';
import { api } from '../lib/api.js';

const PAGE_SIZE = 10;

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-900/15 pt-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="editorial-button-outline inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-30"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Prev
      </button>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-900/60">
        Page {page} of {totalPages}
      </p>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="editorial-button-outline inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-30"
      >
        Next <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const emptyArtisan = { name: '', village: '', craft: '', state: '', district: '', bio: '' };

export default function Admin() {
  const [tab, setTab] = useState('artisans');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  const [artisans, setArtisans] = useState([]);
  const [aPage, setAPage] = useState(1);
  const [aTotal, setATotal] = useState(0);
  const [aPages, setAPages] = useState(1);

  const [products, setProducts] = useState([]);
  const [pPage, setPPage] = useState(1);
  const [pTotal, setPTotal] = useState(0);
  const [pPages, setPPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyArtisan);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadArtisans = useCallback((page, q) => {
    setLoading(true);
    setError('');
    api.artisans.search({ q: q || undefined, page, limit: PAGE_SIZE })
      .then((res) => { setArtisans(res.data); setATotal(res.total); setAPages(res.totalPages); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadProducts = useCallback((page, q) => {
    setLoading(true);
    setError('');
    api.products.search({ q: q || undefined, page, limit: PAGE_SIZE })
      .then((res) => { setProducts(res.data); setPTotal(res.total); setPPages(res.totalPages); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'artisans') {
      setAPage(1);
      loadArtisans(1, debounced);
    } else {
      setPPage(1);
      loadProducts(1, debounced);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, debounced]);

  function flash(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  }

  async function createArtisan() {
    try {
      await api.artisans.create(form);
      setCreating(false);
      setForm(emptyArtisan);
      loadArtisans(1, debounced);
      flash('Artisan created');
    } catch (e) { setError(e.message); }
  }

  async function saveArtisan(id) {
    try {
      await api.artisans.update(id, form);
      setEditingId(null);
      setForm(emptyArtisan);
      loadArtisans(aPage, debounced);
      flash('Artisan updated');
    } catch (e) { setError(e.message); }
  }

  async function deleteArtisan(id) {
    if (!window.confirm('Delete this artisan? Artisans with linked products cannot be deleted.')) return;
    try {
      await api.artisans.remove(id);
      loadArtisans(aPage, debounced);
      flash('Artisan deleted');
    } catch (e) { setError(e.message); }
  }

  async function deleteProduct(id) {
    if (!window.confirm('Delete this product from the chain? This re-links the remaining ledger.')) return;
    try {
      await api.products.remove(id);
      loadProducts(pPage, debounced);
      flash('Product deleted · chain re-linked');
    } catch (e) { setError(e.message); }
  }

  const field = (key, label, cls = '') => (
    <label className={`block ${cls}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-900/60">{label}</span>
      <input
        value={form[key] || ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="field-line mt-1 w-full text-sm"
      />
    </label>
  );

  return (
    <main className="min-h-screen pb-28 pt-28 sm:pt-32">
      <div className="mx-auto max-w-6xl px-6">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-900/25 pb-8">
          <div>
            <p className="section-eyebrow">Registry management · प्रशासन</p>
            <h1 className="mt-3 font-serif text-4xl leading-none sm:text-5xl md:text-6xl">
              Maintain the archive.
            </h1>
          </div>
          <p className="handwritten max-w-xs -rotate-1 text-lg text-ink-900/60">
            Edit makers, prune the ledger, keep every record honest.
          </p>
        </header>

        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mt-5 inline-flex items-center gap-2 border border-[#6f775c]/55 bg-[#eef0e5] px-3 py-2 text-xs text-[#596148]"
          >
            <Check className="h-3.5 w-3.5" /> {notice}
          </motion.p>
        )}
        {error && (
          <p className="mt-5 border-l-2 border-red-700 bg-red-900/[0.04] px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex gap-2" role="tablist">
            {[['artisans', 'Artisans', Users], ['products', 'Products', Package]].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  tab === key ? 'bg-ink-900 text-gold-300' : 'border border-ink-900/25 text-ink-900/70 hover:text-ink-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          <label className="relative block w-full max-w-xs">
            <Search className="pointer-events-none absolute bottom-2.5 left-0 h-4 w-4 text-gold-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the registry…"
              className="field-line w-full bg-transparent !pl-7 text-sm"
            />
          </label>
        </div>

        <div className="paper-sheet paper-texture mt-6 border border-[#c9bea8] bg-[#fbf7ed] px-5 py-6 shadow-[0_22px_60px_rgba(54,42,28,0.16)] sm:px-8">
          {tab === 'artisans' ? (
            <>
              {!creating && (
                <button
                  type="button"
                  onClick={() => { setCreating(true); setForm(emptyArtisan); }}
                  className="editorial-button mb-5 inline-flex items-center gap-2 bg-ink-900 px-4 py-2.5 text-xs text-paper-100"
                >
                  <Plus className="h-3.5 w-3.5" /> New artisan
                </button>
              )}

              <AnimatePresence initial={false}>
                {creating && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden border border-gold-500/30 bg-[#f7f1e3] p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {field('name', 'Name *')}
                      {field('village', 'Village *')}
                      {field('craft', 'Craft *')}
                      {field('state', 'State')}
                      {field('district', 'District')}
                      <label className="block">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-900/60">Bio</span>
                        <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="field-line mt-1 w-full resize-none text-sm" rows={2} />
                      </label>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <button type="button" onClick={createArtisan} className="editorial-button bg-ink-900 px-4 py-2 text-xs text-paper-100">
                        <Check className="h-3.5 w-3.5" /> Create
                      </button>
                      <button type="button" onClick={() => setCreating(false)} className="editorial-button-outline px-4 py-2 text-xs">
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-ink-900/50">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : artisans.length === 0 ? (
                <p className="py-14 text-center text-sm text-ink-900/55">No artisans match “{debounced}”.</p>
              ) : (
                <div className="divide-y divide-ink-900/10">
                  {artisans.map((a) => (
                    <div key={a.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-start">
                      {editingId === a.id ? (
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                          {field('name', 'Name *')}
                          {field('village', 'Village *')}
                          {field('craft', 'Craft *')}
                          {field('state', 'State')}
                          {field('district', 'District')}
                          <label className="block">
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-900/60">Bio</span>
                            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="field-line mt-1 w-full resize-none text-sm" rows={2} />
                          </label>
                          <div className="flex items-center gap-3 sm:col-span-full">
                            <button type="button" onClick={() => saveArtisan(a.id)} className="editorial-button bg-ink-900 px-4 py-2 text-xs text-paper-100">
                              <Check className="h-3.5 w-3.5" /> Save
                            </button>
                            <button type="button" onClick={() => { setEditingId(null); setForm(emptyArtisan); }} className="editorial-button-outline px-4 py-2 text-xs">
                              <X className="h-3.5 w-3.5" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-4">
                            <img src={a.photo} alt="" className="h-16 w-14 border border-ink-900/20 object-cover" />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-serif text-xl font-medium">{a.name}</h3>
                                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-900/50">{a.id}</span>
                              </div>
                              <p className="handwritten mt-1 flex items-center gap-1.5 text-sm text-ink-900/65">
                                <MapPin className="h-3.5 w-3.5 text-gold-600" /> {a.village}{a.state ? `, ${a.state}` : ''}
                              </p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-gold-600">{a.craft}</p>
                              <p className="mt-1 max-w-xl text-xs leading-5 text-ink-900/55">{a.bio}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:pt-1">
                            <button
                              type="button"
                              onClick={() => { setEditingId(a.id); setForm({ name: a.name, village: a.village, craft: a.craft, state: a.state || '', district: a.district || '', bio: a.bio || '' }); }}
                              className="editorial-button-outline inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button type="button" onClick={() => deleteArtisan(a.id)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-red-800 hover:bg-red-900/[0.05]">
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Pagination page={aPage} totalPages={aPages} onPage={(p) => { setAPage(p); loadArtisans(p, debounced); }} />
            </>
          ) : (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-16 text-ink-900/50">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : products.length === 0 ? (
                <p className="py-14 text-center text-sm text-ink-900/55">No products match “{debounced}”.</p>
              ) : (
                <div className="divide-y divide-ink-900/10">
                  {products.map((p) => (
                    <div key={p.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-11 shrink-0 items-center justify-center border border-ink-900/15 bg-[#e9e0ce] p-1">
                          <img src={p.image} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={`/product/${p.id}`} className="font-serif text-lg font-medium transition hover:text-gold-600">
                              {p.title}
                            </Link>
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-900/50">{p.id}</span>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-900/60">
                            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-[#596148]" /> Folio {String(p.chain_index).padStart(3, '0')}</span>
                            <span>·</span>
                            <span>{p.artisan_name}</span>
                            <span>·</span>
                            <span className="text-gold-600">{p.category || p.artisan_craft}</span>
                            <span>·</span>
                            <span className="font-serif">₹{Number(p.price || 0).toLocaleString('en-IN')}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <Link to={`/product/${p.id}`} className="editorial-button-outline inline-flex items-center gap-1.5 px-3 py-2 text-xs">
                          <ShieldCheck className="h-3.5 w-3.5" /> View
                        </Link>
                        <button type="button" onClick={() => deleteProduct(p.id)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-red-800 hover:bg-red-900/[0.05]">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Pagination page={pPage} totalPages={pPages} onPage={(p) => { setPPage(p); loadProducts(p, debounced); }} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}