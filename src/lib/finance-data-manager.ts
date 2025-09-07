interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  balance: number;
  currency: string;
  isConnected: boolean;
}

interface FinanceData {
  accounts: Account[];
  currency: string;
  setupComplete: boolean;
}

class FinanceDataManager {
  private static readonly STORAGE_KEY = 'finance_data';
  private static readonly CURRENCY_KEY = 'finance_currency';
  private static readonly SETUP_KEY = 'finance_setup_complete';

  /**
   * Check if running in browser environment
   */
  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * Safe localStorage getter with error handling
   */
  private static getStorageItem(key: string): string | null {
    if (!this.isBrowser()) {
      return null;
    }

    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to get localStorage item "${key}":`, error);
      return null;
    }
  }

  /**
   * Safe localStorage setter with error handling
   */
  private static setStorageItem(key: string, value: string): boolean {
    if (!this.isBrowser()) {
      return false;
    }

    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Failed to set localStorage item "${key}":`, error);
      return false;
    }
  }

  /**
   * Get complete finance data from localStorage
   */
  private static getFinanceData(): FinanceData {
    const defaultData: FinanceData = {
      accounts: [],
      currency: 'USD',
      setupComplete: false
    };

    const stored = this.getStorageItem(this.STORAGE_KEY);
    if (!stored) {
      return defaultData;
    }

    try {
      const parsed = JSON.parse(stored);
      return {
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        currency: typeof parsed.currency === 'string' ? parsed.currency : 'USD',
        setupComplete: Boolean(parsed.setupComplete)
      };
    } catch (error) {
      console.error('Failed to parse finance data:', error);
      return defaultData;
    }
  }

  /**
   * Save complete finance data to localStorage
   */
  private static setFinanceData(data: FinanceData): boolean {
    try {
      return this.setStorageItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to serialize finance data:', error);
      return false;
    }
  }

  /**
   * Check if finance onboarding setup is complete
   */
  static isSetupComplete(): boolean {
    // Check both new unified storage and legacy setup key
    const data = this.getFinanceData();
    if (data.setupComplete) {
      return true;
    }

    // Check legacy storage key for backwards compatibility
    const legacySetup = this.getStorageItem(this.SETUP_KEY);
    return legacySetup === 'true';
  }

  /**
   * Mark finance setup as completed
   */
  static markSetupComplete(): boolean {
    const data = this.getFinanceData();
    data.setupComplete = true;
    
    const success = this.setFinanceData(data);
    
    // Also set legacy key for backwards compatibility
    if (success) {
      this.setStorageItem(this.SETUP_KEY, 'true');
    }
    
    return success;
  }

  /**
   * Add a new account to storage
   */
  static addAccount(account: Account): boolean {
    if (!account || !account.id || !account.name) {
      console.error('Invalid account data provided');
      return false;
    }

    const data = this.getFinanceData();
    
    // Check if account with same ID already exists
    const existingIndex = data.accounts.findIndex(acc => acc.id === account.id);
    
    if (existingIndex >= 0) {
      // Update existing account
      data.accounts[existingIndex] = { ...account };
    } else {
      // Add new account
      data.accounts.push({ ...account });
    }

    return this.setFinanceData(data);
  }

  /**
   * Get all accounts from storage
   */
  static getAccounts(): Account[] {
    const data = this.getFinanceData();
    return data.accounts.map(account => ({ ...account })); // Return deep copies
  }

  /**
   * Get a specific account by ID
   */
  static getAccount(id: string): Account | null {
    const accounts = this.getAccounts();
    return accounts.find(account => account.id === id) || null;
  }

  /**
   * Remove an account by ID
   */
  static removeAccount(id: string): boolean {
    const data = this.getFinanceData();
    const initialLength = data.accounts.length;
    
    data.accounts = data.accounts.filter(account => account.id !== id);
    
    if (data.accounts.length === initialLength) {
      console.warn(`Account with ID "${id}" not found`);
      return false;
    }

    return this.setFinanceData(data);
  }

  /**
   * Update an existing account
   */
  static updateAccount(id: string, updates: Partial<Account>): boolean {
    const data = this.getFinanceData();
    const accountIndex = data.accounts.findIndex(acc => acc.id === id);
    
    if (accountIndex === -1) {
      console.error(`Account with ID "${id}" not found`);
      return false;
    }

    data.accounts[accountIndex] = {
      ...data.accounts[accountIndex],
      ...updates,
      id // Ensure ID cannot be overwritten
    };

    return this.setFinanceData(data);
  }

  /**
   * Get saved currency preference
   */
  static getCurrency(): string {
    const data = this.getFinanceData();
    if (data.currency) {
      return data.currency;
    }

    // Check legacy currency storage for backwards compatibility
    const legacyCurrency = this.getStorageItem(this.CURRENCY_KEY);
    return legacyCurrency || 'USD';
  }

  /**
   * Save currency preference
   */
  static setCurrency(currency: string): boolean {
    if (!currency || typeof currency !== 'string') {
      console.error('Invalid currency provided');
      return false;
    }

    const data = this.getFinanceData();
    data.currency = currency.toUpperCase();
    
    const success = this.setFinanceData(data);
    
    // Also set legacy key for backwards compatibility
    if (success) {
      this.setStorageItem(this.CURRENCY_KEY, currency.toUpperCase());
    }
    
    return success;
  }

  /**
   * Get total balance across all accounts
   */
  static getTotalBalance(): number {
    const accounts = this.getAccounts();
    return accounts.reduce((total, account) => {
      // Convert to base currency if needed (simplified - assumes same currency for now)
      return total + (account.balance || 0);
    }, 0);
  }

  /**
   * Get accounts grouped by type
   */
  static getAccountsByType(): Record<string, Account[]> {
    const accounts = this.getAccounts();
    const grouped: Record<string, Account[]> = {};

    accounts.forEach(account => {
      const type = account.type || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(account);
    });

    return grouped;
  }

  /**
   * Clear all finance data (useful for testing or reset)
   */
  static clearAllData(): boolean {
    if (!this.isBrowser()) {
      return false;
    }

    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.CURRENCY_KEY);
      localStorage.removeItem(this.SETUP_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear finance data:', error);
      return false;
    }
  }

  /**
   * Export all finance data as JSON string
   */
  static exportData(): string {
    const data = this.getFinanceData();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import finance data from JSON string
   */
  static importData(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      
      // Validate imported data structure
      if (!imported || typeof imported !== 'object') {
        throw new Error('Invalid data format');
      }

      const data: FinanceData = {
        accounts: Array.isArray(imported.accounts) ? imported.accounts : [],
        currency: typeof imported.currency === 'string' ? imported.currency : 'USD',
        setupComplete: Boolean(imported.setupComplete)
      };

      return this.setFinanceData(data);
    } catch (error) {
      console.error('Failed to import finance data:', error);
      return false;
    }
  }

  /**
   * Get summary statistics
   */
  static getSummary() {
    const accounts = this.getAccounts();
    const totalBalance = this.getTotalBalance();
    const currency = this.getCurrency();
    const setupComplete = this.isSetupComplete();

    return {
      totalAccounts: accounts.length,
      totalBalance,
      currency,
      setupComplete,
      accountTypes: this.getAccountsByType(),
      connectedAccounts: accounts.filter(acc => acc.isConnected).length,
      lastUpdated: new Date().toISOString()
    };
  }
}

export { FinanceDataManager };
export type { Account };