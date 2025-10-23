import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth-context';
import { featureFlags } from '@/src/lib/env';
import { trackEvent } from '@/src/lib/analytics';
import { useDashboardMetrics } from '@/src/lib/dashboard-data';
import type { HeatmapData } from '@/src/lib/dashboard-data';
import { useRecommendations } from '@/src/features/recommendations/use-recommendations';

const NEXT_ACTIONS = [
  'Create a list via text, voice, or photo capture.',
  'Scan a receipt to populate price history.',
  'Review the calendar heatmap once you have transaction data.'
] as const;

const FALLBACK_SUGGESTED_ITEMS = ['Milk', 'Butter', 'Bananas', 'Yogurt', 'Olive oil'] as const;

type AuthContextValue = ReturnType<typeof useAuth>;
type TabKey = 'home' | 'search' | 'promos' | 'receipts';
type MenuStage = 'closed' | 'root' | 'settings' | 'receipts' | 'help';

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
      case 'search':
        return <PlaceholderScreen title="Search" message="Search will let you find lists, stores, and items quickly." />;
      case 'promos':
        return (
          <PromosScreen />
        );
      case 'receipts':
        return <PlaceholderScreen title="Receipts" message="Your scanned receipts will appear here for quick reference." />;
      default:
        return null;
    }
  }, [activeTab, auth]);

  return (
    <SafeAreaView style={newStyles.safeArea} edges={['top', 'bottom']}>
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

  const [menuStage, setMenuStage] = useState<MenuStage>('closed');
  const [profileVisible, setProfileVisible] = useState(false);

  const openMenu = useCallback(() => {
    setMenuStage('root');
  }, []);

  const closeMenu = useCallback(() => {
    setMenuStage('closed');
  }, []);

  const openProfile = useCallback(() => {
    setProfileVisible(true);
  }, []);

  const closeProfile = useCallback(() => {
    setProfileVisible(false);
  }, []);

  const handleNavigateToReceipts = useCallback(() => {
    setMenuStage('closed');
    onNavigate('receipts');
  }, [onNavigate]);

  const handleRequestSignOut = useCallback(() => {
    if (!isAuthenticating) {
      closeMenu();
      void handleSignOut();
    }
  }, [closeMenu, handleSignOut, isAuthenticating]);

  return (
    <View style={newStyles.dashboardContainer}>
      <TopBar initials={initials} onProfilePress={openProfile} onMenuPress={openMenu} />
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
                  <Text style={newStyles.quickStatValue}>{metricsLoading ? '…' : stat.value}</Text>
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
              <Text style={newStyles.suggestionStatus}>Loading ideas…</Text>
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
      <MenuModal
        stage={menuStage}
        onStageChange={setMenuStage}
        onClose={closeMenu}
        onNavigateReceipts={handleNavigateToReceipts}
        onSignOut={handleRequestSignOut}
        isAuthenticating={isAuthenticating}
        flags={featureFlags}
      />
    </View>
  );
}

function TopBar({
  initials,
  onProfilePress,
  onMenuPress
}: {
  initials: string;
  onProfilePress: () => void;
  onMenuPress: () => void;
}) {
  return (
    <View style={newStyles.topBar}>
      <View style={newStyles.logoBadge}>
        <Text style={newStyles.logoLetter}>SS</Text>
      </View>
      <Text style={newStyles.logoWordmark}>Smart Shopper</Text>
      <View style={newStyles.topBarSpacer} />
      <Pressable
        accessibilityRole="button"
        onPress={onProfilePress}
        style={({ pressed }) => [newStyles.topBarAvatar, pressed && newStyles.topBarAvatarPressed]}
      >
        <Text style={newStyles.topBarAvatarLabel}>{initials}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onMenuPress}
        style={({ pressed }) => [newStyles.menuButton, pressed && newStyles.menuButtonPressed]}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color="#0C1D37" />
      </Pressable>
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
            <Text style={newStyles.profileSignOutLabel}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function MenuModal({
  stage,
  onStageChange,
  onClose,
  onNavigateReceipts,
  onSignOut,
  isAuthenticating,
  flags
}: {
  stage: MenuStage;
  onStageChange: (stage: MenuStage) => void;
  onClose: () => void;
  onNavigateReceipts: () => void;
  onSignOut: () => void;
  isAuthenticating: boolean;
  flags: typeof featureFlags;
}) {
  if (stage === 'closed') {
    return null;
  }

  const handleShowStage = (nextStage: Exclude<MenuStage, 'closed'>) => {
    onStageChange(nextStage);
  };

  const handleBack = () => {
    onStageChange('root');
  };

  const activeStage = stage;

  const headerTitle = (() => {
    switch (activeStage) {
      case 'settings':
        return 'Settings';
      case 'receipts':
        return 'Receipts';
      case 'help':
        return 'Help & support';
      default:
        return 'Quick menu';
    }
  })();

  const content = (() => {
    switch (activeStage) {
      case 'settings':
        return <SettingsMenuContent flags={flags} />;
      case 'receipts':
        return <ReceiptsMenuContent onNavigateReceipts={onNavigateReceipts} />;
      case 'help':
        return <HelpMenuContent />;
      default:
        return (
          <MenuRoot
            onShowStage={handleShowStage}
            onSignOut={onSignOut}
            isAuthenticating={isAuthenticating}
          />
        );
    }
  })();

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={newStyles.menuOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={newStyles.menuContainer}>
          <View style={newStyles.menuHeader}>
            {activeStage !== 'root' ? (
              <Pressable accessibilityRole="button" onPress={handleBack} style={newStyles.menuHeaderButton}>
                <Ionicons name="chevron-back" size={20} color="#0C1D37" />
              </Pressable>
            ) : (
              <View style={newStyles.menuHeaderSpacer} />
            )}
            <Text style={newStyles.menuHeaderTitle}>{headerTitle}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={newStyles.menuHeaderButton}>
              <Ionicons name="close" size={20} color="#0C1D37" />
            </Pressable>
          </View>
          <ScrollView style={newStyles.menuScroll} contentContainerStyle={newStyles.menuScrollContent}>
            {content}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MenuRoot({
  onShowStage,
  onSignOut,
  isAuthenticating
}: {
  onShowStage: (stage: Exclude<MenuStage, 'closed' | 'root'>) => void;
  onSignOut: () => void;
  isAuthenticating: boolean;
}) {
  return (
    <View style={newStyles.menuSection}>
      <MenuActionItem
        label="Receipts dashboard"
        description="Review scans, exports, and reimbursement insights."
        icon="document-text-outline"
        onPress={() => onShowStage('receipts')}
      />
      <MenuActionItem
        label="Settings"
        description="Update preferences, theme, and notification plan."
        icon="settings-outline"
        onPress={() => onShowStage('settings')}
      />
      <MenuActionItem
        label="Help & support"
        description="Browse FAQs or contact the smart shopper team."
        icon="help-circle-outline"
        onPress={() => onShowStage('help')}
      />
      <MenuDivider />
      <MenuActionItem
        label="Sign out"
        description="Sign out of Smart Shopper on this device."
        icon="log-out-outline"
        destructive
        disabled={isAuthenticating}
        onPress={onSignOut}
      />
    </View>
  );
}

function SettingsMenuContent({ flags }: { flags: typeof featureFlags }) {
  return (
    <View style={newStyles.menuSection}>
      <MenuSectionTitle>Personalization</MenuSectionTitle>
      {flags.themeSelection ? (
        <MenuActionItem
          label="App theme"
          description="Choose a color palette for navigation and analytics cards."
          icon="color-palette-outline"
          onPress={() => Alert.alert('Theme selection', 'Theme selection controls will land in Sprint 1.')}
        />
      ) : (
        <MenuInfoCard
          icon="color-palette-outline"
          title="Dynamic themes coming soon"
          body="Theme selection ships in Sprint 1. Keep this page handy to try the new palettes once the feature flag is on."
        />
      )}
      <MenuSectionTitle>Account</MenuSectionTitle>
      <MenuInfoCard
        icon="person-outline"
        title="Profile settings"
        body="Tap your avatar in the top bar to review contact details or update your household preferences."
      />
      <MenuInfoCard
        icon="shield-checkmark-outline"
        title="Privacy"
        body="Receipt data is stored securely with Supabase policies. Delete requests can be sent through Help & support."
      />
    </View>
  );
}

function ReceiptsMenuContent({ onNavigateReceipts }: { onNavigateReceipts: () => void }) {
  return (
    <View style={newStyles.menuSection}>
      <MenuSectionTitle>Capture options</MenuSectionTitle>
      <MenuInfoCard
        icon="scan-outline"
        title="Scan a receipt"
        body="Use the Receipts tab to scan receipts and sync price points to your heatmap automatically."
      />
      <MenuSectionTitle>Quick actions</MenuSectionTitle>
      <MenuActionItem
        label="Open receipts tab"
        description="Jump into the receipts workspace to view upload history."
        icon="open-outline"
        onPress={onNavigateReceipts}
      />
      <MenuInfoCard
        icon="trending-up-outline"
        title="Analytics tie-ins"
        body="Receipts populate inventory counts, price history, and daily heatmap totals. Connect more stores to enrich insights."
      />
    </View>
  );
}

function HelpMenuContent() {
  return (
    <View style={newStyles.menuSection}>
      <MenuSectionTitle>Need assistance?</MenuSectionTitle>
      <MenuInfoCard
        icon="chatbubbles-outline"
        title="Knowledge base"
        body="Browse quick tips for list building, receipt scanning, and analytics. Articles roll out alongside each sprint."
      />
      <MenuInfoCard
        icon="mail-outline"
        title="Contact support"
        body="Email support@smartshopper.app for help with account access, data corrections, or feature requests."
      />
      <MenuInfoCard
        icon="bulb-outline"
        title="Roadmap feedback"
        body="Share suggestions directly inside the beta community so we can prioritize the features that matter most."
      />
    </View>
  );
}

function MenuSectionTitle({ children }: { children: string }) {
  return <Text style={newStyles.menuSectionTitle}>{children}</Text>;
}

function MenuDivider() {
  return <View style={newStyles.menuDivider} />;
}

function MenuActionItem({
  label,
  description,
  icon,
  destructive,
  disabled,
  onPress
}: {
  label: string;
  description?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        newStyles.menuItem,
        pressed && !disabled && newStyles.menuItemPressed,
        destructive && newStyles.menuItemDestructive,
        disabled && newStyles.menuItemDisabled
      ]}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
    >
      <View style={newStyles.menuItemIcon}>
        <Ionicons name={icon} size={20} color={destructive ? '#E53E3E' : '#0C1D37'} />
      </View>
      <View style={newStyles.menuItemText}>
        <Text style={[newStyles.menuItemLabel, destructive && newStyles.menuItemLabelDestructive]}>{label}</Text>
        {description ? <Text style={newStyles.menuItemDescription}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

function MenuInfoCard({
  icon,
  title,
  body
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}) {
  return (
    <View style={newStyles.menuInfoCard}>
      <View style={newStyles.menuInfoIcon}>
        <Ionicons name={icon} size={20} color="#4FD1C5" />
      </View>
      <View style={newStyles.menuInfoText}>
        <Text style={newStyles.menuInfoTitle}>{title}</Text>
        <Text style={newStyles.menuInfoBody}>{body}</Text>
      </View>
    </View>
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
      {loading ? <Text style={newStyles.heatmapHint}>Refreshing spend heatmap…</Text> : null}
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
    { key: 'search', label: 'Search', icon: activeTab === 'search' ? 'search' : 'search-outline' },
    { key: 'promos', label: 'Promos', icon: activeTab === 'promos' ? 'pricetags' : 'pricetags-outline' },
    { key: 'receipts', label: 'Receipts', icon: activeTab === 'receipts' ? 'document-text' : 'document-text-outline' }
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0C1D37',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoLetter: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  logoWordmark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  topBarSpacer: {
    flex: 1
  },
  topBarAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  topBarAvatarPressed: {
    opacity: 0.85
  },
  topBarAvatarLabel: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 16
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
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuButtonPressed: {
    opacity: 0.75
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
