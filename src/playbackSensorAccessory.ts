import type { Characteristic, CharacteristicValue, PlatformAccessory, Service, Logging, WithUUID } from 'homebridge';
import type { PlexHomeKitTypes } from './plex/customCharacterists.js';
import type { PlayerSnapshot, PlexPlayerEventsPort } from './plex/plexService.types.js';

export type AccessoryContext = {
  plexHost: string;
  plexToken: string;
  playerUuid: string;
  stopAtCredits?: boolean;
  creditsOffsetSeconds?: number;
};

export class PlaybackSensorAccessory {
  private service: Service;
  private metadataService: Service;
  private occupancyDetected = false;
  private readonly playerId: string;
  private readonly onPlayerUpdate: (snapshot: PlayerSnapshot) => void;
  private readonly onPlayerOffline: (payload: { playerId: string }) => void;

  constructor(
    private readonly accessory: PlatformAccessory<AccessoryContext>,
    private readonly characteristicType: typeof Characteristic,
    private readonly serviceType: typeof Service,
    private readonly log: Logging,
    private readonly plexTypes: PlexHomeKitTypes,
    private readonly plexService: PlexPlayerEventsPort,
  ) {
    this.playerId = this.accessory.context.playerUuid;
    this.service = accessory.getService(this.serviceType.OccupancySensor) ||
      accessory.addService(this.serviceType.OccupancySensor);
    const PlaybackMetadata = this.plexTypes.Services.PlaybackMetadata as WithUUID<typeof Service>;
    
    const metadataSubtype = `plex-metadata-${this.playerId}`;
    this.metadataService = accessory.getServiceById(PlaybackMetadata, metadataSubtype) ||
      accessory.addService(PlaybackMetadata, `${this.accessory.displayName} Playback Metadata`, metadataSubtype);

    this.accessory.getService(this.serviceType.AccessoryInformation)!
      .setCharacteristic(this.characteristicType.Name, this.accessory.displayName);
    this.service.getCharacteristic(this.characteristicType.OccupancyDetected)
      .onGet(this.getOn.bind(this));

    this.onPlayerUpdate = (snapshot: PlayerSnapshot) => {
      if (snapshot.playerId !== this.playerId) {
        return;
      }
      this.applySnapshot(snapshot);
    };
    this.onPlayerOffline = ({ playerId }) => {
      if (playerId !== this.playerId) {
        return;
      }
      this.updateOccupancyState(false, 'player-offline');
      this.clearMetadataValues();
    };
    this.plexService.on('player:update', this.onPlayerUpdate);
    this.plexService.on('player:offline', this.onPlayerOffline);

    const initial = this.plexService.getSnapshot(this.playerId);
    if (initial) {
      this.applySnapshot(initial);
    }
    this.log.info('Registered playback accessory:', this.accessory.displayName);
  }

  dispose() {
    this.plexService.off('player:update', this.onPlayerUpdate);
    this.plexService.off('player:offline', this.onPlayerOffline);
  }

  async getOn(): Promise<CharacteristicValue> {
    return this.occupancyDetected;
  }

  private applySnapshot(snapshot: PlayerSnapshot) {
    const playing = snapshot.state === 'playing';
    const offsetMs = (this.accessory.context.creditsOffsetSeconds ?? 0) * 1000;
    const creditsReached = this.accessory.context.stopAtCredits === true &&
      snapshot.creditsStartTimeOffset !== undefined &&
      snapshot.viewOffset !== undefined &&
      snapshot.viewOffset >= snapshot.creditsStartTimeOffset + offsetMs;
    this.updateOccupancyState(playing && !creditsReached, `service:${snapshot.source}:${snapshot.state}${creditsReached ? ':credits' : ''}`);

    const { VideoCodec, Resolution, AudioCodec, AspectRatio, PlaybackStatus } = this.plexTypes.Characteristics;
    this.metadataService.getCharacteristic(PlaybackStatus).updateValue(snapshot.state);

    if (!playing) {
      this.clearMetadataValues();
      return;
    }

    if (snapshot.metadata.aspectRatio) {
      this.metadataService.getCharacteristic(AspectRatio).updateValue(snapshot.metadata.aspectRatio);
    }
    if (snapshot.metadata.audioCodec) {
      this.metadataService.getCharacteristic(AudioCodec).updateValue(snapshot.metadata.audioCodec);
    }
    if (snapshot.metadata.resolution) {
      this.metadataService.getCharacteristic(Resolution).updateValue(snapshot.metadata.resolution);
    }
    if (snapshot.metadata.videoCodec) {
      this.metadataService.getCharacteristic(VideoCodec).updateValue(snapshot.metadata.videoCodec);
    }
  }

  private clearMetadataValues() {
    const { VideoCodec, Resolution, AudioCodec, AspectRatio } = this.plexTypes.Characteristics;
    this.metadataService.getCharacteristic(AspectRatio).updateValue('');
    this.metadataService.getCharacteristic(AudioCodec).updateValue('');
    this.metadataService.getCharacteristic(Resolution).updateValue('');
    this.metadataService.getCharacteristic(VideoCodec).updateValue('');
  }

  private updateOccupancyState(detected: boolean, source: string) {
    this.occupancyDetected = detected;
    this.service.updateCharacteristic(this.characteristicType.OccupancyDetected, detected);
    this.log.debug(`Playback occupancy updated (${source}) -> ${detected}`);
  }
}
