import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    Home,
    Plus,
    LayoutGrid,
    ChevronLeft,
    ChevronRight,
    Lightbulb,
    Settings
} from 'lucide-react';

const Sidebar = ({ user, isCollapsed, toggleCollapse, onConfigure }) => {
    const location = useLocation();

    const match = location.pathname.match(/^\/project\/([^/]+)/);
    const projectId = match ? match[1] : null;

    const menuItems = projectId ? [
        {
            icon: ArrowLeft,
            label: 'All Projects',
            path: '/projects'
        },
        {
            icon: Home,
            label: 'Project Overview',
            path: `/project/${projectId}`
        },
        {
            icon: Plus,
            label: 'Create Dashboard',
            path: `/project/${projectId}/dashboard/new`
        },
    ] : [
        {
            icon: LayoutGrid,
            label: 'Projects',
            path: '/projects'
        },
    ];

    return (
        <aside
            className={`fixed left-0 top-0 bottom-0 flex flex-col gap-4 z-[1030] border-r border-[var(--color-border)] bg-[var(--color-bg-base)] transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16 p-4' : 'w-64 p-6'}`}
        >
            {/* Header / Toggle */}
            <div className={`flex items-center h-[60px] ${isCollapsed ? 'justify-center' : 'justify-between py-4'}`}>
                {!isCollapsed && (
                    <div className="overflow-hidden whitespace-nowrap">
                        <h1 className="text-xl font-black text-[var(--color-text-base)] m-0 tracking-tight">Analytical <span className="text-lime-400">Hub</span></h1>
                        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest m-0">Platform</p>
                    </div>
                )}

                <button
                    onClick={toggleCollapse}
                    className={`flex items-center justify-center min-w-[24px] p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-base)] transition-colors ${isCollapsed ? '' : 'ml-auto'}`}
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            title={isCollapsed ? item.label : ''}
                            className="no-underline"
                        >
                            <motion.div
                                whileHover={{ backgroundColor: 'var(--color-hover)' }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer ${isCollapsed ? 'justify-center px-0' : ''} ${isActive ? 'bg-[var(--color-hover)] text-[var(--color-text-base)] font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-base)] font-medium'}`}
                            >
                                <div className="min-w-[24px] flex items-center justify-center">
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-lime-400' : 'text-[var(--color-text-muted)]'}`} />
                                </div>
                                {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                            </motion.div>
                        </Link>
                    );
                })}
            </nav>

            {/* Divider */}
            <div className="h-px bg-[var(--color-border)] my-4" />

            {/* Library Section */}
            {!isCollapsed && (
                <div className="px-4 py-2 text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-widest whitespace-nowrap">
                    Your Library
                </div>
            )}

            {/* Settings Link (Bottom) */}

            {/* User Session Info */}
            {user && (
                <div className={`rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex flex-col mx-2 mb-4 ${isCollapsed ? 'p-3 items-center' : 'p-4 items-start'}`}>
                    {!isCollapsed && <div className="text-xs text-[var(--color-text-muted)] mb-2 whitespace-nowrap">USER SESSION</div>}
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-lime-500 shadow-[0_0_8px_rgba(132,204,22,0.6)]"></div>
                        {!isCollapsed && <span className="text-sm font-medium text-[var(--color-text-base)]">Active</span>}
                    </div>
                </div>
            )}

            {/* Tip Card if not logged in */}
            {!user && !isCollapsed && (
                <div className="mt-auto p-4 rounded-xl bg-gradient-to-br from-lime-400 to-lime-500 text-black shadow-lg">
                    <div className="text-sm font-bold mb-1 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
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
