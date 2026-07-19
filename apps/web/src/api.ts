import {
  dashboardResponseSchema,
  type DashboardResponse,
} from '@lunch/shared/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'DashboardApiError';
  }
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/api/v1/lunch`, {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new DashboardApiError(
      'Lunchservern gick inte att nå. Kontrollera anslutningen och försök igen.',
    );
  }

  if (!response.ok) {
    throw new DashboardApiError(
      'Lunchservern svarade inte som förväntat. Försök igen om en stund.',
      response.status,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new DashboardApiError('Lunchservern skickade ett oläsbart svar.');
  }

  const parsed = dashboardResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new DashboardApiError('Lunchserverns svar hade ett oväntat format.');
  }

  return parsed.data;
}
