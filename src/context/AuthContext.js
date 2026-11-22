import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { loginApi, logoutApi, setAuthTokens, setTokenUpdateHandler, signupApi } from '../services/api';
import { clearSession, getSession, initOfflineStorage, saveSession } from '../services/offlineStorage';

const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [persistSession, setPersistSession] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        await initOfflineStorage();
        const session = await getSession();

        if (isMounted && session) {
          setUser(session.user);
          setToken(session.token);
          setRefreshToken(session.refreshToken);
          setAuthTokens({ token: session.token, refreshToken: session.refreshToken });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setTokenUpdateHandler(async (tokens) => {
      if (!tokens) {
        setAuthTokens(null);
        await clearSession();
        setUser(null);
        setToken(null);
        setRefreshToken(null);
        return;
      }

      setToken(tokens.token);
      setRefreshToken(tokens.refreshToken);
      if (user) {
        await saveSession({ user, token: tokens.token, refreshToken: tokens.refreshToken }, persistSession);
      }
    });
    return () => setTokenUpdateHandler(null);
  }, [persistSession, user]);

  const signIn = useCallback(async ({ identifier, email, password, rememberMe = true }) => {
    const response = await loginApi({ identifier, email, password });
    const userData = response.data?.user;
    const authToken = response.data?.token;
    const authRefreshToken = response.data?.refreshToken;
    if (!userData || !authToken || !authRefreshToken) {
      throw new Error('The authentication service returned an incomplete response.');
    }

    await saveSession({ user: userData, token: authToken, refreshToken: authRefreshToken }, rememberMe);
    setAuthTokens({ token: authToken, refreshToken: authRefreshToken });
    setPersistSession(rememberMe);
    setUser(userData);
    setToken(authToken);
    setRefreshToken(authRefreshToken);
    return userData;
  }, []);

  const signUp = useCallback(async ({ name, identifier, email, password, termsAccepted }) => {
    const response = await signupApi({ name, identifier, email, password, termsAccepted });
    const userData = response.data?.user;
    const authToken = response.data?.token;
    const authRefreshToken = response.data?.refreshToken;
    if (!userData || !authToken || !authRefreshToken) {
      throw new Error('The authentication service returned an incomplete response.');
    }

    await saveSession({ user: userData, token: authToken, refreshToken: authRefreshToken });
    setAuthTokens({ token: authToken, refreshToken: authRefreshToken });
    setPersistSession(true);
    setUser(userData);
    setToken(authToken);
    setRefreshToken(authRefreshToken);
    return userData;
  }, []);

  const signOut = useCallback(async () => {
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch (error) {
        console.warn('Server logout failed; clearing the local session:', error.message);
      }
    }
    setAuthTokens(null);
    await clearSession();
    setUser(null);
    setToken(null);
    setRefreshToken(null);
  }, [refreshToken]);

  const value = useMemo(
    () => ({ user, token, loading, signIn, signUp, signOut }),
    [loading, signIn, signOut, signUp, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
