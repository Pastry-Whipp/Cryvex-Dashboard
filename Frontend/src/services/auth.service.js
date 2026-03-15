import api from './api';

export const authService = {
  login: async (username, password) => {
    // Backend expects form-data with `username` & `password` at /auth/login
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  register: async (userData) => {
    // Backend signup endpoint is /auth/signup and expects:
    // { email, username, full_name, password }
    const response = await api.post('/auth/signup', userData);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  refreshToken: async (refreshToken) => {
    const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token, password) => {
    const response = await api.post('/auth/reset-password', { token, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await api.put('/users/me', data);
    return response.data;
  },

  getUserByUsername: async (username) => {
    const response = await api.get(`/users/${username}`);
    return response.data;
  },
};
