import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  useWindowDimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth-context';
import { featureFlags } from '@/src/lib/env';
import { trackEvent } from '@/src/lib/analytics';
import { useDashboardMetrics, type HeatmapData } from '@/src/lib/dashboard-data';
import { useRecommendations } from '@/src/features/recommendations/use-recommendations';
import { ListsScreen } from '@/src/features/lists/ListsScreen';
import { useTopBar } from '@/src/providers/TopBarProvider';

const NEXT_ACTIONS = [
  'Create a list via text, voice, or photo capture.',
  'Scan a receipt to populate price history.',
  'Review the calendar heatmap once you have transaction data.'
] as const;

const FALLBACK_SUGGESTED_ITEMS = ['Milk', 'Butter', 'Bananas', 'Yogurt', 'Olive oil'] as const;

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
  const insets = useSafeAreaInsets();

  const handleSelectTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  const handleCreatePress = useCallback(() => {
    if (!featureFlags.createWorkflow) {
      Alert.alert('Coming soon', 'The new list creation workflow is under development.');
      return;
    }
    setCreateSheetVisible(true);
  }, []);

  const handleCloseCreateSheet = useCallback(() => {
    setCreateSheetVisible(false);
  }, []);

  const renderContent = useMemo(() => {
    switch (activeTab) {
      case 'home':
        return <DashboardView auth={auth} onNavigate={setActiveTab} />;
      case 'insights':
        return <PlaceholderScreen title="Insights" message="Insights coming soon." />;
      case 'promos':
        return <PromosScreen />;
      case 'lists':
        return <ListsScreen />;
      case 'receipts':
        return <PlaceholderScreen title="Receipts" message="Your scanned receipts will appear here for quick reference." />;
      default:
        return null;
    }
  }, [activeTab, auth]);

  return (
    <SafeAreaView style={newStyles.safeArea} edges={['bottom']}>
      <View style={newStyles.body}>{renderContent}</View>
      <BottomNavigation
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onCreatePress={handleCreatePress}
        bottomInset={insets.bottom}
      />
      {featureFlags.createWorkflow && (
        <CreateSheet visible={isCreateSheetVisible} onClose={handleCloseCreateSheet} />
      )}
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
  const { quickStats, heatmap, loading: metricsLoading, error: metricsError } = useDashboardMetrics(
    user?.id ?? undefined,
    featureFlags.heatmapV2
  );
  const recommendationRequest = useMemo(() => {
    if (!featureFlags.aiSuggestions) {
      return null;
    }

    return {
      query: 'pantry staples',
      locale: user?.user_metadata?.locale ?? undefined
    };
  }, [featureFlags.aiSuggestions, user?.user_metadata?.locale]);

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
              {quickStats.map((stat) => (
                <View key={stat.label} style={newStyles.quickStat}>
                  <Text style={newStyles.quickStatValue}>{metricsLoading ? '...' : stat.value}</Text>
                  <Text style={newStyles.quickStatLabel}>{stat.label}</Text>
                </View>
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
              • {action}
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
              : `${heatmap.monthLabel} · ${receiptsStat} receipt${receiptsStat === '1' ? '' : 's'}`
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
          We’re curating deals from your favorite stores. Check back soon or enable notifications in Settings to be the
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

function CreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'type' | 'voice' | 'camera'>('type');
  const [textValue, setTextValue] = useState('');
  const parsedItems = useMemo(
    () =>
      textValue
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    [textValue]
  );
  const itemCount = parsedItems.length;
  const listParserReady = featureFlags.listParserV2;

  useEffect(() => {
    if (visible) {
      trackEvent('create_sheet_opened');
      return;
    }
    setActiveTab('type');
    setTextValue('');
  }, [visible]);

  const handleDismiss = useCallback(() => {
    trackEvent('create_sheet_closed', { fromTab: activeTab, typedItems: itemCount });
    onClose();
  }, [activeTab, itemCount, onClose]);

  const handleTabChange = useCallback(
    (tab: 'type' | 'voice' | 'camera') => {
      setActiveTab(tab);
      trackEvent('create_sheet_tab_selected', { tab });
    },
    []
  );

  const handleAddItems = useCallback(() => {
    if (!itemCount) {
      Alert.alert('Add your items', 'Enter at least one item to continue.');
      return;
    }
    trackEvent('create_sheet_items_submitted', { tab: 'type', itemCount });
    Alert.alert(
      'Items captured',
      `We will categorize ${itemCount} item${itemCount === 1 ? '' : 's'} as list parsing matures.`
    );
    setTextValue('');
    handleDismiss();
  }, [handleDismiss, itemCount]);

  const renderBody = () => {
    if (activeTab === 'type') {
      return (
        <>
          <TextInput
            style={newStyles.createInput}
            multiline
            placeholder="Paste or type items, one per line (e.g. Eggs, Coffee, Bread, Chicken)"
            value={textValue}
            onChangeText={setTextValue}
          />
          <Text style={newStyles.createHelperText}>
            {itemCount
              ? `${itemCount} item${itemCount === 1 ? '' : 's'} ready to add`
              : 'Type or paste one item per line to build your list.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleAddItems}
            disabled={!itemCount}
            style={({ pressed }) => [
              newStyles.createSubmitButton,
              pressed && itemCount > 0 && newStyles.createSubmitButtonPressed,
              !itemCount && newStyles.createSubmitButtonDisabled
            ]}
          >
            <Text style={newStyles.createSubmitButtonLabel}>Add items</Text>
          </Pressable>
        </>
      );
    }

    const label = activeTab === 'voice' ? 'Voice capture' : 'Camera capture';
    const bodyCopy = listParserReady
      ? `${label} is rolling out with List Parser v2. We will enable beta access for your account soon.`
      : `${label} will launch alongside List Parser v2. Keep typing lists for now so analytics can stay accurate.`;
    return (
      <View style={newStyles.createPlaceholder}>
        <Ionicons name="construct-outline" size={36} color="#4FD1C5" />
        <Text style={newStyles.createPlaceholderTitle}>{label} coming soon</Text>
        <Text style={newStyles.createPlaceholderBody}>{bodyCopy}</Text>
        <Text style={newStyles.createPlaceholderFootnote}>
          Beta access will unlock this workflow once QA flips the new parser flag.
        </Text>
      </View>
    );
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={handleDismiss}>
      <View style={newStyles.createOverlay}>
        <Pressable style={newStyles.createDismissZone} onPress={handleDismiss} />
        <View style={newStyles.createSheet}>
          <View style={newStyles.createHandle} />
          <Text style={newStyles.createTitle}>Add items</Text>
          <View style={newStyles.createTabs}>
            {(['type', 'voice', 'camera'] as const).map((tab) => (
              <Pressable
                key={tab}
                style={[newStyles.createTab, activeTab === tab && newStyles.createTabActive]}
                onPress={() => handleTabChange(tab)}
              >
                <Text style={[newStyles.createTabLabel, activeTab === tab && newStyles.createTabLabelActive]}>
                  {tab === 'type' ? 'Type' : tab === 'voice' ? 'Voice' : 'Camera'}
                </Text>
              </Pressable>
            ))}
          </View>
          {renderBody()}
        </View>
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
  createOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12,29,55,0.45)'
  },
  createDismissZone: {
    flex: 1
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
  }
});






