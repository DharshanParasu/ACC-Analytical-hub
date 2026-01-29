import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const Header = ({ user, onLogin }) => {
    const location = useLocation();

    useEffect(() => {
        if (window.eva) {
            window.eva.replace({ fill: 'currentColor' });
        }
    }, [user, location.pathname]);

    const getPageTitle = () => {
        if (location.pathname === '/overview') return 'Home';
        if (location.pathname.includes('/dashboard/new')) return 'Create Dashboard';
        if (location.pathname.includes('/dashboard/edit')) return 'Edit Dashboard';
        if (location.pathname.includes('/dashboard/view')) return 'Dashboard';
        return 'Analytics Hub';
    };

    return (
        <header className="h-16 bg-[#030508]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-[1020] border-b border-white/10">
            <div>
                <h2 className="text-2xl font-black text-white m-0 tracking-tight">
                    {getPageTitle()}
                </h2>
            </div>

            <div className="flex items-center gap-4">
                <ThemeToggle />

                {/* Search Bar */}
                <div className="relative w-[360px] group">
                    <input
                        type="text"
                        placeholder="Search dashboards..."
                        className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-full text-white placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
                        <span>
                            <i data-eva="search-outline" className="w-5 h-5 text-gray-500 group-focus-within:text-white transition-colors"></i>
                        </span>
                    </div>
                </div>

                {/* User Identity / Login */}
                {user ? (
                    <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                        <div className="text-right flex flex-col">
                            <span className="text-sm font-bold text-white leading-tight">{user.userName}</span>
                            <span className="text-[10px] text-gray-400">{user.emailId}</span>
                        </div>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-9 h-9 rounded-full bg-lime-400 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-white/10 shadow-lg"
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
