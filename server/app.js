import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import rateLimit from 'express-rate-limit';
import { UPLOAD_DIR } from './db.js';
import { httpError } from './lib/validate.js';
import { chainLength, verifyChain } from './lib/hashchain.js';
import { currentUser } from './lib/auth.js';
import artisansRouter from './routes/artisans.js';
import productsRouter from './routes/products.js';
import verifyRouter from './routes/verify.js';
import authRouter from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
app.disable('x-powered-by');

// Trust one proxy hop when deployed behind a reverse proxy / CDN so rate
// limiting and client IP detection use the real origin address.
app.set('trust proxy', NODE_ENV === 'production' ? 1 : false);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'",
  );
  next();
});

const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 15 * 60 * 1000);
const RATE_MAX = Number(process.env.RATE_MAX || 200);
const WRITE_MAX = Number(process.env.WRITE_MAX || 20);
const UPLOAD_MAX = Number(process.env.UPLOAD_MAX || 30);

const limiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

const writeLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: WRITE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write attempts, please try again later' },
});

const uploadLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: UPLOAD_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
});

function requireWriteAccess(req, res, next) {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Request origin is not allowed' });
  }

  const user = currentUser(req);
  if (user) {
    req.user = user;
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  const validKeys = (process.env.API_KEYS || '').split(',').map((key) => key.trim()).filter(Boolean);
  if (apiKey && validKeys.includes(apiKey)) {
    req.apiKeyAuthenticated = true;
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
}

app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.includes(file.mimetype) || !ALLOWED_EXTS.includes(ext)) {
    return cb(httpError(400, 'Only JPG, PNG, and WebP images are allowed'), false);
  }
  cb(null, true);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

const JPEG_SIG = [0xff, 0xd8, 0xff];
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function sniffImage(filePath) {
  const fd = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fd.read(buf, 0, 12, 0);
    const head = buf.subarray(0, bytesRead);
    if (head.length >= JPEG_SIG.length && JPEG_SIG.every((b, i) => head[i] === b)) return 'image/jpeg';
    if (head.length >= PNG_SIG.length && PNG_SIG.every((b, i) => head[i] === b)) return 'image/png';
    if (head.length >= 12 && head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return null;
  } finally {
    await fd.close();
  }
}

app.post('/api/upload', uploadLimiter, requireWriteAccess, upload.array('files', 10), async (req, res, next) => {
  const files = req.files || [];
  try {
    for (const f of files) {
      const detected = await sniffImage(f.path);
      if (!detected || detected !== f.mimetype) {
        const err = httpError(400, 'Uploaded file content does not match its declared image type');
        err.cleanup = files.map((x) => x.path);
        throw err;
      }
    }
  } catch (err) {
    if (err.cleanup) {
      await Promise.allSettled(err.cleanup.map((p) => fsp.unlink(p).catch(() => {})));
    }
    return next(err);
  }
  res.json({ urls: files.map((f) => `/uploads/${f.filename}`) });
});

app.use('/api/artisans', (req, res, next) => {
  if (req.method !== 'GET') {
    return writeLimiter(req, res, () => requireWriteAccess(req, res, next));
  }
  next();
}, artisansRouter);

app.use('/api/products', (req, res, next) => {
  if (req.method !== 'GET') {
    return writeLimiter(req, res, () => requireWriteAccess(req, res, next));
  }
  next();
}, productsRouter);

app.use('/api/verify', verifyRouter);
app.use('/api/auth', authLimiter, authRouter);

app.get('/api/health', (req, res) => {
  const chain = verifyChain();
  res.json({
    ok: chain.valid,
    uptime: process.uptime(),
    products: chainLength(),
    node: process.version,
    env: NODE_ENV,
    chain: { valid: chain.valid, errors: chain.errors.length },
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Virasā API',
    version: '1.0.0',
    docs: 'See README.md',
    endpoints: {
      health: '/api/health',
      artisans: 'GET/POST /api/artisans',
      artisan: 'GET /api/artisans/:id',
      products: 'GET/POST /api/products',
      product: 'GET /api/products/:id',
      upload: 'POST /api/upload',
      verify: 'GET /api/verify/:id',
      chain: 'GET /api/verify',
      certificate: 'GET /api/verify/:id/certificate',
    },
  });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
if (NODE_ENV === 'production' && fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
  console.log(`Virasā serving client build from ${CLIENT_DIST}`);
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large (max 5 MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err.safe) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

export default app;
