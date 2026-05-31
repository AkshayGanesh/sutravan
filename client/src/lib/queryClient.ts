import { QueryClient } from "@tanstack/react-query";

// Supabase-direct: each query supplies its own queryFn (no default Express path).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
