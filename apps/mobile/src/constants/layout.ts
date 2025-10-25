import { Platform } from 'react-native';

export const HEADER_HEIGHT = Platform.select({
  ios: 56,
  android: 56,
  default: 56
});
