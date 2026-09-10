import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { PlaybackSensorAccessory, AccessoryContext } from './playbackSensorAccessory.js';
import { PlexHomeKitTypes } from './plex/customCharacterists.js';
import { PlexService } from './plex/plexService.js';

export class PlexSensorPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly plexTypes: PlexHomeKitTypes;
  private plexService?: PlexService;
  private readonly playbackAccessories = new Map<string, PlaybackSensorAccessory>();

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
      this.initializePlexService();
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
      this.plexService?.start();
    });

    this.api.on('shutdown', () => {
      this.plexService?.stop();
      this.plexService = undefined;
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

  private initializePlexService() {
    if (this.plexService) {
      return;
    }
    const { plexHost: domain, plexPort, plexToken } = this.config;
    if (typeof domain !== 'string' || typeof plexToken !== 'string') {
      this.log.warn('Plex service not started: missing plexHost or plexToken.');
      return;
    }
    const host = `http://${domain}:${plexPort}`;
    const players = Array.isArray(this.config.players) ? this.config.players : [];
    const creditsEnabled = players.some(player => player?.stopAtCredits === true);
    const pollIntervalSeconds = typeof this.config.pollIntervalSeconds === 'number'
      ? this.config.pollIntervalSeconds
      : creditsEnabled ? 5 : 30;
    this.plexService = new PlexService({
      host,
      token: plexToken,
      log: this.log,
      enableWebhooks: Boolean(this.config.enableWebhooks),
      webhookPort: typeof this.config.plexWebhookPort === 'number' ? this.config.plexWebhookPort : undefined,
      pollIntervalMs: pollIntervalSeconds * 1000,
    });
  }

  discoverDevices() {
    this.log.info('Discovering devices');
    this.discoveredCacheUUIDs.length = 0;
  
    const { plexHost: domain, plexPort, plexToken } = this.config;
    if (typeof domain !== 'string' || typeof plexToken !== 'string') {
      this.log.warn('Missing plexHost or plexToken in config.');
      return;
    }
    const plexHost = `http://${domain}:${plexPort}`;
    const players = typeof this.config.players === 'object' ? this.config.players : [];

    for (const { name, uuid, stopAtCredits, creditsOffsetSeconds } of players) {
      const playbackContext: AccessoryContext = { plexHost, plexToken, playerUuid: uuid, stopAtCredits, creditsOffsetSeconds };
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
          const playbackAccessory = this.playbackAccessories.get(uuid);
          playbackAccessory?.dispose();
          this.playbackAccessories.delete(uuid);
        } catch (error) {
          this.log.warn('Failed to unregister stale accessory:', accessory.displayName, error);
        }
      }
    }
  }

  private registerPlaybackAccessory(accessory: PlatformAccessory<AccessoryContext>) {
    if (!this.plexService) {
      this.log.warn('Skipping playback accessory registration: Plex service is not initialized.');
      return;
    }
    const existingPlaybackAccessory = this.playbackAccessories.get(accessory.UUID);
    existingPlaybackAccessory?.dispose();
    const playbackAccessory = new PlaybackSensorAccessory(accessory, this.Characteristic, this.Service, this.log, this.plexTypes, this.plexService);
    this.playbackAccessories.set(accessory.UUID, playbackAccessory);
  }
}
