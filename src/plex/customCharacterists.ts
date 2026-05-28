import { type API } from 'homebridge';
import { CustomHomeKitTypes } from 'homebridge-lib/CustomHomeKitTypes';

export class PlexHomeKitTypes extends CustomHomeKitTypes {
  constructor(homebridge: API) {
    super(homebridge);

    this.createCharacteristicClass('VideoCodec', 'DE492799-E35B-4346-90DA-C267A5A854B9', {
      format: this.Formats.STRING,
      perms: [this.Perms.NOTIFY, this.Perms.PAIRED_READ],
    }, 'Video Codec');

    this.createCharacteristicClass('AspectRatio', '6AF8F349-E6FB-4FBD-B73F-39CC2656F5FF', {
      format: this.Formats.STRING,
      perms: [this.Perms.NOTIFY, this.Perms.PAIRED_READ],
    }, 'Aspect Ratio');

    this.createCharacteristicClass('Resolution', '9F509783-3F6C-416D-BE8F-290E322B66EE', {
      format: this.Formats.STRING,
      perms: [this.Perms.NOTIFY, this.Perms.PAIRED_READ],
    }, 'Resolution');

    this.createCharacteristicClass('AudioCodec', '4C579BD0-DDD5-4F6F-BBCE-E04E10DF1A03', {
      format: this.Formats.STRING,
      perms: [this.Perms.NOTIFY, this.Perms.PAIRED_READ],
    }, 'Audio Codec');

    this.createCharacteristicClass('PlaybackStatus', '697B3DB7-D541-4C2C-A6B3-F0D48B9A6174', {
      format: this.Formats.STRING,
      perms: [this.Perms.NOTIFY, this.Perms.PAIRED_READ],
    }, 'Playback Status');

    this.createServiceClass('PlaybackMetadata', '0CD6DDC3-813E-4B16-BDE9-587A13EB358A', [
      this.Characteristics.VideoCodec,
      this.Characteristics.AspectRatio,
      this.Characteristics.Resolution,
      this.Characteristics.AudioCodec,
      this.Characteristics.PlaybackStatus,
    ]);
  }
}
