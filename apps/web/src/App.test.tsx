import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { dashboardFixture, jsonResponse } from './test/fixtures';

describe('lunch dashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(dashboardFixture)));
  });

  it('renders verified menus with provenance and never exposes stale dishes', async () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Hämtar dagens luncher…' }),
    ).toBeInTheDocument();

    const restaurant = await screen.findByRole('heading', { name: 'Ateljén' });
    const card = restaurant.closest('article');
    expect(card).not.toBeNull();
    expect(within(card!).getByText('Rostad blomkål med tahini')).toBeInTheDocument();
    expect(within(card!).getByText('135 kr')).toBeInTheDocument();
    expect(within(card!).getByText('Glutenfri')).toBeInTheDocument();
    expect(within(card!).getByText('260 m från Tellusgången')).toBeInTheDocument();
    expect(within(card!).getByRole('link', { name: /Originalmeny/ })).toHaveAttribute(
      'href',
      'https://example.com/lunch',
    );

    expect(screen.getByRole('heading', { name: 'Gamla Hörnan' })).toBeInTheDocument();
    expect(screen.getByText('Kan vara inaktuell')).toBeInTheDocument();
    expect(screen.getByText('Ingen bekräftad meny att visa.')).toBeInTheDocument();
    expect(screen.queryByText('Gammal pannbiff')).not.toBeInTheDocument();
  });

  it('searches restaurants and dishes and can reset an empty result', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Ateljén' });

    const search = screen.getByRole('searchbox', {
      name: 'Sök restaurang eller maträtt',
    });
    await user.type(search, 'linssoppa');

    expect(
      screen.getByRole('heading', { name: 'Söderbergs Bistro' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ateljén' })).not.toBeInTheDocument();
    expect(screen.getByText('1 restaurang visas')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'ramen');
    expect(
      screen.getByRole('heading', { name: 'Inga träffar med de filtren' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rensa filter' }));

    expect(screen.getByRole('heading', { name: 'Ateljén' })).toBeInTheDocument();
    expect(search).toHaveValue('');
  });

  it('filters to confirmed and dietary-compatible menus', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Ateljén' });

    await user.click(screen.getByRole('checkbox', { name: 'Bara bekräftade idag' }));
    expect(
      screen.queryByRole('heading', { name: 'Gamla Hörnan' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('2 restauranger visas')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Vegansk' }));
    expect(
      screen.getByRole('heading', { name: 'Söderbergs Bistro' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ateljén' })).not.toBeInTheDocument();
    expect(screen.getByText('1 restaurang visas')).toBeInTheDocument();
  });

  it('provides landmark navigation and named interactive controls', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Ateljén' });

    expect(
      screen.getByRole('navigation', { name: 'Huvudnavigation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hoppa till luncherna' })).toHaveAttribute(
      'href',
      '#lunch-results',
    );
    expect(screen.getByRole('combobox', { name: 'Sortera' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Kostönskemål' })).toBeInTheDocument();
  });

  it('shows a useful API error and retries successfully', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse(dashboardFixture));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Luncherna kunde inte laddas',
    );
    await user.click(screen.getByRole('button', { name: 'Försök igen' }));

    expect(await screen.findByRole('heading', { name: 'Ateljén' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/lunch',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('rejects malformed API data instead of partially rendering it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ restaurants: [] })),
    );
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('oväntat format');
    });
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });
});
