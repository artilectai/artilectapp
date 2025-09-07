import CryptoJS from 'crypto-js';

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        expand: () => void;
        enableClosingConfirmation: () => void;
        setHeaderColor: (color: string) => void;
        colorScheme: string;
        onEvent: (event: string, callback: () => void) => void;
        viewportHeight: number;
        viewportStableHeight: number;
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        };
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
        };
      };
    };
  }
}

// =====================================================
// TYPE DEFINITIONS
// =====================================================

/**
 * Telegram WebApp user information
 */
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/**
 * User preferences and settings
 */
export interface UserPreferences {
  language: string;
  timezone: string;
  currency: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    finance: boolean;
    workout: boolean;
    planner: boolean;
    marketing: boolean;
  };
  privacy: {
    shareData: boolean;
    analytics: boolean;
  };
}

/**
 * Financial account information
 */
export interface FinancialAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
  balance: number;
  currency: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Financial transaction
 */
export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  description: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Budget information
 */
export interface Budget {
  id: string;
  name: string;
  category: string;
  amount: number;
  spent: number;
  currency: string;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Financial data structure
 */
export interface FinancialData {
  accounts: FinancialAccount[];
  transactions: Transaction[];
  budgets: Budget[];
  categories: string[];
  lastSync: Date;
}

/**
 * Workout program
 */
export interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  duration: number; // in weeks
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  exercises: Exercise[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Exercise definition
 */
export interface Exercise {
  id: string;
  name: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'balance';
  muscle_groups: string[];
  equipment: string[];
  instructions: string[];
  sets?: number;
  reps?: number;
  duration?: number; // in seconds
  rest?: number; // in seconds
}

/**
 * Workout session
 */
export interface WorkoutSession {
  id: string;
  programId: string;
  date: Date;
  duration: number; // in minutes
  exercises: {
    exerciseId: string;
    sets: {
      reps?: number;
      weight?: number;
      duration?: number;
      rest?: number;
    }[];
  }[];
  notes: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Health tracker data
 */
export interface HealthTracker {
  weight: { value: number; date: Date; unit: 'kg' | 'lbs' }[];
  bodyFat: { value: number; date: Date }[];
  measurements: {
    chest?: { value: number; date: Date; unit: 'cm' | 'in' }[];
    waist?: { value: number; date: Date; unit: 'cm' | 'in' }[];
    hips?: { value: number; date: Date; unit: 'cm' | 'in' }[];
    arms?: { value: number; date: Date; unit: 'cm' | 'in' }[];
    thighs?: { value: number; date: Date; unit: 'cm' | 'in' }[];
  };
  goals: {
    targetWeight?: number;
    targetBodyFat?: number;
    targetDate?: Date;
  };
}

/**
 * Workout data structure
 */
export interface WorkoutData {
  programs: WorkoutProgram[];
  sessions: WorkoutSession[];
  tracker: HealthTracker;
  lastSync: Date;
}

/**
 * Task item
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Project information
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  progress: number;
  tasks: Task[];
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Progress tracking
 */
export interface Progress {
  daily: {
    date: Date;
    tasksCompleted: number;
    tasksTotal: number;
    focusTime: number; // in minutes
  }[];
  weekly: {
    week: string;
    tasksCompleted: number;
    tasksTotal: number;
    productivity: number;
  }[];
  monthly: {
    month: string;
    tasksCompleted: number;
    tasksTotal: number;
    projectsCompleted: number;
  }[];
}

/**
 * Planner data structure
 */
export interface PlannerData {
  tasks: Task[];
  projects: Project[];
  progress: Progress;
  categories: string[];
  lastSync: Date;
}

/**
 * Subscription information
 */
export interface Subscription {
  plan: 'free' | 'premium' | 'pro';
  status: 'active' | 'inactive' | 'cancelled' | 'expired';
  startDate: Date;
  endDate?: Date;
  autoRenew: boolean;
  paymentMethod: string;
  features: string[];
  lastPayment?: {
    amount: number;
    currency: string;
    date: Date;
    transactionId: string;
  };
}

/**
 * Complete user data structure
 */
export interface UserData {
  telegramUser: TelegramUser;
  preferences: UserPreferences;
  financial: FinancialData;
  workout: WorkoutData;
  planner: PlannerData;
  subscription: Subscription;
  createdAt: Date;
  updatedAt: Date;
  lastSync: Date;
  version: string;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  encryptionKey: string;
  maxStorageSize: number; // in MB
  syncInterval: number; // in minutes
  dataRetention: number; // in days
  enableCompression: boolean;
  enableBackup: boolean;
}

// =====================================================
// CONSTANTS
// =====================================================

const STORAGE_VERSION = '1.0.0';
const DEFAULT_ENCRYPTION_KEY = 'tg-app-secure-key-2024';
const MAX_STORAGE_MB = 50;
const SYNC_INTERVAL_MINUTES = 5;
const DATA_RETENTION_DAYS = 365;

// Storage keys
const STORAGE_KEYS = {
  USER_DATA: 'tg_user_data_',
  CONFIG: 'tg_config',
  SYNC_QUEUE: 'tg_sync_queue',
  BACKUP: 'tg_backup_',
  LAST_SYNC: 'tg_last_sync_',
} as const;

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Generate a storage key with Telegram ID prefix
 */
function getStorageKey(telegramId: number, key: string): string {
  return `${key}${telegramId}`;
}

/**
 * Encrypt sensitive data
 */
function encryptData(data: string, key: string = DEFAULT_ENCRYPTION_KEY): string {
  try {
    return CryptoJS.AES.encrypt(data, key).toString();
  } catch (error) {
    console.error('Encryption failed:', error);
    return data; // Fallback to unencrypted
  }
}

/**
 * Decrypt sensitive data
 */
function decryptData(encryptedData: string, key: string = DEFAULT_ENCRYPTION_KEY): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData; // Fallback to original data
  }
}

/**
 * Compress data using simple compression
 */
function compressData(data: string): string {
  try {
    // Simple compression using JSON stringify optimizations
    const parsed = JSON.parse(data);
    return JSON.stringify(parsed);
  } catch (error) {
    return data;
  }
}

/**
 * Calculate storage size in MB
 */
function getStorageSize(): number {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length;
    }
  }
  return total / (1024 * 1024); // Convert to MB
}

/**
 * Format currency for UZS and other currencies
 */
export function formatCurrency(amount: number, currency: string = 'UZS'): string {
  if (currency === 'UZS') {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// =====================================================
// TELEGRAM INTEGRATION
// =====================================================

/**
 * Check if running in Telegram WebApp environment
 */
export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' &&
    !!window.Telegram &&
    !!window.Telegram.WebApp;
}

/**
 * Get Telegram user information
 */
export function getTelegramUserInfo(): TelegramUser | null {
  if (!isTelegramWebApp()) {
    console.warn('Not running in Telegram WebApp environment');
    return null;
  }

  const webApp = window.Telegram.WebApp;
  const user = webApp.initDataUnsafe?.user;

  if (!user) {
    console.warn('Telegram user data not available');
    return null;
  }

  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    language_code: user.language_code,
    is_premium: user.is_premium,
    photo_url: user.photo_url,
  };
}

/**
 * Setup Telegram WebApp integration
 */
export function setupTelegramIntegration(): void {
  if (!isTelegramWebApp()) {
    console.warn('Not running in Telegram WebApp environment');
    return;
  }

  const webApp = window.Telegram.WebApp;

  // Expand to full height
  webApp.expand();

  // Enable closing confirmation
  webApp.enableClosingConfirmation();

  // Set header color to match app theme
  webApp.setHeaderColor('#0f1114');

  // Handle theme changes
  webApp.onEvent('themeChanged', () => {
    console.log('Telegram theme changed:', webApp.colorScheme);
    // Trigger theme update in app
    window.dispatchEvent(new CustomEvent('telegram-theme-changed', {
      detail: { colorScheme: webApp.colorScheme }
    }));
  });

  // Handle viewport changes
  webApp.onEvent('viewportChanged', () => {
    console.log('Telegram viewport changed:', {
      height: webApp.viewportHeight,
      stableHeight: webApp.viewportStableHeight,
    });
  });

  console.log('Telegram WebApp integration setup complete');
}

/**
 * Trigger Telegram haptic feedback
 */
export function triggerHapticFeedback(type: 'light' | 'medium' | 'heavy' | 'error' | 'success' | 'warning' = 'light'): void {
  if (!isTelegramWebApp()) return;

  const webApp = window.Telegram.WebApp;
  
  switch (type) {
    case 'light':
      webApp.HapticFeedback.impactOccurred('light');
      break;
    case 'medium':
      webApp.HapticFeedback.impactOccurred('medium');
      break;
    case 'heavy':
      webApp.HapticFeedback.impactOccurred('heavy');
      break;
    case 'error':
      webApp.HapticFeedback.notificationOccurred('error');
      break;
    case 'success':
      webApp.HapticFeedback.notificationOccurred('success');
      break;
    case 'warning':
      webApp.HapticFeedback.notificationOccurred('warning');
      break;
  }
}

// =====================================================
// STORAGE FUNCTIONS
// =====================================================

/**
 * Initialize Telegram storage system
 */
export function initTelegramStorage(config?: Partial<StorageConfig>): boolean {
  try {
    const defaultConfig: StorageConfig = {
      encryptionKey: DEFAULT_ENCRYPTION_KEY,
      maxStorageSize: MAX_STORAGE_MB,
      syncInterval: SYNC_INTERVAL_MINUTES,
      dataRetention: DATA_RETENTION_DAYS,
      enableCompression: true,
      enableBackup: true,
    };

    const finalConfig = { ...defaultConfig, ...config };
    
    // Store configuration
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(finalConfig));

    // Check storage availability
    if (!window.localStorage) {
      throw new Error('localStorage not available');
    }

    // Check storage quota
    const currentSize = getStorageSize();
    if (currentSize > finalConfig.maxStorageSize) {
      console.warn(`Storage size (${currentSize.toFixed(2)}MB) exceeds limit (${finalConfig.maxStorageSize}MB)`);
    }

    console.log('Telegram storage initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Telegram storage:', error);
    return false;
  }
}

/**
 * Get user data by Telegram ID
 */
export function getUserData(telegramId: number): UserData | null {
  try {
    const key = getStorageKey(telegramId, STORAGE_KEYS.USER_DATA);
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      return null;
    }

    // Try to decrypt if it's encrypted
    let decrypted = stored;
    if (stored.startsWith('U2FsdGVkX1')) { // CryptoJS AES encrypted data starts with this
      decrypted = decryptData(stored);
    }

    const userData = JSON.parse(decrypted) as UserData;
    
    // Convert date strings back to Date objects
    userData.createdAt = new Date(userData.createdAt);
    userData.updatedAt = new Date(userData.updatedAt);
    userData.lastSync = new Date(userData.lastSync);
    
    if (userData.financial?.lastSync) {
      userData.financial.lastSync = new Date(userData.financial.lastSync);
    }
    
    if (userData.workout?.lastSync) {
      userData.workout.lastSync = new Date(userData.workout.lastSync);
    }
    
    if (userData.planner?.lastSync) {
      userData.planner.lastSync = new Date(userData.planner.lastSync);
    }

    return userData;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
}

/**
 * Save user data with Telegram ID
 */
export function saveUserData(telegramId: number, data: Partial<UserData>): boolean {
  try {
    const key = getStorageKey(telegramId, STORAGE_KEYS.USER_DATA);
    const existing = getUserData(telegramId);
    
    const updatedData: UserData = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    } as UserData;

    // Ensure required fields exist
    if (!updatedData.telegramUser) {
      const telegramUser = getTelegramUserInfo();
      if (telegramUser) {
        updatedData.telegramUser = telegramUser;
      }
    }

    if (!updatedData.createdAt) {
      updatedData.createdAt = new Date();
    }

    if (!updatedData.version) {
      updatedData.version = STORAGE_VERSION;
    }

    const jsonString = JSON.stringify(updatedData);
    
    // Encrypt sensitive financial data
    const config = getStorageConfig();
    let toStore = jsonString;
    if (config.encryptionKey && (data.financial || existing?.financial)) {
      toStore = encryptData(jsonString, config.encryptionKey);
    }

    // Compress if enabled
    if (config.enableCompression) {
      toStore = compressData(toStore);
    }

    localStorage.setItem(key, toStore);
    
    // Update last sync time
    localStorage.setItem(
      getStorageKey(telegramId, STORAGE_KEYS.LAST_SYNC),
      new Date().toISOString()
    );

    return true;
  } catch (error) {
    console.error('Failed to save user data:', error);
    return false;
  }
}

/**
 * Get storage configuration
 */
function getStorageConfig(): StorageConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to get storage config:', error);
  }

  // Return default config
  return {
    encryptionKey: DEFAULT_ENCRYPTION_KEY,
    maxStorageSize: MAX_STORAGE_MB,
    syncInterval: SYNC_INTERVAL_MINUTES,
    dataRetention: DATA_RETENTION_DAYS,
    enableCompression: true,
    enableBackup: true,
  };
}

/**
 * Update user preferences
 */
export function updateUserPreferences(telegramId: number, preferences: Partial<UserPreferences>): boolean {
  try {
    const userData = getUserData(telegramId);
    if (!userData) {
      return false;
    }

    const updatedPreferences = {
      ...userData.preferences,
      ...preferences,
    };

    return saveUserData(telegramId, {
      preferences: updatedPreferences,
    });
  } catch (error) {
    console.error('Failed to update user preferences:', error);
    return false;
  }
}

/**
 * Sync financial data
 */
export function syncFinancialData(telegramId: number, financialData: Partial<FinancialData>): boolean {
  try {
    const userData = getUserData(telegramId);
    if (!userData) {
      return false;
    }

    const updatedFinancial = {
      ...userData.financial,
      ...financialData,
      lastSync: new Date(),
    };

    return saveUserData(telegramId, {
      financial: updatedFinancial,
    });
  } catch (error) {
    console.error('Failed to sync financial data:', error);
    return false;
  }
}

/**
 * Sync workout data
 */
export function syncWorkoutData(telegramId: number, workoutData: Partial<WorkoutData>): boolean {
  try {
    const userData = getUserData(telegramId);
    if (!userData) {
      return false;
    }

    const updatedWorkout = {
      ...userData.workout,
      ...workoutData,
      lastSync: new Date(),
    };

    return saveUserData(telegramId, {
      workout: updatedWorkout,
    });
  } catch (error) {
    console.error('Failed to sync workout data:', error);
    return false;
  }
}

/**
 * Sync planner data
 */
export function syncPlannerData(telegramId: number, plannerData: Partial<PlannerData>): boolean {
  try {
    const userData = getUserData(telegramId);
    if (!userData) {
      return false;
    }

    const updatedPlanner = {
      ...userData.planner,
      ...plannerData,
      lastSync: new Date(),
    };

    return saveUserData(telegramId, {
      planner: updatedPlanner,
    });
  } catch (error) {
    console.error('Failed to sync planner data:', error);
    return false;
  }
}

/**
 * Handle subscription changes
 */
export function handleSubscriptionChange(telegramId: number, subscription: Partial<Subscription>): boolean {
  try {
    const userData = getUserData(telegramId);
    if (!userData) {
      return false;
    }

    const updatedSubscription = {
      ...userData.subscription,
      ...subscription,
    };

    const success = saveUserData(telegramId, {
      subscription: updatedSubscription,
    });

    if (success) {
      // Trigger haptic feedback for subscription changes
      triggerHapticFeedback('success');
      
      // Dispatch custom event for subscription change
      window.dispatchEvent(new CustomEvent('subscription-changed', {
        detail: { telegramId, subscription: updatedSubscription }
      }));
    }

    return success;
  } catch (error) {
    console.error('Failed to handle subscription change:', error);
    return false;
  }
}

/**
 * Export user data for backup
 */
export function exportUserData(telegramId: number): string | null {
  try {
    const userData = getUserData(telegramId);
    if (!userData) {
      return null;
    }

    // Create export object with metadata
    const exportData = {
      version: STORAGE_VERSION,
      exportDate: new Date().toISOString(),
      telegramId: telegramId,
      data: userData,
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Failed to export user data:', error);
    return null;
  }
}

/**
 * Import user data from backup
 */
export function importUserData(telegramId: number, exportedData: string): boolean {
  try {
    const parsed = JSON.parse(exportedData);
    
    // Validate export format
    if (!parsed.version || !parsed.data) {
      throw new Error('Invalid export format');
    }

    // Version compatibility check
    if (parsed.version !== STORAGE_VERSION) {
      console.warn(`Version mismatch: expected ${STORAGE_VERSION}, got ${parsed.version}`);
    }

    return saveUserData(telegramId, parsed.data);
  } catch (error) {
    console.error('Failed to import user data:', error);
    return false;
  }
}

/**
 * Delete user data (GDPR compliance)
 */
export function deleteUserData(telegramId: number): boolean {
  try {
    const userDataKey = getStorageKey(telegramId, STORAGE_KEYS.USER_DATA);
    const backupKey = getStorageKey(telegramId, STORAGE_KEYS.BACKUP);
    const syncKey = getStorageKey(telegramId, STORAGE_KEYS.LAST_SYNC);

    localStorage.removeItem(userDataKey);
    localStorage.removeItem(backupKey);
    localStorage.removeItem(syncKey);

    // Clear sync queue entries for this user
    const syncQueue = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    if (syncQueue) {
      try {
        const queue = JSON.parse(syncQueue);
        const filtered = queue.filter((item: any) => item.telegramId !== telegramId);
        localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(filtered));
      } catch (error) {
        console.error('Failed to clean sync queue:', error);
      }
    }

    // Trigger haptic feedback
    triggerHapticFeedback('warning');

    console.log(`User data deleted for Telegram ID: ${telegramId}`);
    return true;
  } catch (error) {
    console.error('Failed to delete user data:', error);
    return false;
  }
}

/**
 * Create automatic backup
 */
export function createBackup(telegramId: number): boolean {
  try {
    const config = getStorageConfig();
    if (!config.enableBackup) {
      return true; // Backup disabled, but not an error
    }

    const exportData = exportUserData(telegramId);
    if (!exportData) {
      return false;
    }

    const backupKey = getStorageKey(telegramId, STORAGE_KEYS.BACKUP);
    const backup = {
      timestamp: new Date().toISOString(),
      data: exportData,
    };

    localStorage.setItem(backupKey, JSON.stringify(backup));
    return true;
  } catch (error) {
    console.error('Failed to create backup:', error);
    return false;
  }
}

/**
 * Restore from backup
 */
export function restoreFromBackup(telegramId: number): boolean {
  try {
    const backupKey = getStorageKey(telegramId, STORAGE_KEYS.BACKUP);
    const backup = localStorage.getItem(backupKey);
    
    if (!backup) {
      console.warn('No backup found for user');
      return false;
    }

    const parsed = JSON.parse(backup);
    return importUserData(telegramId, parsed.data);
  } catch (error) {
    console.error('Failed to restore from backup:', error);
    return false;
  }
}

/**
 * Clean up old data based on retention policy
 */
export function cleanupOldData(): void {
  try {
    const config = getStorageConfig();
    const retentionMs = config.dataRetention * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs);

    // Clean up old backups
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.BACKUP)) {
        try {
          const backup = JSON.parse(localStorage.getItem(key) || '{}');
          if (backup.timestamp && new Date(backup.timestamp) < cutoffDate) {
            localStorage.removeItem(key);
            console.log(`Removed old backup: ${key}`);
          }
        } catch (error) {
          // Remove corrupted backup
          localStorage.removeItem(key);
        }
      }
    }

    console.log('Data cleanup completed');
  } catch (error) {
    console.error('Failed to cleanup old data:', error);
  }
}

/**
 * Get storage statistics
 */
export function getStorageStats(): {
  totalSize: number;
  userCount: number;
  configSize: number;
  backupSize: number;
} {
  let totalSize = 0;
  let userCount = 0;
  let configSize = 0;
  let backupSize = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      const size = value.length;
      totalSize += size;

      if (key.startsWith(STORAGE_KEYS.USER_DATA)) {
        userCount++;
      } else if (key === STORAGE_KEYS.CONFIG) {
        configSize = size;
      } else if (key.startsWith(STORAGE_KEYS.BACKUP)) {
        backupSize += size;
      }
    }
  }

  return {
    totalSize: totalSize / (1024 * 1024), // Convert to MB
    userCount,
    configSize: configSize / 1024, // Convert to KB
    backupSize: backupSize / (1024 * 1024), // Convert to MB
  };
}

// =====================================================
// INITIALIZATION AND DEFAULTS
// =====================================================

/**
 * Create default user data structure
 */
export function createDefaultUserData(telegramUser: TelegramUser): UserData {
  const now = new Date();
  
  return {
    telegramUser,
    preferences: {
      language: telegramUser.language_code || 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: 'UZS',
      theme: 'dark',
      notifications: {
        finance: true,
        workout: true,
        planner: true,
        marketing: false,
      },
      privacy: {
        shareData: false,
        analytics: true,
      },
    },
    financial: {
      accounts: [],
      transactions: [],
      budgets: [],
      categories: [
        'Food & Dining',
        'Transportation',
        'Shopping',
        'Entertainment',
        'Bills & Utilities',
        'Healthcare',
        'Education',
        'Travel',
        'Income',
        'Savings',
      ],
      lastSync: now,
    },
    workout: {
      programs: [],
      sessions: [],
      tracker: {
        weight: [],
        bodyFat: [],
        measurements: {},
        goals: {},
      },
      lastSync: now,
    },
    planner: {
      tasks: [],
      projects: [],
      progress: {
        daily: [],
        weekly: [],
        monthly: [],
      },
      categories: [
        'Work',
        'Personal',
        'Health',
        'Learning',
        'Family',
        'Finance',
        'Travel',
        'Hobbies',
      ],
      lastSync: now,
    },
    subscription: {
      plan: 'free',
      status: 'active',
      startDate: now,
      autoRenew: false,
      paymentMethod: '',
      features: ['basic_planning', 'basic_finance', 'basic_workout'],
    },
    createdAt: now,
    updatedAt: now,
    lastSync: now,
    version: STORAGE_VERSION,
  };
}

// =====================================================
// AUTO-INITIALIZATION
// =====================================================

// Initialize storage when module loads
if (typeof window !== 'undefined') {
  // Setup Telegram integration if available
  if (isTelegramWebApp()) {
    setupTelegramIntegration();
  }

  // Initialize storage system
  initTelegramStorage();

  // Setup periodic cleanup
  setInterval(cleanupOldData, 24 * 60 * 60 * 1000); // Daily cleanup

  // Handle page visibility for sync
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // App became visible, trigger sync if needed
      const telegramUser = getTelegramUserInfo();
      if (telegramUser) {
        const userData = getUserData(telegramUser.id);
        if (userData) {
          // Check if sync is needed (based on last sync time)
          const lastSync = new Date(userData.lastSync);
          const now = new Date();
          const syncInterval = getStorageConfig().syncInterval * 60 * 1000;
          
          if (now.getTime() - lastSync.getTime() > syncInterval) {
            console.log('Triggering background sync...');
            // Trigger sync event
            window.dispatchEvent(new CustomEvent('background-sync-needed', {
              detail: { telegramId: telegramUser.id }
            }));
          }
        }
      }
    }
  });

  console.log('Telegram storage utility loaded successfully');
}