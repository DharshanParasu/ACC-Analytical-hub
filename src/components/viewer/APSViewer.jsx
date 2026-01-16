import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FileExplorer from './FileExplorer';
import apsService from '../../services/apsService';

const APSViewer = ({ config = {}, modelUrn, modelName, onViewerReady, onModelLoaded, onRequestFileBrowse }) => {
    const viewerContainer = useRef(null);
    const [viewer, setViewer] = useState(null);
    const [error, setError] = useState(null);
    const { title = '3D Model Viewer' } = config;

    // 1. Initialize Viewer once
    useEffect(() => {
        if (!viewerContainer.current) return;
        if (typeof window.Autodesk === 'undefined') {
            setError('APS Viewer SDK not loaded.');
            return;
        }

        const options = {
            env: 'AutodeskProduction',
            api: 'derivativeV2',
            getAccessToken: async (onTokenReady) => {
                const token = await apsService.getAccessToken();
                if (token) onTokenReady(token, 3600);
            }
        };

        window.Autodesk.Viewing.Initializer(options, () => {
            const container = viewerContainer.current;
            if (!container) return;
            const instance = new window.Autodesk.Viewing.GuiViewer3D(container);
            instance.start();
            setViewer(instance);

            if (onViewerReady) {
                onViewerReady(instance);
            }
        });

        return () => {
            if (viewer) {
                viewer.finish();
                setViewer(null);
            }
        };
    }, []);

    // 2. Load Model when viewer is ready or selection changes
    useEffect(() => {
        console.log('[APSViewer] Prop Update:', { viewer: !!viewer, modelUrn });
        if (!viewer || !modelUrn) return;

        const documentId = `urn:${modelUrn}`;
        console.log('[APSViewer] Loading Document:', documentId);

        // Event listener for when model structure/properties are ready
        const onModelReady = () => {
            viewer.removeEventListener(window.Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, onModelReady);
            console.log('[Viewer] Object tree created, model ready for analytics.');
            if (onModelLoaded) onModelLoaded(viewer);
        };
        viewer.addEventListener(window.Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, onModelReady);

        window.Autodesk.Viewing.Document.load(
            documentId,
            (doc) => {
                const defaultModel = doc.getRoot().getDefaultGeometry();
                viewer.loadDocumentNode(doc, defaultModel);
                setError(null);
            },
            (errorCode) => {
                console.error('Error loading document:', errorCode);
                setError('Failed to load model.');
            }
        );

        return () => {
            if (viewer) viewer.removeEventListener(window.Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, onModelReady);
        };
    }, [viewer, modelUrn]);

    const handleModelSelect = (selection) => {
        setSelectedModel(selection);
        setError(null);
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-md)'
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-md)'
                }}>
                    <h3 style={{
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 'var(--font-weight-semibold)',
                        color: 'var(--color-text-base)'
                    }}>
                        {title}
                    </h3>

                    <div style={{
                        display: 'flex',
                        gap: 'var(--spacing-xs)'
                    }}>
                        {!error && viewer && (
                            <>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                        viewer.isolate(0);
                                        viewer.select([]);
                                        viewer.navigation.setRequestHomeView(true);
                                    }}
                                    className="btn-icon"
                                    title="Clear Filters"
                                    style={{ background: 'rgba(29, 185, 84, 0.2)', color: 'var(--color-primary)' }}
                                >
                                    🧹
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => viewer?.navigation.setRequestHomeView(true)}
                                    className="btn-icon"
                                    title="Reset View"
                                >
                                    🔄
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => viewer?.navigation.setRequestFitToView(true)}
                                    className="btn-icon"
                                    title="Fit to View"
                                >
                                    ⛶
                                </motion.button>
                            </>
                        )}
                    </div>
                </div>

                <div
                    ref={viewerContainer}
                    style={{
                        flex: 1,
                        minHeight: 0,
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        background: 'var(--color-bg-press)',
                        border: '1px solid var(--color-border)',
                        position: 'relative'
                    }}
                >
                    {(!viewer || error || !modelUrn) && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 'var(--spacing-xl)',
                            textAlign: 'center',
                            zIndex: 10,
                            background: 'var(--color-bg-press)' // Ensure opacity
                        }}>
                            <div style={{ fontSize: '64px', marginBottom: 'var(--spacing-md)' }}>
                                {error ? '⚠️' : (modelUrn ? '🏗️' : '📁')}
                            </div>
                            <div style={{
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: 'var(--font-weight-semibold)',
                                color: error ? 'var(--color-error)' : 'var(--color-text-base)',
                                marginBottom: 'var(--spacing-sm)'
                            }}>
                                {error ? error : (modelUrn ? (modelName || 'Loading Model...') : 'No Model Selected')}
                            </div>
                            {error && (
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-subdued)', marginBottom: 'var(--spacing-md)' }}>
                                    Check console for details.
                                </div>
                            )}

                            {!modelUrn && !error && (
                                <>
                                    <div style={{
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-text-subdued)',
                                        marginBottom: 'var(--spacing-lg)',
                                        maxWidth: '300px'
                                    }}>
                                        Please select a 3D model from the dashboard settings to view it here.
                                    </div>
                                    {onRequestFileBrowse && (
                                        <motion.button
                                            whileHover={{ scale: 1.04 }}
                                            whileTap={{ scale: 0.96 }}
                                            onClick={onRequestFileBrowse}
                                            className="btn btn-primary"
                                            style={{ fontSize: 'var(--font-size-sm)' }}
                                        >
                                            Select Model
                                        </motion.button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {modelUrn && modelName && (
                    <div style={{
                        marginTop: 'var(--spacing-sm)',
                        padding: 'var(--spacing-sm)',
                        background: 'var(--color-bg-press)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-subdued)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>
                            🏗️ {modelName}
                        </span>
                    </div>
                )}
            </motion.div>
        </>
    );
};

export default APSViewer;
