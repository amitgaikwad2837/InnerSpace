import { create } from 'zustand';

interface AuthState {
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  setUser: (userId: string, email: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  isAuthenticated: false,
  setUser: (userId, email) =>
    set({ userId, email, isAuthenticated: true }),
  logout: () =>
    set({ userId: null, email: null, isAuthenticated: false }),
}));
