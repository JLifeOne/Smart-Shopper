import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { searchService } from '@/src/shared/search/searchService';
import { useSearchStore } from '@/src/shared/search/store';
import { SearchOverlay } from '@/src/components/search/SearchOverlay';

type SearchOverlayContextValue = {
  openSearch: (initialQuery?: string) => void;
  closeSearch: () => void;
  setActiveListId: (listId: string | null) => void;
};

const SearchOverlayContext = createContext<SearchOverlayContextValue>({
  openSearch: () => {},
  closeSearch: () => {},
  setActiveListId: () => {}
});

export const useSearchOverlay = () => useContext(SearchOverlayContext);

type ProviderProps = React.PropsWithChildren<{ topOffset?: number }>;

export function SearchOverlayProvider({ children, topOffset = 0 }: ProviderProps) {
  useEffect(() => {
    const { setLoading } = useSearchStore.getState();
    let unsubscribe: (() => void) | undefined;
    setLoading(true);

    (async () => {
      await searchService.buildIndex();
      setLoading(false);
      unsubscribe = searchService.attachLiveReindex();
    })().catch((error) => {
      console.error('SearchOverlayProvider: failed to initialise index', error);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const value = useMemo<SearchOverlayContextValue>(() => {
    const openSearch = (initialQuery = '') => {
      const query = initialQuery.trim();
      const results = query ? searchService.search(query) : [];
      useSearchStore.setState({
        open: true,
        query,
        results
      });
    };

    const closeSearch = () => {
      const { setOpen, setQuery, setResults } = useSearchStore.getState();
      setOpen(false);
      setQuery('');
      setResults([]);
    };

    const setActiveListId = (listId: string | null) => {
      useSearchStore.getState().setActiveListId(listId);
    };

    return {
      openSearch,
      closeSearch,
      setActiveListId
    };
  }, []);

  return (
    <SearchOverlayContext.Provider value={value}>
      {children}
      <SearchOverlay topOffset={topOffset} />
    </SearchOverlayContext.Provider>
  );
}
