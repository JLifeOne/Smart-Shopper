import type { ReactNode } from 'react';

export type ViewStyle = Record<string, unknown>;

type ComponentProps = {
  children?: ReactNode;
  onPress?: () => void;
  style?: unknown;
} & Record<string, unknown>;

export const View = ({ children }: ComponentProps) => <div>{children}</div>;
export const Text = ({ children }: ComponentProps) => <span>{children}</span>;
export const Pressable = ({ children, onPress }: ComponentProps) => (
  <button type="button" onClick={onPress}>
    {children}
  </button>
);

export const StyleSheet = {
  create: (styles: Record<string, ViewStyle>) => styles
};
