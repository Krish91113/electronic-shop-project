import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  auth as authApi,
  setActiveShop,
  setUnauthorizedHandler,
  setAuthToken,
  type User,
  type Shop,
} from "./api";

export type { User, Shop };

interface AuthState {
  user: User | null;
  activeShop: Pick<Shop, "id" | "name" | "slug" | "code"> | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchShop: (shopId: string) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SHOP_KEY = "time_centre_active_shop_id";

function getStoredShop(): string | null {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(SHOP_KEY);
    }
  } catch {
    // fallback
  }
  return null;
}

function setStoredShop(shopId: string | null) {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (shopId) {
        window.sessionStorage.setItem(SHOP_KEY, shopId);
      } else {
        window.sessionStorage.removeItem(SHOP_KEY);
      }
    }
  } catch {
    // fallback
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [activeShop, setActiveShopState] = useState<Pick<
    Shop,
    "id" | "name" | "slug" | "code"
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolveShop = useCallback((u: User, preferredId?: string | null) => {
    const preferred = preferredId ?? getStoredShop();
    const shop = preferred ? (u.shops.find((s) => s.id === preferred) ?? u.shops[0]) : u.shops[0];
    if (shop) {
      setActiveShopState(shop);
      setActiveShop(shop.id);
      setStoredShop(shop.id);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      resolveShop(me);
    } catch {
      setUser(null);
      setActiveShopState(null);
      setActiveShop(null);
    } finally {
      setIsLoading(false);
    }
  }, [resolveShop]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Any 401 from the API clears the local session so protected UI redirects to login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      setUser(null);
      setActiveShopState(null);
      setActiveShop(null);
      setStoredShop(null);
      queryClient.clear();
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const me = await authApi.login(email, password);
      if (me.token) {
        setAuthToken(me.token);
      }
      queryClient.clear();
      setUser(me);
      resolveShop(me);
    },
    [resolveShop, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAuthToken(null);
      setUser(null);
      setActiveShopState(null);
      setActiveShop(null);
      setStoredShop(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const switchShop = useCallback(
    (shopId: string) => {
      if (!user) return;
      const shop = user.shops.find((s) => s.id === shopId);
      if (shop) {
        setActiveShopState(shop);
        setActiveShop(shop.id);
        setStoredShop(shop.id);
        // Drop all cached data so the next render fetches for the new shop.
        queryClient.clear();
      }
    },
    [user, queryClient],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        activeShop,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        switchShop,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
