import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    enabled: boolean;
    email: boolean;
    browser: boolean;
  };
  editor: {
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
  };
  autoSave: boolean;
  debugMode: boolean;
}

const initialState: SettingsState = {
  theme: 'system',
  language: 'en',
  notifications: {
    enabled: true,
    email: true,
    browser: true,
  },
  editor: {
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    minimap: true,
  },
  autoSave: true,
  debugMode: false,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    updateNotifications: (
      state,
      action: PayloadAction<Partial<SettingsState['notifications']>>
    ) => {
      state.notifications = { ...state.notifications, ...action.payload };
    },
    updateEditor: (
      state,
      action: PayloadAction<Partial<SettingsState['editor']>>
    ) => {
      state.editor = { ...state.editor, ...action.payload };
    },
    setAutoSave: (state, action: PayloadAction<boolean>) => {
      state.autoSave = action.payload;
    },
    setDebugMode: (state, action: PayloadAction<boolean>) => {
      state.debugMode = action.payload;
    },
    resetSettings: () => {
      return initialState;
    },
  },
});

export const {
  setTheme,
  setLanguage,
  updateNotifications,
  updateEditor,
  setAutoSave,
  setDebugMode,
  resetSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
