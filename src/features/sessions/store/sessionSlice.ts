import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { storage, STORAGE_KEYS } from '@/shared/lib/localStorage';

interface SessionState {
  currentSessionId: string | null;
  currentRepositoryId: string | null;
  isSidebarCollapsed: boolean;
  isHydrated: boolean;
}

// Always use default state for initialization to avoid hydration mismatch
// Persisted state will be loaded via the hydrateFromStorage action after mount
const initialState: SessionState = {
  currentSessionId: null,
  currentRepositoryId: null,
  isSidebarCollapsed: false,
  isHydrated: false,
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    hydrateFromStorage: (state) => {
      // Load persisted state from localStorage (client-side only)
      const persisted = storage.get<Partial<SessionState>>(STORAGE_KEYS.SESSION);
      if (persisted) {
        state.currentSessionId = persisted.currentSessionId ?? state.currentSessionId;
        state.currentRepositoryId = persisted.currentRepositoryId ?? state.currentRepositoryId;
        state.isSidebarCollapsed = persisted.isSidebarCollapsed ?? state.isSidebarCollapsed;
      }
      state.isHydrated = true;
    },
    setCurrentSession: (state, action: PayloadAction<string | null>) => {
      state.currentSessionId = action.payload;
    },
    setCurrentRepository: (state, action: PayloadAction<string | null>) => {
      state.currentRepositoryId = action.payload;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.isSidebarCollapsed = action.payload;
    },
    clearSession: (state) => {
      state.currentSessionId = null;
      state.currentRepositoryId = null;
    },
  },
});

export const {
  hydrateFromStorage,
  setCurrentSession,
  setCurrentRepository,
  setSidebarCollapsed,
  clearSession
} = sessionSlice.actions;
export default sessionSlice.reducer;
