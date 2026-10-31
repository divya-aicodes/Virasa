import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, MapPin, Download, ScanLine, ArrowLeft, FileClock, Scale } from 'lucide-react';
import Reveal from '../components/ui/Reveal.jsx';
import VirasaLogo from '../components/VirasaLogo.jsx';
import { api } from '../lib/api.js';

const stepNotes = [
  'The first lines are drawn slowly, giving the composition its rhythm and balance.',
  'Pigments are prepared by hand and applied with tools familiar to generations of makers.',
  'Fine marks and repeated patterns build the dense visual language of Madhubani.',
  'The finished work rests and dries before it is signed, recorded, and sent onward.',
];

const printAngles = [-1.75, 1.35, -0.8, 1.8];
const materialTones = ['#d7c39c', '#c7b594', '#d6c9b2', '#b9ad91'];

export default function ProductPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [showDispute, setShowDispute] = useState(false);
  const [dispute, setDispute] = useState({ reporterName: '', reporterEmail: '', reason: '' });
  const [disputeNotice, setDisputeNotice] = useState('');

  useEffect(() => {
    Promise.all([api.verify.check(id), api.products.history(id), api.products.evidence(id)])
      .then(([verification, revisionResult, evidenceResult]) => {
        setData(verification);
        setHistory(revisionResult.revisions || []);
        setEvidence(evidenceResult.evidence || []);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <main className="paper-texture flex min-h-screen flex-col items-center justify-center gap-7 bg-[#eee9df] px-6 pt-20 text-center text-[#2b241d]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#8d6b25]">Archive unavailable</p>
        <p className="max-w-xl font-serif text-3xl leading-tight md:text-4xl">{error}</p>
        <Link to="/explore" className="editorial-button-outline text-sm">
          <ArrowLeft className="h-4 w-4" /> Return to the collection
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="paper-texture flex min-h-screen items-center justify-center bg-[#eee9df] px-6 pt-20 text-[#2b241d]">
        <div className="text-center">
          <p className="font-serif text-4xl tracking-[-0.03em]">Virasā</p>
          <div className="mx-auto my-5 h-px w-40 bg-[#2b241d]/35" />
          <p className="animate-pulse text-[10px] font-semibold uppercase tracking-[0.36em] text-[#776d62]">Opening provenance folio</p>
        </div>
      </main>
    );
  }

  const { product: p, verify, valid } = data;
  const materials = p.materials || [];
  const steps = p.steps || [];
  const price = Number(p.price || 0).toLocaleString('en-IN');
  const hash = verify.hash || '';
  const prevHash = verify.prevHash || '';

  async function submitDispute(event) {
    event.preventDefault();
    setDisputeNotice('');
    try {
      const result = await api.disputes.create({ productId: p.id, ...dispute });
      setDisputeNotice(`Dispute ${result.id} was recorded. The certificate is paused during review.`);
      setDispute({ reporterName: '', reporterEmail: '', reason: '' });
    } catch (submitError) {
      setDisputeNotice(submitError.message);
    }
  }

  return (
    <main className="paper-texture min-h-screen bg-[#e9e5dc] pb-24 pt-24 text-[#2b241d] md:pt-28">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <Link
          to="/explore"
          className="mb-5 inline-flex items-center gap-2 border-b border-[#2b241d]/40 pb-1 text-[11px] font-semibold uppercase tracking-[0.22em] transition-colors hover:border-[#9a7417] hover:text-[#7d5d10]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to collection
        </Link>

        <section className="grid items-stretch overflow-visible border border-[#2b241d]/20 bg-[#fbf7ee] shadow-[0_26px_70px_rgba(48,39,30,0.16)] lg:min-h-[760px] lg:grid-cols-[minmax(0,0.97fr)_minmax(0,1.03fr)]">
          <Reveal className="h-full">
            <div className="relative flex h-full min-h-[590px] flex-col overflow-hidden bg-[#2b241d] p-6 text-[#f6f0e5] sm:p-9 lg:min-h-[760px] lg:p-11">
              <div className="flex items-start justify-between gap-6 border-b border-[#f6f0e5]/25 pb-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#f6f0e5]/65">
                <span>Virasā collection</span>
                <span className="text-right">Archive no.<br />{p.id}</span>
              </div>

              <div className="relative mx-auto my-auto w-full max-w-[530px] py-10 sm:px-6">
                <span className="absolute left-[5%] top-7 z-10 h-7 w-24 -rotate-3 bg-[#d9cba9]/75 shadow-sm" aria-hidden="true" />
                <span className="absolute bottom-7 right-[3%] z-10 h-7 w-20 rotate-2 bg-[#d9cba9]/70 shadow-sm" aria-hidden="true" />
                <div className="bg-[#efe7d8] p-3 shadow-[13px_16px_0_rgba(0,0,0,0.2),0_28px_60px_rgba(0,0,0,0.32)] sm:p-5">
                  <div className="flex aspect-[4/5] items-center justify-center bg-[#15120f]">
                    <img
                      src={p.image}
                      alt={p.title}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between gap-4 border-t border-[#f6f0e5]/25 pt-4">
                <div>
                  <p className="font-serif text-lg italic text-[#f6f0e5]">Original work</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-[#f6f0e5]/55">Recorded by the artisan</p>
                </div>
                <p className="handwritten -rotate-2 text-right text-lg text-[#d8c596]">{p.category || p.artisan_craft}{p.artisan_state ? `, ${p.artisan_state}` : ''}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="h-full">
            <article className="paper-sheet paper-texture relative flex h-full min-h-[760px] flex-col border-l border-[#2b241d]/20 bg-[#fbf7ee] px-6 py-9 sm:px-10 sm:py-11 lg:px-14 lg:py-12">
              <span className="absolute right-5 top-5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#2b241d]/55">Fol. {String(verify.chainIndex).padStart(3, '0')}</span>

              <header className="text-center">
                <VirasaLogo size="small" className="justify-center" />
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.36em] text-[#71675c]">Certificate of provenance · प्रमाण पत्र</p>
              </header>

              <div className="ink-rule my-8 h-px bg-[#2b241d]/35" />

              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8b6921]">{p.artisan_craft}</p>
                <h1 className="mx-auto mt-3 max-w-xl font-serif text-4xl leading-[1.02] tracking-[-0.035em] sm:text-5xl lg:text-[3.55rem]">{p.title}</h1>
              </div>

              <div className="my-8 grid items-center gap-7 border-y border-[#2b241d]/25 py-6 sm:grid-cols-[1fr_auto]">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <span className="absolute -left-2 -top-2 h-5 w-12 -rotate-6 bg-[#d7c7a2]/75" aria-hidden="true" />
                    <img src={p.artisan_photo} alt={p.artisan_name} className="h-16 w-14 border border-[#2b241d]/30 object-cover grayscale-[15%]" />
                  </div>
                  <div>
                    <p className="handwritten text-xl leading-none text-[#473a2c]">made by {p.artisan_name}</p>
                    <p className="handwritten mt-2 flex items-center gap-1.5 text-base leading-none text-[#756a5e]">
                      <MapPin className="h-3.5 w-3.5 text-[#9a7417]" /> {p.artisan_village}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#756a5e]">Artisan price</p>
                    <p className="mt-1 font-serif text-3xl">₹{price}</p>
                  </div>
                  <div className={`flex h-24 w-24 shrink-0 -rotate-6 flex-col items-center justify-center rounded-full border-2 text-center ${valid ? 'border-[#3f6a4b] text-[#31583d]' : 'border-[#9d3e35] text-[#8a3028]'}`}>
                    <ShieldCheck className="h-5 w-5" />
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em]">{valid ? 'Chain verified' : 'Chain broken'}</span>
                    <span className="mt-1 font-mono text-[8px] uppercase">Block {verify.chainIndex}/{verify.chainLength}</span>
                  </div>
                </div>
              </div>

              <p className="font-serif text-lg leading-relaxed text-[#493f35]">{p.description}</p>

              <section className="mt-8">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6e6256]">Material specimens</p>
                  <p className="handwritten -rotate-2 text-base text-[#8b6921]">chosen by hand</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
                  {materials.map((material, index) => (
                    <div
                      key={`${material}-${index}`}
                      className="relative flex min-h-20 items-end px-3 pb-3 pt-6 shadow-[2px_4px_8px_rgba(45,36,29,0.12)]"
                      style={{
                        backgroundColor: materialTones[index % materialTones.length],
                        clipPath: 'polygon(1% 4%, 97% 0, 100% 91%, 94% 100%, 4% 96%, 0 12%)',
                        transform: `rotate(${index % 2 === 0 ? -1.3 : 1.1}deg)`,
                      }}
                    >
                      <span className="absolute left-1/2 top-0 h-4 w-11 -translate-x-1/2 -translate-y-1/2 bg-[#eee5ce]/75" aria-hidden="true" />
                      <span className="text-[10px] font-semibold uppercase leading-snug tracking-[0.1em] text-[#302920]">{material}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-auto pt-9">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a href={`/api/verify/${p.id}/certificate`} className="editorial-button flex-1">
                    <Download className="h-4 w-4" /> Download certificate
                  </a>
                  <Link to={`/verify?id=${p.id}`} className="editorial-button-outline flex-1">
                    <ScanLine className="h-4 w-4" /> Verify record
                  </Link>
                </div>

                <div className="mt-7 border-t border-[#2b241d]/30 pt-4 font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em] text-[#635a50] sm:text-[10px]">
                  <p>ID {p.id} · SHA-256 {hash.slice(0, 36)}…</p>
                  <p className="mt-1 break-all">Previous {prevHash.slice(0, 44)}…</p>
                </div>
              </div>
            </article>
          </Reveal>
        </section>

        <section className="mt-14 grid gap-7 lg:grid-cols-2">
          <Reveal>
            <article className="paper-sheet border border-[#2b241d]/20 bg-[#fbf7ee] p-6 shadow-[0_18px_45px_rgba(48,39,30,0.1)] sm:p-8">
              <div className="flex items-center gap-3 border-b border-[#2b241d]/20 pb-4">
                <FileClock className="h-5 w-5 text-[#8b6921]" />
                <div><p className="section-eyebrow">Append-only history</p><h2 className="mt-1 font-serif text-2xl">Every revision remains visible.</h2></div>
              </div>
              <ol className="mt-5 divide-y divide-[#2b241d]/10">
                {history.map((revision) => (
                  <li key={revision.id} className="grid grid-cols-[3rem_1fr_auto] gap-3 py-3 text-sm">
                    <span className="font-serif text-lg text-[#8b6921]">r{revision.revision_no}</span>
                    <span><span className="block font-medium capitalize">{revision.action.replaceAll('_', ' ')}</span><span className="mt-1 block text-xs text-[#635a50]">{revision.reason || 'Registry update'}</span></span>
                    <time className="text-right text-[10px] text-[#756a5e]">{new Date(revision.created_at).toLocaleDateString()}</time>
                  </li>
                ))}
              </ol>
            </article>
          </Reveal>

          <Reveal delay={0.08}>
            <article className="paper-sheet border border-[#2b241d]/20 bg-[#fbf7ee] p-6 shadow-[0_18px_45px_rgba(48,39,30,0.1)] sm:p-8">
              <div className="flex items-center justify-between gap-4 border-b border-[#2b241d]/20 pb-4">
                <div><p className="section-eyebrow">Evidence register</p><h2 className="mt-1 font-serif text-2xl">{evidence.length} documented items</h2></div>
                <ShieldCheck className="h-6 w-6 text-[#3f6a4b]" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {evidence.map((item) => (
                  <figure key={item.id} className="border border-[#2b241d]/15 bg-[#eee7d8] p-2">
                    {item.mime_type?.startsWith('video/') ? <video src={item.url} className="aspect-[4/3] w-full object-cover" controls preload="metadata" /> : <img src={item.url} alt={item.caption || 'Provenance evidence'} className="aspect-[4/3] w-full object-cover" loading="lazy" />}
                    <figcaption className="mt-2 text-[10px] leading-4 text-[#635a50]">{item.caption || item.evidence_type}<span className="mt-1 block font-semibold uppercase tracking-[0.1em] text-[#3f6a4b]">{item.verification_status}</span></figcaption>
                  </figure>
                ))}
              </div>
            </article>
          </Reveal>
        </section>

        <Reveal className="mt-10">
          <section className="border-y border-[#2b241d]/25 py-7">
            <button type="button" onClick={() => setShowDispute((visible) => !visible)} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5d10]">
              <Scale className="h-4 w-4" /> Report incorrect provenance or ownership
            </button>
            {showDispute && (
              <form onSubmit={submitDispute} className="mt-6 grid max-w-3xl gap-4 border border-[#2b241d]/15 bg-[#fbf7ee] p-5 sm:grid-cols-2">
                <label className="text-xs">Your name<input required minLength={2} maxLength={100} value={dispute.reporterName} onChange={(event) => setDispute({ ...dispute, reporterName: event.target.value })} className="field-line mt-1 w-full" /></label>
                <label className="text-xs">Contact email<input required type="email" value={dispute.reporterEmail} onChange={(event) => setDispute({ ...dispute, reporterEmail: event.target.value })} className="field-line mt-1 w-full" /></label>
                <label className="text-xs sm:col-span-2">What is incorrect?<textarea required minLength={20} maxLength={2000} value={dispute.reason} onChange={(event) => setDispute({ ...dispute, reason: event.target.value })} className="field-line mt-1 min-h-28 w-full resize-y" /></label>
                <div className="flex items-center gap-4 sm:col-span-2"><button type="submit" className="editorial-button px-5 py-3 text-xs">Submit dispute</button>{disputeNotice && <p className="text-xs text-[#635a50]" role="status">{disputeNotice}</p>}</div>
              </form>
            )}
          </section>
        </Reveal>

        <section className="pb-6 pt-24 sm:pt-32">
          <Reveal>
            <div className="grid gap-7 border-b border-[#2b241d]/30 pb-7 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#8b6921]">The making · प्रक्रिया</p>
                <h2 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.04] tracking-[-0.035em] sm:text-5xl md:text-6xl">A work made visible, one gesture at a time.</h2>
              </div>
              <p className="handwritten max-w-xs -rotate-2 text-xl leading-snug text-[#6d5740]">{steps.length} moments preserved in the record</p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-0">
            {steps.map((step, index) => (
              <Reveal
                key={`${step.caption}-${index}`}
                delay={index * 0.07}
                className={`${index % 2 ? 'lg:mt-14' : ''} ${index > 0 ? 'lg:-ml-6' : ''}`}
              >
                <article
                  className="paper-sheet relative border border-[#2b241d]/20 bg-[#f9f3e8] p-3 pb-6 shadow-[7px_12px_24px_rgba(45,36,29,0.17)]"
                  style={{
                    transform: `rotate(${printAngles[index % printAngles.length]}deg)`,
                    zIndex: steps.length - index,
                  }}
                >
                  <span className="absolute left-1/2 top-0 z-10 h-7 w-24 -translate-x-1/2 -translate-y-1/2 bg-[#d8c9a9]/70 shadow-sm" aria-hidden="true" />
                  <div className="relative overflow-hidden bg-[#d8d0c2]">
                    <img src={step.image} alt={step.caption} className="aspect-[4/3] w-full object-cover grayscale-[10%]" loading="lazy" />
                    <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center border border-[#f8f2e8]/60 bg-[#2b241d]/80 font-serif text-sm text-[#f8f2e8]">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <p className="handwritten mt-5 text-xl leading-tight text-[#3f342a]">{step.caption}</p>
                  <div className="my-3 h-px w-14 bg-[#9a7417]/55" />
                  <p className="text-xs leading-relaxed text-[#6b6055]">{stepNotes[index] || 'This moment was photographed and added to the work’s permanent provenance record.'}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal className="mt-16">
          <div className="border-y border-[#2b241d]/30 py-7 text-center">
            <p className="font-serif text-xl italic text-[#45392e]">This story is locked into Virasā.</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#766b60]">Alter one record and the chain reveals the change</p>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
