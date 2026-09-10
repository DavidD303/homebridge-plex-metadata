import type {
  PlexApiResponse,
  PlexMediaContainer,
  PlexMetadataItem,
  PlexRequestOptions,
  PlexSession,
} from './plexTypes.js';

type Logger = {
  error: (message: string, ...parameters: unknown[]) => void;
};

/**
 * Minimal Plex API client scaffold.
 * Pass a Plex host (e.g. http://192.168.1.10:32400) and token in constructor.
 */
export class PlexApiClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly log: Logger;

  constructor(host: string, token: string, log?: Logger) {
    if (!host.trim()) {
      throw new Error('Plex host is required.');
    }
    if (!token.trim()) {
      throw new Error('Plex token is required.');
    }

    this.baseUrl = this.normalizeHost(host);
    this.token = token.trim();
    this.log = log ?? { error: console.error };
  }

  /**
   * Returns active playback sessions.
   */
  async getSessions(): Promise<PlexApiResponse<PlexMediaContainer<PlexSession>>> {
    return this.request<PlexApiResponse<PlexMediaContainer<PlexSession>>>('/status/sessions');
  }

  /** Returns intro and credits markers detected for one library item. */
  async getMarkers(ratingKey: string): Promise<PlexApiResponse<PlexMediaContainer<PlexMetadataItem>>> {
    return this.request<PlexApiResponse<PlexMediaContainer<PlexMetadataItem>>>(
      `/library/metadata/${encodeURIComponent(ratingKey)}`,
      { query: { includeMarkers: 1 } },
    );
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
      this.log.error(`Plex request failed (${response.status}): ${message}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      const body = await response.text();
      this.log.error(`Expected JSON from Plex API, received: ${contentType || 'unknown'} (${body.slice(0, 200)})`);
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
