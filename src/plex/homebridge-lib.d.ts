declare module 'homebridge-lib/CustomHomeKitTypes' {
    import type { WithUUID, API, Characteristic, Formats, Perms, Service, Units } from 'homebridge';
    type CharacteristicConstructor = WithUUID<new () => Characteristic>;
    type ServiceConstructor = WithUUID<typeof Service>;
  
    export class CustomHomeKitTypes {
      constructor(homebridge: API);
  
      get Access(): Record<string, number>;
      get Formats(): typeof Formats;
      get Perms(): typeof Perms;
      get Units(): typeof Units;
      get Characteristics(): Record<string, CharacteristicConstructor>;
      get Services(): Record<string, ServiceConstructor>;
  
      createCharacteristicClass(
        key: string,
        uuid: string,
        props: object,
        displayName?: string,
      ): CharacteristicConstructor;

      createServiceClass(
        key: string,
        uuid: string,
        characteristics: CharacteristicConstructor[],
        optionalCharacteristics?: CharacteristicConstructor[],
      ): ServiceConstructor;
    }
  }
