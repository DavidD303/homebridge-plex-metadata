import type { Characteristic, CharacteristicValue, PlatformAccessory, Service, Logging, WithUUID } from 'homebridge';
import { PlexApiClient } from './plex/plexApi.js';
import type { PlaybackState } from './plex/plexTypes.js';
import type { PlexHomeKitTypes } from './plex/customCharacterists.js';

export type AccessoryContext = {
  plexHost: string;
  plexToken: string;
  playerUuid: string;
};

export class PlaybackSensorAccessory {
  private service: Service;
  private metadataService: Service;
  private occupancyDetected = false;
  private lastWebhookEventAt = 0;
  private readonly fallbackPollIntervalMs = 30_000;
  private readonly staleAfterMs = 120_000;
  private readonly plexApiClient: PlexApiClient;

  constructor(
    private readonly accessory: PlatformAccessory<AccessoryContext>,
    private readonly characteristicType: typeof Characteristic,
    private readonly serviceType: typeof Service,
    private readonly log: Logging,
    private readonly plexTypes: PlexHomeKitTypes,
  ) {
    this.service = accessory.getService(this.serviceType.OccupancySensor) ||
      accessory.addService(this.serviceType.OccupancySensor);
    const PlaybackMetadata = this.plexTypes.Services.PlaybackMetadata as WithUUID<typeof Service>;
    
    const metadataSubtype = `plex-metadata-${this.accessory.context.playerUuid}`;
    this.metadataService = accessory.getServiceById(PlaybackMetadata, metadataSubtype) ||
      accessory.addService(PlaybackMetadata, `${this.accessory.displayName} Playback Metadata`, metadataSubtype);

    this.accessory.getService(this.serviceType.AccessoryInformation)!
      .setCharacteristic(this.characteristicType.Name, this.accessory.displayName)
      .setCharacteristic(this.characteristicType.SerialNumber, 'my-serial-number');

    this.service.getCharacteristic(this.characteristicType.OccupancyDetected)
      .onGet(this.getOn.bind(this));

    const { plexHost, plexToken } = this.accessory.context;
    if (!plexHost || !plexToken) {
      throw new Error('Plex polling fallback disabled: missing plexHost or plexToken in accessory context.');
    }

    this.plexApiClient = new PlexApiClient(plexHost, plexToken);
    this.startPollingFallback();
    this.log.info('Registered playback accessory:', this.accessory.displayName);
  }

  private aspectRatioToHomeKit(aspectRatio: number): string | undefined {
    if (aspectRatio === 16/9) {
      return '16:9';
    } else if (aspectRatio === 4/3) {
      return '4:3';
    } else if (aspectRatio === 2.4) {
      return '2.4:1';
    } else {
      return `${aspectRatio.toFixed(2)}:1`; 
    }
  }

  handlePlaybackEvent(event: PlaybackState) {
    this.updateOccupancyState(event === 'playing', `webhook:${event}`);
  }

  async getOn(): Promise<CharacteristicValue> {
    return this.occupancyDetected;
  }

  private startPollingFallback() {
    setInterval(() => {
      void this.pollIfWebhookStale();
    }, this.fallbackPollIntervalMs);
  }

  private async pollIfWebhookStale() {
    const now = Date.now();
    if (now - this.lastWebhookEventAt < this.staleAfterMs) {
      return;
    }
    this.pollPlexApi();
  }

  private async pollPlexApi() {
    try {
      const sessions = await this.plexApiClient.getSessions();
      if (sessions.MediaContainer.Metadata === undefined) {
        return; 
      }

      for (const session of sessions.MediaContainer.Metadata) {
        this.log.info(
          `Session:
          Player machine identifier: ${session.Player?.machineIdentifier}
          Player title: ${session.Player?.title}
          Playing: ${session.title}`,
        );
      }
 
      
      const session = sessions.MediaContainer.Metadata?.find((metadata) => {
        return metadata.Player?.machineIdentifier === this.accessory.context.playerUuid;
      });

      if (session === undefined) {
        return; 
      }

      const playing = session?.Player?.state === 'playing';
      this.updateOccupancyState(playing, 'polling-fallback');

      const { VideoCodec, Resolution, AudioCodec, AspectRatio } = this.plexTypes.Characteristics;

      // Aspect ratio
      const [Media] = session?.Media ?? [];
      const { width, height } = Media ?? {};
      const aspectRatio = width / height;
      const aspectRatioString = this.aspectRatioToHomeKit(aspectRatio);
      if (aspectRatioString) {
        this.log.debug('Aspect ratio:', aspectRatioString);
        this.metadataService.getCharacteristic(AspectRatio).updateValue(aspectRatioString);
      }

      // Audio codec
      const audioCodec = Media?.audioCodec;
      this.metadataService.getCharacteristic(AudioCodec).updateValue(audioCodec);

      // Video resolution
      const resolution = Media?.videoResolution;
      this.log.debug('Resolution:', resolution);
      this.metadataService.getCharacteristic(Resolution).updateValue(resolution);

      // Video codec
      const videoCodec = Media?.videoCodec;
      this.metadataService.getCharacteristic(VideoCodec).updateValue(videoCodec);


    } catch (error) {
      this.log.warn('Failed Plex fallback polling:', error);
    }
  }

  private updateOccupancyState(detected: boolean, source: string) {
    this.occupancyDetected = detected;
    this.service.updateCharacteristic(this.characteristicType.OccupancyDetected, detected);
    this.log.debug(`Playback occupancy updated (${source}) -> ${detected}`);
  }
}
