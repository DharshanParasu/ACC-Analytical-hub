import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ user, isCollapsed, toggleCollapse }) => {
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
                width: isCollapsed ? '64px' : '240px',
                background: 'var(--color-bg-base)',
                padding: isCollapsed ? '16px 8px' : 'var(--spacing-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
                zIndex: 'var(--z-fixed)',
                borderRight: '1px solid var(--color-border)',
                transition: 'width 0.3s ease, padding 0.3s ease',
                overflow: 'hidden'
            }}
        >
            {/* Header / Toggle */}
            <div style={{
                padding: isCollapsed ? '0 0 16px 0' : 'var(--spacing-md) 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                height: '60px'
            }}>
                {!isCollapsed && (
                    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <h1 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--color-text-base)', margin: 0 }}>Analytics Hub</h1>
                        <p style={{ fontSize: '10px', color: 'var(--color-text-subdued)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Platform</p>
                    </div>
                )}

                <button
                    onClick={toggleCollapse}
                    className="btn-icon"
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--color-text-subdued)',
                        padding: '4px',
                        minWidth: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: isCollapsed ? 0 : 'auto'
                    }}
                >
                    {isCollapsed ? '➡' : '⬅'}
                </button>
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
                            title={isCollapsed ? item.label : ''}
                        >
                            <motion.div
                                whileHover={{ backgroundColor: 'var(--color-bg-highlight)' }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: isCollapsed ? 'center' : 'flex-start',
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
                                {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
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
            {!isCollapsed && (
                <div style={{
                    padding: '12px 16px',
                    color: 'var(--color-text-subdued)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    whiteSpace: 'nowrap'
                }}>
                    Your Library
                </div>
            )}

            {/* User Session Info */}
            {user && (
                <div style={{
                    padding: isCollapsed ? '12px' : '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.03)',
                    marginTop: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isCollapsed ? 'center' : 'flex-start'
                }}>
                    {!isCollapsed && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subdued)', marginBottom: '8px', whiteSpace: 'nowrap' }}>USER SESSION</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1db954' }}></div>
                        {!isCollapsed && <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Active</span>}
                    </div>
                </div>
            )}

            {/* Tip Card if not logged in */}
            {!user && !isCollapsed && (
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
