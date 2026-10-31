import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    api.auth
      .me()
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await api.auth.login(email, password);
    if (result.user) setUser(result.user);
    return result;
  }, []);

  const completeMfa = useCallback(async (challengeToken, code) => {
    const result = await api.auth.mfaLogin(challengeToken, code);
    setUser(result.user);
    return result;
  }, []);

  const refresh = useCallback(async () => {
    const user = await api.auth.me();
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore network errors on sign-out
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, completeMfa, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
