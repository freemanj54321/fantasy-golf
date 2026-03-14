import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('rapidApiConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports configuration object', async () => {
    // Mock import.meta.env
    vi.stubGlobal('import', {
      meta: {
        env: {
          VITE_RAPIDAPI_API_KEY: 'test-api-key',
          VITE_RAPIDAPI_QUOTES_API_HOST: 'quotes-host',
          VITE_RAPIDAPI_GOLF_API_HOST: 'golf-host',
        },
      },
    });

    const { rapidApiConfig } = await import('./rapidApiConfig');

    expect(rapidApiConfig).toBeDefined();
    expect(typeof rapidApiConfig).toBe('object');
  });

  it('has apiKey property', async () => {
    const { rapidApiConfig } = await import('./rapidApiConfig');
    expect(rapidApiConfig).toHaveProperty('apiKey');
  });

  it('has quotesApiHost property', async () => {
    const { rapidApiConfig } = await import('./rapidApiConfig');
    expect(rapidApiConfig).toHaveProperty('quotesApiHost');
  });

  it('has golfApiHost property', async () => {
    const { rapidApiConfig } = await import('./rapidApiConfig');
    expect(rapidApiConfig).toHaveProperty('golfApiHost');
  });
});
