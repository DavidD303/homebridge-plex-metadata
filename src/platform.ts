import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { PlaybackSensorAccessory, AccessoryContext } from './playbackSensorAccessory.js';
import { PlexWebhookServer } from './plex/plexWebhookServer.js';
import type { PlaybackState } from './plex/plexTypes.js';
import { PlexHomeKitTypes } from './plex/customCharacterists.js';

export class PlexSensorPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly plexTypes: PlexHomeKitTypes;
  private plexWebhookServer?: PlexWebhookServer;
  private readonly playbackAccessories = new Set<PlaybackSensorAccessory>();

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.plexTypes = new PlexHomeKitTypes(api);

    this.log.debug('Finished initializing platform:');

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();

      // Enable webhooks if enabled in config
      if (this.config.enableWebhooks) {
        const port = Number(this.config.plexWebhookPort);
        this.startPlexWebhookListener(port);
      }
    });

    this.api.on('shutdown', () => {
      this.stopPlexWebhookListener();
    });

    //process.once('SIGINT', () => void this.stopPlexWebhookListener());
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    if (this.accessories.has(accessory.UUID)) {
      this.log.warn('Duplicate cached accessory detected, ignoring duplicate:', accessory.displayName);
      return;
    }

    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);
  }

  private startPlexWebhookListener(port: number = 32500) {
    if (this.plexWebhookServer) {
      return;
    }

    this.plexWebhookServer = new PlexWebhookServer({
      port,
      log: this.log,
    });
    this.plexWebhookServer.onPlaybackEvent((event) => {
      this.handlePlaybackEvent(event);
    });

    this.plexWebhookServer.start();
  }

  private stopPlexWebhookListener() {
    if (!this.plexWebhookServer) {
      return;
    }

    this.plexWebhookServer.stop();
    this.plexWebhookServer = undefined;
  }

  private handlePlaybackEvent(event: PlaybackState) {
    for (const playbackAccessory of this.playbackAccessories) {
      playbackAccessory.handlePlaybackEvent(event);
    }
  }

  discoverDevices() {
    this.log.info('Discovering devices');
    this.discoveredCacheUUIDs.length = 0;
  
    const plexHost = typeof this.config.plexHost === 'string' ? this.config.plexHost : undefined;
    const plexToken = typeof this.config.plexToken === 'string' ? this.config.plexToken : undefined;
    const players = typeof this.config.players === 'object' ? this.config.players : [];
    
    if (!plexHost || !plexToken) {
      this.log.warn('Missing plexHost or plexToken in config');
      return;
    }

    for (const { name, uuid } of players) {
      const playbackContext: AccessoryContext = { plexHost, plexToken, playerUuid: uuid };
      this.addAccessory(playbackContext, name);
    }

    this.removeStaleAccessories();
  }

  private addAccessory(playbackContext: AccessoryContext, name: string) {
    const playbackUuid = this.api.hap.uuid.generate(playbackContext.playerUuid);
    const existingPlaybackAccessory = this.accessories.get(playbackUuid) as PlatformAccessory<AccessoryContext> | undefined;

    if (existingPlaybackAccessory) {
      this.log.info('Restoring existing playback accessory from cache:', existingPlaybackAccessory.displayName);
      existingPlaybackAccessory.context = {
        ...existingPlaybackAccessory.context,
        ...playbackContext,
      };
      this.api.updatePlatformAccessories([existingPlaybackAccessory]);
      this.registerPlaybackAccessory(existingPlaybackAccessory);
    } else {
      this.log.info('Adding playback accessory:', name);
      const playbackAccessory: PlatformAccessory<AccessoryContext> = new this.api.platformAccessory(name, playbackUuid);
      playbackAccessory.context = playbackContext;
      try {
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [playbackAccessory]);
        this.registerPlaybackAccessory(playbackAccessory);
        this.accessories.set(playbackUuid, playbackAccessory);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already bridged by Homebridge')) {
          this.log.debug('Accessory already bridged, restoring runtime reference:', name);
          this.accessories.set(playbackUuid, playbackAccessory);
          this.registerPlaybackAccessory(playbackAccessory);
        } else {
          this.log.warn('Skipping playback accessory registration due to duplicate bridge state:', error);
        }
      }
    }

    this.discoveredCacheUUIDs.push(playbackUuid);
  }

  private removeStaleAccessories() {
    // Remove cached accessories that are no longer present in config.
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        try {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.delete(uuid);
        } catch (error) {
          this.log.warn('Failed to unregister stale accessory:', accessory.displayName, error);
        }
      }
    }
  }

  private registerPlaybackAccessory(accessory: PlatformAccessory<AccessoryContext>) {
    const playbackAccessory = new PlaybackSensorAccessory(accessory, this.Characteristic, this.Service, this.log, this.plexTypes);
    this.playbackAccessories.add(playbackAccessory);
  }
}