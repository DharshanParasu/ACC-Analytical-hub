import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../../services/storageService';
import { PlayCircle, Edit2, Trash2 } from 'lucide-react';

const DashboardCard = ({ dashboard, onDelete, basePath = '/dashboard' }) => {
    const navigate = useNavigate();

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (window.confirm(`Delete "${dashboard.name}"?`)) {
            storageService.deleteDashboard(dashboard.id);
            onDelete();
        }
    };

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`${basePath}/view/${dashboard.id}`)}
            style={{
                background: 'var(--color-bg-elevated)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-md)',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all var(--transition-base)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
                border: '1px solid var(--color-border)'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            {/* Thumbnail */}
            <div style={{
                width: '100%',
                aspectRatio: '16 / 9',
                background: 'var(--color-bg-base)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid var(--color-border)'
            }}>
                {dashboard.thumbnail}

                {/* Play button overlay on hover */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        color: '#fff',
                        boxShadow: 'var(--shadow-lg)'
                    }}>
                        <span>
                            <PlayCircle className="w-8 h-8" />
                        </span>
                    </div>
                </motion.div>
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
                <h3 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-bold)',
                    marginBottom: '4px',
                    color: 'var(--color-text-base)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {dashboard.name}
                </h3>

                <p style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 'var(--spacing-sm)'
                }}>
                    {dashboard.description || 'No description'}
                </p>

                <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)'
                }}>
                    <span>{dashboard.components?.length || 0} components</span>
                    <span>•</span>
                    <span>{formatDate(dashboard.updatedAt)}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                style={{
                    position: 'absolute',
                    top: 'var(--spacing-sm)',
                    right: 'var(--spacing-sm)',
                    display: 'flex',
                    gap: 'var(--spacing-xs)'
                }}
            >
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${basePath}/edit/${dashboard.id}`);
                    }}
                    style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px'
                    }}
                    title="Edit"
                >
                    <span>
                        <Edit2 className="w-4 h-4" />
                    </span>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleDelete}
                    style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px'
                    }}
                    title="Delete"
                >
                    <span>
                        <Trash2 className="w-4 h-4" />
                    </span>
                </motion.button>
            </motion.div>
        </motion.div>
    );
};

export default DashboardCard;
