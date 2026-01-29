import React, { useState, useEffect, useRef } from 'react';
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
import ScheduleVisual from '../charts/ScheduleVisual';
import exportUtils from '../../utils/exportUtils';
import { analyticsService } from '../../services/analyticsService';
import apsService from '../../services/apsService';
import { RefreshCw, Zap, FileText, Edit2, LogOut, Loader2, Maximize2, Minimize2 } from 'lucide-react';

const componentTypes = [
    { type: 'viewer', component: APSViewer },
    { type: 'filter', component: PropertyFilter },
    { type: 'pie', component: PieChart },
    { type: 'bar', component: BarChart },
    { type: 'line', component: LineChart },
    { type: 'kpi', component: KPICard },
    { type: 'table', component: DataTable },
    { type: 'schedule', component: ScheduleVisual },
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
    const { projectId, id } = useParams();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewer, setViewer] = useState(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [globalModel, setGlobalModel] = useState(null);

    // Interaction Sync State - Default to true for consumers
    const [currentSelection, setCurrentSelection] = useState([]);
    const [interactionSync, setInteractionSync] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    useEffect(() => {
        // EVA icons removed
    }, [dashboard, isRefreshing, interactionSync]);

    useEffect(() => {
        try {
            const data = storageService.getDashboard(id);
            if (data) {
                setDashboard(data);
                // Handle both legacy (globalModel) and new (projectData.model) structures
                const modelData = data.projectData?.model || data.globalModel;

                // Normalize to ensure we have modelUrn
                if (modelData) {
                    // Check if it's the new format (urn) or old (modelUrn)
                    const normalizedModel = {
                        ...modelData,
                        modelUrn: modelData.urn || modelData.modelUrn
                    };
                    setGlobalModel(normalizedModel);
                }
            }
        } catch (err) {
            console.error("Error loading dashboard data:", err);
        } finally {
            setLoading(false);
        }
    }, [id]);



    // Unified Data State (Master Data)
    const [masterData, setMasterData] = useState([]);
    const [availableProperties, setAvailableProperties] = useState([]);
    const [propertiesLoading, setPropertiesLoading] = useState(false);



    // Responsive Canvas Logic
    // Initialize with mostly full width (subtracting approximate padding) to prevent "shrink" effect on load
    const [canvasWidth, setCanvasWidth] = useState(window.innerWidth - 48);
    const canvasRef = useRef(null);
    const containerRef = useRef(null); // Ref for global container to maximize

    useEffect(() => {
        if (!canvasRef.current) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                // Subtract 48px padding (24px * 2) to match DashboardBuilder consistency
                const newWidth = entry.contentRect.width;
                if (newWidth > 100) { // Safety check to avoid zero/small width glitches
                    setCanvasWidth(newWidth);
                }
            }
        });

        resizeObserver.observe(canvasRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Full Screen Logic
    useEffect(() => {
        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);

    const toggleFullScreen = async () => {
        if (!containerRef.current) return;

        try {
            if (!document.fullscreenElement) {
                await containerRef.current.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error("Error toggling full screen:", err);
        }
    };

    // Auto-load data when model is ready (replacing old processJoins)
    const handleModelLoaded = async (viewerInstance) => {
        console.log('[DashboardView] Model loaded, enabling charts.');
        const targetViewer = viewerInstance || viewer;
        if (targetViewer) {
            setModelLoaded(true);
            setViewer(targetViewer);
            // Trigger initial data load
            await refreshData(targetViewer);
            // Also explicitly fetch properties (redundant with refreshData but safer for initial load)
            await fetchProperties(targetViewer);
        }
    };

    const handleViewerReady = (viewerInstance) => {
        setViewer(viewerInstance);

        // Listen for selection changes
        try {
            viewerInstance.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
                // Check current sync state from ref or state (ensure closure freshness)
                if (!interactionSync) return;
                const selection = viewerInstance.getSelection();
                setCurrentSelection(selection);
            });
        } catch (err) {
            console.error("Error attaching viewer listener:", err);
        }
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

    const fetchProperties = async (viewerInstance) => {
        if (!viewerInstance || !dashboard?.projectData) return;
        setPropertiesLoading(true);
        try {
            const props = await analyticsService.getUnifiedPropertyNames(viewerInstance, dashboard.projectData);
            setAvailableProperties(props);
            console.log('[DashboardView] Properties updated:', props.length);
        } catch (err) {
            console.error('[DashboardView] Failed to fetch properties:', err);
        } finally {
            setPropertiesLoading(false);
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
                    modelName={globalModel?.name}
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
                    masterData={masterData}
                    availableProperties={availableProperties}
                    propertiesLoading={propertiesLoading}
                />
            </div>
        );
    };


    const refreshData = async (viewerOverride = null) => {
        const targetViewer = viewerOverride || viewer;
        console.log('[DashboardView] Refresh Clicked', targetViewer ? 'with viewer' : 'no viewer');

        if (!dashboard?.projectData) return;

        setIsRefreshing(true);

        try {
            const projectData = dashboard.projectData;
            const newSources = { ...projectData.sources };

            // Only refresh Excel if we have a token (skipping deeply nested redundant checks for brevity, assuming similar logic to Builder)
            // Ideally we would share this "refresh sources" logic in a service, but for now we keep it inline to minimize diff risk.
            if (projectData.sources) {
                const token = await apsService.getAccessToken();
                if (token) {
                    for (const [key, source] of Object.entries(newSources)) {
                        if (source.fileUrn && source.type === 'excel') {
                            try {
                                const arrayBuffer = await apsService.getFileContent(source.fileUrn, token);
                                const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
                                const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                                newSources[key] = { ...source, data: jsonData, lastUpdated: new Date().toISOString() };
                            } catch (e) { console.error('Refesh error', e); }
                        }
                    }
                }
            }

            // Re-fetch ALL Master Data (Calculation happens here inside getAllData)
            if (targetViewer) {
                const updatedProjectData = { ...projectData, sources: newSources };
                // Update local dashboard state to keep it in sync
                setDashboard(prev => ({ ...prev, projectData: updatedProjectData }));

                const allData = await analyticsService.getAllData(targetViewer, updatedProjectData);
                if (allData && allData.results) {
                    setMasterData(allData.results);
                    console.log('[DashboardView] Master Data Processed:', allData.results.length);
                }

                // Refresh property list for UI
                await fetchProperties(targetViewer);
            }

        } catch (error) {
            console.error('[DashboardView] Error refreshing data:', error);
            alert(`Error during refresh: ${error.message}`);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                    <Loader2 className="w-12 h-12 text-lime-400" />
                </motion.div>
            </div>
        );
    }

    if (!dashboard) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'white' }}>
                <h2>Dashboard Not Found</h2>
                <button onClick={() => navigate(projectId ? `/project/${projectId}` : '/projects')} className="btn btn-primary">Back</button>
            </div>
        );
    }

    // Defensive check for layout
    const layout = Array.isArray(dashboard.layout) ? dashboard.layout : [];

    return (
        <ErrorBoundary onBack={() => navigate(projectId ? `/project/${projectId}` : '/projects')}>
            <motion.div
                ref={containerRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full min-h-screen flex flex-col bg-[var(--color-bg-base)]"
                style={{ overflowY: 'auto' }}
            >
                {/* Header */}
                <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]/80 backdrop-blur-md flex justify-between items-center z-10 sticky top-0 transition-colors duration-200">
                    <div>
                        <h1 className="text-2xl font-black text-[var(--color-text-base)] m-0 tracking-tight">{dashboard.name}</h1>
                        <p className="text-[var(--color-text-muted)] text-sm mt-1">{dashboard.description}</p>
                    </div>
                    <div className="flex gap-3 items-center">
                        <button
                            onClick={toggleFullScreen}
                            className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-base)] rounded-full font-medium hover:bg-[var(--color-hover)] transition-colors flex items-center gap-2 px-3 py-2 text-sm"
                            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                        >
                            {isFullScreen ? (
                                <Minimize2 className="w-4 h-4" />
                            ) : (
                                <Maximize2 className="w-4 h-4" />
                            )}
                        </button>
                        <button
                            onClick={refreshData}
                            disabled={isRefreshing}
                            className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-base)] rounded-full font-medium hover:bg-[var(--color-hover)] transition-colors flex items-center gap-2 px-5 py-2 text-sm"
                        >
                            {isRefreshing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <span>
                                    <RefreshCw className="w-4 h-4" />
                                </span>
                            )}
                            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                        </button>

                        {viewer && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-elevated)] rounded-full border border-[var(--color-border)]">
                                <label className={`text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 ${interactionSync ? 'text-lime-400' : 'text-[var(--color-text-muted)]'}`}>
                                    <span>
                                        <Zap className={`w-3.5 h-3.5 ${interactionSync ? 'text-lime-400' : 'text-[var(--color-text-muted)]'}`} />
                                    </span>
                                    SYNC
                                </label>
                                <div
                                    onClick={() => {
                                        setInteractionSync(!interactionSync);
                                        if (interactionSync) setCurrentSelection([]);
                                    }}
                                    className={`w-8 h-4.5 rounded-full relative cursor-pointer transition-colors ${interactionSync ? 'bg-lime-500' : 'bg-[var(--color-bg-surface)]'}`}
                                >
                                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${interactionSync ? 'left-4' : 'left-0.5'}`} />
                                </div>
                            </div>
                        )}
                        <button
                            className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-base)] rounded-full font-medium hover:bg-[var(--color-hover)] transition-colors flex items-center gap-2 px-5 py-2 text-sm"
                            onClick={() => exportUtils.exportToHTML(dashboard, 'dashboard-canvas')}
                        >
                            <span>
                                <FileText className="w-4 h-4 text-cyan-400" />
                            </span>
                            Export HTML
                        </button>
                        <button onClick={() => navigate(projectId ? `/project/${projectId}/dashboard/edit/${id}` : `/dashboard/edit/${id}`)} className="btn btn-secondary rounded-full flex items-center gap-2 border border-[var(--color-border)] text-[var(--color-text-base)] hover:bg-[var(--color-hover)] bg-[var(--color-bg-elevated)]">
                            <span>
                                <Edit2 className="w-4 h-4" />
                            </span>
                            Edit
                        </button>
                        <button onClick={() => navigate(projectId ? `/project/${projectId}` : '/projects')} className="btn btn-secondary rounded-full flex items-center gap-2 border border-[var(--color-border)] text-[var(--color-text-base)] hover:bg-[var(--color-hover)] bg-[var(--color-bg-elevated)]">
                            <span>
                                <LogOut className="w-4 h-4" />
                            </span>
                            Exit
                        </button>
                    </div>
                </div>

                {/* Grid Layout */}
                <div ref={canvasRef} className="flex-1 relative overflow-auto p-6" id="dashboard-canvas">
                    <GridLayout
                        className="layout"
                        layout={layout}
                        cols={12}
                        rowHeight={30}
                        width={canvasWidth}
                        isDraggable={false}
                        isResizable={false}
                    >
                        {dashboard.components.map(comp => (
                            <div key={comp.id} className="border border-white/5 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-sm shadow-xl">
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
