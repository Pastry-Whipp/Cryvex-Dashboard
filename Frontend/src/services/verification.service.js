import api from './api';

class VerificationService {
    /**
     * Trigger verification for a pipeline configuration
     */
    async triggerVerification(configId) {
        const response = await api.post(`/verification/${configId}/verify`);
        return response.data;
    }

    /**
     * Get verification results for an execution
     */
    async getVerificationResults(executionId, syncStatus = true) {
        const response = await api.get(`/verification/${executionId}/results`, {
            params: { sync_status: syncStatus }
        });
        return response.data;
    }

    /**
     * Poll for verification status updates
     */
    pollVerificationStatus(executionId, callback, interval = 3000) {
        let isStopped = false;
        let timeoutId = null;

        const poll = async () => {
            if (isStopped) return;

            try {
                const data = await this.getVerificationResults(executionId, true);

                // Call the callback with the data
                callback(data, null);

                // Continue polling if status is queued or running
                if (data.status === 'queued' || data.status === 'running') {
                    timeoutId = setTimeout(poll, interval);
                } else {
                    // Verification complete (success or failed)
                    isStopped = true;
                }
            } catch (error) {
                console.error('Polling error:', error);
                callback(null, error);

                // Continue polling on error (might be temporary network issue)
                if (!isStopped) {
                    timeoutId = setTimeout(poll, interval);
                }
            }
        };

        // Start polling
        poll();

        // Return a function to stop polling
        return () => {
            isStopped = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }

    /**
     * Get status badge variant for verification status
     */
    getStatusBadgeVariant(status) {
        const variants = {
            'pending': 'neutral',
            'queued': 'info',
            'running': 'warning',
            'success': 'success',
            'failed': 'danger',
            'cancelled': 'neutral'
        };
        return variants[status] || 'neutral';
    }

    /**
     * Get human-readable status label
     */
    getStatusLabel(status) {
        const labels = {
            'pending': 'Pending',
            'queued': 'Queued',
            'running': 'Running',
            'success': 'Verified',
            'failed': 'Failed',
            'cancelled': 'Cancelled'
        };
        return labels[status] || status;
    }

    /**
     * Parse verification results from task progress
     */
    parseVerificationResults(execution) {
        if (!execution || !execution.tasks) {
            return null;
        }

        const results = {
            overall_status: execution.status,
            tables: [],
            total_tables: 0,
            verified_tables: 0,
            failed_tables: 0
        };

        // Parse task results
        execution.tasks.forEach(task => {
            if (task.task_id.startsWith('verify_')) {
                const tableName = task.task_id.replace('verify_', '');
                results.tables.push({
                    table_name: tableName,
                    status: task.state,
                    verified: task.state === 'success',
                    duration: task.duration
                });

                results.total_tables++;
                if (task.state === 'success') {
                    results.verified_tables++;
                } else if (task.state === 'failed') {
                    results.failed_tables++;
                }
            }
        });

        return results;
    }
}

export const verificationService = new VerificationService();
