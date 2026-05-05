import type {
  PlexApiResponse,
  PlexMediaContainer,
  PlexRequestOptions,
  PlexSession,
} from './plexTypes.js';

/**
 * Minimal Plex API client scaffold.
 * Pass a Plex host (e.g. http://192.168.1.10:32400) and token in constructor.
 */
export class PlexApiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(host: string, token: string) {
    if (!host.trim()) {
      throw new Error('Plex host is required.');
    }
    if (!token.trim()) {
      throw new Error('Plex token is required.');
    }

    this.baseUrl = this.normalizeHost(host);
    this.token = token.trim();
  }

  /**
   * Returns active playback sessions.
   */
  async getSessions(): Promise<PlexApiResponse<PlexMediaContainer<PlexSession>>> {
    return this.request<PlexApiResponse<PlexMediaContainer<PlexSession>>>('/status/sessions');
  }

  async request<T>(path: string, options: PlexRequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const url = this.buildUrl(path, options.query);
    const response = await fetch(url, {
      method,
      body: options.body,
      headers: {
        Accept: 'application/json',
        'X-Plex-Token': this.token,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Plex request failed (${response.status}): ${message}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      const body = await response.text();
      throw new Error(`Expected JSON from Plex API, received: ${contentType || 'unknown'} (${body.slice(0, 200)})`);
    }

    return await response.json() as T;
  }

  private buildUrl(path: string, query: PlexRequestOptions['query'] = {}): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    url.searchParams.set('X-Plex-Token', this.token);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private normalizeHost(host: string): string {
    const trimmed = host.trim();
    const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
    return withProtocol.replace(/\/+$/, '');
  }
}
