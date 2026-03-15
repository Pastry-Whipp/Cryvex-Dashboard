import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/auth.service';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const userData = await authService.getCurrentUser();
        setUser(userData.data);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.clear();
        setIsAuthenticated(false);
      }
    }
    setLoading(false);
  };

  const login = async (username, password) => {
    try {
      const data = await authService.login(username, password);
      localStorage.setItem('accessToken', data.access_token || data.data?.access_token);
      // If backend later adds refresh tokens, we can store them here
      if (data.refresh_token || data.data?.refresh_token) {
        localStorage.setItem('refreshToken', data.refresh_token || data.data?.refresh_token);
      }
      // Current backend only returns access token; fetch user profile via /users/me
      const userData = await authService.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.response?.data?.error?.message || 'Login failed' 
      };
    }
  };

  const register = async (userData) => {
    try {
      // Step 1: Create the account
      await authService.register(userData);

      // Step 2: Auto-login with the new credentials
      const loginData = await authService.login(userData.username, userData.password);
      localStorage.setItem('accessToken', loginData.access_token || loginData.data?.access_token);
      if (loginData.refresh_token || loginData.data?.refresh_token) {
        localStorage.setItem('refreshToken', loginData.refresh_token || loginData.data?.refresh_token);
      }

      // Step 3: Fetch user profile
      const userProfile = await authService.getCurrentUser();
      setUser(userProfile);
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.response?.data?.error?.message || 'Registration failed'
      };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.clear();
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
