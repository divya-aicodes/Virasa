import { motion, useReducedMotion } from 'framer-motion';

const threadPaths = [
  'M8.8 21.7c10.7-4.4 18.3.2 23.3 13.3 4.8 12.7 10.5 15.6 22.7-14.1',
  'M8.2 27.6c10.1-4.6 17.2-.2 21.9 12.2 4.7 12.5 11.1 16.1 25.7-12.6',
  'M8.2 33.4c9.4-4.3 15.7-.7 20.1 10.8 4.5 11.8 11.2 15 27-10.3',
  'M10.4 39.3c7.7-3.1 12.8-.1 16.7 9.3 3.5 8.6 10.4 11 24.8-5.2',
  'M39.7 43.7c5.8-5.7 10.7-13.1 14.8-22.8',
  'M43.9 48.1c5.3-5.2 9.4-11.7 12.2-19.1',
];

const sizes = {
  display: {
    gap: 'gap-3.5',
    mark: 'h-12 w-12 sm:h-[3.35rem] sm:w-[3.35rem]',
    word: "text-[2.8rem] sm:text-[3.2rem]",
  },
  nav: {
    gap: 'gap-2',
    mark: 'h-8 w-8 md:h-9 md:w-9',
    word: "text-[1.9rem] md:text-[2.15rem]",
  },
  small: {
    gap: 'gap-2.5',
    mark: 'h-8 w-8',
    word: "text-[1.85rem]",
  },
};

export default function VirasaLogo({ dark = false, animated = false, size = 'display', className = '' }) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;
  const logoSize = sizes[size] || sizes.display;

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 5 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 0.65, 0.3, 1] }}
      className={`group/logo inline-flex items-center ${logoSize.gap} ${dark ? 'text-[#f5efe1]' : 'text-[#24211c]'} ${className}`}
      aria-label="Virasā"
    >
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className={`${logoSize.mark} shrink-0 text-[#c39a55] transition-colors duration-300 group-hover/logo:text-[#d8b471]`}
        fill="none"
      >
        <motion.circle
          cx="32"
          cy="32"
          r="27.25"
          stroke="currentColor"
          strokeWidth="1.8"
          initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.75, ease: 'easeInOut' }}
        />
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
          {threadPaths.map((path, index) => (
            <motion.path
              key={path}
              d={path}
              initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : false}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: shouldAnimate ? 0.08 + index * 0.055 : 0, ease: 'easeInOut' }}
            />
          ))}
        </g>
        <motion.circle
          cx="47.2"
          cy="15.7"
          r="2.8"
          fill="currentColor"
          initial={shouldAnimate ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, delay: shouldAnimate ? 0.68 : 0 }}
        />
      </motion.svg>

      <motion.span
        initial={shouldAnimate ? { opacity: 0, x: -3 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, delay: shouldAnimate ? 0.18 : 0, ease: 'easeOut' }}
        className={`font-['Cormorant_Garamond'] ${logoSize.word} font-medium leading-none tracking-[-.045em] transition-transform duration-300 group-hover/logo:translate-x-px`}
      >
        Virasā
      </motion.span>
    </motion.div>
  );
}
