declare module '@expo/vector-icons' {
  import type { ComponentType } from 'react';

  export type IconProps = {
    name: string;
    size?: number;
    color?: string;
  };

  export const Ionicons: ComponentType<IconProps>;
}
