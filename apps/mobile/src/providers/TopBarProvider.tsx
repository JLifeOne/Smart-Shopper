import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

export type TopBarConfig = {
  title?: string;
  logoGlyph?: string | null;
  onMenuPress?: (() => void) | null;
  showSearch?: boolean;
};

type TopBarState = {
  config: TopBarConfig;
  setConfig: (config: TopBarConfig) => void;
  reset: () => void;
};

const defaultConfig: TopBarConfig = {
  title: 'Smart Shopper',
  logoGlyph: 'SS',
  onMenuPress: null,
  showSearch: true
};

const TopBarContext = createContext<TopBarState | undefined>(undefined);

export const TopBarProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [config, setConfigState] = useState<TopBarConfig>(defaultConfig);

  const setConfig = useCallback((next: TopBarConfig) => {
    setConfigState({ ...defaultConfig, ...next });
  }, []);

  const reset = useCallback(() => {
    setConfigState(defaultConfig);
  }, []);

  const value = useMemo<TopBarState>(
    () => ({
      config,
      setConfig,
      reset
    }),
    [config, reset, setConfig]
  );

  return <TopBarContext.Provider value={value}>{children}</TopBarContext.Provider>;
};

export function useTopBarController() {
  const context = useContext(TopBarContext);
  if (!context) {
    throw new Error('useTopBarController must be used within TopBarProvider');
  }
  return context;
}

export function useTopBar(config: TopBarConfig) {
  const { setConfig, reset } = useTopBarController();

  useEffect(() => {
    setConfig(config);
    return () => reset();
  }, [config, reset, setConfig]);
}
