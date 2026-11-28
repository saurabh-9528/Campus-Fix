import { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await apiClient.get('/auth/me');
          setUser(userData);
        } catch (error) {
          console.error("Failed to fetch user", error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleUnauthorized = () => {
      localStorage.removeItem('token');
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    // Backend expects JSON with email and password
    const data = await apiClient.post('/auth/login', { email, password });
    localStorage.setItem('token', data.access_token);

    // Fetch user details and preserve must_change_password from login response
    const userData = await apiClient.get('/auth/me');
    const mergedUser = {
      ...userData,
      must_change_password: Boolean(data.must_change_password ?? userData.must_change_password),
    };
    setUser(mergedUser);
    return mergedUser;
  };

  const updateProfile = async (profileData) => {
    const updatedUser = await apiClient.patch('/auth/me', profileData);
    setUser(updatedUser);
    return updatedUser;
  };

  const changePassword = async (passwordData) => {
    const res = await apiClient.post('/auth/change-password', passwordData);
    const refreshedUser = await apiClient.get('/auth/me');
    setUser(refreshedUser);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
