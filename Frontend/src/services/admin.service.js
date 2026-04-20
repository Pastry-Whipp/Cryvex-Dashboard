import api from './api';

export const adminService = {
  bootstrapAdmin: () => api.post('/admin/bootstrap'),

  listUsers: (params = {}) => api.get('/admin/users', { params }).then(r => r.data),

  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data).then(r => r.data),

  deleteUser: (id) => api.delete(`/admin/users/${id}`).then(r => r.data),
};
