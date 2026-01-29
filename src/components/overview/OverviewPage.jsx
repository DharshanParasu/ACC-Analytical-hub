import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DashboardCard from './DashboardCard';
import { storageService } from '../../services/storageService';

const OverviewPage = () => {
    const navigate = useNavigate();
    const [dashboards, setDashboards] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        storageService.createSampleDashboards();
        loadDashboards();
        if (window.eva) {
            window.eva.replace({ fill: 'currentColor' });
        }
    }, []);

    const loadDashboards = () => {
        const data = storageService.getAllDashboards();
        setDashboards(data);
    };

    const filteredDashboards = dashboards.filter(dashboard => {
        return dashboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dashboard.description.toLowerCase().includes(searchQuery.toLowerCase());
    });

    useEffect(() => {
        if (window.eva) {
            window.eva.replace({ fill: 'currentColor' });
        }
    }, [filteredDashboards]);



    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-[1800px] mx-auto"
        >
            {/* Quick Actions */}
            <div className="flex gap-4 mb-8">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/dashboard/new')}
                    className="btn btn-primary py-3 px-8 text-sm shadow-[0_0_15px_rgba(204,246,85,0.3)] hover:shadow-[0_0_25px_rgba(204,246,85,0.5)] transition-shadow flex items-center gap-2"
                >
                    <span>
                        <i data-eva="plus-outline" className="w-4 h-4"></i>
                    </span>
                    Create Dashboard
                </motion.button>
            </div>

            {/* Section: Recent Dashboards */}
            <section className="mb-16">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-white tracking-tight">
                        Your Dashboards
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
                                />
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-16 text-center bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md flex flex-col items-center justify-center max-w-2xl mx-auto"
                    >
                        <div className="text-7xl mb-6 opacity-30">
                            <span>
                                <i data-eva="grid-outline" data-eva-animation="pulse" className="w-16 h-16"></i>
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold mb-2 text-white">
                            {searchQuery ? 'No dashboards found' : 'Create your first dashboard'}
                        </h3>
                        <p className="text-gray-400 mb-8 text-lg">
                            {searchQuery
                                ? 'Try adjusting your search query'
                                : 'Get started with analytics and 3D model insights'
                            }
                        </p>
                        {!searchQuery && (
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => navigate('/dashboard/new')}
                                className="btn btn-primary flex items-center gap-2"
                            >
                                <span>
                                    <i data-eva="plus-outline" className="w-4 h-4"></i>
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
                    <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">
                        Overview
                    </h2>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                        {[
                            {
                                label: 'Total Dashboards',
                                value: dashboards.length,
                                icon: 'bar-chart-outline',
                                color: 'text-lime-400'
                            },
                            {
                                label: 'Updated This Week',
                                value: dashboards.filter(d => {
                                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                                    return new Date(d.updatedAt) > weekAgo;
                                }).length,
                                icon: 'clock-outline',
                                color: 'text-cyan-400'
                            },
                            {
                                label: 'Total Components',
                                value: dashboards.reduce((sum, d) => sum + (d.components?.length || 0), 0),
                                icon: 'layers-outline',
                                color: 'text-purple-400'
                            }
                        ].map((stat, index) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.1 }}
                                className="glass-panel p-6 flex items-center gap-6 hover:bg-white/10 transition-colors"
                            >
                                <div className={`text-4xl ${stat.color} opacity-80`}>
                                    <span>
                                        <i data-eva={stat.icon} className="w-10 h-10"></i>
                                    </span>
                                </div>
                                <div>
                                    <div className={`text-4xl font-black ${stat.color} leading-none mb-1`}>
                                        {stat.value}
                                    </div>
                                    <div className="text-sm text-gray-400 font-medium uppercase tracking-wider">
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
