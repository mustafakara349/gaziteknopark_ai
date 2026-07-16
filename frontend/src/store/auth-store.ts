import { create } from 'zustand';

interface AuthState {
  token: string | null;
  role: string | null;
  userId: string | null;
  fullName: string | null;
  isAuthenticated: boolean;
  login: (token: string, role: string, userId: string, fullName: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  role: localStorage.getItem('user_role'),
  userId: localStorage.getItem('user_id'),
  fullName: localStorage.getItem('user_fullname'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  
  login: (token, role, userId, fullName) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user_role', role);
    localStorage.setItem('user_id', userId);
    localStorage.setItem('user_fullname', fullName);
    set({ token, role, userId, fullName, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_fullname');
    set({ token: null, role: null, userId: null, fullName: null, isAuthenticated: false });
  },
}));
