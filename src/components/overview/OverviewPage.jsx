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
    }, []);

    const loadDashboards = () => {
        const data = storageService.getAllDashboards();
        setDashboards(data);
    };

    const filteredDashboards = dashboards.filter(dashboard => {
        return dashboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dashboard.description.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ width: '100%', maxWidth: '1800px' }}
        >
            {/* Quick Actions */}
            <div style={{
                display: 'flex',
                gap: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-xl)'
            }}>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/dashboard/new')}
                    className="btn btn-primary"
                    style={{
                        padding: '14px 28px',
                        fontSize: 'var(--font-size-sm)'
                    }}
                >
                    ➕ Create Dashboard
                </motion.button>
            </div>

            {/* Section: Recent Dashboards */}
            <section style={{ marginBottom: 'var(--spacing-3xl)' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-lg)'
                }}>
                    <h2 style={{
                        fontSize: 'var(--font-size-2xl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-text-base)'
                    }}>
                        Your Dashboards
                    </h2>
                </div>

                {filteredDashboards.length > 0 ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: 'var(--spacing-lg)'
                    }}>
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
                        style={{
                            padding: 'var(--spacing-3xl)',
                            textAlign: 'center',
                            background: 'var(--color-bg-elevated)',
                            borderRadius: 'var(--radius-lg)'
                        }}
                    >
                        <div style={{ fontSize: '64px', marginBottom: 'var(--spacing-lg)' }}>
                            📊
                        </div>
                        <h3 style={{
                            fontSize: 'var(--font-size-2xl)',
                            fontWeight: 'var(--font-weight-bold)',
                            marginBottom: 'var(--spacing-sm)',
                            color: 'var(--color-text-base)'
                        }}>
                            {searchQuery ? 'No dashboards found' : 'Create your first dashboard'}
                        </h3>
                        <p style={{
                            fontSize: 'var(--font-size-base)',
                            color: 'var(--color-text-subdued)',
                            marginBottom: 'var(--spacing-xl)'
                        }}>
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
                                className="btn btn-primary"
                            >
                                ➕ Create Dashboard
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </section>

            {/* Section: Quick Stats */}
            {dashboards.length > 0 && (
                <section style={{ marginBottom: 'var(--spacing-3xl)' }}>
                    <h2 style={{
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-text-base)',
                        marginBottom: 'var(--spacing-lg)'
                    }}>
                        Overview
                    </h2>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 'var(--spacing-md)'
                    }}>
                        {[
                            {
                                label: 'Total Dashboards',
                                value: dashboards.length,
                                icon: '📊',
                                color: 'var(--color-primary)'
                            },
                            {
                                label: 'Updated This Week',
                                value: dashboards.filter(d => {
                                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                                    return new Date(d.updatedAt) > weekAgo;
                                }).length,
                                icon: '🕒',
                                color: 'var(--color-accent-blue)'
                            },
                            {
                                label: 'Total Components',
                                value: dashboards.reduce((sum, d) => sum + (d.components?.length || 0), 0),
                                icon: '🧩',
                                color: 'var(--color-accent-purple)'
                            }
                        ].map((stat, index) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.1 }}
                                style={{
                                    background: 'var(--color-bg-elevated)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-lg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-md)'
                                }}
                            >
                                <div style={{
                                    fontSize: '32px'
                                }}>
                                    {stat.icon}
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: 'var(--font-size-3xl)',
                                        fontWeight: 'var(--font-weight-black)',
                                        color: stat.color,
                                        lineHeight: 1
                                    }}>
                                        {stat.value}
                                    </div>
                                    <div style={{
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-text-subdued)',
                                        marginTop: '4px'
                                    }}>
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
