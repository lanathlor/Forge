import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage, STORAGE_KEYS } from '../localStorage';

describe('localStorage utility', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return null when key does not exist', () => {
      const result = storage.get('nonexistent-key');
      expect(result).toBeNull();
    });

    it('should return parsed value when key exists', () => {
      const testData = { foo: 'bar', baz: 123 };
      localStorage.setItem('test-key', JSON.stringify(testData));

      const result = storage.get<typeof testData>('test-key');
      expect(result).toEqual(testData);
    });

    it('should handle primitive values', () => {
      localStorage.setItem('string-key', JSON.stringify('hello'));
      localStorage.setItem('number-key', JSON.stringify(42));
      localStorage.setItem('boolean-key', JSON.stringify(true));

      expect(storage.get<string>('string-key')).toBe('hello');
      expect(storage.get<number>('number-key')).toBe(42);
      expect(storage.get<boolean>('boolean-key')).toBe(true);
    });

    it('should return null on JSON parse error', () => {
      localStorage.setItem('invalid-json', 'not valid json {');
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = storage.get('invalid-json');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('set', () => {
    it('should store value in localStorage', () => {
      const testData = { foo: 'bar', baz: 123 };
      const result = storage.set('test-key', testData);

      expect(result).toBe(true);
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify(testData));
    });

    it('should handle primitive values', () => {
      storage.set('string-key', 'hello');
      storage.set('number-key', 42);
      storage.set('boolean-key', true);

      expect(localStorage.getItem('string-key')).toBe(JSON.stringify('hello'));
      expect(localStorage.getItem('number-key')).toBe(JSON.stringify(42));
      expect(localStorage.getItem('boolean-key')).toBe(JSON.stringify(true));
    });

    it('should overwrite existing value', () => {
      storage.set('test-key', 'old-value');
      storage.set('test-key', 'new-value');

      expect(storage.get('test-key')).toBe('new-value');
    });

    it('should handle JSON stringify errors gracefully', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      // Create circular reference
      const circular: { self?: unknown } = {};
      circular.self = circular;

      const result = storage.set('circular', circular);
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('remove', () => {
    it('should remove item from localStorage', () => {
      localStorage.setItem('test-key', 'test-value');
      expect(localStorage.getItem('test-key')).toBe('test-value');

      const result = storage.remove('test-key');
      expect(result).toBe(true);
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    it('should return true even if key does not exist', () => {
      const result = storage.remove('nonexistent-key');
      expect(result).toBe(true);
    });

    it('should return true for successful removal', () => {
      localStorage.setItem('test-key2', 'test-value');
      const result = storage.remove('test-key2');
      expect(result).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all items from localStorage', () => {
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');
      localStorage.setItem('key3', 'value3');

      expect(localStorage.length).toBe(3);

      const result = storage.clear();
      expect(result).toBe(true);
      expect(localStorage.length).toBe(0);
    });

    it('should return true for successful clear', () => {
      localStorage.setItem('key-to-clear', 'value');
      const result = storage.clear();
      expect(result).toBe(true);
    });
  });

  describe('STORAGE_KEYS', () => {
    it('should have SESSION key defined', () => {
      expect(STORAGE_KEYS.SESSION).toBe('autobot_session');
    });

    it('should be defined as const', () => {
      // TypeScript enforces immutability at compile time
      // At runtime, const objects can be mutated, but TypeScript prevents it
      expect(STORAGE_KEYS).toBeDefined();
      expect(Object.isFrozen(STORAGE_KEYS)).toBe(false); // const doesn't freeze objects
    });
  });

  describe('SSR handling', () => {
    it('get should return null when window is undefined', () => {
      const originalWindow = globalThis.window;
      delete (globalThis as { window?: typeof window }).window;

      const result = storage.get('test-key');
      expect(result).toBeNull();

      // Restore window
      (globalThis as { window?: typeof window }).window = originalWindow;
    });

    it('set should return false when window is undefined', () => {
      const originalWindow = globalThis.window;
      delete (globalThis as { window?: typeof window }).window;

      const result = storage.set('test-key', 'test-value');
      expect(result).toBe(false);

      // Restore window
      (globalThis as { window?: typeof window }).window = originalWindow;
    });

    it('remove should return false when window is undefined', () => {
      const originalWindow = globalThis.window;
      delete (globalThis as { window?: typeof window }).window;

      const result = storage.remove('test-key');
      expect(result).toBe(false);

      // Restore window
      (globalThis as { window?: typeof window }).window = originalWindow;
    });

    it('clear should return false when window is undefined', () => {
      const originalWindow = globalThis.window;
      delete (globalThis as { window?: typeof window }).window;

      const result = storage.clear();
      expect(result).toBe(false);

      // Restore window
      (globalThis as { window?: typeof window }).window = originalWindow;
    });
  });

  describe('localStorage errors', () => {
    it('remove should return false when localStorage.removeItem throws', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const removeItemSpy = vi
        .spyOn(localStorage, 'removeItem')
        .mockImplementation(() => {
          throw new Error('Storage error');
        });

      const result = storage.remove('test-key');
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      removeItemSpy.mockRestore();
    });

    it('clear should return false when localStorage.clear throws', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const clearSpy = vi
        .spyOn(localStorage, 'clear')
        .mockImplementation(() => {
          throw new Error('Storage error');
        });

      const result = storage.clear();
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      clearSpy.mockRestore();
    });
  });
});
