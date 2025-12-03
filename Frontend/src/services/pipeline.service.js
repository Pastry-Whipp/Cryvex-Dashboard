import api from './api';

export const pipelineService = {
  getAll: async (params = {}) => {
    const response = await api.get('/pipelines', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/pipelines/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/pipelines', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/pipelines/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/pipelines/${id}`);
    return response.data;
  },

  execute: async (id) => {
    const response = await api.post(`/pipelines/${id}/execute`);
    return response.data;
  },

  getExecutions: async (id, params = {}) => {
    const response = await api.get(`/pipelines/${id}/executions`, { params });
    return response.data;
  },
};
