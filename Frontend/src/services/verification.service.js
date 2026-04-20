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
     * Force stop a running/queued verification
     */
    async forceStop(executionId) {
        const response = await api.post(`/verification/${executionId}/stop`);
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

        // Parse task results — show all tasks (DAG may use 'run_verification' or 'verify_*' naming)
        execution.tasks.forEach(task => {
            const tableName = task.task_id.replace(/^(verify_|run_)/, '');
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
        });

        return results;
    }
}

export const verificationService = new VerificationService();


// ============================================================
// Merkle Proof API methods
// ============================================================

class MerkleProofService {
    async verifyRow(tableName, rowData) {
        const response = await api.post('/merkle-proof/verify', {
            table_name: tableName,
            row_data: rowData
        });
        return response.data;
    }

    async verifyTable(tableName) {
        const response = await api.get(`/merkle-proof/verify-table/${tableName}`);
        return response.data;
    }

    async getRootHistory(tableName) {
        const response = await api.get(`/merkle-proof/root-history/${tableName}`);
        return response.data;
    }

    async getVerifiedTables() {
        const response = await api.get('/merkle-proof/tables');
        return response.data;
    }
}

export const merkleProofService = new MerkleProofService();
