// contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_BACKEND_SERVER_URL;

class FetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "FetchError";
  }
}

const fetchAPI = async <T = any,>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; response: Response }> => {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    credentials: "include", // Include cookies in requests
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);

    let data: T;
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = {} as T;
    }

    if (!response.ok) {
      throw new FetchError(
        (data as any)?.message || `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    return { data, response };
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Network error. Please check your connection.");
    }
    throw error;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const { data } = await fetchAPI<{ authenticated: boolean }>(
        "/auth/verify"
      );
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (password: string): Promise<boolean> => {
    try {
      await fetchAPI<{ message: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });

      setIsAuthenticated(true);
      return true;
    } catch (error) {
      setIsAuthenticated(false);

      if (error instanceof FetchError && error.status === 401) {
        // Invalid password
        return false;
      }

      // Re-throw other errors for the component to handle
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetchAPI("/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      // Always set authenticated to false
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, login, logout, checkAuth }}
    >
      {children}
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
