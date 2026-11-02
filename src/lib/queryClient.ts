import { MutationCache, QueryClient } from '@tanstack/react-query';
import { logAdminAction } from './adminActivity';

export const queryClient = new QueryClient({
  // Every mutation that declares `meta: { activity: '...' }` is recorded in the Super Admin team feed once it succeeds.
  mutationCache: new MutationCache({
    onSuccess: (_data, variables, _context, mutation) => {
      const label = mutation.meta?.activity;
      if (label) void logAdminAction(label, typeof variables === 'string' ? { id: variables } : variables);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
