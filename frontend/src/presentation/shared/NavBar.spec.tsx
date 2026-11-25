import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/use-auth';
import { NavBar } from './NavBar';

vi.mock('../auth/use-auth');

describe('NavBar logout control', () => {
  afterEach(cleanup);

  it('calls the auth logout when "Se déconnecter" is clicked', () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'u1',
        email: 'a@b.c',
        name: 'Alice',
        avatarUrl: null,
        language: 'fr',
      },
      loading: false,
      logout,
    });
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('shows no logout control when signed out', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      logout: vi.fn(),
    });
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
  });
});
