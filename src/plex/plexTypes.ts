export type PlexRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: BodyInit | null;
  headers?: Record<string, string>;
};

export type PlexMediaContainer<T> = {
  size?: number;
  Metadata?: T[];
  [key: string]: unknown;
};

export type PlexMedia = {
  width: number;
  height: number;
  audioCodec: string;
  videoCodec: string;
  videoResolution: string;
};

export type PlexApiResponse<T = unknown> = {
  MediaContainer: T;
};

export type PlexPlayer = {
  address?: string;
  title?: string;
  state?: string;
  machineIdentifier?: string;
};

export type PlexSessionRef = {
  id?: string;
};

export type PlexMetadataSummary = {
  title?: string;
  grandparentTitle?: string;
};

export type PlexSession = {
  key: string;
  ratingKey?: string;
  viewOffset?: number;
  type: string;
  title: string;
  grandparentTitle: string;
  parentTitle: string;
  Media: PlexMedia[];
  Player: PlexPlayer;
  Session: PlexSessionRef;
  User: PlexUser;
  [key: string]: unknown;
};

export type PlexMarker = {
  type?: string;
  startTimeOffset?: number;
  endTimeOffset?: number;
  final?: boolean | number;
};

export type PlexMetadataItem = {
  ratingKey?: string;
  Marker?: PlexMarker[];
};

export type PlexWebhookPayload = {
  event: string;
  Player?: PlexWebhookPlayer;
  Session?: PlexSessionRef;
  Metadata?: PlexMetadataSummary;
  Account?: PlexUser;
};

export type PlexUser = {
  id: string;
  thumb: string;
  title: string;
};

export type PlexWebhookPlayer = {
  publicAddress?: string;
  title?: string;
  uuid?: string;
};
