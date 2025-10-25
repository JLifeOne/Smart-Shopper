import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HEADER_HEIGHT } from '@/src/constants/layout';
import { useSearchOverlay } from '@/src/providers/SearchOverlayProvider';

export const TopBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { openSearch } = useSearchOverlay();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: insets.top,
        height: HEADER_HEIGHT,
        zIndex: 100,
        backgroundColor: '#F6FAFB',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E8EDF2',
        ...Platform.select({ android: { elevation: 12 } })
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: '#0F172A',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>SS</Text>
      </View>

      <Text style={{ flex: 1, color: '#0F172A', fontSize: 16, fontWeight: '600' }}>Smart Shopper</Text>

      <Pressable onPress={() => openSearch()} hitSlop={10} style={{ padding: 4 }}>
        <Ionicons name="search" size={20} color="#0f766e" />
      </Pressable>
    </View>
  );
};
