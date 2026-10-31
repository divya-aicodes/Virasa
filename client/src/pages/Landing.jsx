import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Camera,
  Fingerprint,
  Link2,
  MapPin,
  Palette,
  ScanLine,
  ShieldCheck,
  User,
} from 'lucide-react';
import Reveal from '../components/ui/Reveal.jsx';
import HeritageCarousel from '../components/HeritageCarousel.jsx';
import VirasaLogo from '../components/VirasaLogo.jsx';
import { api } from '../lib/api.js';

const stats = [
  { value: '3,00,000+', label: 'artisan livelihoods tied to endangered craft traditions' },
  { value: '₹1,200 Cr', label: 'lost each year to counterfeit handicrafts' },
  { value: '1 scan', label: 'to meet the maker and verify every documented step' },
];

const process = [
  {
    number: 'I',
    icon: Camera,
    title: 'The artisan records',
    hindi: 'कारीगर दर्ज करती हैं',
    body: 'Photographs, materials, and the making process are recorded in the artisan’s own voice.',
  },
  {
    number: 'II',
    icon: Link2,
    title: 'Virasā binds the story',
    hindi: 'विरसा कहानी जोड़ता है',
    body: 'Each record receives a SHA-256 fingerprint linked to the record before it. A changed detail breaks the chain.',
  },
  {
    number: 'III',
    icon: ScanLine,
    title: 'The buyer verifies',
    hindi: 'खरीदार सत्यापित करता है',
    body: 'A QR scan reveals the maker, village, materials, timeline, and a tamper-evident certificate.',
  },
];

const outcomes = [
  ['A living archive', 'Techniques remain teachable long after a single artwork leaves the village.'],
  ['Proof without friction', 'No wallets, gas fees, or specialist tools—only a lightweight chained ledger.'],
  ['A fairer price', 'Proven authorship helps the real maker retain the value of her knowledge and labour.'],
  ['A story worth keeping', 'The buyer receives provenance that feels as human as the object itself.'],
];

const preserved = [
  { label: 'maker', icon: User },
  { label: 'village', icon: MapPin },
  { label: 'materials', icon: Palette },
  { label: 'steps', icon: Camera },
];

export default function Landing() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.products.list().then(setProducts).catch(() => setProducts([]));
  }, []);

  return (
    <div>
      <section className="pt-20">
        <div className="grid min-h-[calc(100vh-5rem)] lg:grid-cols-[1.04fr_.96fr]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9 }}
            className="workbench-surface relative flex min-h-[34rem] items-center overflow-hidden px-7 pt-16 pb-24 sm:px-12 lg:min-h-[46rem] lg:px-16"
          >
            <div className="absolute inset-x-8 top-7 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-[#d9cbb6]/58 sm:inset-x-12">
              <span>Living archive / India</span>
              <span>SHA-256 · chained</span>
            </div>
            <div className="absolute -left-20 bottom-8 h-32 w-72 rotate-6 border-y border-[#b08a55]/15 bg-[#725233]/10" />
            <div className="relative mx-auto w-full max-w-[39rem]">
              <div className="artwork-mount relative -rotate-[3deg]">
                <HeritageCarousel className="aspect-[4/3] w-full" imageClassName="saturate-[.92]" />
                <svg
                  viewBox="0 0 120 120"
                  className="absolute left-0 top-0 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[3deg] animate-[spin_24s_linear_infinite] drop-shadow-[0_2px_3px_rgba(20,14,8,0.35)] sm:h-28 sm:w-28"
                  aria-hidden="true"
                >
                  <defs>
                    <path id="seal-circle" d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" />
                  </defs>
                  <circle cx="60" cy="60" r="57" fill="#f4ecdc" stroke="#b89a57" strokeWidth="1.25" />
                  <circle cx="60" cy="60" r="52" fill="#f4ecdc" stroke="#b89a57" strokeWidth="0.75" />
                  <circle cx="60" cy="60" r="40" fill="#efe3cd" />
                  <text fontSize="8.4" letterSpacing="2.4" fill="#8a6a35">
                    <textPath href="#seal-circle">VIRASĀ · LIVING ARCHIVE · INDIA ·</textPath>
                  </text>
                  <g transform="translate(60 60)">
                    <rect x="-9" y="-9" width="18" height="18" fill="#b89a57" />
                    <rect x="-9" y="-9" width="18" height="18" fill="#b89a57" transform="rotate(45)" />
                    <rect x="-2.5" y="-2.5" width="5" height="5" fill="#7a5b2e" transform="rotate(45)" />
                  </g>
                </svg>
              </div>
              <p className="handwritten absolute -bottom-12 right-1 rotate-[-2deg] text-lg text-[#e8dcc9]/78 sm:right-8 sm:text-xl">
                painted by hand, held by proof
              </p>
              <div className="absolute -right-5 -top-7 h-16 w-5 rotate-[18deg] border border-[#b9a17e]/25 bg-[#ddc89f]/10" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.85, delay: 0.15 }}
            className="relative flex items-center bg-[#e7e3dc] px-4 py-10 sm:px-8 lg:px-0 lg:py-12"
          >
            <div className="paper-sheet paper-texture relative w-full px-6 py-9 sm:px-10 sm:py-11 lg:-ml-7 lg:mr-10 lg:px-12">
              <div className="absolute right-5 top-5 sm:right-8 sm:top-8 max-sm:static max-sm:mb-5 max-sm:flex max-sm:justify-center">
                <span className="verification-stamp">
                  <ShieldCheck className="h-3.5 w-3.5" /> Living archive · SHA-256
                </span>
              </div>

              <div className="text-center sm:pr-0">
                <p className="font-serif text-5xl font-medium leading-none tracking-[-0.045em] sm:text-6xl">Virasā</p>
                <p className="handwritten mt-2 text-lg text-ink-900/76 sm:text-xl">
                  carried by hand, kept honest by record
                </p>
              </div>

              <div className="my-7 border-t ink-rule" />

              <p className="section-eyebrow">An artwork with a memory</p>
              <h1 className="mt-3 max-w-xl font-serif text-4xl font-medium leading-[0.98] tracking-[-0.035em] sm:text-5xl">
                Every masterpiece carries the proof of its hands.
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-ink-900/66 sm:text-base">
                Virasā preserves the maker, village, materials, and every creation step—then binds them into a chain that exposes tampering with one scan.
              </p>

              <div className="mt-9 border border-[#b89a57]/45 bg-[#f7f1e6] px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-900/50">
                    What the record keeps
                  </span>
                  <Fingerprint className="h-3.5 w-3.5 text-gold-600" strokeWidth={1.5} />
                </div>
                <div className="mt-3.5 flex items-center justify-between gap-1.5">
                  {preserved.map((item, index) => (
                    <Fragment key={item.label}>
                      {index > 0 && (
                        <motion.span
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.35 + index * 0.18, duration: 0.35 }}
                          className="h-px flex-1 origin-left bg-[#b89a57]/50"
                        />
                      )}
                      <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.18, duration: 0.45 }}
                        className={`flex flex-col items-center gap-1.5 ${index % 2 ? 'rotate-1' : '-rotate-1'}`}
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-[#b89a57]/60 bg-[#fffaf0] text-gold-600 shadow-[0_1px_2px_rgba(59,46,30,0.15)]">
                          <item.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </span>
                        <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-900/60">
                          {item.label}
                        </span>
                      </motion.span>
                    </Fragment>
                  ))}
                </div>
                <div className="mt-3.5 flex items-center gap-3 border-t border-[#b89a57]/30 pt-3">
                  <span className="h-px flex-1 bg-[#b89a57]/40" />
                  <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-900/75">
                    <ScanLine className="h-3.5 w-3.5 text-gold-600" strokeWidth={1.6} />
                    one scan exposes tampering
                  </span>
                  <span className="h-px flex-1 bg-[#b89a57]/40" />
                </div>
              </div>

              <div className="mt-9 flex flex-wrap gap-3 border-t ink-rule pt-6">
                <Link to="/artisan" className="editorial-button">
                  <Palette className="h-4 w-4" /> Begin your craft story
                </Link>
                <Link to="/explore" className="editorial-button-outline">
                  Explore the collection <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <p className="section-eyebrow">Why provenance matters</p>
              <h2 className="font-serif text-4xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl">
                India’s hands are still painting. The market has forgotten how to tell.
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.08} className="mt-14">
            <div className="grid border-y ink-rule md:grid-cols-3 md:divide-x md:divide-[#2b231d]/20">
              {stats.map((stat) => (
                <div key={stat.value} className="border-b ink-rule px-1 py-8 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0">
                  <p className="font-serif text-4xl font-semibold text-gold-600 sm:text-5xl">{stat.value}</p>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-ink-900/60">{stat.label}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.12} className="mt-16">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-20">
              <p className="font-serif text-3xl leading-tight sm:text-4xl">
                A tradition carried in memory can disappear in one generation. A counterfeit can erase its value in one sale.
              </p>
              <div className="space-y-5 text-base leading-8 text-ink-900/67">
                <p><span className="float-left mr-2 font-serif text-5xl leading-[.8] text-clay-500">M</span>ithila painting is learned by watching hands: how a bamboo nib turns, how natural colour settles, how a line becomes a story. Virasā records that knowledge while it is alive.</p>
                <p>The record travels with the artwork. It gives buyers a way to distinguish a handmade original from a print and gives artisans evidence that the work—and its value—began with them.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-ink-900/15 bg-[#f2ede5] px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="section-eyebrow">The provenance ritual</p>
                <h2 className="mt-3 font-serif text-4xl font-medium sm:text-6xl">Record / Bind / Reveal</h2>
              </div>
              <p className="handwritten max-w-sm text-lg text-ink-900/60">Three quiet acts turn an artwork into a living document.</p>
            </div>
          </Reveal>

          <div className="mt-14 grid border-y ink-rule md:grid-cols-3 md:divide-x md:divide-[#2b231d]/20">
            {process.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.1}>
                <article className={`relative min-h-full px-1 py-9 md:px-8 ${index === 0 ? 'md:pl-0' : ''} ${index === process.length - 1 ? 'md:pr-0' : ''}`}>
                  <div className="flex items-start justify-between">
                    <span className="font-serif text-4xl text-gold-500/74">{item.number}</span>
                    <item.icon className="h-5 w-5 text-ink-900/60" strokeWidth={1.4} />
                  </div>
                  <h3 className="mt-10 font-serif text-2xl font-semibold">{item.title}</h3>
                  <p className="font-devanagari mt-1 text-sm text-ink-900/60">{item.hindi}</p>
                  <p className="mt-5 text-sm leading-7 text-ink-900/64">{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8 text-center">
            <p className="text-xs uppercase tracking-[0.19em] text-ink-900/60">
              SHA-256 chained ledger · no gas fees · no wallet · no blockchain complexity
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-6xl overflow-hidden border border-ink-900/15 lg:grid-cols-[.82fr_1.18fr]">
          <Reveal className="workbench-surface flex min-h-[28rem] flex-col justify-between p-8 text-[#f5ecdd] sm:p-12">
            <div>
              <p className="text-[11px] uppercase tracking-[.24em] text-[#d0b477]">What the chain protects</p>
              <h2 className="mt-5 font-serif text-4xl font-medium leading-tight sm:text-5xl">Not only an object. A lineage.</h2>
            </div>
            <div className="mt-12 flex items-end justify-between border-t border-[#f5ecdd]/20 pt-6">
              <Fingerprint className="h-12 w-12 text-[#c8a458]" strokeWidth={1} />
              <p className="handwritten max-w-[15rem] text-right text-lg text-[#e2d4bf]/70">proof should feel as human as the hands it protects</p>
            </div>
          </Reveal>

          <div className="paper-sheet border-0 p-8 sm:p-12">
            {outcomes.map(([title, body], index) => (
              <Reveal key={title} delay={index * 0.07}>
                <div className="grid gap-3 border-b ink-rule py-6 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[2.4rem_1fr_1.35fr] sm:gap-6">
                  <span className="font-serif text-2xl text-gold-600">0{index + 1}</span>
                  <h3 className="font-serif text-2xl font-semibold">{title}</h3>
                  <p className="text-sm leading-7 text-ink-900/62">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {products.length > 0 && (
        <section className="bg-[#f2ede5] px-6 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="section-eyebrow">Fresh from the workshops</p>
                  <h2 className="mt-3 font-serif text-4xl font-medium sm:text-6xl">The verified collection</h2>
                </div>
                <Link to="/explore" className="inline-flex items-center gap-2 border-b border-ink-900/50 pb-1 text-sm font-medium">
                  View the full archive <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>

            <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {products.slice(0, 3).map((product, index) => (
                <Reveal key={product.id} delay={index * 0.09}>
                  <Link to={`/product/${product.id}`} className="catalog-card group block p-3">
                    <div className="relative overflow-hidden border border-ink-900/15 bg-[#dfd3c0] p-2">
                      <img src={product.image} alt={product.title} className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.025]" loading="lazy" />
                      <span className="verification-stamp absolute right-3 top-3 bg-[#f8f3e9]/94">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    </div>
                    <div className="px-2 pb-3 pt-5">
                      <div className="flex items-center justify-between gap-4 border-b ink-rule pb-3 text-[10px] uppercase tracking-[.16em] text-ink-900/60">
                        <span>{product.id}</span>
                        <span>Folio {String(product.chain_index).padStart(3, '0')}</span>
                      </div>
                      <h3 className="mt-4 font-serif text-2xl font-semibold leading-tight">{product.title}</h3>
                      <p className="handwritten mt-1 flex items-center gap-1.5 text-sm text-ink-900/62">
                        <MapPin className="h-3.5 w-3.5" /> {product.artisan_name}, {product.artisan_village}
                      </p>
                      <div className="mt-5 flex items-end justify-between gap-4">
                        <span className="font-serif text-2xl font-semibold">₹{Number(product.price).toLocaleString('en-IN')}</span>
                        <span className="text-[11px] text-ink-900/60">{product.steps.length} documented steps</span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-24 sm:py-32">
        <Reveal className="page-curl paper-sheet mx-auto max-w-5xl px-7 py-16 text-center sm:px-16 sm:py-20">
          <p className="section-eyebrow">Add a folio to the archive</p>
          <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl font-medium leading-tight sm:text-6xl">
            Let the next buyer meet the hands behind the work.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-ink-900/62 sm:text-base">
            Document a making process, issue a certificate, or verify a piece already carrying the Virasā mark.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/artisan" className="editorial-button"><Camera className="h-4 w-4" /> I am an artisan</Link>
            <Link to="/verify" className="editorial-button-outline"><ScanLine className="h-4 w-4" /> Verify an artwork</Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-ink-900/15 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <VirasaLogo size="small" />
          <p className="text-[11px] uppercase tracking-[.17em] text-ink-900/60">Smart India Hackathon 2026 · Heritage carried forward</p>
        </div>
      </footer>
    </div>
  );
}
