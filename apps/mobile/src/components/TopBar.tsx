import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HEADER_HEIGHT } from '@/src/constants/layout';
import { useSearchOverlay } from '@/src/providers/SearchOverlayProvider';
import { useTopBarController } from '@/src/providers/TopBarProvider';

export const TopBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { openSearch } = useSearchOverlay();
  const { config } = useTopBarController();

  const initials = config.initials?.trim();
  const showProfile = Boolean(initials && config.onProfilePress);
  const showMenu = Boolean(config.onMenuPress);
  const showSearch = config.showSearch !== false;
  const title = config.title ?? 'Smart Shopper';

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoLetter}>SS</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.spacer} />
        {showSearch ? (
          <Pressable
            onPress={() => openSearch()}
            accessibilityRole="search"
            accessibilityLabel="Open search"
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            hitSlop={10}
          >
            <Ionicons name="search" size={20} color="#0f766e" />
          </Pressable>
        ) : null}
        {showProfile ? (
          <Pressable
            onPress={() => config.onProfilePress?.()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarButtonPressed]}
            hitSlop={8}
          >
            <Text style={styles.avatarLabel}>{initials}</Text>
          </Pressable>
        ) : null}
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
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  logoLetter: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600'
  },
  spacer: {
    flex: 1
  },
  iconButton: {
    padding: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4
  },
  iconButtonPressed: {
    backgroundColor: 'rgba(15,118,110,0.08)'
  },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6
  },
  avatarButtonPressed: {
    opacity: 0.85
  },
  avatarLabel: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 15
  }
});

