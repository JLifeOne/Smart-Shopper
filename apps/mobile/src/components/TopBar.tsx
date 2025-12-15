import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HEADER_HEIGHT } from '@/src/constants/layout';
import { useSearchOverlay } from '@/src/providers/SearchOverlayContext';
import { useTopBarController } from '@/src/providers/TopBarProvider';
import { useSearchStore } from '@/src/shared/search/store';
import { trackEvent } from '@/src/lib/analytics';

const ICON_WIDTH = 44;

export const TopBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { config } = useTopBarController();
  const { openSearch, closeSearch } = useSearchOverlay();
  const query = useSearchStore((state) => state.query);
  const setQuery = useSearchStore((state) => state.setQuery);
  const searchOpen = useSearchStore((state) => state.open);

  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const [barWidth, setBarWidth] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const logoGlyph = useMemo(() => {
    const raw = config.logoGlyph?.trim();
    if (!raw) return 'SS';
    return raw.slice(0, 3).toUpperCase();
  }, [config.logoGlyph]);
  const isPremium = config.isPremium ?? false;
  const leftAction = config.leftAction ?? null;

  const showMenu = Boolean(config.onMenuPress);
  const showSearch = config.showSearch !== false;
  const title = config.title ?? 'Smart Shopper';

  const reservedRight = useMemo(() => {
    const buttons = showMenu ? ICON_WIDTH : 0;
    return buttons + 24;
  }, [showMenu]);

  const maxWidth = useMemo(() => {
    if (!barWidth) return ICON_WIDTH;
    const available = Math.max(ICON_WIDTH, barWidth - reservedRight - 12);
    const target = Math.max(ICON_WIDTH, barWidth * 0.85);
    return Math.min(target, available);
  }, [barWidth, reservedRight]);

  const animateTo = useCallback(
    (target: number, duration: number) => {
      Animated.timing(progress, {
        toValue: target,
        duration,
        easing: target === 1 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: false
      }).start(({ finished }) => {
        if (finished && target === 1) {
          inputRef.current?.focus();
        }
      });
    },
    [progress]
  );

  const collapse = useCallback(
    (notify = true) => {
      if (!expandedRef.current) return;
      expandedRef.current = false;
      setExpanded(false);
      inputRef.current?.blur();
      animateTo(0, 140);
      if (notify) {
        closeSearch();
      }
    },
    [animateTo, closeSearch]
  );

  const expand = useCallback(() => {
    if (!showSearch || expandedRef.current) {
      return;
    }
    expandedRef.current = true;
    setExpanded(true);
    trackEvent('search.open');
    openSearch(query);
    animateTo(1, 180);
  }, [animateTo, openSearch, query, showSearch]);

  useEffect(() => {
    if (!searchOpen && expandedRef.current) {
      collapse(false);
    }
  }, [collapse, searchOpen]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      collapse();
      return true;
    });
    return () => sub.remove();
  }, [collapse, expanded]);

  const handleSubmit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      trackEvent('search.submit', { query: trimmed });
    },
    []
  );

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: [ICON_WIDTH, maxWidth] });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] });
  const inputOpacity = progress;
  const brandOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}> 
      <View
        style={styles.bar}
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.brand, { opacity: brandOpacity }]}>
          {leftAction ? (
            <Pressable
              onPress={leftAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={leftAction.accessibilityLabel ?? 'Back'}
              style={({ pressed }) => [
                styles.iconButton,
                styles.leftActionButton,
                pressed && styles.iconButtonPressed
              ]}
              hitSlop={10}
            >
              <Ionicons name={leftAction.icon} size={22} color="#0C1D37" />
            </Pressable>
          ) : null}
          <View style={styles.logoBadge}>
            <Text style={styles.logoLetter}>{logoGlyph}</Text>
            {isPremium ? (
              <View style={styles.crownBadge}>
                <Ionicons name="crown" size={12} color="#FACC15" />
              </View>
            ) : null}
          </View>
          <Text style={styles.title}>{title}</Text>
        </Animated.View>
        <View style={styles.rightCluster}>
          {showMenu ? (
            <Pressable
              onPress={() => config.onMenuPress?.()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              hitSlop={10}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#0C1D37" />
            </Pressable>
          ) : null}
          {showSearch ? (
            <Animated.View
              style={[
                styles.searchContainer,
                {
                  width,
                  shadowOpacity,
                  ...(Platform.OS === 'android' ? { elevation: expandedRef.current ? 6 : 0 } : {})
                }
              ]}
            >
              <View style={styles.searchIconSlot}>
                <Ionicons name="search" size={18} color="#6B7280" />
              </View>
              <Animated.View
                style={[styles.inputWrapper, { opacity: inputOpacity }]}
                pointerEvents={expandedRef.current ? 'auto' : 'none'}
              >
                <TextInput
                  ref={inputRef}
                  value={query}
                  placeholder="Search lists, items, receipts..."
                  placeholderTextColor="#9CA3AF"
                  onChangeText={setQuery}
                  onSubmitEditing={({ nativeEvent }) => handleSubmit(nativeEvent.text)}
                  style={styles.input}
                  autoCorrect
                  returnKeyType="search"
                />
              </Animated.View>
              {expandedRef.current ? (
                <Pressable
                  onPress={() => {
                    collapse();
                  }}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close search"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color="#6B7280" />
                </Pressable>
              ) : (
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={expand}
                  accessibilityRole="button"
                  accessibilityLabel="Open search"
                />
              )}
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#F6FAFB',
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: '#101828',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 10 }
      },
      default: {}
    })
  },
  bar: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EDF2'
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative'
  },
  logoLetter: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  crownBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 2
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600'
  },
  rightCluster: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  iconButton: {
    padding: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  leftActionButton: {
    marginRight: 6
  },
  iconButtonPressed: {
    backgroundColor: 'rgba(15,118,110,0.08)'
  },
  searchContainer: {
    height: ICON_WIDTH,
    borderRadius: ICON_WIDTH / 2,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 6,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12
  },
  searchIconSlot: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center'
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center'
  },
  input: {
    height: '100%',
    paddingLeft: 40,
    paddingRight: 40,
    color: '#0F172A',
    fontSize: 16
  },
  closeButton: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 8
  }
});

