declare module 'libphonenumber-js' {
  export type PhoneNumber = {
    number: string;
    isValid(): boolean;
  };

  export function parsePhoneNumberFromString(input: string, country?: string): PhoneNumber | undefined;
}
