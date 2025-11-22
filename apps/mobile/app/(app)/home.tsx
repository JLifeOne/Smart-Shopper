import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth-context';
import { featureFlags } from '@/src/lib/env';
import { trackEvent } from '@/src/lib/analytics';
import { useDashboardMetrics, type HeatmapData } from '@/src/lib/dashboard-data';
import { useRecommendations } from '@/src/features/recommendations/use-recommendations';
import { ListsScreen, type ListsScreenHandle } from '@/src/features/lists/ListsScreen';
import { createList, setListStore } from '@/src/features/lists/mutations';
import { createListItem } from '@/src/features/list-items/mutations';
import {
  parseListInput,
  enrichParsedEntries,
  type EnrichedListEntry
} from '@/src/features/lists/parse-list-input';
import { SmartAddPreview } from '@/src/features/lists/components/SmartAddPreview';
import { storeSuggestionsFor, stores, type StoreDefinition } from '@/src/data/stores';
import { detectRegion } from '@/src/catalog/catalogService';
import { Toast } from '@/src/components/search/Toast';
import { useTopBar } from '@/src/providers/TopBarProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { startVoiceCapture, cancelVoiceCapture, finalizeVoiceCapture } from '@/src/features/capture/voice-capture';
import { captureListFromCamera } from '@/src/features/capture/camera-capture';
import { normalizeName } from '@/src/categorization';
import { recordCategoryTelemetry } from '@/src/lib/category-telemetry';

const NEXT_ACTIONS = [
  'Create a list via text, voice, or photo capture.',
  'Scan a receipt to populate price history.',
  'Review the calendar heatmap once you have transaction data.'
] as const;

const FALLBACK_SUGGESTED_ITEMS = ['Milk', 'Butter', 'Bananas', 'Yogurt', 'Olive oil'] as const;

const CREATE_LIST_DRAFT_KEY = '@smart-shopper:create-list-draft';
const CUSTOM_STORES_KEY = '@smart-shopper:custom-stores';

type AuthContextValue = ReturnType<typeof useAuth>;
type TabKey = 'home' | 'insights' | 'promos' | 'lists' | 'receipts';
export default function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.initializing && !auth.session) {
      router.replace('/auth/sign-in');
    }
  }, [auth.initializing, auth.session, router]);

  if (!auth.session) {
    return null;
  }

  return <HomeWithNewNavigation auth={auth} />;
}

function HomeWithNewNavigation({ auth }: { auth: AuthContextValue }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [isCreateSheetVisible, setCreateSheetVisible] = useState(false);
  const listsScreenRef = useRef<ListsScreenHandle | null>(null);
  const insets = useSafeAreaInsets();

  const handleSelectTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  const handleCreatePress = useCallback(() => {
    trackEvent('nav_create_press', { tab: activeTab, createSheet: true });
    setCreateSheetVisible(true);
  }, [activeTab]);

  const handleCloseCreateSheet = useCallback(() => {
    setCreateSheetVisible(false);
  }, []);

  const handleCreateSheetSuccess = useCallback(
    ({ listId }: { listId: string }) => {
      setCreateSheetVisible(false);
      setActiveTab('lists');
      router.push(`/lists/${listId}` as never);
    },
    [router]
  );

  let content: ReactNode = null;
  switch (activeTab) {
    case 'home':
      content = <DashboardView auth={auth} onNavigate={handleSelectTab} />;
      break;
    case 'insights':
      content = <PlaceholderScreen title="Insights" message="Insights coming soon." />;
      break;
    case 'promos':
      content = <PromosScreen />;
      break;
    case 'lists':
      content = <ListsScreen ref={listsScreenRef} />;
      break;
    case 'receipts':
      content = (
        <PlaceholderScreen title="Receipts" message="Your scanned receipts will appear here for quick reference." />
      );
      break;
    default:
      content = null;
  }

  return (
    <SafeAreaView style={newStyles.safeArea} edges={['bottom']}>
      <View style={newStyles.body}>{content}</View>
      <BottomNavigation
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onCreatePress={handleCreatePress}
        bottomInset={insets.bottom}
      />
      <CreateSheet
        visible={isCreateSheetVisible}
        onClose={handleCloseCreateSheet}
        ownerId={auth.user?.id ?? null}
        onCreated={handleCreateSheetSuccess}
      />
    </SafeAreaView>
  );
}




function DashboardView({
  auth,
  onNavigate
}: {
  auth: AuthContextValue;
  onNavigate: (tab: TabKey) => void;
}) {
  const { user, signOut, isAuthenticating } = auth;
  const router = useRouter();
  const isMenuPremium = featureFlags.menuIngestion ?? false;
  const { quickStats, heatmap, loading: metricsLoading, error: metricsError } = useDashboardMetrics(
    user?.id ?? undefined,
    featureFlags.heatmapV2
  );
  const glanceStats = useMemo<Array<{ label: string; value: string; onPress?: () => void }>>(() => {
    const trackedItems = quickStats.find((stat) => stat.label === 'Tracked items');
    const receiptsScanned = quickStats.find((stat) => stat.label === 'Receipts scanned');
    return [
      { label: 'Menus', value: '0', onPress: () => router.push('/menus' as never) },
      trackedItems ? { ...trackedItems, onPress: undefined } : { label: 'Tracked items', value: '0', onPress: undefined },
      receiptsScanned
        ? { ...receiptsScanned, onPress: undefined }
        : { label: 'Receipts scanned', value: '0', onPress: undefined }
    ];
  }, [quickStats, router]);
  const recommendationRequest = useMemo(() => {
    if (!featureFlags.aiSuggestions) {
      return null;
    }

    return {
      query: 'pantry staples',
      locale: user?.user_metadata?.locale ?? undefined
    };
  }, [user?.user_metadata?.locale]);

  const { data: recommendations, loading: recommendationsLoading, error: recommendationsError } = useRecommendations(
    recommendationRequest,
    { enabled: Boolean(user) }
  );
  const suggestedItems = recommendations.length
    ? recommendations.map((suggestion) => suggestion.label)
    : Array.from(FALLBACK_SUGGESTED_ITEMS);
  const welcomeMessage = useMemo(
    () =>
      user?.email
        ? `Hi ${user.email.split('@')[0]}, you are ready to build your first smart list and start price tracking.`
        : 'You are ready to build your first smart list and start price tracking.',
    [user?.email]
  );

  const handleSignOut = useCallback(async () => {
    const errorMessage = await signOut();
    if (errorMessage) {
      Alert.alert('Sign out failed', errorMessage);
      return;
    }
    router.replace('/auth/sign-in');
  }, [router, signOut]);

  const initials = useMemo(() => {
    if (!user?.email) {
      return 'SS';
    }
    return user.email
      .split('@')[0]
      .split('.')
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  }, [user?.email]);

  const [isMenuOpen, setMenuOpen] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const openProfile = useCallback(() => {
    setProfileVisible(true);
  }, []);

  const closeProfile = useCallback(() => {
    setProfileVisible(false);
  }, []);

  const handleNavigateToReceipts = useCallback(() => {
    trackEvent('menu.navigate', { target: 'receipts_dashboard' });
    closeMenu();
    onNavigate('receipts');
  }, [closeMenu, onNavigate]);

  const handleRequestSignOut = useCallback(() => {
    if (!isAuthenticating) {
      closeMenu();
      void handleSignOut();
    }
  }, [closeMenu, handleSignOut, isAuthenticating]);

  useTopBar(
    useMemo(
      () => ({
        logoGlyph: initials,
        onMenuPress: openMenu,
        showSearch: true
      }),
      [initials, openMenu]
    )
  );

  return (
    <View style={newStyles.dashboardContainer}>
      <Animated.ScrollView
        contentContainerStyle={newStyles.dashboardScroll}
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      >
        <View style={newStyles.greetingCard}>
          <Text style={newStyles.heading}>Hello{user?.email ? ',' : ''}</Text>
          <Text style={newStyles.subtitle}>{user?.email ?? 'Guest Shopper'}</Text>
          <Text style={newStyles.welcome}>{welcomeMessage}</Text>
        </View>

        <View style={newStyles.analyticsGrid}>
          <View style={[newStyles.analyticsCard, newStyles.performanceCard]}>
            <Text style={newStyles.cardTitle}>At a glance</Text>
            <View style={newStyles.quickStatRow}>
              {glanceStats.map((stat) => (
                stat.onPress ? (
                  <Pressable
                    key={stat.label}
                    style={({ pressed }) => [newStyles.quickStat, pressed && newStyles.quickStatPressed]}
                    onPress={stat.onPress}
                  >
                    <Text style={newStyles.quickStatValue}>{metricsLoading ? '...' : stat.value}</Text>
                    <Text style={newStyles.quickStatLabel}>{stat.label}</Text>
                  </Pressable>
                ) : (
                  <View key={stat.label} style={newStyles.quickStat}>
                    <Text style={newStyles.quickStatValue}>{metricsLoading ? '...' : stat.value}</Text>
                    <Text style={newStyles.quickStatLabel}>{stat.label}</Text>
                  </View>
                )
              ))}
            </View>
          </View>

          <View style={newStyles.analyticsCard}>
            <Text style={newStyles.cardTitle}>Spend heatmap</Text>
            <HeatmapCalendar
              data={heatmap}
              loading={metricsLoading}
              enabled={featureFlags.heatmapV2}
              error={metricsError}
            />
          </View>

          <View style={newStyles.analyticsCard}>
            <Text style={newStyles.cardTitle}>Promos spotlight</Text>
            <Text style={newStyles.cardBody}>
              Discover store promotions tailored to your lists. Visit the Promos tab to explore deals (coming soon).
            </Text>
          </View>

          <Pressable
            style={[newStyles.analyticsCard, newStyles.menuCard]}
            onPress={() => router.push('/menus' as never)}
          >
            <Text style={newStyles.cardTitle}>Menus</Text>
            <Text style={newStyles.cardBody}>
              Scan menus to detect dishes. {isMenuPremium ? 'Start a menu scan now.' : 'Upgrade to unlock recipes or save dish titles only.'}
            </Text>
          </Pressable>

          <View style={newStyles.analyticsCard}>
            <Text style={newStyles.cardTitle}>Budget insights</Text>
            <Text style={newStyles.cardBody}>
              Smart budgeting will surface personalized spend vs. goal analytics. Enable beta notifications in Settings
              soon.
            </Text>
          </View>
        </View>

        <View style={newStyles.card}>
          <Text style={newStyles.cardTitle}>Suggested additions</Text>
          {recommendationsError ? (
            <Text style={newStyles.suggestionStatus}>Suggestions paused: {recommendationsError}</Text>
          ) : null}
          <View style={newStyles.suggestionsRow}>
            {recommendationsLoading ? (
              <Text style={newStyles.suggestionStatus}>Loading ideas...</Text>
            ) : (
              suggestedItems.map((item) => (
                <Pressable key={item} style={({ pressed }) => [newStyles.suggestionChip, pressed && newStyles.suggestionChipPressed]}>
                  <Text style={newStyles.suggestionChipLabel}>{item}</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>

        <View style={newStyles.card}>
          <Text style={newStyles.cardTitle}>Next actions</Text>
          {NEXT_ACTIONS.map((action) => (
            <Text key={action} style={newStyles.cardBody}>
              {'\u2022 '}
              {action}
            </Text>
          ))}
        </View>
      </Animated.ScrollView>
      <ProfilePeekSheet visible={profileVisible} onClose={closeProfile} user={user} onSignOut={handleRequestSignOut} />
      <CommandDrawer
        visible={isMenuOpen}
        onClose={closeMenu}
        onNavigateTab={onNavigate}
        onNavigateReceipts={handleNavigateToReceipts}
        onSignOut={handleRequestSignOut}
        onOpenProfile={openProfile}
        isAuthenticating={isAuthenticating}
        user={user}
        quickStats={quickStats}
        heatmap={heatmap}
        metricsLoading={metricsLoading}
        metricsError={metricsError}
        recommendationsCount={suggestedItems.length}
        flags={featureFlags}
      />
    </View>
  );
}

function ProfilePeekSheet({
  visible,
  onClose,
  user,
  onSignOut
}: {
  visible: boolean;
  onClose: () => void;
  user: AuthContextValue['user'];
  onSignOut: () => void;
}) {
  if (!visible) {
    return null;
  }
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={newStyles.profileOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={newStyles.profileSheet}>
          <View style={newStyles.profileAvatar}>
            <Text style={newStyles.profileAvatarLabel}>
              {user?.email
                ? user.email
                    .split('@')[0]
                    .split('.')
                    .map((part) => part.charAt(0).toUpperCase())
                    .join('')
                    .slice(0, 2)
                : 'SS'}
            </Text>
          </View>
          <Text style={newStyles.profileName}>{user?.email?.split('@')[0] ?? 'Guest Shopper'}</Text>
          <Text style={newStyles.profileEmail}>{user?.email ?? 'No email linked yet'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onClose();
              onSignOut();
            }}
            style={({ pressed }) => [newStyles.profileSignOutButton, pressed && newStyles.profileSignOutButtonPressed]}
          >
          <Text style={newStyles.profileSignOutLabel}>Switch phone number</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type DrawerQuickAction = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

type DrawerSectionItem = {
  id: string;
  label: string;
  meta?: string;
  onPress?: () => void;
};

type DrawerSection = {
  id: string;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  badge?: string;
  items: DrawerSectionItem[];
};

function CommandDrawer({
  visible,
  onClose,
  onNavigateTab,
  onNavigateReceipts,
  onSignOut,
  onOpenProfile,
  isAuthenticating,
  user,
  quickStats,
  heatmap,
  metricsLoading,
  metricsError,
  recommendationsCount,
  flags
}: {
  visible: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TabKey) => void;
  onNavigateReceipts: () => void;
  onSignOut: () => void;
  onOpenProfile: () => void;
  isAuthenticating: boolean;
  user: AuthContextValue['user'];
  quickStats: Array<{ label: string; value: string }>;
  heatmap: HeatmapData;
  metricsLoading: boolean;
  metricsError?: string;
  recommendationsCount: number;
  flags: typeof featureFlags;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [cellularUploadsEnabled, setCellularUploadsEnabled] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) {
        setRendered(false);
      }
    });
  }, [progress, visible]);

  const dismiss = useCallback(() => {
    trackEvent('menu.close');
    onClose();
  }, [onClose]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 0]
  });

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35]
  });

  const initials = useMemo(() => {
    if (!user?.email) {
      return 'SS';
    }
    return user.email
      .split('@')[0]
      .split('.')
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  }, [user?.email]);

  const primaryEmail = user?.email ?? 'guest@smartshopper.app';

  const handleQuickAction = useCallback(
    (id: string, callback?: () => void) => {
      trackEvent('menu.quick_action', { id });
      onClose();
      callback?.();
    },
    [onClose]
  );

  const quickActions = useMemo<DrawerQuickAction[]>(
    () => [
      {
        id: 'scan_receipt',
        label: 'Scan receipt',
        icon: 'scan-outline',
        onPress: () => handleQuickAction('scan_receipt', onNavigateReceipts)
      },
      {
        id: 'log_price',
        label: 'Log price',
        icon: 'create-outline',
        onPress: () =>
          handleQuickAction('log_price', () =>
            Alert.alert('Log price', 'Manual price logging unlocks alongside offline-first inventory.')
          )
      },
      {
        id: 'add_pantry_item',
        label: 'Add pantry item',
        icon: 'bag-add-outline',
        onPress: () => handleQuickAction('add_pantry_item', () => onNavigateTab('lists'))
      },
      {
        id: 'invite_household',
        label: 'Invite household',
        icon: 'share-social-outline',
        onPress: () =>
          handleQuickAction('invite_household', () =>
            Alert.alert('Invite household', 'Household invites go live once list sharing is generally available.')
          )
      }
    ],
    [handleQuickAction, onNavigateReceipts, onNavigateTab]
  );

  const sections = useMemo<DrawerSection[]>(() => {
    const listsStat = quickStats.find((stat) => stat.label === 'Lists')?.value ?? '0';
    const itemsStat = quickStats.find((stat) => stat.label === 'Tracked items')?.value ?? '0';
    const receiptsStat = quickStats.find((stat) => stat.label === 'Receipts scanned')?.value ?? '0';

    return [
      {
        id: 'shopping',
        title: 'Shopping intelligence',
        icon: 'analytics-outline',
        badge: metricsLoading ? 'Syncing...' : metricsError ? 'Attention' : 'Up to date',
        items: [
          {
            id: 'heatmap',
            label: 'Spend heatmap',
            meta: metricsError
              ? metricsError
              : `${heatmap.monthLabel} - ${receiptsStat} receipt${receiptsStat === '1' ? '' : 's'}`
          },
          {
            id: 'lists',
            label: 'Active lists',
            meta: `${listsStat} maintained`,
            onPress: () => handleQuickAction('open_lists', () => onNavigateTab('lists'))
          },
          {
            id: 'inventory',
            label: 'Tracked pantry items',
            meta: `${itemsStat} in sync`
          }
        ]
      },
      {
        id: 'savings',
        title: 'Savings radar',
        icon: 'cash-outline',
        badge: recommendationsCount ? `${recommendationsCount} tips` : undefined,
        items: [
          {
            id: 'promos',
            label: 'Promos preview',
            meta: 'See what is trending this week.',
            onPress: () => handleQuickAction('open_promos', () => onNavigateTab('promos'))
          },
          {
            id: 'ai_suggestions',
            label: 'AI suggestions',
            meta: flags.aiSuggestions
              ? `${recommendationsCount || 0} ready for review`
              : 'Enable feature_ai_suggestions to preview tailored ideas.',
            onPress: flags.aiSuggestions
              ? () => handleQuickAction('open_ai_suggestions', () => onNavigateTab('home'))
              : () =>
                  handleQuickAction('ai_waitlist', () =>
                    Alert.alert('AI suggestions', 'Flip on feature_ai_suggestions in your env to test the workflow.')
                  )
          }
        ]
      },
      {
        id: 'household',
        title: 'Household',
        icon: 'people-circle-outline',
        badge: flags.listSharing ? 'Live' : 'Beta soon',
        items: [
          {
            id: 'sharing',
            label: 'Sharing status',
            meta: flags.listSharing ? 'Invites enabled' : 'Enable feature_list_sharing to test collaboration.',
            onPress: flags.listSharing
              ? () =>
                  handleQuickAction('manage_sharing', () =>
                    Alert.alert('Household sharing', 'Manage members from the Lists workspace.')
                  )
              : undefined
          },
          {
            id: 'account',
            label: 'Account & billing',
            meta: 'Review plan, receipts, and notification settings.',
            onPress: () => handleQuickAction('open_account', onOpenProfile)
          }
        ]
      }
    ];
  }, [
    flags.aiSuggestions,
    flags.listSharing,
    handleQuickAction,
    heatmap.monthLabel,
    metricsError,
    metricsLoading,
    onNavigateTab,
    onOpenProfile,
    quickStats,
    recommendationsCount
  ]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    sections.reduce((acc, section, index) => {
      acc[section.id] = index === 0;
      return acc;
    }, {} as Record<string, boolean>)
  );

  useEffect(() => {
    setExpandedSections((prev) => {
      let changed = sections.length !== Object.keys(prev).length;
      const next: Record<string, boolean> = {};
      sections.forEach((section, index) => {
        const nextValue = prev[section.id] ?? index === 0;
        next[section.id] = nextValue;
        if (prev[section.id] !== nextValue) {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [sections]);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = !prev[id];
      trackEvent('menu.section_toggle', { id, expanded: next });
      return { ...prev, [id]: next };
    });
  }, []);

  const supportLinks = useMemo(
    () => [
      {
        id: 'support',
        label: 'Contact support',
        icon: 'chatbubble-ellipses-outline',
        onPress: () =>
          handleQuickAction('contact_support', () =>
            Alert.alert('Support', 'Email support@smartshopper.app or use in-app chat (coming soon).')
          )
      },
      {
        id: 'docs',
        label: 'Runbooks & docs',
        icon: 'book-outline',
        onPress: () =>
          handleQuickAction('open_docs', () =>
            Alert.alert('Runbooks', 'Documentation opens in the Smart Shopper portal in the upcoming release.')
          )
      },
      {
        id: 'feedback',
        label: 'Request a feature',
        icon: 'bulb-outline',
        onPress: () =>
          handleQuickAction('request_feature', () =>
            Alert.alert('Feature requests', 'Tell us what to build next at feedback@smartshopper.app.')
          )
      }
    ],
    [handleQuickAction]
  );

  if (!rendered) {
    return null;
  }

  return (
    <Modal transparent animationType="none" visible onRequestClose={dismiss}>
      <View style={drawerStyles.modalRoot}>
        <Animated.View style={[drawerStyles.backdrop, { opacity: backdropOpacity }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <Animated.View
          style={[
            drawerStyles.drawer,
            {
              top: insets.top + 12,
              right: 16,
              bottom: Math.max(insets.bottom + 24, 32),
              width: Math.min(width - 32, 360),
              transform: [{ translateY }]
            }
          ]}
        >
          <View style={drawerStyles.headerRow}>
            <Text style={drawerStyles.headerTitle}>Command center</Text>
            <Pressable accessibilityRole="button" onPress={dismiss} style={drawerStyles.headerButton}>
              <Ionicons name="close" size={18} color="#0F172A" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={drawerStyles.scrollContent}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => handleQuickAction('view_account', onOpenProfile)}
              style={({ pressed }) => [
                drawerStyles.profileCard,
                pressed && drawerStyles.profileCardPressed
              ]}
            >
              <View style={drawerStyles.profileAvatar}>
                <Text style={drawerStyles.profileAvatarLabel}>{initials}</Text>
              </View>
              <View style={drawerStyles.profileMeta}>
                <Text style={drawerStyles.profileName}>{primaryEmail.split('@')[0]}</Text>
                <Text style={drawerStyles.profileEmail}>{primaryEmail}</Text>
                <Text style={drawerStyles.profilePlan}>Smart Shopper Beta</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </Pressable>

            <Text style={drawerStyles.sectionLabel}>Quick capture</Text>
            <View style={drawerStyles.quickRow}>
              {quickActions.map((action) => (
                <Pressable
                  key={action.id}
                  accessibilityRole="button"
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    drawerStyles.quickChip,
                    pressed && drawerStyles.quickChipPressed
                  ]}
                >
                  <View style={drawerStyles.quickChipIcon}>
                    <Ionicons name={action.icon} size={18} color="#0F172A" />
                  </View>
                  <Text style={drawerStyles.quickChipLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>

            {sections.map((section) => {
              const expanded = expandedSections[section.id];
              return (
                <View key={section.id} style={drawerStyles.accordion}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => toggleSection(section.id)}
                    style={({ pressed }) => [
                      drawerStyles.accordionHeader,
                      pressed && drawerStyles.accordionHeaderPressed
                    ]}
                  >
                    <View style={drawerStyles.accordionIcon}>
                      <Ionicons name={section.icon} size={18} color="#0F172A" />
                    </View>
                    <View style={drawerStyles.accordionTitleWrap}>
                      <Text style={drawerStyles.accordionTitle}>{section.title}</Text>
                      {section.badge ? (
                        <View style={drawerStyles.accordionBadge}>
                          <Text style={drawerStyles.accordionBadgeLabel}>{section.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
                  </Pressable>
                  {expanded ? (
                    <View style={drawerStyles.accordionBody}>
                      {section.items.map((item) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole={item.onPress ? 'button' : 'text'}
                          onPress={item.onPress}
                          disabled={!item.onPress}
                          style={({ pressed }) => [
                            drawerStyles.accordionItem,
                            pressed && item.onPress && drawerStyles.accordionItemPressed
                          ]}
                        >
                          <Text style={drawerStyles.accordionItemLabel}>{item.label}</Text>
                          {item.meta ? <Text style={drawerStyles.accordionItemMeta}>{item.meta}</Text> : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <View style={drawerStyles.toolkitCard}>
              <View style={drawerStyles.toolkitRow}>
                <View>
                  <Text style={drawerStyles.toolkitTitle}>Offline queue</Text>
                  <Text style={drawerStyles.toolkitSubtitle}>Retry pending sync events instantly.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    handleQuickAction('flush_queue', () =>
                      Alert.alert('Sync queue', 'We will retry pending events and surface issues in the activity log.')
                    )
                  }
                  style={({ pressed }) => [
                    drawerStyles.toolkitButton,
                    pressed && drawerStyles.toolkitButtonPressed
                  ]}
                >
                  <Text style={drawerStyles.toolkitButtonLabel}>Flush</Text>
                </Pressable>
              </View>
              <View style={drawerStyles.toolkitDivider} />
              <View style={drawerStyles.toolkitRow}>
                <View>
                  <Text style={drawerStyles.toolkitTitle}>Auto-sync</Text>
                  <Text style={drawerStyles.toolkitSubtitle}>Sync whenever the app becomes active.</Text>
                </View>
                <Switch
                  value={autoSyncEnabled}
                  onValueChange={(value) => {
                    setAutoSyncEnabled(value);
                    trackEvent('menu.toolkit_toggle', { id: 'auto_sync', value });
                  }}
                />
              </View>
              <View style={drawerStyles.toolkitRow}>
                <View>
                  <Text style={drawerStyles.toolkitTitle}>Cellular uploads</Text>
                  <Text style={drawerStyles.toolkitSubtitle}>Allow receipt uploads on mobile data.</Text>
                </View>
                <Switch
                  value={cellularUploadsEnabled}
                  onValueChange={(value) => {
                    setCellularUploadsEnabled(value);
                    trackEvent('menu.toolkit_toggle', { id: 'cellular_uploads', value });
                  }}
                />
              </View>
            </View>

            <Text style={drawerStyles.sectionLabel}>Support & docs</Text>
            <View style={drawerStyles.supportList}>
              {supportLinks.map((link) => (
                <Pressable
                  key={link.id}
                  accessibilityRole="button"
                  onPress={link.onPress}
                  style={({ pressed }) => [
                    drawerStyles.supportItem,
                    pressed && drawerStyles.supportItemPressed
                  ]}
                >
                  <View style={drawerStyles.supportItemIcon}>
                    <Ionicons name={link.icon} size={18} color="#0F172A" />
                  </View>
                  <Text style={drawerStyles.supportItemLabel}>{link.label}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                disabled={isAuthenticating}
                onPress={() => handleQuickAction('sign_out', onSignOut)}
                style={({ pressed }) => [
                  drawerStyles.supportItem,
                  pressed && drawerStyles.supportItemPressed
                ]}
              >
                <View style={drawerStyles.supportItemIcon}>
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                </View>
                <Text style={drawerStyles.supportItemLabelDanger}>
                  {isAuthenticating ? 'Switching...' : 'Switch phone number'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function HeatmapCalendar({
  data,
  loading,
  enabled,
  error
}: {
  data: HeatmapData;
  loading: boolean;
  enabled: boolean;
  error?: string;
}) {
  return (
    <View style={newStyles.heatmap}>
      <View style={newStyles.heatmapHeader}>
        <Pressable accessibilityRole="button" style={newStyles.heatmapNavButton} disabled>
          <Ionicons name="chevron-back" size={16} color="#94A3B8" />
        </Pressable>
        <Text style={newStyles.heatmapTitle}>{data.monthLabel}</Text>
        <Pressable accessibilityRole="button" style={newStyles.heatmapNavButton} disabled>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </Pressable>
      </View>
      <View style={newStyles.heatmapGrid}>
        {data.weeks.map((week, rowIndex) => (
          <View key={`${data.monthLabel}-week-${rowIndex}`} style={newStyles.heatmapRow}>
            {week.map((cell) => (
              <View
                key={cell.isoDay}
                style={[newStyles.heatmapCell, heatmapIntensity(cell.intensity, cell.isCurrentMonth)]}
              >
                <Text
                  style={[
                    newStyles.heatmapCellLabel,
                    !cell.isCurrentMonth && newStyles.heatmapCellLabelMuted,
                    cell.intensity >= 3 && newStyles.heatmapCellLabelOnDark
                  ]}
                >
                  {cell.date.getUTCDate()}
                </Text>
                {cell.total > 0 ? (
                  <View
                    style={[
                      newStyles.heatmapDot,
                      cell.intensity >= 3 && newStyles.heatmapDotOnDark
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
      {loading ? <Text style={newStyles.heatmapHint}>Refreshing spend heatmap...</Text> : null}
      {!enabled ? <Text style={newStyles.heatmapHint}>Enable feature_heatmap_v2 to test live data.</Text> : null}
      {error ? <Text style={newStyles.heatmapError}>{error}</Text> : null}
    </View>
  );
}

function heatmapIntensity(value: number, isCurrentMonth: boolean) {
  if (!isCurrentMonth) {
    return { backgroundColor: '#E2E8F0' };
  }
  switch (value) {
    case 0:
      return { backgroundColor: '#EFF6FF' };
    case 1:
      return { backgroundColor: '#BFDBFE' };
    case 2:
      return { backgroundColor: '#93C5FD' };
    default:
      return { backgroundColor: '#3B82F6' };
  }
}

function PlaceholderScreen({ title, message }: { title: string; message: string }) {
  return (
    <View style={newStyles.placeholderContainer}>
      <Ionicons name="construct-outline" size={42} color="#4FD1C5" />
      <Text style={newStyles.placeholderTitle}>{title}</Text>
      <Text style={newStyles.placeholderSubtitle}>{message}</Text>
    </View>
  );
}

function PromosScreen() {
  return (
    <View style={newStyles.promosContainer}>
      <View style={newStyles.promosCard}>
        <Text style={newStyles.promosTitle}>Promos coming soon</Text>
        <Text style={newStyles.promosCopy}>
          We're curating deals from your favorite stores. Check back soon or enable notifications in Settings to be the
          first to know.
        </Text>
      </View>
    </View>
  );
}

function BottomNavigation({
  activeTab,
  onSelectTab,
  onCreatePress,
  bottomInset
}: {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onCreatePress: () => void;
  bottomInset: number;
}) {
  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
    { key: 'home', label: 'Home', icon: activeTab === 'home' ? 'home' : 'home-outline' },
    { key: 'insights', label: 'Insights', icon: activeTab === 'insights' ? 'stats-chart' : 'stats-chart-outline' },
    { key: 'promos', label: 'Promos', icon: activeTab === 'promos' ? 'pricetags' : 'pricetags-outline' },
    { key: 'lists', label: 'Lists', icon: activeTab === 'lists' ? 'checkmark-done' : 'checkmark-done-outline' }
  ];

  return (
    <View style={[newStyles.navContainer, { paddingBottom: bottomInset + 12 }]}>
      <View style={newStyles.navPill}>
        {tabs.slice(0, 2).map((tab) => (
          <NavTabButton key={tab.key} tab={tab} isActive={tab.key === activeTab} onSelect={() => onSelectTab(tab.key)} />
        ))}
        <Pressable accessibilityRole="button" onPress={onCreatePress} style={({ pressed }) => [newStyles.fabButton, pressed && newStyles.fabButtonPressed]}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
        {tabs.slice(2).map((tab) => (
          <NavTabButton key={tab.key} tab={tab} isActive={tab.key === activeTab} onSelect={() => onSelectTab(tab.key)} />
        ))}
      </View>
    </View>
  );
}

function NavTabButton({
  tab,
  isActive,
  onSelect
}: {
  tab: { key: TabKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] };
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onSelect}
      style={({ pressed }) => [newStyles.navItem, pressed && newStyles.navItemPressed]}
    >
      <Ionicons name={tab.icon} size={22} color={isActive ? '#4FD1C5' : '#6C7A91'} />
      <Text style={[newStyles.navLabel, isActive && newStyles.navLabelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

function suggestListName() {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  const hour = now.getHours();
  const descriptor = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `${weekday} ${descriptor} list`;
}

function detectLocaleRegion() {
  try {
    return detectRegion();
  } catch {
    return 'US';
  }
}

type CreateSheetProps = {
  visible: boolean;
  onClose: () => void;
  ownerId?: string | null;
  deviceId?: string | null;
  onCreated: (result: { listId: string }) => void;
};

type ListDraftPayload = {
  listName: string;
  textValue: string;
  store?: {
    id: string | null;
    label?: string | null;
    region?: string | null;
  };
  updatedAt: number;
};

type CreateTab = 'type' | 'voice' | 'camera' | 'menu';

function CreateSheet({ visible, onClose, ownerId, deviceId, onCreated }: CreateSheetProps) {
  const [activeTab] = useState<CreateTab>('type');
  const isMenuPremium = featureFlags.menuIngestion ?? false;
  const [listName, setListName] = useState(() => suggestListName());
  const [textValue, setTextValue] = useState('');
  const [parsedEntries, setParsedEntries] = useState<EnrichedListEntry[]>([]);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreDefinition | null>(null);
  const draftHydratedRef = useRef(false);
  const customStoresReadyRef = useRef(false);
  const [customStores, setCustomStores] = useState<StoreDefinition[]>([]);
  const [addingCustomStore, setAddingCustomStore] = useState(false);
  const [customStoreDraft, setCustomStoreDraft] = useState('');
  const [editingCustomStoreId, setEditingCustomStoreId] = useState<string | null>(null);
  const [voiceRecording, setVoiceRecording] = useState<Audio.Recording | null>(null);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [cameraProcessing, setCameraProcessing] = useState(false);
  const [cameraWarnings, setCameraWarnings] = useState<string[]>([]);
  const [cameraPreviewUri, setCameraPreviewUri] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const defaultListNameRef = useRef('');
  const skipTypeParseRef = useRef(false);
  const cameraAutoTriggerRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  if (!defaultListNameRef.current) {
    defaultListNameRef.current = listName;
  }

  const region = useMemo(() => detectLocaleRegion(), []);
  const storeOptions = useMemo(() => {
    const base = storeSuggestionsFor(region);
    const map = new Map<string, StoreDefinition>();
    [...customStores, ...base].forEach((store) => {
      if (!map.has(store.id)) {
        map.set(store.id, store);
      }
    });
    return Array.from(map.values());
  }, [region, customStores]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CUSTOM_STORES_KEY);
        if (cancelled || !raw) {
          customStoresReadyRef.current = true;
          return;
        }
        const parsed = JSON.parse(raw) as StoreDefinition[];
        if (!cancelled && Array.isArray(parsed)) {
          setCustomStores(parsed);
        }
      } catch (err) {
        console.warn('create-sheet: failed to load custom stores', err);
      } finally {
        customStoresReadyRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customStoresReadyRef.current) {
      return;
    }
    AsyncStorage.setItem(CUSTOM_STORES_KEY, JSON.stringify(customStores)).catch((err: unknown) =>
      console.warn('create-sheet: failed to persist custom stores', err)
    );
  }, [customStores]);

  useEffect(() => {
    if (visible) {
      trackEvent('create_sheet_opened');
    } else {
      setParsing(false);
      setCreating(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible || !voiceRecording) {
      return;
    }
    cancelVoiceCapture(voiceRecording).catch(() => undefined);
    setVoiceRecording(null);
  }, [visible, voiceRecording]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (activeTab !== 'type') {
      setParsing(false);
      return;
    }
    const trimmed = textValue.trim();
    if (!trimmed) {
      setParsedEntries([]);
      setParsing(false);
      return;
    }
    const parsed = parseListInput(trimmed);
    if (!parsed.length) {
      setParsedEntries([]);
      setParsing(false);
      return;
    }
    let cancelled = false;
    setParsing(true);
    enrichParsedEntries(parsed, { merchantCode: selectedStore?.id ?? null })
      .then((entries) => {
        if (!cancelled) {
          setParsedEntries(entries);
        }
      })
      .catch((err: unknown) => {
        console.warn('create-sheet: enrich failed', err);
        if (!cancelled) {
          const fallbackEntries = parsed.map((entry) => ({
            ...entry,
            category: 'pantry',
            categoryLabel: 'Pantry',
            confidence: 0.2,
            assignment: 'suggestion' as const,
            unit: entry.unit ?? 'qty',
            categorySource: null,
            categoryCanonical: null,
            suggestions: [] as EnrichedListEntry['suggestions']
          }));
          recordCategoryTelemetry(
            fallbackEntries.map((entry) => ({ band: entry.assignment, confidence: entry.confidence })),
            { context: 'list_input_fallback' }
          );
          setParsedEntries(fallbackEntries);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setParsing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, textValue, selectedStore?.id, visible]);

  const persistDraft = useCallback(() => {
    const baseline = (defaultListNameRef.current || '').trim();
    const trimmedName = listName.trim();
    const hasCustomName = trimmedName.length > 0 && trimmedName !== baseline;
    const hasItems = textValue.trim().length > 0 || parsedEntries.length > 0;
    const hasStore = Boolean(selectedStore);
    const shouldPersist = hasCustomName || hasItems || hasStore;
    if (!shouldPersist) {
      AsyncStorage.removeItem(CREATE_LIST_DRAFT_KEY).catch((err: unknown) =>
        console.warn('create-sheet: failed to clear draft', err)
      );
      return;
    }
    const payload: ListDraftPayload = {
      listName: trimmedName.length ? listName : baseline || suggestListName(),
      textValue,
      store: selectedStore
        ? { id: selectedStore.id, label: selectedStore.label, region: selectedStore.region ?? null }
        : { id: null },
      updatedAt: Date.now()
    };
    AsyncStorage.setItem(CREATE_LIST_DRAFT_KEY, JSON.stringify(payload)).catch((err: unknown) =>
      console.warn('create-sheet: failed to persist draft', err)
    );
  }, [listName, parsedEntries.length, selectedStore, textValue]);

  const handleDismiss = useCallback(() => {
    if (creating) {
      return;
    }
    persistDraft();
    if (voiceRecording) {
      cancelVoiceCapture(voiceRecording).catch(() => undefined);
      setVoiceRecording(null);
    }
    setVoiceProcessing(false);
    setVoiceTranscript('');
    setCameraProcessing(false);
    setCameraWarnings([]);
    setCameraPreviewUri(null);
    setCameraError(null);
    cameraAutoTriggerRef.current = false;
    skipTypeParseRef.current = false;
    setAddingCustomStore(false);
    setCustomStoreDraft('');
    setEditingCustomStoreId(null);
    trackEvent('create_sheet_closed', { fromTab: activeTab, typedItems: parsedEntries.length });
    onClose();
  }, [activeTab, creating, parsedEntries.length, persistDraft, voiceRecording, onClose]);

  const buildCustomStore = useCallback(
    (label: string, regionHint?: string | null): StoreDefinition => {
      const normalized = label.trim();
      const slugBase = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let slug = slugBase || `store-${Date.now()}`;
      let candidateId = `custom:${slug}`;
      const existingIds = new Set(storeOptions.map((store) => store.id));
      let counter = 1;
      while (existingIds.has(candidateId)) {
        candidateId = `custom:${slug}-${counter++}`;
      }
      return {
        id: candidateId,
        label: normalized,
        region: regionHint ?? region,
        aisles: []
      };
    },
    [storeOptions, region]
  );

  const handleStoreSelect = useCallback(
    (store: StoreDefinition | null) => {
      setSelectedStore(store);
      setAddingCustomStore(false);
      setCustomStoreDraft('');
      setEditingCustomStoreId(null);
      trackEvent('create_sheet_store_selected', {
        storeId: store?.id ?? null,
        storeLabel: store?.label ?? null,
        storeRegion: store?.region ?? null
      });
    },
    []
  );

  const handleSaveCustomStore = useCallback(() => {
    const trimmed = customStoreDraft.trim();
    if (!trimmed) {
      Alert.alert('Store name required', 'Enter a store name or cancel.');
      return;
    }
    if (editingCustomStoreId) {
      setCustomStores((prev) =>
        prev.map((store) => (store.id === editingCustomStoreId ? { ...store, label: trimmed } : store))
      );
      setSelectedStore((prev) => {
        if (prev?.id !== editingCustomStoreId) {
          return prev;
        }
        return { ...prev, label: trimmed };
      });
      setAddingCustomStore(false);
      setCustomStoreDraft('');
      setEditingCustomStoreId(null);
      trackEvent('create_sheet_custom_store_renamed', { storeId: editingCustomStoreId });
      return;
    }
    const newStore = buildCustomStore(trimmed, region);
    setCustomStores((prev) => {
      if (prev.some((store) => store.id === newStore.id)) {
        return prev;
      }
      return [newStore, ...prev];
    });
    setAddingCustomStore(false);
    setCustomStoreDraft('');
    setEditingCustomStoreId(null);
    trackEvent('create_sheet_custom_store_added', { storeId: newStore.id });
    handleStoreSelect(newStore);
  }, [buildCustomStore, customStoreDraft, editingCustomStoreId, handleStoreSelect, region]);

  const handleCancelCustomStore = useCallback(() => {
    setAddingCustomStore(false);
    setCustomStoreDraft('');
    setEditingCustomStoreId(null);
  }, []);

  const handleRemoveCustomStore = useCallback(() => {
    if (!selectedStore || !selectedStore.id.startsWith('custom:')) {
      return;
    }
    const storeId = selectedStore.id;
    const label = selectedStore.label;
    Alert.alert(
      'Remove store?',
      `Remove ${label} from your quick stores? You can always add it again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setCustomStores((prev) => prev.filter((store) => store.id !== storeId));
            setSelectedStore((prev) => (prev?.id === storeId ? null : prev));
            setAddingCustomStore(false);
            setCustomStoreDraft('');
            setEditingCustomStoreId(null);
            trackEvent('create_sheet_custom_store_removed', { storeId });
          }
        }
      ],
      { cancelable: true }
    );
  }, [selectedStore]);

  const handleCreateList = useCallback(async () => {
    const trimmedName = listName.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Give this list a name before creating it.');
      return;
    }

    const entries = parsedEntries.length
      ? parsedEntries
      : parseListInput(textValue).map((entry) => ({
          ...entry,
          category: 'pantry',
          categoryLabel: 'Pantry',
          confidence: 0.2,
          assignment: 'suggestion' as const,
          unit: entry.unit ?? 'qty',
          categorySource: null,
          categoryCanonical: null,
          suggestions: [] as EnrichedListEntry['suggestions']
        }));

    setCreating(true);
    try {
      const list = await createList({ name: trimmedName, ownerId: ownerId ?? null, deviceId: deviceId ?? null });
      if (selectedStore) {
        await setListStore(list.id, selectedStore);
      }
      for (const entry of entries) {
        await createListItem(list.id, entry.label, entry.quantity, {
          unit: entry.unit,
          category: entry.category,
          categoryConfidence: entry.confidence,
          categoryBand: entry.assignment,
          categorySource: entry.categorySource,
          categoryCanonical: entry.categoryCanonical,
          merchantCode: selectedStore?.id ?? null
        });
      }
      trackEvent('create_sheet_list_created', {
        itemCount: entries.length,
        storeId: selectedStore?.id ?? null
      });
      Toast.show(entries.length ? `Created ${trimmedName}, ${entries.length} items ready.` : `Created ${trimmedName}`);
      await AsyncStorage.removeItem(CREATE_LIST_DRAFT_KEY).catch((err: unknown) =>
        console.warn('create-sheet: failed to clear draft after create', err)
      );
      draftHydratedRef.current = false;
      onCreated({ listId: list.id });
    } catch (err) {
      console.error('Failed to create list from sheet', err);
      Alert.alert('Could not create list', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setCreating(false);
    }
  }, [listName, parsedEntries, textValue, ownerId, deviceId, selectedStore, onCreated]);

  const handleVoiceToggle = useCallback(async () => {
    if (voiceRecording) {
      setVoiceProcessing(true);
      try {
        const result = await finalizeVoiceCapture(voiceRecording, { locale: region });
        setVoiceTranscript(result.transcript);
        setVoiceRecording(null);
        setVoiceProcessing(false);
        trackEvent('create_sheet_voice_transcribed', {
          locale: result.locale ?? region,
          confidence: result.confidence
        });
        if (result.transcript.trim().length) {
          setTextValue(result.transcript.trim());
          Toast.show('Voice captured - review your list.');
        }
      } catch (err) {
        console.error('Voice capture failed', err);
        Alert.alert('Voice capture failed', err instanceof Error ? err.message : 'Try again in a quiet space.');
        setVoiceRecording(null);
        setVoiceProcessing(false);
      }
      return;
    }
    try {
      const recording = await startVoiceCapture();
      setVoiceTranscript('');
      setVoiceRecording(recording);
      trackEvent('create_sheet_voice_started', { locale: region });
    } catch (err) {
      console.error('Unable to start voice capture', err);
      Alert.alert(
        'Microphone unavailable',
        err instanceof Error ? err.message : 'Grant microphone permissions to use voice capture.'
      );
    }
  }, [region, voiceRecording]);

  const handleCameraCapture = useCallback(async () => {
    if (cameraProcessing) {
      return;
    }
    setCameraProcessing(true);
    setCameraWarnings([]);
    setCameraError(null);
    setCameraPreviewUri(null);
    try {
      const result = await captureListFromCamera();
      if (result.imageUri) {
        setCameraPreviewUri(result.imageUri);
      }
      const warnings = result.warnings ?? [];
      const items = result.items ?? [];
      setCameraWarnings(warnings);
      if (warnings.length) {
        setCameraError('We could not read every item. Review and complete your list.');
      }
      const itemLines = items
        .map((item) => {
          const parts: string[] = [];
          if (item.quantity && item.quantity > 0) {
            parts.push(String(item.quantity));
          }
          if (item.unit) {
            parts.push(item.unit);
          }
          if (item.label) {
            parts.push(item.label);
          }
          return parts.join(' ').trim();
        })
        .filter(Boolean);
      if (itemLines.length) {
        const merged = itemLines.join('\n');
        setTextValue((current) => {
          const prefix = current.trim();
          if (!prefix.length) {
            return merged;
          }
          return `${prefix}\n${merged}`;
        });
        trackEvent('create_sheet_camera_list_success', {
          confidence: result.confidence,
          items: items.length,
          warnings: warnings.length
        });
        Toast.show('Photo captured - review the detected items.');
      } else {
        trackEvent('create_sheet_camera_list_empty', { warnings: warnings.length });
        setCameraError('We could not detect any items. Try again with clearer lighting.');
      }
    } catch (err) {
      console.error('Camera capture failed', err);
      Alert.alert(
        'Camera capture failed',
        err instanceof Error ? err.message : 'Try again with brighter lighting and a steady angle.'
      );
      setCameraError('We could not process the photo. Try again with better lighting.');
      trackEvent('create_sheet_camera_capture_failed', { mode: 'list' });
    } finally {
      setCameraProcessing(false);
    }
  }, [cameraProcessing]);

  useEffect(() => {
    if (!visible) {
      cameraAutoTriggerRef.current = false;
      return;
    }
    if (!cameraProcessing && !cameraAutoTriggerRef.current) {
      cameraAutoTriggerRef.current = true;
      handleCameraCapture();
    }
  }, [activeTab, visible, cameraProcessing, handleCameraCapture]);

  const storeChips = useMemo(() => {
    const chips: Array<StoreDefinition | null> = [null];
    const seen = new Set<string>();
    const register = (store: StoreDefinition | null) => {
      if (!store) {
        return;
      }
      if (seen.has(store.id)) {
        return;
      }
      chips.push(store);
      seen.add(store.id);
    };
    if (selectedStore) {
      register(selectedStore);
    }
    customStores.forEach(register);
    storeOptions.slice(0, 5).forEach(register);
    return chips;
  }, [customStores, storeOptions, selectedStore]);

  const sheetMaxHeight = Math.min(height * 0.92, 820);
  const sheetMinHeight = Math.min(height * 0.68, 620);
  const sheetBottomPadding = Math.max(insets.bottom + 32, 56);
  const keyboardOffset = Platform.OS === 'ios' ? insets.top + 48 : 0;
  const isEditingCustomStore = editingCustomStoreId !== null;
  const selectedIsCustom = Boolean(selectedStore?.id?.startsWith('custom:'));

  useEffect(() => {
    if (!visible) {
      draftHydratedRef.current = false;
      setEditingCustomStoreId(null);
    }
  }, [visible]);

  const hydrateDefault = useCallback(() => {
    const nextName = suggestListName();
    defaultListNameRef.current = nextName;
    setListName(nextName);
    setTextValue('');
    setParsedEntries([]);
    setSelectedStore(null);
    setAddingCustomStore(false);
    setCustomStoreDraft('');
    setEditingCustomStoreId(null);
    setVoiceRecording(null);
    setVoiceProcessing(false);
    setVoiceTranscript('');
    setCameraProcessing(false);
    setCameraWarnings([]);
    setCameraPreviewUri(null);
    setCameraError(null);
    cameraAutoTriggerRef.current = false;
    skipTypeParseRef.current = false;
    draftHydratedRef.current = true;
  }, []);

  const applyDraft = useCallback(
    (draft: ListDraftPayload) => {
      const fallbackName = suggestListName();
      const chosenName = draft.listName && draft.listName.trim().length ? draft.listName : fallbackName;
      defaultListNameRef.current = fallbackName;
      setListName(chosenName);
      setTextValue(draft.textValue ?? '');
      setParsedEntries([]);
      if (draft.store?.id && draft.store.label) {
        const existing = [...customStores, ...storeOptions].find((store) => store.id === draft.store?.id);
        if (existing) {
          setSelectedStore(existing);
        } else {
          const newStore = buildCustomStore(draft.store.label, draft.store.region ?? region);
          setCustomStores((prev) => {
            if (prev.some((store) => store.id === newStore.id)) {
              return prev;
            }
            return [newStore, ...prev];
          });
          setSelectedStore(newStore);
        }
      } else {
        setSelectedStore(null);
      }
      setAddingCustomStore(false);
      setCustomStoreDraft('');
      setEditingCustomStoreId(null);
      setVoiceRecording(null);
      setVoiceProcessing(false);
      setVoiceTranscript('');
      setCameraProcessing(false);
      setCameraWarnings([]);
      setCameraPreviewUri(null);
      setCameraError(null);
      cameraAutoTriggerRef.current = false;
      skipTypeParseRef.current = false;
      draftHydratedRef.current = true;
    },
    [buildCustomStore, customStores, region, storeOptions]
  );

  useEffect(() => {
    if (!visible || draftHydratedRef.current) {
      return;
    }
    let cancelled = false;
    (async () => {
      if (!customStoresReadyRef.current) {
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (customStoresReadyRef.current || cancelled) {
              clearInterval(interval);
              resolve();
            }
          }, 30);
        });
      }
      if (cancelled) {
        return;
      }
      try {
        const rawDraft = await AsyncStorage.getItem(CREATE_LIST_DRAFT_KEY);
        if (cancelled) {
          return;
        }
        const draft = rawDraft ? (JSON.parse(rawDraft) as ListDraftPayload) : null;
        if (draft && ((draft.listName && draft.listName.trim().length) || (draft.textValue && draft.textValue.trim().length))) {
          Alert.alert(
            'Resume draft?',
            'You have an unsaved list draft. Continue editing or discard it.',
            [
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () => {
                  AsyncStorage.removeItem(CREATE_LIST_DRAFT_KEY).catch((err: unknown) =>
                    console.warn('create-sheet: failed to clear draft', err)
                  );
                  hydrateDefault();
                }
              },
              {
                text: 'Continue',
                onPress: () => {
                  applyDraft(draft);
                }
              }
            ],
            { cancelable: false }
          );
        } else {
          hydrateDefault();
        }
      } catch (err) {
        console.warn('create-sheet: failed to load draft', err);
        hydrateDefault();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyDraft, hydrateDefault, visible]);

  useEffect(() => {
    if (!visible || !draftHydratedRef.current) {
      return;
    }
    const handle = setTimeout(() => {
      persistDraft();
    }, 250);
    return () => clearTimeout(handle);
  }, [persistDraft, visible]);

  const renderTypeTab = () => (
    <>
      <Text style={newStyles.createLabel}>List name</Text>
      <TextInput
        style={newStyles.createNameInput}
        value={listName}
        onChangeText={setListName}
        placeholder="e.g. Weekend run"
      />
      <Text style={newStyles.createLabel}>Store</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={newStyles.storeChipRow}>
        {storeChips.map((store) => {
          const key = store ? store.id : 'any-store';
          const isActive = store ? selectedStore?.id === store.id : !selectedStore;
          return (
            <Pressable
              key={key}
              style={[newStyles.storeChip, isActive && newStyles.storeChipActive]}
              onPress={() => handleStoreSelect(store)}
            >
              <Text
                style={[
                  newStyles.storeChipLabel,
                  !store && !isActive && newStyles.storeChipLabelMuted
                ]}
              >
                {store ? store.label : 'Any store'}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          key="custom-add"
          style={[newStyles.storeChip, newStyles.storeChipAdd]}
          onPress={() => {
            setAddingCustomStore(true);
            setCustomStoreDraft('');
            setEditingCustomStoreId(null);
          }}
        >
          <Text style={newStyles.storeChipAddLabel}>+ Custom store</Text>
        </Pressable>
      </ScrollView>
      {selectedIsCustom && !addingCustomStore ? (
        <View style={newStyles.customStoreManage}>
          <Pressable
            style={newStyles.customStoreManageButton}
            onPress={() => {
              if (!selectedStore) {
                return;
              }
              setAddingCustomStore(true);
              setEditingCustomStoreId(selectedStore.id);
              setCustomStoreDraft(selectedStore.label);
            }}
          >
            <Text style={newStyles.customStoreManageButtonLabel}>Rename store</Text>
          </Pressable>
          <Pressable style={newStyles.customStoreManageDanger} onPress={handleRemoveCustomStore}>
            <Text style={newStyles.customStoreManageDangerLabel}>Remove</Text>
          </Pressable>
        </View>
      ) : null}
      {addingCustomStore ? (
        <View style={newStyles.customStoreEditor}>
          <TextInput
            style={newStyles.customStoreInput}
            placeholder={isEditingCustomStore ? 'Update store name' : 'Enter store name'}
            value={customStoreDraft}
            onChangeText={setCustomStoreDraft}
          />
          <View style={newStyles.customStoreActions}>
            <Pressable style={newStyles.customStoreActionButton} onPress={handleCancelCustomStore}>
              <Text style={newStyles.customStoreActionLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[newStyles.customStoreActionButton, newStyles.customStoreActionPrimary]}
              onPress={handleSaveCustomStore}
            >
              <Text style={[newStyles.customStoreActionLabel, newStyles.customStoreActionPrimaryLabel]}>
                {isEditingCustomStore ? 'Update' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Text style={newStyles.createLabel}>Items</Text>
      <View style={newStyles.inputActionsRow}>
        <Text style={newStyles.createHelperText}>Paste or type items, one per line.</Text>
        <View style={newStyles.actionChips}>
          <Pressable
            accessibilityRole="button"
            style={newStyles.actionChip}
            onPress={handleVoiceToggle}
            disabled={voiceProcessing}
          >
            <Ionicons name="mic" size={16} color="#0C1D37" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={newStyles.actionChip}
            onPress={handleCameraCapture}
            disabled={cameraProcessing}
          >
            <Ionicons name="camera" size={16} color="#0C1D37" />
          </Pressable>
        </View>
      </View>
      <TextInput
        style={newStyles.createInput}
        multiline
        placeholder="Paste or type items, one per line (e.g. Eggs, Coffee, Bread, Chicken)"
        value={textValue}
        onChangeText={setTextValue}
      />
      <Text style={newStyles.createHelperText}>
        {parsedEntries.length
          ? `${parsedEntries.length} item${parsedEntries.length === 1 ? '' : 's'} ready`
          : 'Type or paste one item per line to build your list.'}
      </Text>
      <View style={newStyles.menuInfoCard}>
        <Ionicons name="restaurant" size={16} color="#0C1D37" />
        <View style={{ flex: 1 }}>
          <Text style={newStyles.menuInfoTitle}>Menu (Premium)</Text>
          <Text style={newStyles.menuInfoBody}>Convert dishes to Recipes and complete Shopping list.</Text>
        </View>
        <Pressable
          style={newStyles.menuInfoButton}
          onPress={() =>
            Toast.show(
              isMenuPremium ? 'Open Menus from the Lists tab to review.' : 'Upgrade to unlock menu parsing.',
              1600
            )
          }
        >
          <Text style={newStyles.menuInfoButtonLabel}>{isMenuPremium ? 'Open' : 'Upgrade'}</Text>
        </Pressable>
      </View>
      <SmartAddPreview
        entries={parsedEntries}
        loading={parsing}
        onCategoryChange={(index, suggestion) =>
          setParsedEntries((current) =>
            current.map((entry, idx) =>
              idx === index
                ? {
                    ...entry,
                    category: suggestion.category,
                    categoryLabel: suggestion.label,
                    confidence: suggestion.confidence,
                    assignment: suggestion.band,
                    categorySource: suggestion.source ?? null,
                    categoryCanonical: suggestion.canonicalName ?? null
                  }
                : entry
            )
          )
        }
        onUnitChange={(entryIndex, unit) =>
          setParsedEntries((current) =>
            current.map((entry, idx) => (idx === entryIndex ? { ...entry, unit } : entry))
          )
        }
        theme={{
          accent: '#4FD1C5',
          accentDark: '#0C1D37',
          subtitle: '#4A576D',
          border: '#E2E8F0',
          card: '#FFFFFF'
        }}
      />
      <Pressable
        accessibilityRole="button"
        onPress={handleCreateList}
        disabled={creating}
        style={({ pressed }) => [
          newStyles.createSubmitButton,
          pressed && !creating && newStyles.createSubmitButtonPressed,
          creating && newStyles.createSubmitButtonDisabled
        ]}
      >
        {creating ? (
          <ActivityIndicator size="small" color="#0C1D37" />
        ) : (
          <Text style={newStyles.createSubmitButtonLabel}>Create list</Text>
        )}
      </Pressable>
    </>
  );

  const renderVoiceTab = () => {
    const isRecording = Boolean(voiceRecording);
    return (
      <View style={newStyles.captureContainer}>
        <Text style={newStyles.captureTitle}>Speak your list</Text>
        <Text style={newStyles.captureBody}>
          Dictate each item naturally - pause between items and we will build the list for you.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={[
            newStyles.capturePrimaryButton,
            isRecording && newStyles.capturePrimaryButtonActive,
            voiceProcessing && newStyles.capturePrimaryButtonDisabled
          ]}
          onPress={handleVoiceToggle}
          disabled={voiceProcessing}
        >
          {voiceProcessing ? (
            <ActivityIndicator size="small" color="#0C1D37" />
          ) : (
            <>
              <Ionicons
                name={isRecording ? 'stop-circle' : 'mic'}
                size={18}
                color={isRecording ? '#0C1D37' : '#FFFFFF'}
              />
              <Text
                style={[
                  newStyles.capturePrimaryLabel,
                  isRecording && newStyles.capturePrimaryLabelActive
                ]}
              >
                {isRecording ? 'Stop & transcribe' : 'Start recording'}
              </Text>
            </>
          )}
        </Pressable>
        {voiceTranscript ? (
          <View style={newStyles.voiceTranscriptCard}>
            <Text style={newStyles.voiceTranscriptTitle}>Last capture</Text>
            <Text style={newStyles.voiceTranscriptText}>{voiceTranscript}</Text>
            <Pressable
              accessibilityRole="button"
              style={newStyles.captureSecondaryButton}
            >
              <Text style={newStyles.captureSecondaryLabel}>Review in form</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={newStyles.captureFootnote}>
          We move your capture into the form so you can confirm and edit the items.
        </Text>
      </View>
    );
  };

  const renderMenuTab = () => (
    <View style={newStyles.captureContainer}>
      <Text style={newStyles.captureTitle}>Scan a menu (Premium)</Text>
      <Text style={newStyles.captureBody}>
        Detect dishes from a photo or upload. Premium unlocks recipes and shopping plans; non-premium can save dish
        titles only.
      </Text>
      {isMenuPremium ? (
        <Pressable
          accessibilityRole="button"
          style={[newStyles.capturePrimaryButton]}
          onPress={() => {
            Toast.show('Menu scan coming soon—hooking into /ingest/menu.', 1800);
          }}
        >
          <Ionicons name="restaurant" size={18} color="#FFFFFF" />
          <Text style={newStyles.capturePrimaryLabel}>Start menu scan</Text>
        </Pressable>
      ) : (
        <View style={newStyles.lockedCard}>
          <Ionicons name="lock-closed" size={18} color="#0C1D37" />
          <Text style={newStyles.lockedTitle}>Premium required</Text>
          <Text style={newStyles.lockedBody}>
            Upgrade to unlock menu recipes and auto-generated shopping plans. Or save dish titles only.
          </Text>
          <Pressable
            style={newStyles.capturePrimaryButton}
            accessibilityRole="button"
            onPress={() => Toast.show('Upgrade flow coming soon.', 1500)}
          >
            <Text style={newStyles.capturePrimaryLabel}>Upgrade</Text>
          </Pressable>
          <Pressable
            style={newStyles.captureSecondaryButton}
            accessibilityRole="button"
            onPress={() => Toast.show('Saved dish titles only (no recipes).', 1500)}
          >
            <Text style={newStyles.captureSecondaryLabel}>Save titles only</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const renderCameraTab = () => (
    <View style={newStyles.captureContainer}>
      <Text style={newStyles.captureTitle}>Snap your list</Text>
      <Text style={newStyles.captureBody}>
        Take a clear photo of your handwritten or printed list. We will pull the items into the Type tab so you can
        confirm and tweak them.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={[
          newStyles.capturePrimaryButton,
          cameraProcessing && newStyles.capturePrimaryButtonDisabled
        ]}
        onPress={handleCameraCapture}
        disabled={cameraProcessing}
      >
        {cameraProcessing ? (
          <ActivityIndicator size="small" color="#0C1D37" />
        ) : (
          <>
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <Text style={newStyles.capturePrimaryLabel}>Capture list photo</Text>
          </>
        )}
      </Pressable>
      {cameraError ? (
        <View style={newStyles.captureWarnings}>
          <Text style={newStyles.captureWarningText}>{cameraError}</Text>
        </View>
      ) : null}
      {cameraWarnings.length ? (
        <View style={newStyles.captureWarnings}>
          {cameraWarnings.map((warning) => (
            <Text key={warning} style={newStyles.captureWarningText}>
              {'\u2022 '}
              {warning}
            </Text>
          ))}
        </View>
      ) : null}
      {cameraPreviewUri ? (
        <Image source={{ uri: cameraPreviewUri }} style={newStyles.capturePreviewImage} resizeMode="cover" />
      ) : null}
      <Text style={newStyles.captureFootnote}>
        Captured items open in the Type tab for final edits after capture.
      </Text>
    </View>
  );

  const renderBody = () => renderTypeTab();

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={handleDismiss}>
      <View style={newStyles.createOverlay}>
        <Pressable style={newStyles.createDismissZone} onPress={handleDismiss} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardOffset}
          style={[newStyles.createAvoiding, { maxHeight: sheetMaxHeight }]}
        >
          <ScrollView
            style={[newStyles.createSheetScroll, { maxHeight: sheetMaxHeight }]}
            contentContainerStyle={[
              newStyles.createSheetContainer,
              { minHeight: sheetMinHeight, paddingBottom: sheetBottomPadding }
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={[newStyles.createSheet, { paddingBottom: Math.max(24, sheetBottomPadding - 12) }]}>
              <View style={newStyles.createHandle} />
              <Text style={newStyles.createTitle}>New list</Text>
              {renderBody()}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const drawerStyles = StyleSheet.create({
  modalRoot: {
    flex: 1
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,29,55,0.35)'
  },
  drawer: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: '#0C1D37',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0C1D37'
  },
  headerButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9'
  },
  scrollContent: {
    paddingBottom: 48
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20
  },
  profileCardPressed: {
    opacity: 0.85
  },
  profileAvatar: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  profileAvatarLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  profileMeta: {
    flex: 1
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C1D37'
  },
  profileEmail: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2
  },
  profilePlan: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '600',
    marginTop: 6
  },
  sectionLabel: {
    fontSize: 13,
    letterSpacing: 0.8,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2F6',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    marginBottom: 10
  },
  quickChipPressed: {
    opacity: 0.85
  },
  quickChipIcon: {
    marginRight: 8
  },
  quickChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C1D37'
  },
  accordion: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden'
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC'
  },
  accordionHeaderPressed: {
    backgroundColor: '#EDF2F7'
  },
  accordionIcon: {
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  accordionTitleWrap: {
    flex: 1
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0C1D37'
  },
  accordionBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E0F2F1'
  },
  accordionBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E'
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF'
  },
  accordionItem: {
    paddingVertical: 10
  },
  accordionItemPressed: {
    opacity: 0.7
  },
  accordionItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C1D37'
  },
  accordionItemMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4
  },
  toolkitCard: {
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24
  },
  toolkitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  toolkitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C1D37'
  },
  toolkitSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    maxWidth: 200
  },
  toolkitButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#0F766E'
  },
  toolkitButtonPressed: {
    opacity: 0.85
  },
  toolkitButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  toolkitDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10
  },
  supportList: {
    marginTop: 12
  },
  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  supportItemPressed: {
    opacity: 0.75
  },
  supportItemIcon: {
    marginRight: 12
  },
  supportItemLabel: {
    fontSize: 14,
    color: '#0C1D37',
    fontWeight: '500'
  },
  supportItemLabelDanger: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600'
  }
});

const newStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  },
  body: {
    flex: 1,
    paddingBottom: 110
  },
  dashboardContainer: {
    flex: 1
  },
  dashboardScroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 24
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A576D'
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  welcome: {
    fontSize: 16,
    lineHeight: 24,
    color: '#0C1D37'
  },
  greetingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 8,
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2
  },
  analyticsGrid: {
    gap: 16
  },
  analyticsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    gap: 12
  },
  performanceCard: {
    backgroundColor: '#F9FAFB'
  },
  menuCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0C1D37'
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A576D'
  },
  quickStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16
  },
  quickStat: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#101828',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  quickStatPressed: {
    backgroundColor: '#F1F5F9'
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0C1D37'
  },
  quickStatLabel: {
    marginTop: 4,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#6C7A91'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  suggestionStatus: {
    color: '#6C7A91',
    fontSize: 13
  },
  suggestionChip: {
    backgroundColor: '#4FD1C51A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18
  },
  suggestionChipPressed: {
    opacity: 0.7
  },
  suggestionChipLabel: {
    color: '#0C1D37',
    fontWeight: '600'
  },
  heatmap: {
    gap: 12
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  heatmapTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0C1D37'
  },
  heatmapNavButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9'
  },
  heatmapGrid: {
    gap: 6
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 6
  },
  heatmapCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  heatmapCellLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0C1D37'
  },
  heatmapCellLabelMuted: {
    color: '#64748B'
  },
  heatmapCellLabelOnDark: {
    color: '#FFFFFF'
  },
  heatmapDot: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0C1D37'
  },
  heatmapDotOnDark: {
    backgroundColor: '#FFFFFF'
  },
  heatmapHint: {
    fontSize: 12,
    color: '#64748B'
  },
  heatmapError: {
    fontSize: 12,
    color: '#DC2626'
  },
  profileOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12,29,55,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  profileSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#101828',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileAvatarLabel: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 24
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0C1D37'
  },
  profileEmail: {
    fontSize: 14,
    color: '#4A576D'
  },
  profileSignOutButton: {
    marginTop: 8,
    backgroundColor: '#E53E3E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20
  },
  profileSignOutButtonPressed: {
    opacity: 0.85
  },
  profileSignOutLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.4
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0C1D37'
  },
  placeholderSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#4A576D'
  },
  promosContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48
  },
  promosCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    gap: 12,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3
  },
  promosTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0C1D37'
  },
  promosCopy: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4A576D'
  },
  navContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center'
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 40,
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
    gap: 12
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 56
  },
  navItemPressed: {
    opacity: 0.75
  },
  navLabel: {
    fontSize: 12,
    color: '#6C7A91'
  },
  navLabelActive: {
    color: '#0C1D37',
    fontWeight: '600'
  },
  fabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4FD1C5',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8
  },
  fabButtonPressed: {
    transform: [{ scale: 0.96 }]
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12,29,55,0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 20
  },
  menuContainer: {
    width: 320,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#101828',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0'
  },
  menuHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuHeaderSpacer: {
    width: 36,
    height: 36
  },
  menuHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  menuScroll: {
    flexGrow: 0
  },
  menuScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16
  },
  menuSection: {
    gap: 12
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#4A576D'
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#F8FAFC'
  },
  menuItemPressed: {
    opacity: 0.8
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0C1D37'
  },
  menuItemDestructive: {
    backgroundColor: '#FFF5F5'
  },
  menuItemLabelDestructive: {
    color: '#E53E3E'
  },
  menuItemDisabled: {
    opacity: 0.6
  },
  menuItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuItemText: {
    flex: 1,
    gap: 4
  },
  menuItemDescription: {
    fontSize: 12,
    color: '#4A576D',
    lineHeight: 18
  },
  menuInfoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF'
  },
  menuInfoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBFBF8'
  },
  menuInfoText: {
    flex: 1,
    gap: 4
  },
  menuInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C1D37'
  },
  menuInfoBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4A576D'
  },
  menuInfoButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#0C1D37',
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuInfoButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  createOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12,29,55,0.45)'
  },
  createDismissZone: {
    flex: 1
  },
  createAvoiding: {
    alignSelf: 'stretch',
    width: '100%',
    flexShrink: 0
  },
  createSheetScroll: {
    alignSelf: 'stretch'
  },
  createSheetContainer: {
    paddingHorizontal: 0,
    flexGrow: 1,
    justifyContent: 'flex-end'
  },
  createSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    gap: 16
  },
  createHandle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1'
  },
  createTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0C1D37',
    textAlign: 'center'
  },
  createTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 4
  },
  createTab: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center'
  },
  createTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  createTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B'
  },
  createTabLabelActive: {
    color: '#0C1D37'
  },
  createLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A576D',
    marginTop: 8
  },
  createNameInput: {
    borderRadius: 16,
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0C1D37'
  },
  storeChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8
  },
  storeChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF'
  },
  storeChipActive: {
    borderColor: '#4FD1C5',
    backgroundColor: '#ECFDF5'
  },
  storeChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C1D37'
  },
  storeChipLabelMuted: {
    color: '#64748B'
  },
  storeChipAdd: {
    borderStyle: 'dashed',
    borderColor: '#CBD5E1'
  },
  storeChipAddLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C1D37'
  },
  customStoreManage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12
  },
  customStoreManageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#E2F8F4'
  },
  customStoreManageButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
    letterSpacing: 0.3
  },
  customStoreManageDanger: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FEE2E2'
  },
  customStoreManageDangerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    letterSpacing: 0.3
  },
  customStoreEditor: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E2EC',
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
    marginTop: 8,
    marginBottom: 12
  },
  customStoreInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0C1D37',
    backgroundColor: '#FFFFFF'
  },
  customStoreActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  customStoreActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF'
  },
  customStoreActionPrimary: {
    backgroundColor: '#4FD1C5',
    borderColor: '#4FD1C5'
  },
  customStoreActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C1D37'
  },
  customStoreActionPrimaryLabel: {
    color: '#0C1D37'
  },
  createInput: {
    minHeight: 120,
    borderRadius: 16,
    borderColor: '#CBD5E1',
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
    color: '#0C1D37'
  },
  createHelperText: {
    fontSize: 12,
    color: '#4A576D',
    marginTop: 8,
    marginBottom: 4
  },
  createSubmitButton: {
    borderRadius: 16,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    paddingVertical: 14
  },
  createSubmitButtonPressed: {
    opacity: 0.8
  },
  createSubmitButtonDisabled: {
    backgroundColor: '#94A3B8'
  },
  createSubmitButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  createPlaceholder: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 16
  },
  createPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0C1D37'
  },
  createPlaceholderBody: {
    fontSize: 14,
    color: '#4A576D',
    textAlign: 'center',
    lineHeight: 20
  },
  createPlaceholderFootnote: {
    fontSize: 12,
    color: '#6C7A91',
    textAlign: 'center',
    lineHeight: 18
  },
  captureContainer: {
    gap: 16,
    paddingVertical: 8
  },
  captureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C1D37'
  },
  captureBody: {
    fontSize: 13,
    color: '#4A576D',
    lineHeight: 19
  },
  capturePrimaryButton: {
    borderRadius: 18,
    backgroundColor: '#0C1D37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 8
  },
  capturePrimaryButtonActive: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  capturePrimaryButtonDisabled: {
    backgroundColor: '#94A3B8'
  },
  capturePrimaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  capturePrimaryLabelActive: {
    color: '#0C1D37'
  },
  captureFootnote: {
    fontSize: 12,
    color: '#6C7A91',
    lineHeight: 18
  },
  voiceTranscriptCard: {
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 8
  },
  voiceTranscriptTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C1D37'
  },
  voiceTranscriptText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20
  },
  inputActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  actionChips: {
    flexDirection: 'row',
    gap: 8
  },
  actionChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  captureSecondaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#E2E8F0'
  },
  captureSecondaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0C1D37'
  },
  lockedCard: {
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  lockedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1D37'
  },
  lockedBody: {
    fontSize: 13,
    color: '#4A576D',
    lineHeight: 18
  },
  captureWarnings: {
    borderRadius: 12,
    backgroundColor: '#FFF4DE',
    padding: 12,
    gap: 4
  },
  captureWarningText: {
    fontSize: 12,
    color: '#B45309'
  },
  capturePreviewImage: {
    width: '100%',
    height: 160,
    borderRadius: 16
  }
});

