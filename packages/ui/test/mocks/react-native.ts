export const Pressable = (props: any) => props.children ?? null;
export const Text = ({ children }: any) => children ?? null;
export const View = ({ children }: any) => children ?? null;
export const StyleSheet = {
  create: (styles: any) => styles
};
export type ViewStyle = Record<string, unknown>;
