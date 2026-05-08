declare module 'homebridge-lib/CustomHomeKitTypes' {
    import type { WithUUID, API, Characteristic, Formats, Perms, Units } from 'homebridge';
    type CharacteristicConstructor = WithUUID<new () => Characteristic>;
  
    export class CustomHomeKitTypes {
      constructor(homebridge: API);
  
      get Access(): Record<string, number>;
      get Formats(): typeof Formats;
      get Perms(): typeof Perms;
      get Units(): typeof Units;
      get Characteristics(): Record<string, CharacteristicConstructor>;
      get Services(): Record<string, unknown>;
  
      createCharacteristicClass(
        key: string,
        uuid: string,
        props: object,
        displayName?: string,
      ): CharacteristicConstructor;
    }
  }
