/**
 * Safe localStorage operations with error handling
 */

export const storage = {
  /**
   * Get an item from localStorage
   * @param key The key to retrieve
   * @returns The parsed value or null if not found or error occurs
   */
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    } catch (error) {
      console.error(`Failed to get item from localStorage: ${key}`, error);
      return null;
    }
  },

  /**
   * Set an item in localStorage
   * @param key The key to set
   * @param value The value to store (will be JSON stringified)
   * @returns true if successful, false otherwise
   */
  set<T>(key: string, value: T): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Failed to set item in localStorage: ${key}`, error);
      return false;
    }
  },

  /**
   * Remove an item from localStorage
   * @param key The key to remove
   * @returns true if successful, false otherwise
   */
  remove(key: string): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove item from localStorage: ${key}`, error);
      return false;
    }
  },

  /**
   * Clear all items from localStorage
   * @returns true if successful, false otherwise
   */
  clear(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage', error);
      return false;
    }
  },
};

// Storage keys used in the app
export const STORAGE_KEYS = {
  SESSION: 'autobot_session',
  REPO_SNAPSHOTS: 'autobot_repo_snapshots',
} as const;
