import { type API } from 'homebridge';
import { CustomHomeKitTypes } from 'homebridge-lib/CustomHomeKitTypes';

export class PlexHomeKitTypes extends CustomHomeKitTypes {
  constructor(homebridge: API) {
    super(homebridge);

    this.createCharacteristicClass('VideoCodec', 'DE492799-E35B-4346-90DA-C267A5A854B9', {
      format: this.Formats.STRING,
      perms: [this.Perms.NOTIFY, this.Perms.PAIRED_READ],
    });

    this.createCharacteristicClass('AspectRatio', '6AF8F349-E6FB-4FBD-B73F-39CC2656F5FF', {
      format: this.Formats.STRING,
      perms: [this.Perms.NOTIFY, this.Perms.PAIRED_READ],
    });

    this.createCharacteristicClass('Resolution', '9F509783-3F6C-416D-BE8F-290E322B66EE', {
      format: this.Formats.STRING,
      perms: [this.Perms.NOTIFY, this.Perms.PAIRED_READ],
    });

    this.createCharacteristicClass('AudioCodec', '4C579BD0-DDD5-4F6F-BBCE-E04E10DF1A03', {
      format: this.Formats.STRING,
      perms: [this.Perms.NOTIFY, this.Perms.PAIRED_READ],
    });
  }
}
