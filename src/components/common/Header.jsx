import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const Header = ({ user, onLogin }) => {
    const location = useLocation();

    const getPageTitle = () => {
        if (location.pathname === '/overview') return 'Home';
        if (location.pathname.includes('/dashboard/new')) return 'Create Dashboard';
        if (location.pathname.includes('/dashboard/edit')) return 'Edit Dashboard';
        if (location.pathname.includes('/dashboard/view')) return 'Dashboard';
        return 'Analytics Hub';
    };

    return (
        <header
            style={{
                height: '64px',
                background: 'var(--color-bg-base)',
                padding: '0 var(--spacing-xl)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 'var(--z-sticky)',
                borderBottom: '1px solid var(--color-border-subtle)'
            }}
        >
            <div>
                <h2
                    style={{
                        fontSize: 'var(--font-size-2xl)',
                        fontWeight: 'var(--font-weight-black)',
                        color: 'var(--color-text-base)',
                        margin: 0
                    }}
                >
                    {getPageTitle()}
                </h2>
            </div>

            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)'
            }}>
                {/* Search Bar */}
                <div
                    style={{
                        position: 'relative',
                        width: '360px'
                    }}
                >
                    <input
                        type="text"
                        placeholder="Search dashboards..."
                        className="input"
                        style={{
                            paddingLeft: '40px',
                            background: 'var(--color-bg-elevated)',
                            border: 'none'
                        }}
                    />
                    <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '18px',
                        color: 'var(--color-text-subdued)'
                    }}>
                        🔍
                    </span>
                </div>

                {/* User Identity / Login */}
                {user ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{user.userName}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-subdued)' }}>{user.emailId}</span>
                        </div>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-full)',
                                background: 'var(--color-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: '2px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            {user.profileImages?.sizeX40 ? (
                                <img src={user.profileImages.sizeX40} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ color: 'black', fontWeight: 'bold' }}>{user.userName?.charAt(0)}</span>
                            )}
                        </motion.div>
                    </div>
                ) : (
                    <button
                        onClick={onLogin}
                        className="btn btn-primary"
                        style={{ fontSize: '0.85rem', padding: '6px 16px' }}
                    >
                        Login
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
