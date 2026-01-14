// Storage service for dashboard persistence
const STORAGE_KEY = 'analytical_hub_dashboards';

export const storageService = {
    // Get all dashboards
    getAllDashboards() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading dashboards:', error);
            return [];
        }
    },

    // Get dashboard by ID
    getDashboard(id) {
        const dashboards = this.getAllDashboards();
        return dashboards.find(d => d.id === id);
    },

    // Save dashboard
    saveDashboard(dashboard) {
        try {
            const dashboards = this.getAllDashboards();
            const existingIndex = dashboards.findIndex(d => d.id === dashboard.id);

            const updatedDashboard = {
                ...dashboard,
                updatedAt: new Date().toISOString()
            };

            if (existingIndex >= 0) {
                dashboards[existingIndex] = updatedDashboard;
            } else {
                dashboards.push({
                    ...updatedDashboard,
                    createdAt: new Date().toISOString()
                });
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards));
            return updatedDashboard;
        } catch (error) {
            console.error('Error saving dashboard:', error);
            throw error;
        }
    },

    // Delete dashboard
    deleteDashboard(id) {
        try {
            const dashboards = this.getAllDashboards();
            const filtered = dashboards.filter(d => d.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error deleting dashboard:', error);
            return false;
        }
    },

    // Create sample dashboards (for demo)
    createSampleDashboards() {
        const samples = [
            {
                id: 'sample-1',
                name: 'Construction Analytics',
                description: 'Building component analysis from BIM model',
                components: [
                    { type: 'viewer', id: 'viewer-1', config: {} },
                    { type: 'pie', id: 'pie-1', config: { title: 'Materials Distribution' } },
                    { type: 'bar', id: 'bar-1', config: { title: 'Cost by Category' } }
                ],
                thumbnail: '🏗️',
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'sample-2',
                name: 'Project Timeline',
                description: 'Schedule and progress tracking',
                components: [
                    { type: 'line', id: 'line-1', config: { title: 'Progress Over Time' } },
                    { type: 'kpi', id: 'kpi-1', config: { title: 'Completion %' } },
                    { type: 'kpi', id: 'kpi-2', config: { title: 'Days Remaining' } }
                ],
                thumbnail: '📈',
                createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'sample-3',
                name: 'Resource Allocation',
                description: 'Team and equipment utilization',
                components: [
                    { type: 'bar', id: 'bar-2', config: { title: 'Resource Usage' } },
                    { type: 'table', id: 'table-1', config: { title: 'Resource Details' } }
                ],
                thumbnail: '👥',
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        // Only create samples if no dashboards exist
        const existing = this.getAllDashboards();
        if (existing.length === 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
        }
    }
};
