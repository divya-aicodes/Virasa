import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImagePlus, Plus, Trash2, CheckCircle2, ShieldCheck, Download, ScanLine, Languages, ArrowLeft, ArrowRight, Loader2,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';

const T = {
  en: {
    step1: 'Tell us about you', step1sub: 'Just your name, village and craft. That is all.',
    step2: 'Show your artwork', step2sub: 'Photo first. Then add up to 4 creation steps — each one tells your story.',
    step3: 'You are on the chain', step3sub: 'Your artwork now has a verifiable provenance record.',
    name: 'Your name', village: 'Your village', craft: 'Your craft', craftPh: 'e.g. Madhubani Painting',
    continue: 'Continue', back: 'Back', finish: 'Register provenance',
    title: 'Artwork title', titlePh: 'e.g. Krishna Leela — Peacock Dance',
    desc: 'Short description', descPh: 'What does your artwork show? How long did it take?',
    materials: 'Materials (press Enter to add)', price: 'Price (₹)',
    mainImage: 'Main artwork photo', stepImage: 'Creation step photo', stepCaption: 'Caption for this step',
    addStep: 'Add another step', addStepShort: 'Add step',
    uploading: 'Uploading...', created: 'Chain created!',
    yourArt: 'Your artwork', scan: 'Scan this QR anywhere to verify your art',
    cert: 'Download certificate', explore: 'See it in the collection',
    newProduct: 'Add another artwork',
  },
  hi: {
    step1: 'अपने बारे में बताएं', step1sub: 'बस नाम, गाँव और शिल्प। बस इतना ही।',
    step2: 'अपनी कलाकृति दिखाएं', step2sub: 'पहले फोटो। फिर 4 कदम तक जोड़ें — हर कदम आपकी कहानी बताता है।',
    step3: 'आप श्रृंखला में जुड़ गए', step3sub: 'आपकी कलाकृति अब हमेशा के लिए सत्यापित है।',
    name: 'आपका नाम', village: 'आपका गाँव', craft: 'आपका शिल्प', craftPh: 'जैसे मधुबनी पेंटिंग',
    continue: 'आगे बढ़ें', back: 'पीछे', finish: 'श्रृंखला पर लॉक करें',
    title: 'कलाकृति का नाम', titlePh: 'जैसे कृष्ण लीला — मोर नृत्य',
    desc: 'छोटा विवरण', descPh: 'आपकी कलाकृति क्या दिखाती है? कितने दिन लगे?',
    materials: 'सामग्री (Enter दबाकर जोड़ें)', price: 'कीमत (₹)',
    mainImage: 'मुख्य कलाकृति फोटो', stepImage: 'बनाने के कदम की फोटो', stepCaption: 'इस कदम का विवरण',
    addStep: 'एक और कदम जोड़ें', addStepShort: 'कदम जोड़ें',
    uploading: 'अपलोड हो रहा है...', created: 'श्रृंखला बन गई!',
    yourArt: 'आपकी कलाकृति', scan: 'अपनी कला सत्यापित करने के लिए यह QR स्कैन करें',
    cert: 'प्रमाणपत्र डाउनलोड करें', explore: 'संग्रह में देखें',
    newProduct: 'एक और कलाकृति जोड़ें',
  },
};

const defaultSteps = [
  { caption: 'Outline drawing with bamboo nib' },
  { caption: 'Base colours filled by hand' },
  { caption: 'Fine hatch detailing' },
  { caption: 'Final artwork completed' },
];

const FOLIOS = [
  { en: 'Artisan', hi: 'शिल्पकार' },
  { en: 'Artwork', hi: 'कलाकृति' },
  { en: 'Certificate', hi: 'प्रमाणपत्र' },
];

export default function ArtisanPanel() {
  const { user, refresh } = useAuth();
  const [lang, setLang] = useState('en');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [profile, setProfile] = useState({ name: '', village: '', craft: '' });
  const [product, setProduct] = useState({ title: '', description: '', materials: [], materialInput: '', price: '' });
  const [mainImage, setMainImage] = useState(null);
  const [steps, setSteps] = useState(defaultSteps.map((s) => ({ ...s, image: null })));
  const [result, setResult] = useState(null);
  const [linkedArtisanId, setLinkedArtisanId] = useState(user?.artisanId || null);

  useEffect(() => {
    if (!user?.artisanId) return;
    setLinkedArtisanId(user.artisanId);
    api.artisans.get(user.artisanId)
      .then((artisan) => {
        setProfile({ name: artisan.name, village: artisan.village, craft: artisan.craft });
      })
      .catch(() => {});
  }, [user?.artisanId]);

  const t = T[lang];
  const alt = T[lang === 'en' ? 'hi' : 'en'];
  const canContinue1 = profile.name && profile.village && profile.craft;
  const canContinue2 = product.title && mainImage;

  function setMaterial(e) {
    const v = e.target.value;
    if (e.key === 'Enter' && v.trim()) {
      e.preventDefault();
      setProduct((p) => ({ ...p, materials: [...p.materials, v.trim()], materialInput: '' }));
    } else {
      setProduct((p) => ({ ...p, materialInput: v }));
    }
  }

  function setFile(setter) {
    return (e) => setter(e.target.files?.[0] || null);
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const artisan = linkedArtisanId
        ? await api.artisans.update(linkedArtisanId, profile)
        : await api.artisans.create(profile);
      if (!linkedArtisanId) {
        setLinkedArtisanId(artisan.id);
        await refresh();
      }

      const files = [mainImage, ...steps.filter((s) => s.image).map((s) => s.image)];
      const { urls } = await api.upload(files);

      let i = 0;
      const image = urls[i++];
      const stepData = steps
        .filter((s) => s.image)
        .map((s) => ({ image: urls[i++], caption: s.caption || 'Creation step' }));

      const created = await api.products.create({
        artisan_id: artisan.id,
        title: product.title,
        description: product.description,
        image,
        steps: stepData,
        materials: product.materials,
        price: Number(product.price) || 0,
      });

      const check = await api.verify.check(created.id);
      setResult({ product: created, verify: check.verify });
      setStep(2);
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep(0);
    setProduct({ title: '', description: '', materials: [], materialInput: '', price: '' });
    setMainImage(null);
    setSteps(defaultSteps.map((s) => ({ ...s, image: null })));
    setResult(null);
    setError('');
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-28 pt-28 sm:pt-32">
      <div aria-hidden="true" className="pointer-events-none absolute left-[-9rem] top-56 h-72 w-72 rotate-12 border border-gold-500/10 bg-white/20" />
      <div aria-hidden="true" className="pointer-events-none absolute right-[-7rem] top-20 h-56 w-56 -rotate-6 border border-ink-900/5 bg-gold-500/[0.025]" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <header className="mx-auto max-w-2xl text-center">
          <p className="section-eyebrow">Artisan registry · शिल्पकार पंजी</p>
          <h1 className="mt-4 font-serif text-4xl font-medium leading-tight text-ink-900 sm:text-5xl">
            A living record <span className="text-gold-500">/</span> जीवित दस्तावेज़
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-ink-900/60">
            Record the hand, the place, and every mark of making. अपनी कला, अपनी जगह और अपनी प्रक्रिया को दर्ज करें।
          </p>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="editorial-button-outline mt-6 inline-flex items-center gap-2 border border-gold-500/45 bg-transparent px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600 transition hover:bg-gold-500/5"
            aria-label="Change which language is shown first"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === 'en' ? 'हिन्दी पहले' : 'English first'}
          </button>
        </header>

        <nav className="mx-auto mt-12 max-w-3xl" aria-label="Registration progress">
          <ol className="grid grid-cols-3 border-y border-ink-900/15">
            {FOLIOS.map((folio, i) => (
              <li
                key={folio.en}
                aria-current={step === i ? 'step' : undefined}
                className={`relative px-2 py-4 text-center transition-colors sm:px-5 ${i !== 2 ? 'border-r border-ink-900/15' : ''} ${step === i ? 'bg-white/35 text-ink-900' : step > i ? 'text-gold-600' : 'text-ink-900/35'}`}
              >
                <span className="block font-serif text-lg italic leading-none">0{i + 1}</span>
                <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em]">
                  {lang === 'en' ? folio.en : folio.hi}
                </span>
                <span className="mt-0.5 hidden text-[10px] text-ink-900/45 sm:block">
                  {lang === 'en' ? folio.hi : folio.en}
                </span>
                {step === i && <span className="absolute inset-x-5 bottom-0 h-px bg-gold-500" />}
              </li>
            ))}
          </ol>
        </nav>

        <div className="relative mx-auto mt-12 max-w-4xl px-1 pb-8 sm:px-5">
          <div aria-hidden="true" className="paper-sheet absolute inset-x-6 bottom-1 top-5 rotate-[1.1deg] border border-ink-900/10 bg-[#e1d8c6] shadow-[0_18px_50px_rgba(45,39,32,0.12)]" />
          <div aria-hidden="true" className="paper-sheet absolute inset-x-3 bottom-4 top-2 -rotate-[0.7deg] border border-ink-900/10 bg-[#eee6d7] shadow-[0_14px_34px_rgba(45,39,32,0.1)] sm:inset-x-9" />

          <AnimatePresence mode="wait">
            {/* STEP 1 — PROFILE */}
            {step === 0 && (
              <motion.section
                key="s1"
                initial={{ opacity: 0, y: 24, rotate: 0.5 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, x: -24, rotate: -0.5 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className="paper-sheet paper-texture relative z-10 border border-ink-900/15 bg-[#fbf7ee] px-6 py-9 shadow-[0_28px_70px_rgba(45,39,32,0.18)] sm:px-12 sm:py-12 md:px-16"
              >
                <header className="border-b border-ink-900/20 pb-8 text-center">
                  <div className="mx-auto mb-5 flex items-center justify-center gap-3 text-gold-600">
                    <span className="ink-rule h-px w-10 bg-gold-500/50" />
                    <span className="font-serif text-sm italic">Folio 01</span>
                    <span className="ink-rule h-px w-10 bg-gold-500/50" />
                  </div>
                  <h2 className="font-serif text-3xl font-medium leading-tight text-ink-900 sm:text-4xl">
                    {t.step1} <span className="text-gold-500">/</span> <span className="text-ink-900/65">{alt.step1}</span>
                  </h2>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink-900/55">
                    {t.step1sub} <span className="mx-1 text-gold-500/60">·</span> {alt.step1sub}
                  </p>
                </header>

                <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
                  <label className="group block sm:col-span-2">
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-ink-900/75">{t.name} *</span>
                      <span className="text-xs text-ink-900/55">{alt.name}</span>
                    </span>
                    <input
                      className="field-line mt-2 w-full border-0 border-b border-ink-900/30 bg-transparent px-0 py-3 font-serif text-xl text-ink-900 outline-none placeholder:text-ink-900/25 focus:border-gold-500 focus:ring-0"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="Sunita Devi"
                    />
                  </label>
                  <label className="group block">
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-ink-900/75">{t.village} *</span>
                      <span className="text-xs text-ink-900/55">{alt.village}</span>
                    </span>
                    <input
                      className="field-line mt-2 w-full border-0 border-b border-ink-900/30 bg-transparent px-0 py-3 font-serif text-lg text-ink-900 outline-none placeholder:text-ink-900/25 focus:border-gold-500 focus:ring-0"
                      value={profile.village}
                      onChange={(e) => setProfile({ ...profile, village: e.target.value })}
                      placeholder="Ranti, Madhubani"
                    />
                  </label>
                  <label className="group block">
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-ink-900/75">{t.craft} *</span>
                      <span className="text-xs text-ink-900/55">{alt.craft}</span>
                    </span>
                    <input
                      className="field-line mt-2 w-full border-0 border-b border-ink-900/30 bg-transparent px-0 py-3 font-serif text-lg text-ink-900 outline-none placeholder:text-ink-900/25 focus:border-gold-500 focus:ring-0"
                      value={profile.craft}
                      onChange={(e) => setProfile({ ...profile, craft: e.target.value })}
                      placeholder={t.craftPh}
                    />
                  </label>
                </div>

                <footer className="mt-12 flex flex-col gap-6 border-t border-ink-900/15 pt-7 sm:flex-row sm:items-center sm:justify-between">
                  <p className="handwritten max-w-sm -rotate-1 font-serif text-sm italic leading-6 text-ink-900/45">
                    Every maker begins with a place — हर शिल्पकार की कहानी एक जगह से शुरू होती है।
                  </p>
                  <button
                    type="button"
                    onClick={() => canContinue1 && setStep(1)}
                    disabled={!canContinue1}
                    className="editorial-button inline-flex min-w-48 items-center justify-center gap-3 bg-ink-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.13em] text-paper-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <span>{t.continue}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </footer>
              </motion.section>
            )}

            {/* STEP 2 — PRODUCT */}
            {step === 1 && (
              <motion.section
                key="s2"
                initial={{ opacity: 0, y: 24, rotate: 0.5 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, x: -24, rotate: -0.5 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className="paper-sheet paper-texture relative z-10 border border-ink-900/15 bg-[#fbf7ee] px-5 py-9 shadow-[0_28px_70px_rgba(45,39,32,0.18)] sm:px-10 sm:py-12 md:px-14"
              >
                <header className="border-b border-ink-900/20 pb-8 text-center">
                  <div className="mx-auto mb-5 flex items-center justify-center gap-3 text-gold-600">
                    <span className="ink-rule h-px w-10 bg-gold-500/50" />
                    <span className="font-serif text-sm italic">Folio 02</span>
                    <span className="ink-rule h-px w-10 bg-gold-500/50" />
                  </div>
                  <h2 className="font-serif text-3xl font-medium leading-tight text-ink-900 sm:text-4xl">
                    {t.step2} <span className="text-gold-500">/</span> <span className="text-ink-900/65">{alt.step2}</span>
                  </h2>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-ink-900/55">
                    {t.step2sub} <span className="mx-1 text-gold-500/60">·</span> {alt.step2sub}
                  </p>
                </header>

                <div className="mt-9 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-ink-900/75">{t.title} *</span>
                      <span className="text-xs text-ink-900/55">{alt.title}</span>
                    </span>
                    <input
                      className="field-line mt-2 w-full border-0 border-b border-ink-900/30 bg-transparent px-0 py-3 font-serif text-xl text-ink-900 outline-none placeholder:text-ink-900/25 focus:border-gold-500 focus:ring-0"
                      value={product.title}
                      onChange={(e) => setProduct({ ...product, title: e.target.value })}
                      placeholder={t.titlePh}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-ink-900/75">{t.desc}</span>
                      <span className="text-xs text-ink-900/55">{alt.desc}</span>
                    </span>
                    <textarea
                      className="field-line mt-2 min-h-24 w-full resize-none border-0 border-b border-ink-900/30 bg-transparent px-0 py-3 text-sm leading-7 text-ink-900 outline-none placeholder:text-ink-900/25 focus:border-gold-500 focus:ring-0"
                      value={product.description}
                      onChange={(e) => setProduct({ ...product, description: e.target.value })}
                      placeholder={t.descPh}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.17em] text-ink-900/75">{t.materials}</span>
                    <span className="mt-1 block text-xs text-ink-900/55">{alt.materials}</span>
                    <input
                      className="field-line mt-1 w-full border-0 border-b border-ink-900/30 bg-transparent px-0 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-900/25 focus:border-gold-500 focus:ring-0"
                      value={product.materialInput}
                      onKeyDown={setMaterial}
                      onChange={setMaterial}
                      placeholder="Natural pigments, handmade paper"
                    />
                    {product.materials.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {product.materials.map((m) => (
                          <span key={m} className="flex items-center gap-1.5 border border-gold-500/25 bg-gold-500/[0.06] px-2.5 py-1 text-[11px] text-gold-600">
                            {m}
                            <button
                              type="button"
                              onClick={() => setProduct((p) => ({ ...p, materials: p.materials.filter((x) => x !== m) }))}
                              className="text-ink-900/35 transition hover:text-red-700"
                              aria-label={`Remove ${m}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.17em] text-ink-900/75">{t.price}</span>
                    <span className="mt-1 block text-xs text-ink-900/55">{alt.price}</span>
                    <input
                      type="number"
                      className="field-line mt-1 w-full border-0 border-b border-ink-900/30 bg-transparent px-0 py-3 font-serif text-lg text-ink-900 outline-none placeholder:text-ink-900/25 focus:border-gold-500 focus:ring-0"
                      value={product.price}
                      onChange={(e) => setProduct({ ...product, price: e.target.value })}
                      placeholder="₹ 4,500"
                    />
                  </label>
                </div>

                <div className="mt-11 grid items-start gap-8 border-t border-ink-900/15 pt-9 lg:grid-cols-[0.85fr_1.15fr]">
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-ink-900/75">{t.mainImage} *</span>
                      <span className="text-xs text-ink-900/55">{alt.mainImage}</span>
                    </div>
                    <label className="group relative mt-3 block cursor-pointer border border-ink-900/25 bg-[#eee8da] p-2 shadow-[0_10px_26px_rgba(45,39,32,0.12)] transition hover:-translate-y-0.5 hover:border-gold-500/50">
                      {mainImage ? (
                        <img src={URL.createObjectURL(mainImage)} alt="Selected artwork" className="aspect-[4/3] w-full object-cover saturate-[0.9]" />
                      ) : (
                        <span className="flex aspect-[4/3] flex-col items-center justify-center border border-dashed border-ink-900/25 bg-[#f7f1e5] text-center">
                          <ImagePlus className="h-8 w-8 text-gold-500" />
                          <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.17em] text-ink-900/55">Choose artwork photo</span>
                          <span className="mt-1 text-xs text-ink-900/50">कलाकृति की तस्वीर चुनें</span>
                        </span>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={setFile(setMainImage)} />
                    </label>
                    <p className="handwritten mt-3 -rotate-1 text-right font-serif text-xs italic text-ink-900/55">the finished work / अंतिम कलाकृति</p>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-ink-900/75">{t.addStepShort} · optional</span>
                      <span className="text-xs text-ink-900/55">{alt.addStepShort} · अधिकतम 4</span>
                    </div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      {steps.map((s, i) => (
                        <div
                          key={i}
                          className={`border border-ink-900/20 bg-[#f5efe2] p-2.5 shadow-[0_8px_20px_rgba(45,39,32,0.1)] ${i % 2 === 0 ? '-rotate-[0.5deg]' : 'rotate-[0.6deg] sm:translate-y-3'}`}
                        >
                          <div className="flex items-center justify-between gap-2 px-1 pb-2">
                            <span className="font-serif text-xs italic text-ink-900/55">0{i + 1} · {t.stepCaption}</span>
                            {s.image && (
                              <button
                                type="button"
                                onClick={() => setSteps(steps.map((x, xi) => (xi === i ? { ...x, image: null } : x)))}
                                className="text-ink-900/35 transition hover:text-red-700"
                                aria-label={`Remove creation step ${i + 1} photo`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <label className="block cursor-pointer">
                            {s.image ? (
                              <img src={URL.createObjectURL(s.image)} alt={`Creation step ${i + 1}`} className="h-24 w-full object-cover saturate-[0.85]" />
                            ) : (
                              <span className="flex h-24 items-center justify-center border border-dashed border-ink-900/25 bg-white/30 text-gold-500/70 transition hover:bg-gold-500/5">
                                <Plus className="h-5 w-5" />
                              </span>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => setSteps(steps.map((x, xi) => (xi === i ? { ...x, image: e.target.files?.[0] || null } : x)))}
                            />
                          </label>
                          <input
                            type="text"
                            value={s.caption}
                            onChange={(e) => setSteps(steps.map((x, xi) => (xi === i ? { ...x, caption: e.target.value } : x)))}
                            placeholder={s.caption}
                            className="field-line mt-2 w-full border-0 border-b border-ink-900/25 bg-transparent px-1 py-2 text-xs text-ink-900 outline-none placeholder:text-ink-900/25 focus:border-gold-500 focus:ring-0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="mt-9 border-l-2 border-red-700 bg-red-900/[0.04] px-4 py-3 text-sm text-red-800" role="alert">
                    {error}
                  </p>
                )}

                <footer className="mt-12 flex flex-col-reverse gap-3 border-t border-ink-900/15 pt-7 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="editorial-button-outline inline-flex items-center justify-center gap-2 border border-ink-900/25 bg-transparent px-5 py-3 text-xs font-semibold uppercase tracking-[0.13em] text-ink-900/65 transition hover:border-gold-500/60 hover:text-gold-600"
                  >
                    <ArrowLeft className="h-4 w-4" /> {t.back} · {alt.back}
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!canContinue2 || busy}
                    className="editorial-button inline-flex min-w-60 items-center justify-center gap-3 bg-ink-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-paper-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {busy ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {t.uploading}</>
                    ) : (
                      <><ShieldCheck className="h-4 w-4" /> {t.finish}</>
                    )}
                  </button>
                </footer>
              </motion.section>
            )}

            {/* STEP 3 — SUCCESS */}
            {step === 2 && result && (
              <motion.section
                key="s3"
                initial={{ opacity: 0, y: 18, rotate: 0.5 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="paper-sheet paper-texture relative z-10 border border-ink-900/15 bg-[#fbf7ee] px-6 py-10 shadow-[0_28px_70px_rgba(45,39,32,0.18)] sm:px-12 sm:py-12 md:px-16"
              >
                <header className="border-b border-ink-900/20 pb-8 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -14 }}
                    animate={{ scale: 1, rotate: -4 }}
                    transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-800/55 p-1 text-green-800"
                  >
                    <span className="flex h-full w-full items-center justify-center rounded-full border border-green-800/45">
                      <CheckCircle2 className="h-9 w-9" />
                    </span>
                  </motion.div>
                  <p className="section-eyebrow mt-5">Provenance sealed · उत्पत्ति प्रमाणित</p>
                  <h2 className="mt-3 font-serif text-3xl font-medium leading-tight text-ink-900 sm:text-4xl">
                    {t.created} <span className="text-gold-500">/</span> <span className="text-ink-900/65">{alt.created}</span>
                  </h2>
                  <p className="mt-3 text-xs text-ink-900/50">
                    <span className="font-mono text-gold-600">{result.product.id}</span>
                    <span className="mx-2">·</span>
                    {t.yourArt} #{result.verify.chainIndex} of {result.verify.chainLength}
                  </p>
                </header>

                <div className="mt-10 grid items-center gap-9 md:grid-cols-[1.05fr_0.95fr]">
                  <figure className="border border-ink-900/20 bg-[#eee7d8] p-2 shadow-[0_12px_28px_rgba(45,39,32,0.14)]">
                    <img src={result.product.image} alt={result.product.title} className="aspect-[4/3] w-full object-cover saturate-[0.9]" />
                    <figcaption className="px-2 pb-1 pt-3 text-center font-serif text-xl font-medium text-ink-900">
                      {result.product.title}
                    </figcaption>
                  </figure>

                  <div className="text-center md:text-left">
                    <p className="font-serif text-sm italic text-gold-600">Virasā Certificate of Origin</p>
                    <div className="ink-rule my-5 h-px bg-ink-900/20" />
                    <p className="text-sm leading-7 text-ink-900/58">
                      {t.scan} <span className="text-gold-500/60">·</span> {alt.scan}
                    </p>
                    <div className="mt-7 flex flex-col gap-3">
                      <a
                        href={`/api/verify/${result.product.id}/certificate`}
                        className="editorial-button inline-flex items-center justify-center gap-2 bg-ink-900 px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-paper-100 transition hover:-translate-y-0.5"
                      >
                        <Download className="h-4 w-4" /> {t.cert}
                      </a>
                      <Link
                        to={`/verify?id=${result.product.id}`}
                        className="editorial-button-outline inline-flex items-center justify-center gap-2 border border-gold-500/45 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold-600 transition hover:bg-gold-500/5"
                      >
                        <ScanLine className="h-4 w-4" /> Verify · सत्यापित करें
                      </Link>
                    </div>
                    <p className="handwritten mt-5 -rotate-1 font-serif text-xs italic text-ink-900/55">made by hand, held by proof / हाथों से निर्मित, प्रमाण से सुरक्षित</p>
                  </div>
                </div>

                <footer className="mt-11 flex flex-col gap-3 border-t border-ink-900/15 pt-7 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={reset}
                    className="editorial-button inline-flex items-center justify-center gap-2 bg-ink-900 px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-paper-100 transition hover:-translate-y-0.5"
                  >
                    <Plus className="h-4 w-4" /> {t.newProduct}
                  </button>
                  <Link
                    to={`/product/${result.product.id}`}
                    className="editorial-button-outline inline-flex items-center justify-center border border-ink-900/25 px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink-900/65 transition hover:border-gold-500/60 hover:text-gold-600"
                  >
                    {t.explore} · {alt.explore}
                  </Link>
                </footer>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
