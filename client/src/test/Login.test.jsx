import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login.jsx';
import { AuthProvider } from '../auth.jsx';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<div>ADMIN DASHBOARD</div>} />
          <Route path="/artisan" element={<div>ARTISAN PANEL</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Login page', () => {
  it('renders the sign-in form', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeTruthy();
    expect(screen.getByLabelText(/^email/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in to the archive/i })).toBeTruthy();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderLogin();

    const password = screen.getByLabelText(/^password/i);
    await user.type(password, 'secret');

    expect(password).toHaveProperty('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveProperty('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveProperty('type', 'password');
  });

  it('shows a notice when submitting empty credentials', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /sign in to the archive/i }));

    expect(screen.getByRole('status').textContent).toMatch(
      /enter your archive credentials/i,
    );
  });

  it('signs in an admin and navigates to the dashboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'tok-123',
        user: { id: 'USR-ADMIN1', name: 'Archive Admin', email: 'admin@virasa.in', role: 'admin' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/^email/i), 'admin@virasa.in');
    await user.type(screen.getByLabelText(/^password/i), 'admin-virasa-2026');
    await user.click(screen.getByRole('button', { name: /sign in to the archive/i }));

    expect(await screen.findByText('ADMIN DASHBOARD')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('switches to register mode', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /request access/i }));

    expect(screen.getByLabelText(/^name/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /become a keeper/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /create your account/i })).toBeTruthy();
  });

  it('registers a new account then returns to sign-in', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'USR-NEW1', name: 'New Keeper', email: 'new@example.com', role: 'artisan' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /request access/i }));
    await user.type(screen.getByLabelText(/^name/i), 'New Keeper');
    await user.type(screen.getByLabelText(/^email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'keeper-pass-123');
    await user.click(screen.getByRole('button', { name: /create your account/i }));

    expect(await screen.findByText(/account created\. sign in to continue/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
