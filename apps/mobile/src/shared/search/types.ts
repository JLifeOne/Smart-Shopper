export type SearchKind = 'product' | 'list' | 'feature';

export type SearchEntity = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  tags?: string[];
  route?: string;
  payload?: Record<string, unknown>;
  score?: number;
};
