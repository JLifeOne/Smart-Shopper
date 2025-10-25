import { create } from 'zustand';
import type { SearchEntity } from './types';

type SearchState = {
  open: boolean;
  query: string;
  results: SearchEntity[];
  loading: boolean;
  activeListId: string | null;
  setOpen: (value: boolean) => void;
  setQuery: (value: string) => void;
  setResults: (value: SearchEntity[]) => void;
  setLoading: (value: boolean) => void;
  setActiveListId: (value: string | null) => void;
};

export const useSearchStore = create<SearchState>((set) => ({
  open: false,
  query: '',
  results: [],
  loading: false,
  activeListId: null,
  setOpen: (open) => set({ open }),
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setLoading: (loading) => set({ loading }),
  setActiveListId: (activeListId) => set({ activeListId })
}));
