import React, { createContext, useContext } from 'react';

export type SearchOverlayContextValue = {
  openSearch: (initialQuery?: string) => void;
  closeSearch: () => void;
  setActiveListId: (listId: string | null) => void;
};

export const SearchOverlayContext = createContext<SearchOverlayContextValue>({
  openSearch: () => {},
  closeSearch: () => {},
  setActiveListId: () => {}
});

export const useSearchOverlay = () => useContext(SearchOverlayContext);
