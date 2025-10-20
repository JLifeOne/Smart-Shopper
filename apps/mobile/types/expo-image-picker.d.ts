declare module 'expo-image-picker' {
  export type PermissionResponse = {
    granted: boolean;
  };

  export type MediaTypeOptionsType = 'Images' | 'Videos' | 'All';

  export const MediaTypeOptions: {
    Images: MediaTypeOptionsType;
    Videos: MediaTypeOptionsType;
    All: MediaTypeOptionsType;
  };

  export type ImagePickerAsset = {
    uri: string;
  };

  export type ImagePickerResult = {
    canceled: boolean;
    assets?: ImagePickerAsset[];
  };

  export function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse>;

  export function launchImageLibraryAsync(options?: {
    mediaTypes?: MediaTypeOptionsType;
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }): Promise<ImagePickerResult>;
}
