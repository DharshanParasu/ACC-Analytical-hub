import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apsService from '../../services/apsService';

const FileExplorer = ({ onSelect, onClose }) => {
    const [path, setPath] = useState([{ id: 'root', name: 'Hubs', type: 'root' }]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const currentPathItem = useMemo(() => path[path.length - 1], [path]);

    useEffect(() => {
        fetchCurrentLevel();
    }, [currentPathItem]);

    const fetchCurrentLevel = async () => {
        setLoading(true);
        setError(null);
        try {
            let data = [];
            const current = currentPathItem;

            if (current.type === 'root') {
                data = await apsService.getHubs();
                data = data.map(hub => ({
                    id: hub.id,
                    name: hub.attributes.name,
                    type: 'hub',
                    thumbnail: '🏢'
                }));
            } else if (current.type === 'hub') {
                data = await apsService.getProjects(current.id);
                data = data.map(proj => ({
                    id: proj.id,
                    hubId: current.id,
                    name: proj.attributes.name,
                    type: 'project',
                    thumbnail: '🏗️'
                }));
            } else if (current.type === 'project') {
                data = await apsService.getTopFolders(current.hubId, current.id);
                data = data.map(folder => ({
                    id: folder.id,
                    projectId: current.id,
                    name: folder.attributes.displayName,
                    type: 'folder',
                    thumbnail: '📁'
                }));
            } else if (current.type === 'folder') {
                data = await apsService.getFolderContents(current.projectId, current.id);
                data = data.map(item => {
                    const isFolder = item.type === 'folders';
                    return {
                        id: item.id,
                        projectId: current.projectId,
                        name: isFolder ? item.attributes.displayName : item.attributes.displayName,
                        type: isFolder ? 'folder' : 'file',
                        thumbnail: isFolder ? '📁' : '📄',
                        size: !isFolder ? (item.attributes.storageSize ? `${(item.attributes.storageSize / 1024 / 1024).toFixed(2)} MB` : 'N/A') : null,
                        version: !isFolder ? `v${item.attributes.versionNumber || 1}` : null,
                        urn: !isFolder ? (item.relationships?.tip?.data?.id || item.id) : null
                    };
                });
            }

            setItems(data);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load content. Please check your credentials and hub access.');
        } finally {
            setLoading(false);
        }
    };

    const breadcrumbs = useMemo(() => {
        return path.map((item, index) => (
            <span key={item.id}>
                <span
                    onClick={() => setPath(path.slice(0, index + 1))}
                    style={{
                        cursor: 'pointer',
                        color: index === path.length - 1 ? 'var(--color-text-base)' : 'var(--color-primary)',
                        fontWeight: index === path.length - 1 ? '600' : '400'
                    }}
                >
                    {item.name}
                </span>
                {index < path.length - 1 && <span style={{ margin: '0 8px', opacity: 0.5 }}>/</span>}
            </span>
        ));
    }, [path]);

    const filteredItems = useMemo(() => {
        return items.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const handleItemClick = (item) => {
        if (item.type !== 'file') {
            setPath([...path, item]);
        } else {
            // Base64 encode the URN for the viewer
            let urn = item.urn;
            if (urn) {
                // Ensure it's the full URN before encoding
                urn = btoa(urn).replace(/=/g, '');
            }

            onSelect({
                project: { name: path[path.length - 1].name, icon: '🏗️' },
                model: item,
                modelUrn: urn
            });
            onClose();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
                padding: 'var(--spacing-xl)'
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius-lg)',
                    width: '100%',
                    maxWidth: '800px',
                    height: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.03)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📂</span>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Select Model</h2>
                    </div>
                    <button onClick={onClose} className="btn-icon">×</button>
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                    {/* Vertical Sidebar / Navigation */}
                    <div style={{
                        width: '280px',
                        borderRight: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.8rem' }}>🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '6px 10px 6px 30px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'white',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>
                        </div>
                        <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--color-text-subdued)', opacity: 0.7 }}>
                            PATH: {breadcrumbs}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        background: 'var(--color-bg-base)',
                        position: 'relative'
                    }}>
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '100%',
                                        gap: '12px'
                                    }}
                                >
                                    <div className="spinner"></div>
                                    <div style={{ color: 'var(--color-text-subdued)', fontSize: '0.85rem' }}>Loading ACC data...</div>
                                </motion.div>
                            ) : error ? (
                                <motion.div
                                    key="error"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '100%',
                                        textAlign: 'center',
                                        padding: '24px'
                                    }}
                                >
                                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
                                    <div style={{ color: '#ff4d4d', fontWeight: '600', marginBottom: '8px', fontSize: '0.9rem' }}>{error}</div>
                                    <button
                                        onClick={fetchCurrentLevel}
                                        className="btn btn-primary"
                                        style={{ marginTop: '16px', fontSize: '0.85rem' }}
                                    >
                                        Retry
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="items"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    style={{ display: 'flex', flexDirection: 'column' }}
                                >
                                    {filteredItems.length > 0 ? filteredItems.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            whileHover={{ background: 'rgba(255,255,255,0.05)' }}
                                            onClick={() => handleItemClick(item)}
                                            style={{
                                                padding: '12px 20px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                transition: 'background 0.2s'
                                            }}
                                        >
                                            <div style={{ fontSize: '1.5rem' }}>
                                                {item.thumbnail || '📄'}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {item.name}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subdued)', display: 'flex', gap: '8px' }}>
                                                    <span style={{ textTransform: 'uppercase' }}>{item.type}</span>
                                                    {item.type === 'file' && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{item.size}</span>
                                                            <span>•</span>
                                                            <span>{item.version}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ opacity: 0.3 }}>
                                                {item.type === 'file' ? '✓' : '›'}
                                            </div>
                                        </motion.div>
                                    )) : (
                                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-subdued)', fontSize: '0.9rem' }}>
                                            No items found.
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: 'var(--spacing-md) var(--spacing-xl)',
                    borderTop: '1px solid var(--color-border)',
                    fontSize: '0.8rem',
                    color: 'var(--color-text-subdued)',
                    display: 'flex',
                    justifyContent: 'space-between'
                }}>
                    <span>{filteredItems.length} items</span>
                    <span>Powered by Autodesk Platform Services</span>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default FileExplorer;
