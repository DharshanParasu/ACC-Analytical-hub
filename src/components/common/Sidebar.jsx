import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ user }) => {
    const location = useLocation();

    const menuItems = [
        {
            icon: '🏠',
            label: 'Home',
            path: '/overview'
        },
        {
            icon: '➕',
            label: 'Create Dashboard',
            path: '/dashboard/new'
        },
    ];

    return (
        <aside
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                width: '240px',
                background: 'var(--color-bg-base)',
                padding: 'var(--spacing-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
                zIndex: 'var(--z-fixed)'
            }}
        >
            {/* Logo */}
            <div style={{ padding: 'var(--spacing-md) 0' }}>
                <h1
                    style={{
                        fontSize: 'var(--font-size-2xl)',
                        fontWeight: 'var(--font-weight-black)',
                        color: 'var(--color-text-base)',
                        marginBottom: '4px'
                    }}
                >
                    Analytics Hub
                </h1>
                <p style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-subdued)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                }}>
                    Dashboard Platform
                </p>
            </div>

            {/* Navigation */}
            <nav style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xs)'
            }}>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{ textDecoration: 'none' }}
                        >
                            <motion.div
                                whileHover={{ backgroundColor: 'var(--color-bg-highlight)' }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-md)',
                                    padding: '12px 16px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: isActive ? 'var(--color-bg-highlight)' : 'transparent',
                                    color: isActive ? 'var(--color-text-base)' : 'var(--color-text-subdued)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-base)',
                                    fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
                                    fontSize: 'var(--font-size-base)'
                                }}
                            >
                                <span style={{ fontSize: '20px' }}>
                                    {item.icon}
                                </span>
                                <span>{item.label}</span>
                            </motion.div>
                        </Link>
                    );
                })}
            </nav>

            {/* Divider */}
            <div style={{
                height: '1px',
                background: 'var(--color-border)',
                margin: 'var(--spacing-md) 0'
            }} />

            {/* Library Section */}
            <div style={{
                padding: '12px 16px',
                color: 'var(--color-text-subdued)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
            }}>
                Your Library
            </div>

            {/* User Session Info */}
            {user && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.03)',
                    marginTop: 'auto'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subdued)', marginBottom: '8px' }}>USER SESSION</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1db954' }}></div>
                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Active</span>
                    </div>
                </div>
            )}

            {/* Tip Card if not logged in */}
            {!user && (
                <div style={{
                    marginTop: 'auto',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, #1db954 0%, #1ed760 100%)',
                    color: '#000'
                }}>
                    <div style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-bold)',
                        marginBottom: 'var(--spacing-xs)'
                    }}>
                        💡 Pro Tip
                    </div>
                    <div style={{
                        fontSize: 'var(--font-size-xs)',
                        lineHeight: 1.4,
                        opacity: 0.9
                    }}>
                        Login to access your ACC projects and 3D models.
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
