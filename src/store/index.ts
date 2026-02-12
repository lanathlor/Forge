import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';

// Import feature APIs to ensure endpoints are registered
import '@/features/repositories/store/repositoriesApi';

// Import slices
import sessionReducer from '@/features/sessions/store/sessionSlice';
import uiReducer from '@/shared/store/uiSlice';
import repoSnapshotReducer from '@/features/sessions/store/repoSnapshotSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    session: sessionReducer,
    ui: uiReducer,
    repoSnapshot: repoSnapshotReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
