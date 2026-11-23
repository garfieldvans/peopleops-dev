import { useQueryClient } from "@tanstack/react-query";
import type { CurrentUser, LoginResponse } from "@peopleops/shared-types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest, refreshSession, setAccessToken } from "../../lib/http";
import { userHasPermission } from "../../lib/permissions";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const session = await refreshSession();
      if (cancelled) return;

      if (session) {
        setUser(session.user);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("anonymous");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("anonymous");
      queryClient.clear();
    }
  }, [queryClient]);

  const hasPermission = useCallback(
    (permission: string) => userHasPermission(user, permission),
    [user],
  );

  const value = useMemo(
    () => ({ status, user, login, logout, hasPermission }),
    [status, user, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
