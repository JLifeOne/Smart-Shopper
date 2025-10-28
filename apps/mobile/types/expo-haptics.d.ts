declare module 'expo-haptics' {
  export enum ImpactFeedbackStyle {
    Light = 'Light',
    Medium = 'Medium',
    Heavy = 'Heavy',
    Rigid = 'Rigid',
    Soft = 'Soft'
  }

  export function selectionAsync(): Promise<void>;
  export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
}

