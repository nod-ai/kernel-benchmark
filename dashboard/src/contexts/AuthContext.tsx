import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import PasswordModal from "../components/PasswordModal";

const API_BASE_URL = import.meta.env.VITE_BACKEND_SERVER_URL;
const TOKEN_KEY = "auth_token";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  /** Prompt the user to authenticate. Resolves true on success, false on dismiss. */
  requestAuth: () => Promise<boolean>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const authCallbackRef = useRef<((success: boolean) => void) | null>(null);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
  }, []);

  const requestAuth = useCallback((): Promise<boolean> => {
    if (isAuthenticated || isLoading) return Promise.resolve(isAuthenticated);

    return new Promise((resolve) => {
      authCallbackRef.current = resolve;
      setShowAuthModal(true);
    });
  }, [isAuthenticated, isLoading]);

  const handleAuthSubmit = async (password: string) => {
    const success = await login(password);
    if (success) {
      setShowAuthModal(false);
      authCallbackRef.current?.(true);
      authCallbackRef.current = null;
    } else {
      throw new Error("Invalid password");
    }
  };

  const handleAuthClose = () => {
    setShowAuthModal(false);
    authCallbackRef.current?.(false);
    authCallbackRef.current = null;
  };

  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(TOKEN_KEY);
      setIsAuthenticated(false);
      setShowAuthModal(true);
    };
    window.addEventListener("auth-required", handler);
    return () => window.removeEventListener("auth-required", handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, login, logout, requestAuth, getToken }}
    >
      {children}
      <PasswordModal
        isOpen={showAuthModal}
        onClose={handleAuthClose}
        onSubmit={handleAuthSubmit}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
