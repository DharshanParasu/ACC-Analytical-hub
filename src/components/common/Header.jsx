import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Search, Settings } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const Header = ({ user, onLogin, onConfigure }) => {
    const location = useLocation();

    const getPageTitle = () => {
        if (location.pathname === '/overview') return 'Home';
        if (location.pathname.includes('/dashboard/new')) return 'Create Dashboard';
        if (location.pathname.includes('/dashboard/edit')) return 'Edit Dashboard';
        if (location.pathname.includes('/dashboard/view')) return 'Dashboard';
        return 'Analytics Hub';
    };

    return (
        <header className="h-16 bg-[var(--color-bg-base)]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-[1020] border-b border-[var(--color-border)] transition-colors duration-200">
            <div>
                <h2 className="text-2xl font-black text-[var(--color-text-base)] m-0 tracking-tight">
                    {getPageTitle()}
                </h2>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={onConfigure}
                    className="p-2 rounded-full hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-base)] transition-colors"
                    title="Settings"
                >
                    <Settings className="w-5 h-5" />
                </button>
                <ThemeToggle />

                {/* Search Bar */}
                <div className="relative w-[360px] group">
                    <input
                        type="text"
                        placeholder="Search dashboards..."
                        className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-full text-[var(--color-text-base)] placeholder-[var(--color-text-muted)] focus:outline-none focus:bg-[var(--color-bg-surface)] focus:border-[var(--color-border-hover)] transition-all"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
                        <Search className="w-5 h-5 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-text-base)] transition-colors" />
                    </div>
                </div>

                {/* User Identity / Login */}
                {user ? (
                    <div className="flex items-center gap-3 pl-4 border-l border-[var(--color-border)]">
                        <div className="text-right flex flex-col">
                            <span className="text-sm font-bold text-[var(--color-text-base)] leading-tight">{user.userName}</span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">{user.emailId}</span>
                        </div>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-9 h-9 rounded-full bg-lime-400 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-[var(--color-border)] shadow-lg"
                        >
                            {user.profileImages?.sizeX40 ? (
                                <img src={user.profileImages.sizeX40} alt="profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-black font-bold">{user.userName?.charAt(0)}</span>
                            )}
                        </motion.div>
                    </div>
                ) : (
                    <button
                        onClick={onLogin}
                        className="btn btn-primary text-sm py-1.5 px-4 rounded-full"
                    >
                        Login
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
