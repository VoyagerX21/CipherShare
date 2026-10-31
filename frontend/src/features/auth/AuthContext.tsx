import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserPublicKey } from '../../types';
import { api } from '../../lib/api/client';
import { hasLocalKeyBlob, unlockPrivateKey, lockPrivateKey, getUnlockedPrivateKey } from '../../lib/crypto/keyStore';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  publicKey: UserPublicKey | null;
  hasLocalKey: boolean;
  isKeyUnlocked: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshKeyStatus: () => Promise<void>;
  unlockKey: (passphrase: string) => Promise<void>;
  lockKey: () => void;
  unlockedKey: CryptoKey | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('ciphershare_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [publicKey, setPublicKey] = useState<UserPublicKey | null>(null);
  const [hasLocalKey, setHasLocalKey] = useState<boolean>(false);
  const [isKeyUnlocked, setIsKeyUnlocked] = useState<boolean>(false);

  const refreshKeyStatus = useCallback(async () => {
    if (!user) {
      setHasLocalKey(false);
      setIsKeyUnlocked(false);
      setPublicKey(null);
      return;
    }
    try {
      // Check server registered public key
      const keyRes = await api.keys.me();
      setPublicKey(keyRes.key);

      // Check IndexedDB local encrypted private key
      const exists = await hasLocalKeyBlob(user.id);
      setHasLocalKey(exists);

      const cachedKey = getUnlockedPrivateKey(user.id);
      setIsKeyUnlocked(!!cachedKey);
    } catch (err) {
      console.error('Failed to refresh key status', err);
    }
  }, [user]);

  const initAuth = useCallback(async () => {
    const savedToken = localStorage.getItem('ciphershare_token');
    if (!savedToken) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.auth.me();
      setUser(res.user);
    } catch (err) {
      console.warn('Session expired or invalid', err);
      localStorage.removeItem('ciphershare_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (user) {
      refreshKeyStatus();
    }
  }, [user, refreshKeyStatus]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.auth.login({ email, password });
    localStorage.setItem('ciphershare_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    const res = await api.auth.register({ name, email, password });
    localStorage.setItem('ciphershare_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    localStorage.removeItem('ciphershare_token');
    lockPrivateKey();
    setToken(null);
    setUser(null);
    setPublicKey(null);
    setHasLocalKey(false);
    setIsKeyUnlocked(false);
  };

  const handleUnlockKey = async (passphrase: string) => {
    if (!user) throw new Error('Not logged in');
    await unlockPrivateKey(user.id, passphrase);
    setIsKeyUnlocked(true);
  };

  const handleLockKey = () => {
    lockPrivateKey();
    setIsKeyUnlocked(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        publicKey,
        hasLocalKey,
        isKeyUnlocked,
        login,
        register,
        logout,
        refreshKeyStatus,
        unlockKey: handleUnlockKey,
        lockKey: handleLockKey,
        unlockedKey: user ? getUnlockedPrivateKey(user.id) : null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
