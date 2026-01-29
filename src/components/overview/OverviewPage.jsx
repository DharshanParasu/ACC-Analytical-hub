import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardCard from './DashboardCard';
import { storageService } from '../../services/storageService';
import { ArrowLeft, Plus, LayoutGrid, BarChart3, Clock } from 'lucide-react';

const OverviewPage = () => {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const [dashboards, setDashboards] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [project, setProject] = useState(null);

    useEffect(() => {
        if (!projectId) return;

        // storageService.createSampleDashboards(); // Removing auto-sample creation here, handled generally or via button?
        // Actually sample creation handles default project.

        loadProjectDetails();
        loadDashboards();
    }, [projectId]);

    const loadProjectDetails = () => {
        const proj = storageService.getProject(projectId);
        if (proj) {
            setProject(proj);
        } else {
            // Project not found? Redirect?
            // navigate('/projects');
        }
    };

    const loadDashboards = () => {
        const data = storageService.getDashboardsByProject(projectId);
        setDashboards(data);
    };

    const filteredDashboards = dashboards.filter(dashboard => {
        return dashboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dashboard.description.toLowerCase().includes(searchQuery.toLowerCase());
    });

    if (!project) return <div className="p-8 text-white">Loading project...</div>;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-[1800px] mx-auto"
        >
            {/* Header Section */}
            <div className="flex justify-between items-end mb-8 border-b border-[var(--color-border)] pb-6">
                <div>
                    <div className="flex items-center gap-2 text-sm text-lime-400 font-mono uppercase tracking-widest mb-2 cursor-pointer hover:underline" onClick={() => navigate('/projects')}>
                        <ArrowLeft className="w-4 h-4" /> Back to Projects
                    </div>
                    <h1 className="text-4xl font-black text-[var(--color-text-base)] tracking-tight">
                        {project.name}
                    </h1>
                    <p className="text-[var(--color-text-muted)] mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-lime-400"></span>
                        {project.hubName}
                    </p>
                </div>

                <div className="flex gap-4">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate(`/project/${projectId}/dashboard/new`)}
                        className="btn btn-primary py-3 px-8 text-sm shadow-[0_0_15px_rgba(204,246,85,0.3)] hover:shadow-[0_0_25px_rgba(204,246,85,0.5)] transition-shadow flex items-center gap-2"
                    >
                        <span>
                            <Plus className="w-4 h-4" />
                        </span>
                        Create Dashboard
                    </motion.button>
                </div>
            </div>

            {/* Section: Recent Dashboards */}
            <section className="mb-16">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-[var(--color-text-base)] tracking-tight">
                        Dashboards
                    </h2>
                </div>

                {filteredDashboards.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                        {filteredDashboards.map((dashboard, index) => (
                            <motion.div
                                key={dashboard.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <DashboardCard
                                    dashboard={dashboard}
                                    onDelete={loadDashboards}
                                    // Need to pass projectId to card if it constructs URL?
                                    // Card usually does navigate(`/dashboard/view/${dashboard.id}`)
                                    // We need to update Card too or pass a custom navigate handler.
                                    // Let's assume we update Card next or handle it here via context.
                                    // Actually, let's update DashboardCard or pass a base URL.
                                    basePath={`/project/${projectId}/dashboard`}
                                />
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-16 text-center bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-3xl backdrop-blur-md flex flex-col items-center justify-center max-w-2xl mx-auto shadow-lg"
                    >
                        <div className="text-7xl mb-6 opacity-30">
                            <span>
                                <LayoutGrid className="w-16 h-16 animate-pulse text-[var(--color-text-muted)]" />
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold mb-2 text-[var(--color-text-base)]">
                            {searchQuery ? 'No dashboards found' : 'Create your first dashboard'}
                        </h3>
                        <p className="text-[var(--color-text-muted)] mb-8 text-lg">
                            {searchQuery
                                ? 'Try adjusting your search query'
                                : 'Get started with analytics and 3D model insights'
                            }
                        </p>
                        {!searchQuery && (
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => navigate(`/project/${projectId}/dashboard/new`)}
                                className="btn btn-primary flex items-center gap-2"
                            >
                                <span>
                                    <Plus className="w-4 h-4" />
                                </span>
                                Create Dashboard
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </section>

            {/* Section: Quick Stats */}
            {dashboards.length > 0 && (
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-[var(--color-text-base)] mb-6 tracking-tight">
                        Project Overview
                    </h2>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                        {[
                            {
                                label: 'Total Dashboards',
                                value: dashboards.length,
                                Icon: BarChart3,
                                color: 'text-lime-400'
                            },
                            {
                                label: 'Updated This Week',
                                value: dashboards.filter(d => {
                                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                                    return new Date(d.updatedAt) > weekAgo;
                                }).length,
                                Icon: Clock,
                                color: 'text-cyan-400'
                            },
                        ].map((stat, index) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.1 }}
                                className="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border)] p-6 flex items-center gap-6 hover:bg-[var(--color-hover)] transition-colors shadow-sm"
                            >
                                <div className={`text-4xl ${stat.color} opacity-80`}>
                                    <span>
                                        <stat.Icon className="w-10 h-10" />
                                    </span>
                                </div>
                                <div>
                                    <div className={`text-4xl font-black ${stat.color} leading-none mb-1`}>
                                        {stat.value}
                                    </div>
                                    <div className="text-sm text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                                        {stat.label}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>
            )}
        </motion.div>
    );
};

export default OverviewPage;
