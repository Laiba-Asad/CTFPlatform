import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LoginPage } from './LoginPage';

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage bootstrap', () => {
  beforeEach(() => {
    // Simulate the API being unreachable (e.g. still starting).
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders the form and all six teams immediately, without a working API', async () => {
    renderLogin();
    // The form is present right away.
    expect(screen.getByRole('button', { name: /enter the arena/i })).toBeTruthy();
    expect(screen.getByLabelText(/your name/i)).toBeTruthy();

    // The team dropdown lists all six teams from the embedded roster (no API call).
    const combo = screen.getByRole('combobox', { name: /select your team/i });
    combo.click();
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(6);
    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining(['0xDEADC0DE', 'GH0ST.PR0T0', 'KR4CK_T3AM', 'N0_TR4C3', 'SH3LLSH0CK', 'Z3R0D4Y']),
    );
  });

  it('shows a calm "can\'t reach the server" notice when the API is down', async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByText(/can't reach the server/i)).toBeTruthy());
    // The sign-in button is still usable (not blocked by the API being down).
    expect(screen.getByRole('button', { name: /enter the arena/i }).hasAttribute('disabled')).toBe(false);
  });
});
