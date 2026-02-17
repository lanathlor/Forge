import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';

// Import feature APIs to ensure endpoints are registered
import '@/features/repositories/store/repositoriesApi';
import '@/features/dashboard/store/tasksApi';

// Import slices
import sessionReducer from '@/features/sessions/store/sessionSlice';
import uiReducer from '@/shared/store/uiSlice';
import repoSnapshotReducer from '@/features/sessions/store/repoSnapshotSlice';
import settingsReducer from '@/features/settings/store/settingsSlice';
import dashboardUiReducer from '@/features/dashboard/store/dashboardUiSlice';
import optimisticUpdatesReducer from '@/shared/store/optimisticUpdatesSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    session: sessionReducer,
    ui: uiReducer,
    repoSnapshot: repoSnapshotReducer,
    settings: settingsReducer,
    dashboardUi: dashboardUiReducer,
    optimisticUpdates: optimisticUpdatesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
