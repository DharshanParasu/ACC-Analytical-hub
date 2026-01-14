import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { storageService } from '../../services/storageService';
import PieChart from '../charts/PieChart';
import BarChart from '../charts/BarChart';
import LineChart from '../charts/LineChart';
import KPICard from '../charts/KPICard';
import DataTable from '../charts/DataTable';
import APSViewer from '../viewer/APSViewer';
import AIChatBot from '../ai/AIChatBot';
import PropertyFilter from './PropertyFilter';
import exportUtils from '../../utils/exportUtils';

const componentTypes = [
    { type: 'viewer', component: APSViewer },
    { type: 'filter', component: PropertyFilter },
    { type: 'pie', component: PieChart },
    { type: 'bar', component: BarChart },
    { type: 'line', component: LineChart },
    { type: 'kpi', component: KPICard },
    { type: 'table', component: DataTable },
    { type: 'chatbot', component: AIChatBot }
];

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Dashboard caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', color: 'white', textAlign: 'center' }}>
                    <h2>Something went wrong.</h2>
                    <p style={{ color: 'red' }}>{this.state.error && this.state.error.toString()}</p>
                    <button onClick={() => window.location.reload()} className="btn btn-primary">Reload Page</button>
                    <button onClick={this.props.onBack} className="btn btn-secondary" style={{ marginLeft: '10px' }}>Back to Overview</button>
                </div>
            );
        }

        return this.props.children;
    }
}

const DashboardView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewer, setViewer] = useState(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [globalModel, setGlobalModel] = useState(null);

    // Interaction Sync State - Default to true for consumers
    const [currentSelection, setCurrentSelection] = useState([]);
    const [interactionSync, setInteractionSync] = useState(true);

    useEffect(() => {
        try {
            const data = storageService.getDashboard(id);
            if (data) {
                setDashboard(data);
                setGlobalModel(data.globalModel);
            }
        } catch (err) {
            console.error("Error loading dashboard data:", err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const handleViewerReady = (viewerInstance) => {
        setViewer(viewerInstance);

        // Listen for selection changes
        try {
            viewerInstance.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
                if (!interactionSync) return;
                const selection = viewerInstance.getSelection();
                setCurrentSelection(selection);
            });
        } catch (err) {
            console.error("Error attaching viewer listener:", err);
        }
    };

    const handleModelLoaded = (viewerInstance) => {
        console.log('[DashboardView] Model loaded, enabling charts.');
        setModelLoaded(true);
    };

    const hexToVector4 = (hex) => {
        if (!hex) return null;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return new window.THREE.Vector4(r, g, b, 0.7);
    };

    const handleFilterClicked = (dbIds, colorHex) => {
        try {
            if (viewer && dbIds && dbIds.length > 0) {
                viewer.clearThemingColors();
                if (colorHex) {
                    const vec4 = hexToVector4(colorHex);
                    if (vec4) dbIds.forEach(id => viewer.setThemingColor(id, vec4));
                }
                viewer.select(dbIds);
                viewer.isolate(dbIds);
                viewer.fitToView(dbIds);
            } else if (viewer) {
                viewer.clearThemingColors();
                viewer.isolate(0);
                viewer.select([]);
                viewer.navigation.setRequestHomeView(true);
            }
        } catch (err) {
            console.error("Error handling filter click:", err);
        }
    };

    const handleThematicColorChange = (aggregation, colorMap) => {
        try {
            if (!viewer || !aggregation || !colorMap) return;
            viewer.clearThemingColors();
            Object.keys(aggregation).forEach((label, idx) => {
                const dbIds = aggregation[label].dbIds || aggregation[label];
                const colorHex = Array.isArray(colorMap) ? colorMap[idx] : colorMap[label];
                if (colorHex && dbIds) {
                    const vec4 = hexToVector4(colorHex);
                    if (vec4) dbIds.forEach(id => viewer.setThemingColor(id, vec4));
                }
            });
        } catch (err) {
            console.error("Error changing thematic colors:", err);
        }
    };

    const renderComponent = (comp) => {
        const componentObj = componentTypes.find(c => c.type === comp.type);
        if (!componentObj) return null;
        const ComponentType = componentObj.component;

        if (comp.type === 'viewer') {
            return (
                <ComponentType
                    config={comp.config}
                    modelUrn={globalModel?.modelUrn}
                    modelName={globalModel?.model?.name}
                    onViewerReady={handleViewerReady}
                    onModelLoaded={handleModelLoaded}
                />
            );
        }

        return (
            <div style={{ height: '100%', overflow: 'hidden' }}>
                <ComponentType
                    config={comp.config}
                    viewer={modelLoaded ? viewer : null}
                    onDataClick={handleFilterClicked}
                    onThematicColorChange={handleThematicColorChange}
                    scopedDbIds={interactionSync && currentSelection.length > 0 ? currentSelection : null}
                />
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ fontSize: '3rem' }}
                >⚙️</motion.div>
            </div>
        );
    }

    if (!dashboard) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'white' }}>
                <h2>Dashboard Not Found</h2>
                <button onClick={() => navigate('/overview')} className="btn btn-primary">Back</button>
            </div>
        );
    }

    // Defensive check for layout
    const layout = Array.isArray(dashboard.layout) ? dashboard.layout : [];

    return (
        <ErrorBoundary onBack={() => navigate('/overview')}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <div style={{
                    padding: 'var(--spacing-lg)',
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-bg-elevated)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 10
                }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{dashboard.name}</h1>
                        <p style={{ color: 'var(--color-text-subdued)', margin: 0 }}>{dashboard.description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {viewer && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px', padding: '6px 12px', background: 'var(--color-bg-base)', borderRadius: '20px', border: '1px solid var(--color-border)' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: interactionSync ? 'var(--color-primary)' : 'var(--color-text-subdued)', cursor: 'pointer' }}>
                                    ⚡ SYNC
                                </label>
                                <div
                                    onClick={() => {
                                        setInteractionSync(!interactionSync);
                                        if (interactionSync) setCurrentSelection([]);
                                    }}
                                    style={{
                                        width: '32px', height: '18px',
                                        background: interactionSync ? 'var(--color-primary)' : 'gray',
                                        borderRadius: '9px', position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{
                                        width: '14px', height: '14px', background: 'white', borderRadius: '50%',
                                        position: 'absolute', top: '2px', left: interactionSync ? '16px' : '2px', transition: 'all 0.2s'
                                    }} />
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => exportUtils.downloadDashboard(dashboard)}
                            className="btn btn-secondary"
                            style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}
                        >
                            📥 Export HTML
                        </button>
                        <button onClick={() => navigate(`/dashboard/edit/${id}`)} className="btn btn-secondary">✏️ Edit</button>
                        <button onClick={() => navigate('/overview')} className="btn btn-secondary">Exit</button>
                    </div>
                </div>

                {/* Grid Layout */}
                <div style={{ flex: 1, position: 'relative', overflow: 'auto', padding: '20px' }}>
                    <GridLayout
                        className="layout"
                        layout={layout}
                        cols={12}
                        rowHeight={80}
                        width={1200}
                        isDraggable={false}
                        isResizable={false}
                        margin={[16, 16]}
                    >
                        {dashboard.components.map((comp) => (
                            <div key={comp.id} style={{
                                background: 'var(--color-bg-base)',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden',
                                border: '1px solid var(--color-border)'
                            }}>
                                {renderComponent(comp)}
                            </div>
                        ))}
                    </GridLayout>
                </div>
            </motion.div>
        </ErrorBoundary>
    );
};

export default DashboardView;
