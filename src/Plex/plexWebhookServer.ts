import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import asyncBusboy from 'async-busboy';
import type { PlaybackState, PlexWebhookPayload } from './plexTypes.js';

type Log = {
  info: (message: string, ...parameters: unknown[]) => void;
  warn: (message: string, ...parameters: unknown[]) => void;
  debug: (message: string, ...parameters: unknown[]) => void;
  error: (message: string, ...parameters: unknown[]) => void;
};

type PlexWebhookServerOptions = {
  port: number;
  log: Log;
};

export class PlexWebhookServer extends EventEmitter {
  private server?: Server;
  private log: Log;
  private path: string = '/plex/webhook';
  constructor(private readonly options: PlexWebhookServerOptions) {
    super();
    this.log = options.log;
  }

  start() {
    if (this.server) {
      return;
    }

    this.server = createServer((req, res) => {
      void this.handleRequest(req, res);
    });

    this.server.on('error', (error) => {
      this.options.log.error('Plex webhook listener error:', error);
    });

    this.server.listen(this.options.port, () => {
      this.options.log.info(`Plex webhook listener ready at http://0.0.0.0:${this.options.port}${this.path}`);
    });
  }

  stop() {
    if (!this.server) {
      return;
    }

    this.server.closeAllConnections();
    this.server.close();
    this.server = undefined;
  }

  onPlaybackEvent(listener: (event: PlaybackState) => void) {
    this.on('playback', listener);
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');

    if (requestUrl.pathname !== this.path) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }
    
    try {
      const { fields } = await asyncBusboy(req);
      const payload = JSON.parse(fields.payload as string) as PlexWebhookPayload;
      this.log.info('payload ->', payload.Player?.uuid ?? 'No uuid', payload.event);
     
      this.emit('playback', this.mapPlaybackState(payload));
      
      res.statusCode = 202;
      res.end('Accepted');
    } catch (error) {
      this.options.log.warn('Invalid Plex webhook payload:', error);
      res.statusCode = 400;
      res.end('Bad Request');
    }
  }

  private mapPlaybackState(payload: PlexWebhookPayload): PlaybackState | undefined {
    if (payload.event === 'media.resume') {
      return 'playing'; 
    }
    if (payload.event === 'media.pause') {
      return 'paused'; 
    }
    if (payload.event === 'media.stop') {
      return 'stopped'; 
    }
  }
}
