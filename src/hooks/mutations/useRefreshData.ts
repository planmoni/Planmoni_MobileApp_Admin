import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useRefreshData = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queryKeys: string[]) => {
      // Invalidate specific queries
      await Promise.all(
        queryKeys.map(key => queryClient.invalidateQueries({ queryKey: [key] }))
      );
    },
    onSuccess: () => {
      console.log('Data refreshed successfully');
    },
    onError: (error) => {
      console.error('Error refreshing data:', error);
    },
  });
};

export const useRefreshAllData = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Invalidate all queries
      await queryClient.invalidateQueries();
    },
    onSuccess: () => {
      console.log('All data refreshed successfully');
    },
    onError: (error) => {
      console.error('Error refreshing all data:', error);
    },
  });
};