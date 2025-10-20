import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth-context';
import { featureFlags } from '@/src/lib/env';

const QUICK_STATS = [
  { label: 'Lists', value: '0' },
  { label: 'Tracked items', value: '0' },
  { label: 'Receipts scanned', value: '0' }
] as const;

const NEXT_ACTIONS = [
  'Create a list via text, voice, or photo capture.',
  'Scan a receipt to populate price history.',
  'Review the calendar heatmap once you have transaction data.'
] as const;

const SUGGESTED_ITEMS = ['Milk', 'Butter', 'Bananas', 'Yogurt', 'Olive oil'] as const;

type AuthContextValue = ReturnType<typeof useAuth>;
type TabKey = 'home' | 'search' | 'promos' | 'receipts';

export default function HomeScreen() {
  const auth = useAuth();

  if (!featureFlags.newNav) {
    return <LegacyHomeScreen auth={auth} />;
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
  const welcomeMessage = useMemo(
    () =>
      user?.email
        ? `Hi ${user.email.split('@')[0]}, you are ready to build your first smart list and start price tracking.`
        : 'You are ready to build your first smart list and start price tracking.',
    [user?.email]
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

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

  const [menuVisible, setMenuVisible] = useState(false);

  const handleMenuOption = useCallback(
    (option: 'settings' | 'receipts' | 'help' | 'signout') => {
      setMenuVisible(false);
      if (option === 'receipts') {
        onNavigate('receipts');
      } else if (option === 'signout') {
        if (!isAuthenticating) {
          handleSignOut();
        }
      } else {
        Alert.alert('Coming soon', `The ${option} experience is on the roadmap.`);
      }
    },
    [handleSignOut, isAuthenticating, onNavigate]
  );

  return (
    <>
      <ScrollView contentContainerStyle={newStyles.dashboardScroll} showsVerticalScrollIndicator={false}>
        <View style={newStyles.headerRow}>
          <View style={newStyles.avatar}>
            <Text style={newStyles.avatarText}>{initials}</Text>
          </View>
          <View style={newStyles.headerCopy}>
            <Text style={newStyles.heading}>Hello{user?.email ? ',' : ''}</Text>
            <Text style={newStyles.subtitle}>{user?.email ?? 'Guest Shopper'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMenuVisible(true)}
            style={({ pressed }) => [newStyles.menuButton, pressed && newStyles.menuButtonPressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#0C1D37" />
          </Pressable>
        </View>
        <Text style={newStyles.welcome}>{welcomeMessage}</Text>

        <View style={newStyles.analyticsGrid}>
          <View style={[newStyles.analyticsCard, newStyles.performanceCard]}>
            <Text style={newStyles.cardTitle}>At a glance</Text>
            <View style={newStyles.quickStatRow}>
              {QUICK_STATS.map((stat) => (
                <View key={stat.label} style={newStyles.quickStat}>
                  <Text style={newStyles.quickStatValue}>{stat.value}</Text>
                  <Text style={newStyles.quickStatLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={newStyles.analyticsCard}>
            <Text style={newStyles.cardTitle}>Spend heatmap</Text>
            <HeatmapPreview />
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
          <View style={newStyles.suggestionsRow}>
            {SUGGESTED_ITEMS.map((item) => (
              <Pressable key={item} style={({ pressed }) => [newStyles.suggestionChip, pressed && newStyles.suggestionChipPressed]}>
                <Text style={newStyles.suggestionChipLabel}>{item}</Text>
              </Pressable>
            ))}
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
      </ScrollView>

      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={newStyles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <View style={newStyles.menuSheet}>
            <Text style={newStyles.menuHeading}>Menu</Text>
            <MenuItem label="Receipts" icon="document-text-outline" onPress={() => handleMenuOption('receipts')} />
            <MenuItem label="Settings" icon="settings-outline" onPress={() => handleMenuOption('settings')} />
            <MenuItem label="Help & support" icon="help-circle-outline" onPress={() => handleMenuOption('help')} />
            <MenuItem
              label="Sign out"
              icon="log-out-outline"
              destructive
              disabled={isAuthenticating}
              onPress={() => handleMenuOption('signout')}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuItem({
  label,
  icon,
  destructive,
  onPress,
  disabled
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        newStyles.menuItem,
        pressed && newStyles.menuItemPressed,
        destructive && newStyles.menuItemDestructive
      ]}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={18} color={destructive ? '#E53E3E' : '#0C1D37'} />
      <Text style={[newStyles.menuItemLabel, destructive && newStyles.menuItemLabelDestructive]}>{label}</Text>
    </Pressable>
  );
}

function HeatmapPreview() {
  const grid = [
    [1, 0, 2, 1, 3, 2, 1],
    [0, 1, 2, 0, 2, 3, 2],
    [0, 0, 1, 1, 2, 2, 3],
    [1, 1, 0, 2, 3, 2, 1],
    [2, 1, 1, 0, 1, 2, 2],
    [3, 2, 1, 1, 0, 1, 2],
    [2, 3, 2, 1, 1, 0, 1]
  ];

  return (
    <View style={newStyles.heatmap}>
      {grid.map((row, rowIndex) => (
        <View key={rowIndex} style={newStyles.heatmapRow}>
          {row.map((value, index) => (
            <View key={`${rowIndex}-${index}`} style={[newStyles.heatmapCell, heatmapIntensity(value)]} />
          ))}
        </View>
      ))}
      <Text style={newStyles.heatmapLegend}>Weekly spend intensity (demo)</Text>
    </View>
  );
}

function heatmapIntensity(value: number) {
  switch (value) {
    case 0:
      return { backgroundColor: '#E2E8F0' };
    case 1:
      return { backgroundColor: '#CBD5F5' };
    case 2:
      return { backgroundColor: '#A5B9F0' };
    default:
      return { backgroundColor: '#7B98F0' };
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

  const handleAddItems = useCallback(() => {
    Alert.alert('Processing items', 'Categorization logic will be wired into this workflow soon.');
    setTextValue('');
    onClose();
  }, [onClose]);

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
          <Pressable
            accessibilityRole="button"
            onPress={handleAddItems}
            style={({ pressed }) => [newStyles.createSubmitButton, pressed && newStyles.createSubmitButtonPressed]}
          >
            <Text style={newStyles.createSubmitButtonLabel}>Add items</Text>
          </Pressable>
        </>
      );
    }

    const label = activeTab === 'voice' ? 'Voice capture' : 'Camera capture';
    return (
      <View style={newStyles.createPlaceholder}>
        <Ionicons name="construct-outline" size={36} color="#4FD1C5" />
        <Text style={newStyles.createPlaceholderTitle}>{label} coming soon</Text>
        <Text style={newStyles.createPlaceholderBody}>
          You’ll soon be able to dictate or scan receipts here. For now, type items manually.
        </Text>
      </View>
    );
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={newStyles.createOverlay}>
        <Pressable style={newStyles.createDismissZone} onPress={onClose} />
        <View style={newStyles.createSheet}>
          <View style={newStyles.createHandle} />
          <Text style={newStyles.createTitle}>Add items</Text>
          <View style={newStyles.createTabs}>
            {(['type', 'voice', 'camera'] as const).map((tab) => (
              <Pressable
                key={tab}
                style={[
                  newStyles.createTab,
                  activeTab === tab && newStyles.createTabActive
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    newStyles.createTabLabel,
                    activeTab === tab && newStyles.createTabLabelActive
                  ]}
                >
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

function LegacyHomeScreen({ auth }: { auth: AuthContextValue }) {
  const { user, signOut, isAuthenticating } = auth;
  const welcomeMessage = useMemo(
    () =>
      user?.email
        ? `Hi ${user.email.split('@')[0]}, you are ready to build your first smart list and start price tracking.`
        : 'You are ready to build your first smart list and start price tracking.',
    [user?.email]
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

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

  const userLabel = user?.email ?? 'Guest';

  return (
    <ScrollView contentContainerStyle={legacyStyles.container}>
      <View style={legacyStyles.headerRow}>
        <View style={legacyStyles.avatar}>
          <Text style={legacyStyles.avatarText}>{initials}</Text>
        </View>
        <View style={legacyStyles.headerCopy}>
          <Text style={legacyStyles.heading}>Dashboard</Text>
          <Text style={legacyStyles.subtitle}>{userLabel}</Text>
        </View>
        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          style={({ pressed }) => [legacyStyles.signOutButton, pressed && legacyStyles.signOutButtonPressed]}
          disabled={isAuthenticating}
        >
          <Text style={legacyStyles.signOutLabel}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={legacyStyles.welcome}>{welcomeMessage}</Text>
      <View style={legacyStyles.card}>
        <Text style={legacyStyles.cardHeading}>Quick stats</Text>
        <View style={legacyStyles.statRow}>
          {QUICK_STATS.map((stat) => (
            <View key={stat.label} style={legacyStyles.stat}>
              <Text style={legacyStyles.statValue}>{stat.value}</Text>
              <Text style={legacyStyles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={legacyStyles.card}>
        <Text style={legacyStyles.cardHeading}>Next actions</Text>
        {NEXT_ACTIONS.map((action) => (
          <Text key={action} style={legacyStyles.cardBody}>
            - {action}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const legacyStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 24
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerCopy: {
    flex: 1,
    marginHorizontal: 16
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0C1D37'
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4A576D'
  },
  welcome: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: '#0C1D37'
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 16
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0'
  },
  signOutButtonPressed: {
    opacity: 0.75
  },
  signOutLabel: {
    color: '#0C1D37',
    fontWeight: '600',
    fontSize: 14
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    gap: 8
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0C1D37',
    marginBottom: 8
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 4
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0C1D37'
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#6C7A91'
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A576D'
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
  dashboardScroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 24
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerCopy: {
    flex: 1,
    marginHorizontal: 16
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 16
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
    gap: 8
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 8
  },
  heatmapCell: {
    width: 20,
    height: 20,
    borderRadius: 6
  },
  heatmapLegend: {
    marginTop: 8,
    fontSize: 12,
    color: '#6C7A91'
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
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,29,55,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 70,
    paddingRight: 20
  },
  menuSheet: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6
  },
  menuHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C7A91',
    paddingHorizontal: 16,
    paddingBottom: 6
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12
  },
  menuItemPressed: {
    backgroundColor: '#F1F5F9'
  },
  menuItemLabel: {
    fontSize: 15,
    color: '#0C1D37'
  },
  menuItemDestructive: {
    backgroundColor: '#FFF5F5'
  },
  menuItemLabelDestructive: {
    color: '#E53E3E'
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
  createSubmitButton: {
    borderRadius: 16,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    paddingVertical: 14
  },
  createSubmitButtonPressed: {
    opacity: 0.8
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
  }
});
