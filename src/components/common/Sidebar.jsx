import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ user, isCollapsed, toggleCollapse }) => {
    const location = useLocation();

    const menuItems = [
        {
            icon: 'home-outline',
            label: 'Home',
            path: '/overview'
        },
        {
            icon: 'plus-outline',
            label: 'Create Dashboard',
            path: '/dashboard/new'
        },
    ];

    useEffect(() => {
        if (window.eva) {
            window.eva.replace({ fill: 'currentColor' });
        }
    }, [isCollapsed, location.pathname, user]);

    return (
        <aside
            className={`fixed left-0 top-0 bottom-0 flex flex-col gap-4 z-[1030] border-r border-white/10 bg-[#030508] transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16 p-4' : 'w-64 p-6'}`}
        >
            {/* Header / Toggle */}
            <div className={`flex items-center h-[60px] ${isCollapsed ? 'justify-center' : 'justify-between py-4'}`}>
                {!isCollapsed && (
                    <div className="overflow-hidden whitespace-nowrap">
                        <h1 className="text-xl font-black text-white m-0 tracking-tight">Analytical <span className="text-lime-400">Hub</span></h1>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest m-0">Platform</p>
                    </div>
                )}

                <button
                    onClick={toggleCollapse}
                    className={`flex items-center justify-center min-w-[24px] p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors ${isCollapsed ? '' : 'ml-auto'}`}
                >
                    <span>
                        <i key={`sidebar-toggle-${isCollapsed}`} data-eva={isCollapsed ? "chevron-right-outline" : "chevron-left-outline"} className="w-4 h-4"></i>
                    </span>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            title={isCollapsed ? item.label : ''}
                            className="no-underline"
                        >
                            <motion.div
                                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer ${isCollapsed ? 'justify-center px-0' : ''} ${isActive ? 'bg-white/10 text-white font-bold' : 'text-gray-400 hover:text-white font-medium'}`}
                            >
                                <div className="min-w-[24px] flex items-center justify-center">
                                    <span>
                                        <i data-eva={item.icon} className={`w-5 h-5 ${isActive ? 'text-lime-400' : 'text-gray-400'}`}></i>
                                    </span>
                                </div>
                                {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                            </motion.div>
                        </Link>
                    );
                })}
            </nav>

            {/* Divider */}
            <div className="h-px bg-white/10 my-4" />

            {/* Library Section */}
            {!isCollapsed && (
                <div className="px-4 py-2 text-gray-500 text-xs font-semibold uppercase tracking-widest whitespace-nowrap">
                    Your Library
                </div>
            )}

            {/* User Session Info */}
            {user && (
                <div className={`mt-auto rounded-xl bg-white/5 border border-white/5 flex flex-col ${isCollapsed ? 'p-3 items-center' : 'p-4 items-start'}`}>
                    {!isCollapsed && <div className="text-xs text-gray-500 mb-2 whitespace-nowrap">USER SESSION</div>}
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-lime-500 shadow-[0_0_8px_rgba(132,204,22,0.6)]"></div>
                        {!isCollapsed && <span className="text-sm font-medium">Active</span>}
                    </div>
                </div>
            )}

            {/* Tip Card if not logged in */}
            {!user && !isCollapsed && (
                <div className="mt-auto p-4 rounded-xl bg-gradient-to-br from-lime-400 to-lime-500 text-black shadow-lg">
                    <div className="text-sm font-bold mb-1 flex items-center gap-2">
                        <span>
                            <i data-eva="bulb-outline" className="w-4 h-4"></i>
                        </span>
                        Pro Tip
                    </div>
                    <div className="text-xs opacity-90 leading-relaxed">
                        Login to access your ACC projects and 3D models.
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
