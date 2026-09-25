"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useRole } from "@/lib/role";

function RoleSync({ client }: { client: QueryClient }) {
  const role = useRole();
  useEffect(() => {
    // Permissions changed: refetch everything with the new role header.
    client.invalidateQueries();
  }, [role, client]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <RoleSync client={client} />
      {children}
    </QueryClientProvider>
  );
}
