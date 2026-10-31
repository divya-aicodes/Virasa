import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const HERITAGE_SLIDES = [
  { src: '/heritage-slides/01-textile-market.png', alt: 'A colourful Indian textile market lined with handwoven fabrics' },
  { src: '/heritage-slides/02-painted-pottery.png', alt: 'An artisan hand-painting traditional decorative pottery' },
  { src: '/heritage-slides/03-wooden-crafts.jpeg', alt: 'A market display of brightly painted wooden handicrafts' },
  { src: '/heritage-slides/04-metal-elephant.jpeg', alt: 'An engraved metal elephant among traditional brassware' },
  { src: '/heritage-slides/05-brass-figurines.jpeg', alt: 'Hand-finished brass figurines in a craft market' },
  { src: '/heritage-slides/06-folk-musicians.jpeg', alt: 'Traditional folk musician figurines wearing colourful dress' },
  { src: '/heritage-slides/07-handcrafted-juttis.jpeg', alt: 'Rows of colourful handcrafted Indian juttis' },
  { src: '/heritage-slides/08-artisan-bangles.jpeg', alt: 'A vibrant collection of handmade Indian bangles' },
  { src: '/heritage-slides/09-gold-jewellery.png', alt: 'Detailed traditional gold jewellery resting on woven fabric' },
];

export default function HeritageCarousel({ className = '', imageClassName = '', interval = 4200 }) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERITAGE_SLIDES.length);
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval, reduceMotion]);

  return (
    <div
      className={`group/carousel relative isolate overflow-hidden bg-[#241d16] ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Indian handmade heritage"
    >
      {HERITAGE_SLIDES.map((slide, index) => {
        const active = index === activeIndex;
        return (
          <motion.img
            key={slide.src}
            src={slide.src}
            alt={active ? slide.alt : ''}
            aria-hidden={!active}
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchpriority={index === 0 ? 'high' : 'auto'}
            decoding="async"
            initial={false}
            animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 1.055 }}
            transition={reduceMotion ? { duration: 0 } : { opacity: { duration: 1.05, ease: 'easeInOut' }, scale: { duration: 5.2, ease: 'linear' } }}
            className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`}
          />
        );
      })}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/45 to-transparent" />
      <div className="absolute inset-x-3 bottom-3 z-20 sm:inset-x-4">
        <div className="flex items-center gap-1.5" aria-label={`Image ${activeIndex + 1} of ${HERITAGE_SLIDES.length}`}>
          {HERITAGE_SLIDES.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${index === activeIndex ? 'w-5 bg-[#e5ca84]' : 'w-1.5 bg-white/55 hover:bg-white/85'}`}
              aria-label={`Show image ${index + 1}: ${slide.alt}`}
              aria-current={index === activeIndex ? 'true' : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
