import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { storage, STORAGE_KEYS } from '@/shared/lib/localStorage';

interface SessionState {
  currentSessionId: string | null;
  currentRepositoryId: string | null;
  isSidebarCollapsed: boolean;
}

// Load persisted state from localStorage
const loadPersistedState = (): SessionState => {
  const defaultState: SessionState = {
    currentSessionId: null,
    currentRepositoryId: null,
    isSidebarCollapsed: false,
  };

  const persisted = storage.get<SessionState>(STORAGE_KEYS.SESSION);
  if (persisted) {
    return {
      currentSessionId: persisted.currentSessionId || null,
      currentRepositoryId: persisted.currentRepositoryId || null,
      isSidebarCollapsed: persisted.isSidebarCollapsed || false,
    };
  }

  return defaultState;
};

const initialState: SessionState = loadPersistedState();

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
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
  setCurrentSession,
  setCurrentRepository,
  setSidebarCollapsed,
  clearSession
} = sessionSlice.actions;
export default sessionSlice.reducer;
