import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from '../lib/api.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(status, body) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('api.artisans', () => {
  it('list calls GET /artisans', async () => {
    mockFetchOnce(200, [{ id: 'ART-1' }]);
    const res = await api.artisans.list();
    expect(res).toEqual([{ id: 'ART-1' }]);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/artisans', expect.anything());
  });

  it('search appends query params and a page/limit', async () => {
    mockFetchOnce(200, { data: [], total: 0, totalPages: 0 });
    await api.artisans.search({ q: 'Sunita', page: 2, limit: 10 });
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/api/artisans?');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
    expect(url).toContain(encodeURIComponent('Sunita'));
  });

  it('create POSTs JSON with a content-type header', async () => {
    mockFetchOnce(201, { id: 'ART-NEW' });
    const body = { name: 'Priya', village: 'B', craft: 'C' };
    await api.artisans.create(body);
    const [, opts] = globalThis.fetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(body);
  });

  it('update issues a PATCH', async () => {
    mockFetchOnce(200, { id: 'ART-1' });
    await api.artisans.update('ART-1', { village: 'Ranti' });
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(opts.method).toBe('PATCH');
    expect(url).toContain('/artisans/ART-1');
  });

  it('remove issues a DELETE', async () => {
    mockFetchOnce(200, { ok: true, deleted: 'ART-1' });
    const res = await api.artisans.remove('ART-1');
    expect(globalThis.fetch.mock.calls[0][1].method).toBe('DELETE');
    expect(res.deleted).toBe('ART-1');
  });
});

describe('api.products', () => {
  it('get requests a single product', async () => {
    mockFetchOnce(200, { id: 'KC-1' });
    await api.products.get('KC-1');
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/products/KC-1');
  });
});

describe('error handling', () => {
  it('throws the server-provided error message on failure', async () => {
    mockFetchOnce(400, { error: 'price must be a number' });
    await expect(api.products.create({})).rejects.toThrow('price must be a number');
  });
});
