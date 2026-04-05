import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { createAppQueryClient } from '../query-client';
import { AppRouterProvider, createAppRouter } from '../router';

export function AppProviders() {
  const [queryClient] = useState(createAppQueryClient);
  const [router] = useState(() => createAppRouter(queryClient));

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouterProvider router={router} />
    </QueryClientProvider>
  );
}
