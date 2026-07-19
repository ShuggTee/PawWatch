import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type AuthUser,
  login as apiLogin,
  signup as apiSignup,
  logout as apiLogout,
  fetchMe,
  getSavedUser,
  getSavedToken,
} from "../data/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    role: "owner" | "sitter",
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getSavedUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getSavedToken();
    if (token) {
      fetchMe()
        .then(setUser)
        .catch(() => {
          apiLogout();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    setUser(result.user);
  }, []);

  const signup = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      role: "owner" | "sitter",
    ) => {
      const result = await apiSignup(email, password, name, role);
      setUser(result.user);
    },
    [],
  );

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
