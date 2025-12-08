import api from './api';

export const auditLogService = {
    /**
     * Get all audit logs with optional filtering
     * @param {Object} params - Query parameters
     * @param {string} params.actionType - Filter by action type
     * @param {string} params.entityType - Filter by entity type
     * @param {number} params.entityId - Filter by entity ID
     * @param {number} params.userId - Filter by user ID
     * @param {number} params.limit - Maximum number of results
     * @param {number} params.offset - Offset for pagination
     */
    getAuditLogs: async (params = {}) => {
        const response = await api.get('/audit-logs', {
            params: {
                action_type: params.actionType || null,
                entity_type: params.entityType || null,
                entity_id: params.entityId || null,
                user_id: params.userId || null,
                limit: params.limit || 50,
                offset: params.offset || 0
            }
        });
        return response.data;
    },

    /**
     * Get a specific audit log by ID
     * @param {number} logId - The audit log ID
     */
    getAuditLog: async (logId) => {
        const response = await api.get(`/audit-logs/${logId}`);
        return response.data;
    },

    /**
     * Get all audit logs for a specific entity
     * @param {string} entityType - Type of entity (pipeline_config, pipeline_execution)
     * @param {number} entityId - ID of the entity
     * @param {number} limit - Maximum number of results
     */
    getEntityLogs: async (entityType, entityId, limit = 50) => {
        const response = await api.get(`/audit-logs/entity/${entityType}/${entityId}`, {
            params: { limit }
        });
        return response.data;
    },

    /**
     * Get human-readable action label
     * @param {string} actionType - Action type
     */
    getActionLabel: (actionType) => {
        const labels = {
            create: 'Created',
            update: 'Updated',
            delete: 'Deleted',
            execute: 'Executed',
            status_change: 'Status Changed'
        };
        return labels[actionType] || actionType;
    },

    /**
     * Get human-readable entity label
     * @param {string} entityType - Entity type
     */
    getEntityLabel: (entityType) => {
        const labels = {
            pipeline_config: 'Pipeline Config',
            pipeline_execution: 'Pipeline Execution'
        };
        return labels[entityType] || entityType;
    },

    /**
     * Get action icon class/name
     * @param {string} actionType - Action type
     */
    getActionIcon: (actionType) => {
        const icons = {
            create: 'plus-circle',
            update: 'edit',
            delete: 'trash-2',
            execute: 'play-circle',
            status_change: 'activity'
        };
        return icons[actionType] || 'file-text';
    },

    /**
     * Get action color variant
     * @param {string} actionType - Action type
     */
    getActionColor: (actionType) => {
        const colors = {
            create: '#10b981', // green
            update: '#3b82f6', // blue
            delete: '#ef4444', // red
            execute: '#8b5cf6', // purple
            status_change: '#f59e0b' // amber
        };
        return colors[actionType] || '#6b7280'; // gray
    }
};

export default auditLogService;
