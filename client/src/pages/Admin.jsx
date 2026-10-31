import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import {
  ArrowLeft, ArrowRight, Check, FileClock, Loader2, MapPin, Package,
  Pencil, Plus, Scale, Search, ShieldCheck, Trash2, Users, X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';

const PAGE_SIZE = 10;
const emptyArtisan = { name: '', village: '', craft: '', state: '', district: '', bio: '', pehchanId: '' };
const emptyProduct = { title: '', description: '', category: '', price: '', materials: '', correctionReason: '' };

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-900/15 pt-4">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="editorial-button-outline inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-30">
        <ArrowLeft className="h-3.5 w-3.5" /> Prev
      </button>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-900/60">Page {page} of {totalPages}</p>
      <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="editorial-button-outline inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-30">
        Next <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
function Status({ value }) {
  const tones = {
    verified: 'border-green-800/30 bg-green-900/[0.06] text-green-800',
    pending: 'border-amber-700/30 bg-amber-700/[0.06] text-amber-800',
    draft: 'border-slate-700/25 bg-slate-700/[0.05] text-slate-700',
    disputed: 'border-red-800/30 bg-red-900/[0.06] text-red-800',
    rejected: 'border-red-800/30 bg-red-900/[0.06] text-red-800',
    archived: 'border-ink-900/20 bg-ink-900/[0.04] text-ink-900/50',
    open: 'border-red-800/30 bg-red-900/[0.06] text-red-800',
    under_review: 'border-amber-700/30 bg-amber-700/[0.06] text-amber-800',
    resolved: 'border-green-800/30 bg-green-900/[0.06] text-green-800',
    reverification_required: 'border-violet-800/30 bg-violet-900/[0.06] text-violet-800',
  };
  return <span className={`inline-flex border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] ${tones[value] || tones.draft}`}>{String(value || 'unknown').replace('_', ' ')}</span>;
}

export default function Admin() {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState('products');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [artisans, setArtisans] = useState([]);
  const [products, setProducts] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyArtisan);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaQr, setMfaQr] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (activeTab = tab, nextPage = page, q = debounced) => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'artisans') {
        const result = await api.artisans.search({ q: q || undefined, page: nextPage, limit: PAGE_SIZE });
        setArtisans(result.data); setTotalPages(result.totalPages || 1);
      } else if (activeTab === 'products') {
        const result = await api.products.search({ q: q || undefined, page: nextPage, limit: PAGE_SIZE });
        setProducts(result.data); setTotalPages(result.totalPages || 1);
      } else if (activeTab === 'disputes') {
        const result = await api.disputes.list(); setDisputes(result.data || []); setTotalPages(1);
      } else {
        const result = await api.audit.list(100); setAuditRows(result.data || []); setTotalPages(1);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [tab, page, debounced]);

  useEffect(() => {
    setPage(1);
    load(tab, 1, debounced);
  }, [tab, debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  function flash(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 3000);
  }

  async function createArtisan() {
    try {
      await api.artisans.create(form); setCreating(false); setForm(emptyArtisan); flash('Artisan created'); load('artisans', 1);
    } catch (actionError) { setError(actionError.message); }
  }

  async function saveArtisan(id) {
    try {
      await api.artisans.update(id, form); setEditingId(null); setForm(emptyArtisan); flash('Artisan updated'); load('artisans', page);
    } catch (actionError) { setError(actionError.message); }
  }

  async function archiveArtisan(id) {
    if (!window.confirm('Archive this artisan profile? Linked product records prevent archival.')) return;
    try { await api.artisans.remove(id); flash('Artisan archived'); load('artisans', page); } catch (actionError) { setError(actionError.message); }
  }

  async function verifyPehchan(id) {
    if (!window.confirm('Confirm that the PEHCHAN ID and artisan details match the official Handicrafts artisan database?')) return;
    try {
      await api.artisans.verifyPehchan(id, 'Matched against the official Handicrafts artisan database');
      flash('PEHCHAN identity verified');
      load('artisans', page);
    } catch (actionError) { setError(actionError.message); }
  }

  async function rejectPehchan(id) {
    const reason = window.prompt('Why could the PEHCHAN identity not be verified?');
    if (!reason) return;
    try {
      await api.artisans.rejectPehchan(id, reason);
      flash('PEHCHAN review returned with a reason');
      load('artisans', page);
    } catch (actionError) { setError(actionError.message); }
  }

  async function approveProduct(id) {
    try { await api.products.approve(id, 'Evidence and ownership reviewed by archive administrator'); flash('Record verified'); load('products', page); } catch (actionError) { setError(actionError.message); }
  }

  async function rejectProduct(id) {
    const reason = window.prompt('Why is this record being rejected?');
    if (!reason) return;
    try { await api.products.reject(id, reason); flash('Record returned with a reason'); load('products', page); } catch (actionError) { setError(actionError.message); }
  }

  async function archiveProduct(id) {
    if (!window.confirm('Archive this record? Its revision history will remain intact.')) return;
    try { await api.products.remove(id); flash('Record archived; history preserved'); load('products', page); } catch (actionError) { setError(actionError.message); }
  }

  function beginProductEdit(product) {
    setEditingProductId(product.id);
    setProductForm({
      title: product.title || '',
      description: product.description || '',
      category: product.category || '',
      price: product.price ?? '',
      materials: (product.materials || []).join(', '),
      correctionReason: '',
    });
  }

  async function saveProduct(product) {
    if (product.status === 'verified' && productForm.correctionReason.trim().length < 10) {
      setError('Explain a verified-record correction in at least 10 characters.');
      return;
    }
    try {
      await api.products.update(product.id, {
        title: productForm.title.trim(),
        description: productForm.description.trim(),
        category: productForm.category.trim(),
        price: Number(productForm.price),
        materials: productForm.materials.split(',').map((item) => item.trim()).filter(Boolean),
        correctionReason: productForm.correctionReason.trim(),
      });
      setEditingProductId(null);
      setProductForm(emptyProduct);
      flash('Product record updated; a revision was appended');
      load('products', page);
    } catch (actionError) { setError(actionError.message); }
  }

  async function startMfaSetup() {
    setError('');
    try {
      const setup = await api.auth.mfaSetup();
      setMfaSetup(setup);
      setMfaQr(await QRCode.toDataURL(setup.uri, { width: 220, margin: 1 }));
    } catch (actionError) { setError(actionError.message); }
  }

  async function confirmMfa() {
    if (!/^\d{6}$/.test(mfaCode)) return setError('Enter the 6-digit authenticator code.');
    try {
      await api.auth.mfaConfirm(mfaSetup.setupToken, mfaCode);
      await refresh();
      setMfaSetup(null); setMfaQr(''); setMfaCode('');
      flash('Administrator MFA is enabled');
    } catch (actionError) { setError(actionError.message); }
  }

  async function resolveDispute(id, status) {
    const resolution = window.prompt(status === 'rejected' ? 'Explain why the dispute is rejected:' : 'Record the resolution and required correction:');
    if (!resolution) return;
    try { await api.disputes.update(id, { status, resolution }); flash(`Dispute ${status.replace('_', ' ')}`); load('disputes', 1); } catch (actionError) { setError(actionError.message); }
  }

  const field = (key, label) => (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-900/60">{label}</span>
      <input value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="field-line mt-1 w-full text-sm" />
    </label>
  );

  const tabs = [
    ['products', 'Review records', Package],
    ['artisans', 'Artisans', Users],
    ['disputes', 'Disputes', Scale],
    ['audit', 'Audit log', FileClock],
  ];

  return (
    <main className="min-h-screen pb-28 pt-28 sm:pt-32">
      <div className="mx-auto max-w-6xl px-6">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-900/25 pb-8">
          <div>
            <p className="section-eyebrow">Registry governance · प्रशासन</p>
            <h1 className="mt-3 font-serif text-4xl leading-none sm:text-5xl md:text-6xl">Maintain the archive.</h1>
          </div>
          <p className="handwritten max-w-xs -rotate-1 text-lg text-ink-900/60">Review evidence, resolve disputes, preserve every revision.</p>
        </header>

        {notice && <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 inline-flex items-center gap-2 border border-[#6f775c]/55 bg-[#eef0e5] px-3 py-2 text-xs text-[#596148]"><Check className="h-3.5 w-3.5" /> {notice}</motion.p>}
        {error && <p className="mt-5 border-l-2 border-red-700 bg-red-900/[0.04] px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

        <section className="mt-6 border border-ink-900/20 bg-[#f7f1e5] p-4" aria-labelledby="admin-security-title">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 id="admin-security-title" className="font-serif text-xl">Administrator security</h2><p className="mt-1 text-xs text-ink-900/55">Authenticator-based MFA protects archive maintenance access.</p></div>
            {user?.mfaEnabled ? <Status value="verified" /> : <button type="button" onClick={startMfaSetup} className="editorial-button px-4 py-2 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> Enable MFA</button>}
          </div>
          {mfaSetup && (
            <div className="mt-5 grid gap-5 border-t border-ink-900/15 pt-5 sm:grid-cols-[220px_1fr]">
              {mfaQr && <img src={mfaQr} alt="QR code for adding Virasā to an authenticator app" className="h-[220px] w-[220px] border border-ink-900/20" />}
              <div><p className="text-sm leading-6 text-ink-900/70">Scan this code in your authenticator app, or enter the setup key manually. Confirm one code before leaving this page.</p><code className="mt-3 block break-all border border-ink-900/15 bg-white/50 p-3 text-xs">{mfaSetup.secret}</code><label className="mt-4 block text-[10px] font-semibold uppercase tracking-[.16em] text-ink-900/60" htmlFor="mfa-confirm-code">6-digit code<input id="mfa-confirm-code" inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="field-line mt-1 block w-44 text-sm" /></label><div className="mt-4 flex gap-2"><button type="button" onClick={confirmMfa} className="editorial-button px-4 py-2 text-xs">Confirm MFA</button><button type="button" onClick={() => { setMfaSetup(null); setMfaQr(''); setMfaCode(''); }} className="editorial-button-outline px-4 py-2 text-xs">Cancel</button></div></div>
            </div>
          )}
        </section>

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist">
            {tabs.map(([key, label, Icon]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${tab === key ? 'bg-ink-900 text-gold-300' : 'border border-ink-900/25 text-ink-900/70 hover:text-ink-900'}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {(tab === 'products' || tab === 'artisans') && (
            <label className="relative block w-full max-w-xs">
              <Search className="pointer-events-none absolute bottom-2.5 left-0 h-4 w-4 text-gold-600" />
              <input aria-label="Search registry" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the registry…" className="field-line w-full bg-transparent !pl-7 text-sm" />
            </label>
          )}
        </div>

        <section className="paper-sheet paper-texture mt-6 border border-[#c9bea8] bg-[#fbf7ed] px-5 py-6 shadow-[0_22px_60px_rgba(54,42,28,0.16)] sm:px-8">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-ink-900/50"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : tab === 'products' ? (
            <div className="divide-y divide-ink-900/10">
              {products.map((product) => (
                <article key={product.id} className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  {editingProductId === product.id ? (
                    <div className="lg:col-span-2">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {['title', 'category', 'price', 'materials'].map((key) => <label key={key} className="block"><span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-ink-900/60">{key === 'materials' ? 'Materials (comma separated)' : key}</span><input type={key === 'price' ? 'number' : 'text'} min={key === 'price' ? '0' : undefined} value={productForm[key]} onChange={(event) => setProductForm({ ...productForm, [key]: event.target.value })} className="field-line mt-1 w-full text-sm" /></label>)}
                        <label className="block sm:col-span-2"><span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-ink-900/60">Description</span><textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} rows="3" className="mt-1 w-full border border-ink-900/25 bg-transparent p-3 text-sm outline-none focus:border-gold-600" /></label>
                        {product.status === 'verified' && <label className="block sm:col-span-2"><span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-ink-900/60">Correction reason *</span><input value={productForm.correctionReason} onChange={(event) => setProductForm({ ...productForm, correctionReason: event.target.value })} className="field-line mt-1 w-full text-sm" placeholder="Why is this verified record changing?" /></label>}
                      </div>
                      <div className="mt-4 flex gap-2"><button type="button" onClick={() => saveProduct(product)} className="editorial-button px-4 py-2 text-xs"><Check className="h-3.5 w-3.5" /> Save revision</button><button type="button" onClick={() => setEditingProductId(null)} className="editorial-button-outline px-4 py-2 text-xs"><X className="h-3.5 w-3.5" /> Cancel</button></div>
                    </div>
                  ) : <><div className="flex items-center gap-4">
                    <img src={product.image} alt="" className="h-16 w-14 border border-ink-900/20 object-cover" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><Link to={`/product/${product.id}`} className="font-serif text-lg hover:text-gold-600">{product.title}</Link><Status value={product.status} /></div>
                      <p className="mt-1 text-xs text-ink-900/60">{product.id} · {product.artisan_name} · revision {product.latest_revision || 1}</p>
                      {!product.owner_approved && <p className="mt-1 text-xs text-amber-800">Waiting for artisan ownership approval</p>}
                      {product.artisan_verification_status !== 'verified' && <p className="mt-1 text-xs text-red-800">Artisan PEHCHAN identity must be verified before publication</p>}
                      {product.rejection_reason && <p className="mt-1 text-xs text-red-800">{product.rejection_reason}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link to={`/product/${product.id}`} className="editorial-button-outline px-3 py-2 text-xs">Evidence</Link>
                    <button type="button" onClick={() => beginProductEdit(product)} className="editorial-button-outline px-3 py-2 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                    {product.status === 'pending' && <button type="button" onClick={() => approveProduct(product.id)} disabled={product.artisan_verification_status !== 'verified'} className="editorial-button px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-35"><ShieldCheck className="h-3.5 w-3.5" /> Verify</button>}
                    {['pending', 'draft'].includes(product.status) && <button type="button" onClick={() => rejectProduct(product.id)} className="editorial-button-outline px-3 py-2 text-xs text-red-800">Reject</button>}
                    {product.status !== 'archived' && <button type="button" onClick={() => archiveProduct(product.id)} className="px-3 py-2 text-xs text-red-800"><Trash2 className="h-3.5 w-3.5" /> Archive</button>}
                  </div>
                  </>}
                </article>
              ))}
              {products.length === 0 && <p className="py-14 text-center text-sm text-ink-900/55">No records found.</p>}
            </div>
          ) : tab === 'artisans' ? (
            <div>
              {!creating && <button type="button" onClick={() => { setCreating(true); setForm(emptyArtisan); }} className="editorial-button mb-5 px-4 py-2.5 text-xs"><Plus className="h-3.5 w-3.5" /> New artisan</button>}
              {creating && (
                <div className="mb-5 border border-gold-500/30 bg-[#f7f1e3] p-4">
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{field('name', 'Name *')}{field('pehchanId', 'PEHCHAN ID')}{field('village', 'Village *')}{field('craft', 'Craft *')}{field('state', 'State')}{field('district', 'District')}{field('bio', 'Bio')}</div>
                  <div className="mt-4 flex gap-2"><button type="button" onClick={createArtisan} className="editorial-button px-4 py-2 text-xs"><Check className="h-3.5 w-3.5" /> Create</button><button type="button" onClick={() => setCreating(false)} className="editorial-button-outline px-4 py-2 text-xs"><X className="h-3.5 w-3.5" /> Cancel</button></div>
                </div>
              )}
              <div className="divide-y divide-ink-900/10">
                {artisans.map((artisan) => (
                  <article key={artisan.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-start">
                    {editingId === artisan.id ? (
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{field('name', 'Name *')}{field('pehchanId', 'PEHCHAN ID')}{field('village', 'Village *')}{field('craft', 'Craft *')}{field('state', 'State')}{field('district', 'District')}{field('bio', 'Bio')}<div className="flex gap-2 sm:col-span-full"><button type="button" onClick={() => saveArtisan(artisan.id)} className="editorial-button px-4 py-2 text-xs"><Check className="h-3.5 w-3.5" /> Save</button><button type="button" onClick={() => setEditingId(null)} className="editorial-button-outline px-4 py-2 text-xs"><X className="h-3.5 w-3.5" /> Cancel</button></div></div>
                    ) : (
                      <>
                        <div className="flex items-start gap-4">{artisan.photo ? <img src={artisan.photo} alt="" className="h-16 w-14 border border-ink-900/20 object-cover" /> : <div className="h-16 w-14 border border-ink-900/20 bg-ink-900/5" />}<div><div className="flex flex-wrap items-center gap-2"><h3 className="font-serif text-xl">{artisan.name}</h3><Status value={artisan.pehchan_verification_status} /></div><p className="mt-1 flex items-center gap-1 text-sm text-ink-900/60"><MapPin className="h-3.5 w-3.5" /> {artisan.village || 'Location private'}</p><p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-gold-600">{artisan.craft}</p><p className="mt-2 font-mono text-[10px] text-ink-900/50">PEHCHAN · {artisan.pehchan_id || 'not supplied'}</p>{artisan.pehchan_rejection_reason && <p className="mt-1 text-xs text-red-800">{artisan.pehchan_rejection_reason}</p>}<a href="https://indian.handicrafts.gov.in/en/search" target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-700 underline underline-offset-4">Check official database</a></div></div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">{artisan.pehchan_id && artisan.pehchan_verification_status !== 'verified' && <button type="button" onClick={() => verifyPehchan(artisan.id)} className="editorial-button px-3 py-2 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> Verify PEHCHAN</button>}{artisan.pehchan_id && artisan.pehchan_verification_status !== 'rejected' && <button type="button" onClick={() => rejectPehchan(artisan.id)} className="editorial-button-outline px-3 py-2 text-xs text-red-800">Reject</button>}<button type="button" onClick={() => { setEditingId(artisan.id); setForm({ ...emptyArtisan, ...artisan, pehchanId: artisan.pehchan_id || '' }); }} className="editorial-button-outline px-3 py-2 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button><button type="button" onClick={() => archiveArtisan(artisan.id)} className="px-3 py-2 text-xs text-red-800"><Trash2 className="h-3.5 w-3.5" /> Archive</button></div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ) : tab === 'disputes' ? (
            <div className="divide-y divide-ink-900/10">
              {disputes.map((dispute) => (
                <article key={dispute.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-serif text-lg">{dispute.product_title}</h3><Status value={dispute.status} /></div><p className="mt-1 font-mono text-[10px] text-ink-900/50">{dispute.id} · {dispute.product_id}</p></div><p className="text-xs text-ink-900/50">{new Date(dispute.created_at).toLocaleString()}</p></div>
                  <p className="mt-3 text-sm leading-6 text-ink-900/70">{dispute.reason}</p>
                  <p className="mt-2 text-xs text-ink-900/50">Reporter: {dispute.reporter_name} · {dispute.reporter_email}</p>
                  {dispute.resolution && <p className="mt-3 border-l-2 border-green-800/35 pl-3 text-xs leading-5 text-ink-900/65">{dispute.resolution}</p>}
                  {['open', 'under_review'].includes(dispute.status) && <div className="mt-4 flex gap-2"><button type="button" onClick={() => resolveDispute(dispute.id, 'resolved')} className="editorial-button px-3 py-2 text-xs">Resolve with correction</button><button type="button" onClick={() => resolveDispute(dispute.id, 'rejected')} className="editorial-button-outline px-3 py-2 text-xs">Reject dispute</button></div>}
                </article>
              ))}
              {disputes.length === 0 && <p className="py-14 text-center text-sm text-ink-900/55">No disputes have been filed.</p>}
            </div>
          ) : (
            <div className="divide-y divide-ink-900/10">
              {auditRows.map((entry) => <article key={entry.id} className="grid gap-2 py-4 md:grid-cols-[10rem_1fr_auto]"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-gold-600">{entry.action}</p><div><p className="text-sm text-ink-900/75">{entry.entity_type} · {entry.entity_id}</p><p className="mt-1 text-xs text-ink-900/45">{entry.actor_name || entry.actor_role}</p></div><time className="text-xs text-ink-900/45">{new Date(entry.created_at).toLocaleString()}</time></article>)}
              {auditRows.length === 0 && <p className="py-14 text-center text-sm text-ink-900/55">No audited actions yet.</p>}
            </div>
          )}
          {(tab === 'products' || tab === 'artisans') && <Pagination page={page} totalPages={totalPages} onPage={(next) => { setPage(next); load(tab, next); }} />}
        </section>
      </div>
    </main>
  );
}
