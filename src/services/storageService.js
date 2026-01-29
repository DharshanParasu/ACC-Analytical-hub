// Storage service for dashboard persistence
const STORAGE_KEY = 'analytical_hub_dashboards';

export const storageService = {
    // --- Projects ---
    getProjects() {
        try {
            const data = localStorage.getItem('analytical_hub_projects');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading projects:', error);
            return [];
        }
    },

    getProject(id) {
        const projects = this.getProjects();
        return projects.find(p => p.id === id);
    },

    saveProject(project) {
        try {
            const projects = this.getProjects();
            const existingIndex = projects.findIndex(p => p.id === project.id);

            const updatedProject = {
                ...project,
                updatedAt: new Date().toISOString()
            };

            if (existingIndex >= 0) {
                projects[existingIndex] = updatedProject;
            } else {
                projects.push({
                    ...updatedProject,
                    createdAt: new Date().toISOString()
                });
            }

            localStorage.setItem('analytical_hub_projects', JSON.stringify(projects));
            return updatedProject;
        } catch (error) {
            console.error('Error saving project:', error);
            throw error;
        }
    },

    deleteProject(id) {
        try {
            const projects = this.getProjects();
            const filtered = projects.filter(p => p.id !== id);
            localStorage.setItem('analytical_hub_projects', JSON.stringify(filtered));

            // Also delete associated dashboards
            const dashboards = this.getAllDashboards();
            const filteredDashboards = dashboards.filter(d => d.projectId !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredDashboards));

            return true;
        } catch (error) {
            console.error('Error deleting project:', error);
            return false;
        }
    },

    // --- Dashboards ---

    // Get all dashboards (internal use)
    getAllDashboards() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading dashboards:', error);
            return [];
        }
    },

    // Get dashboards for a specific project
    getDashboardsByProject(projectId) {
        const dashboards = this.getAllDashboards();
        return dashboards.filter(d => d.projectId === projectId);
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
        // Ensure a default project exists for samples
        const projects = this.getProjects();
        let sampleProjectId = 'sample-project-1';

        if (!projects.some(p => p.id === sampleProjectId)) {
            this.saveProject({
                id: sampleProjectId,
                name: 'Sample ACC Project',
                hubId: 'mock-hub',
                hubName: 'Mock Hub',
                accProjectId: 'mock-project',
                thumbnail: '🏗️'
            });
        }

        const samples = [
            {
                id: 'sample-1',
                projectId: sampleProjectId,
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
                projectId: sampleProjectId,
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
                projectId: sampleProjectId,
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
