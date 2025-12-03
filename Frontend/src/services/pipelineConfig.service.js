import api from './api';

export const pipelineConfigService = {
  getAll: async () => {
    const response = await api.get('/pipeline-configs');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/pipeline-configs/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/pipeline-configs', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/pipeline-configs/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    await api.delete(`/pipeline-configs/${id}`);
  },
};

