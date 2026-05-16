import { EventEmitter } from 'node:events';
import type { Logging } from 'homebridge';
import { PlexApiClient } from './plexApi.js';
import { PlexWebhookServer } from './plexWebhookServer.js';
import type { PlexSession } from './plexTypes.js';
import type { PlexPlayerEventsPort, PlexServiceEvents, PlayerId, PlayerMetadata, PlayerSnapshot } from './plexService.types.js';

type PlexServiceOptions = {
  host: string;
  token: string;
  log: Logging;
  pollIntervalMs?: number;
  enableWebhooks?: boolean;
  webhookPort?: number;
};

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_WEBHOOK_PORT = 32500;

export class PlexService implements PlexPlayerEventsPort {
  private readonly events = new EventEmitter();
  private readonly apiClient: PlexApiClient;
  private readonly snapshots = new Map<PlayerId, PlayerSnapshot>();
  private readonly pollIntervalMs: number;
  private pollTimer?: NodeJS.Timeout;
  private webhookServer?: PlexWebhookServer;
  private connected = false;

  constructor(private readonly options: PlexServiceOptions) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.apiClient = new PlexApiClient(options.host, options.token, options.log);
  }

  start() {
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        void this.pollSessions();
      }, this.pollIntervalMs);
      void this.pollSessions();
    }

    if (this.options.enableWebhooks && !this.webhookServer) {
      this.webhookServer = new PlexWebhookServer({
        port: this.options.webhookPort ?? DEFAULT_WEBHOOK_PORT,
        log: this.options.log,
      });
      this.webhookServer.onPlaybackEvent((event) => {
        if (!event.playerUuid) {
          return;
        }
        const existing = this.snapshots.get(event.playerUuid);
        if (!existing) {
          return;
        }
        const nextSnapshot: PlayerSnapshot = {
          ...existing,
          state: event.state,
          source: 'webhook',
          updatedAt: Date.now(),
        };
        this.snapshots.set(event.playerUuid, nextSnapshot);
        this.emit('player:update', nextSnapshot);
      });
      this.webhookServer.start();
    }
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    if (this.webhookServer) {
      this.webhookServer.stop();
      this.webhookServer = undefined;
    }
    this.events.removeAllListeners();
  }

  on<K extends keyof PlexServiceEvents>(
    event: K,
    listener: (payload: PlexServiceEvents[K]) => void,
  ): PlexPlayerEventsPort {
    this.events.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof PlexServiceEvents>(
    event: K,
    listener: (payload: PlexServiceEvents[K]) => void,
  ): PlexPlayerEventsPort {
    this.events.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  getSnapshot(playerId: PlayerId): PlayerSnapshot | undefined {
    return this.snapshots.get(playerId);
  }

  private emit<K extends keyof PlexServiceEvents>(event: K, payload: PlexServiceEvents[K]) {
    this.events.emit(event, payload);
  }

  private async pollSessions() {
    try {
      const response = await this.apiClient.getSessions();
      const nextSnapshots = this.buildSnapshots(response.MediaContainer.Metadata ?? []);
      const now = Date.now();

      for (const [playerId] of this.snapshots) {
        if (!nextSnapshots.has(playerId)) {
          this.emit('player:offline', { playerId, updatedAt: now, source: 'poll' });
        }
      }

      this.snapshots.clear();
      for (const [playerId, snapshot] of nextSnapshots) {
        this.snapshots.set(playerId, snapshot);
        this.emit('player:update', snapshot);
      }
      this.emit('sessions:update', new Map(this.snapshots));

      if (!this.connected) {
        this.connected = true;
        this.emit('connection:status', { status: 'connected', at: now });
      }
    } catch (error) {
      const now = Date.now();
      this.emit('connection:error', { error, at: now });
      const status = this.connected ? 'degraded' : 'disconnected';
      this.connected = false;
      this.emit('connection:status', { status, reason: this.describeError(error), at: now });
    }
  }

  private buildSnapshots(sessions: PlexSession[]): Map<PlayerId, PlayerSnapshot> {
    const next = new Map<PlayerId, PlayerSnapshot>();
    for (const session of sessions) {
      const playerId = session.Player?.machineIdentifier;
      if (!playerId) {
        continue;
      }
      const media = session.Media?.[0];
      const metadata: PlayerMetadata = {
        title: session.title,
        aspectRatio: this.toAspectRatio(media?.width, media?.height),
        resolution: media?.videoResolution,
        audioCodec: media?.audioCodec,
        videoCodec: media?.videoCodec,
        session,
      };
      next.set(playerId, {
        playerId,
        playerTitle: session.Player?.title,
        state: this.toPlaybackState(session.Player?.state),
        updatedAt: Date.now(),
        source: 'poll',
        metadata,
      });
    }
    return next;
  }

  private toPlaybackState(value?: string): PlayerSnapshot['state'] {
    if (value === 'playing' || value === 'paused' || value === 'stopped') {
      return value;
    }
    return 'idle';
  }

  private toAspectRatio(width?: number, height?: number): string | undefined {
    if (!width || !height) {
      return;
    }
    const ratio = width / height;
    if (ratio === 16 / 9) {
      return '16:9';
    }
    if (ratio === 4 / 3) {
      return '4:3';
    }
    if (ratio === 2.4) {
      return '2.4:1';
    }
    return `${ratio.toFixed(2)}:1`;
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown Plex polling error';
  }
}
