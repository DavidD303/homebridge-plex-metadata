import type { PlexSession } from './plexTypes.js';

export type PlayerId = string;

export type PlayerMetadata = {
  title?: string;
  aspectRatio?: string;
  resolution?: string;
  audioCodec?: string;
  videoCodec?: string;
  session?: PlexSession;
};

export type PlayerSnapshot = {
  playerId: PlayerId;
  playerTitle?: string;
  state: 'playing' | 'paused' | 'stopped' | 'idle';
  updatedAt: number;
  source: 'poll' | 'webhook';
  metadata: PlayerMetadata;
};

export type PlexServiceEvents = {
  'player:update': PlayerSnapshot;
  'player:offline': { playerId: PlayerId; updatedAt: number; source: 'poll' | 'webhook' };
  'sessions:update': Map<PlayerId, PlayerSnapshot>;
  'connection:status': { status: 'connected' | 'degraded' | 'disconnected'; reason?: string; at: number };
  'connection:error': { error: unknown; at: number };
};

export type PlaybackState = 'playing' | 'paused' | 'stopped';

export type PlexWebhookPlaybackEvent = {
  state: PlaybackState;
  playerUuid?: string;
};

export type PlexPlayerEventsPort = {
  on<K extends keyof PlexServiceEvents>(
    event: K,
    listener: (payload: PlexServiceEvents[K]) => void,
  ): PlexPlayerEventsPort;
  off<K extends keyof PlexServiceEvents>(
    event: K,
    listener: (payload: PlexServiceEvents[K]) => void,
  ): PlexPlayerEventsPort;
  getSnapshot(playerId: PlayerId): PlayerSnapshot | undefined;
};
