import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useAppDispatch, useAppSelector } from '../index';
import sessionSlice from '@/features/sessions/store/sessionSlice';
import uiSlice from '@/shared/store/uiSlice';
import { api } from '@/store/api';

function createMockStore() {
  return configureStore({
    reducer: {
      session: sessionSlice,
      ui: uiSlice,
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  });
}

describe('Shared Hooks', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
  });

  describe('useAppDispatch', () => {
    it('should return dispatch function', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );

      const { result } = renderHook(() => useAppDispatch(), { wrapper });

      expect(result.current).toBeDefined();
      expect(typeof result.current).toBe('function');
    });

    it('should dispatch actions', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );

      const { result } = renderHook(() => useAppDispatch(), { wrapper });

      // Dispatch a simple action
      const action = { type: 'test/action' };
      result.current(action);

      expect(result.current).toBeDefined();
    });
  });

  describe('useAppSelector', () => {
    it('should select state from store', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );

      const { result } = renderHook(
        () => useAppSelector((state) => state.session),
        { wrapper }
      );

      expect(result.current).toBeDefined();
    });

    it('should return session state', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );

      const { result } = renderHook(
        () => useAppSelector((state) => state.session),
        { wrapper }
      );

      expect(result.current).toBeDefined();
      expect(result.current.currentRepositoryId).toBeNull();
    });

    it('should return ui state', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );

      const { result } = renderHook(() => useAppSelector((state) => state.ui), {
        wrapper,
      });

      expect(result.current).toBeDefined();
      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });
});
