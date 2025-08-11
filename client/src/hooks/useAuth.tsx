import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setupNeeded: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Check if setup is needed
  const { data: setupCheck, isLoading: setupLoading } = useQuery<{ needed: boolean }>({
    queryKey: ["/api/setup/needed"],
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Get current user - try to get user when not in setup mode
  const { data: user, isLoading: userLoading, error: userError } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
    enabled: !setupLoading && setupCheck !== undefined,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (setupCheck !== undefined) {
      setSetupNeeded(setupCheck.needed);
    }
  }, [setupCheck]);

  useEffect(() => {
    // Mark auth as initialized once we've attempted to get the user or confirmed setup is needed
    if ((user !== undefined || userError !== null || setupCheck?.needed) && !authInitialized) {
      setAuthInitialized(true);
    }
  }, [user, userError, setupCheck, authInitialized]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await apiRequest("/api/auth/login", "POST", { email, password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.href = "/dashboard";
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/auth/logout", "POST");
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const loading = setupLoading || (userLoading && !authInitialized) || loginMutation.isPending || logoutMutation.isPending;

  return (
    <AuthContext.Provider value={{
      user: user || null,
      loading,
      setupNeeded,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
