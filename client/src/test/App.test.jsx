import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '../App.jsx';
import Reveal from '../components/ui/Reveal.jsx';
import RequireAdmin from '../components/RequireAdmin.jsx';
import { AuthProvider } from '../auth.jsx';
import { setToken } from '../lib/api.js';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});

function renderAt(path, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<div>Landing content</div>} />
          </Route>
          <Route path="/admin" element={element} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('App shell', () => {
  it('renders the Virasā brand and navigation', () => {
    renderAt('/', <div>Landing content</div>);

    expect(screen.getByText('Virasā')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Collection')).toBeInTheDocument();
    expect(screen.getByText('For artisans')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });
});

describe('RequireAdmin guard', () => {
  it('hides the registry from artisans and shows sign-out', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'USR-ART001', name: 'Sunita Devi', email: 'sunita@virasa.in', role: 'artisan' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    setToken('artisan-token');

    renderAt('/', <div>Landing content</div>);

    expect(await screen.findByText('Landing content')).toBeTruthy();
    expect(screen.queryByText('Manage')).toBeNull();
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.getByText('Sunita Devi · Sign out')).toBeTruthy();
  });

  it('keeps the admin toolbar clean for admins', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'USR-ADMIN1', name: 'Archive Admin', email: 'admin@virasa.in', role: 'admin' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    setToken('admin-token');

    renderAt('/', <div>Landing content</div>);

    expect(await screen.findByText('Landing content')).toBeTruthy();
    expect(screen.queryByText('Manage')).toBeNull();
    expect(screen.getByText('Archive Admin · Sign out')).toBeTruthy();
  });

  it('asks for confirmation before signing out', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'USR-ADMIN1', name: 'Archive Admin', email: 'admin@virasa.in', role: 'admin' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    setToken('admin-token');

    renderAt('/', <div>Landing content</div>);
    expect(await screen.findByText('Landing content')).toBeTruthy();

    await screen.findByText('Landing content');

    fireEvent.click(screen.getByRole('button', { name: /archive admin · sign out/i }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/sign out of virasā\?/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Archive Admin · Sign out')).toBeTruthy();
  });

  it('signs out after confirming', async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            user: { id: 'USR-ADMIN1', name: 'Archive Admin', email: 'admin@virasa.in', role: 'admin' },
          }),
        });
      }
      if (url === '/api/auth/logout') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.reject(new Error('unexpected call'));
    });
    vi.stubGlobal('fetch', fetchMock);
    setToken('admin-token');

    renderAt('/', <div>Landing content</div>);
    expect(await screen.findByText('Landing content')).toBeTruthy();

    await screen.findByText('Landing content');

    fireEvent.click(screen.getByRole('button', { name: /archive admin · sign out/i }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /^sign out$/i }));

    expect(await screen.findByText('Sign in')).toBeTruthy();
    expect(screen.queryByText('Archive Admin · Sign out')).toBeNull();
    expect(localStorage.getItem('virasa_token')).toBeNull();
  });

  it('denies artisans at /admin with an explanation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'USR-ART001', name: 'Sunita Devi', email: 'sunita@virasa.in', role: 'artisan' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    setToken('artisan-token');

    renderAt('/admin', <RequireAdmin><div>SECRET REGISTRY</div></RequireAdmin>);

    expect(await screen.findByText(/registry access is reserved/i)).toBeTruthy();
    expect(screen.queryByText('SECRET REGISTRY')).toBeNull();
  });

  it('lets an admin through to the registry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'USR-ADMIN1', name: 'Archive Admin', email: 'admin@virasa.in', role: 'admin' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    setToken('admin-token');

    renderAt('/admin', <RequireAdmin><div>SECRET REGISTRY</div></RequireAdmin>);

    expect(await screen.findByText('SECRET REGISTRY')).toBeTruthy();
  });
});

describe('Reveal', () => {
  it('renders its children', () => {
    render(
      <Reveal>
        <p>Hello world</p>
      </Reveal>
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });
});
