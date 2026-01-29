import { useState, useEffect, useRef, Component } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GridLayout from 'react-grid-layout';
import Draggable from 'react-draggable';
import 'react-grid-layout/css/styles.css';
import { storageService } from '../../services/storageService';
import PieChart from '../charts/PieChart';
import BarChart from '../charts/BarChart';
import LineChart from '../charts/LineChart';
import KPICard from '../charts/KPICard';
import DataTable from '../charts/DataTable';
import APSViewer from '../viewer/APSViewer';
import AIChatBot from '../ai/AIChatBot';
import FileExplorer from '../viewer/FileExplorer';
import PropertyFilter from './PropertyFilter';
import ScheduleVisual from '../charts/ScheduleVisual';
import analyticsService from '../../services/analyticsService';
import exportUtils from '../../utils/exportUtils';
import * as XLSX from 'xlsx';
import apsService from '../../services/apsService';
import { Box, Search, PieChart as PieChartIcon, BarChart3, TrendingUp, Target, List, Calendar, MessageSquare, ArrowDownToLine, Maximize2, Minimize2, ChevronLeft, ChevronRight, X, GripHorizontal, Sliders } from 'lucide-react';
import DataSourcesPanel from './DataSourcesPanel';
import { useTheme } from '../../context/ThemeContext';

const componentTypes = [
    { type: 'viewer', icon: Box, label: '3D Viewer', component: APSViewer, defaultSize: { w: 6, h: 4 } },
    { type: 'filter', icon: Search, label: 'Property Filter', component: PropertyFilter, defaultSize: { w: 3, h: 4 } },
    { type: 'pie', icon: PieChartIcon, label: 'Pie Chart', component: PieChart, defaultSize: { w: 3, h: 3 } },
    { type: 'bar', icon: BarChart3, label: 'Bar Chart', component: BarChart, defaultSize: { w: 4, h: 3 } },
    { type: 'line', icon: TrendingUp, label: 'Line Chart', component: LineChart, defaultSize: { w: 6, h: 3 } },
    { type: 'kpi', icon: Target, label: 'KPI Card', component: KPICard, defaultSize: { w: 2, h: 2 } },
    { type: 'table', icon: List, label: 'Data Table', component: DataTable, defaultSize: { w: 6, h: 3 } },
    { type: 'schedule', icon: Calendar, label: 'Schedule Visual', component: ScheduleVisual, defaultSize: { w: 12, h: 6 } },
    { type: 'chatbot', icon: MessageSquare, label: 'AI Assistant', component: AIChatBot, defaultSize: { w: 4, h: 5 } }
];

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("DashboardBuilder caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', color: 'white', textAlign: 'center' }}>
                    <h2>Something went wrong in the Builder.</h2>
                    <p style={{ color: 'red' }}>{this.state.error && this.state.error.toString()}</p>
                    <button onClick={() => window.location.reload()} className="btn btn-primary">Reload Page</button>
                    <button onClick={this.props.onBack} className="btn btn-secondary" style={{ marginLeft: '10px' }}>Back to Overview</button>
                </div>
            );
        }
        return this.props.children;
    }
}

const DashboardBuilder = () => {
    const navigate = useNavigate();
    const { projectId, id } = useParams();
    const { theme } = useTheme();
    const [dashboardName, setDashboardName] = useState('New Dashboard');
    const [dashboardDescription, setDashboardDescription] = useState('');
    const [layout, setLayout] = useState([]);
    const [components, setComponents] = useState([]);
    const [projectData, setProjectData] = useState({ model: null, sources: {} });
    const [showFileExplorer, setShowFileExplorer] = useState(false);
    const [fileExplorerTarget, setFileExplorerTarget] = useState('viewer');

    // Interaction Sync State
    const [interactionSync, setInteractionSync] = useState(false);
    const [paletteCollapsed, setPaletteCollapsed] = useState(false);
    const [settingsCollapsed, setSettingsCollapsed] = useState(false);
    const [isPaletteDocked, setIsPaletteDocked] = useState(false);
    const [isSettingsDocked, setIsSettingsDocked] = useState(false);
    const [palettePopPos, setPalettePopPos] = useState({ x: 24, y: 500 }); // Even safer default
    const [settingsPopPos, setSettingsPopPos] = useState({ x: 800, y: 500 }); // Even safer default-right

    // Panel Resizing State
    const [paletteSize, setPaletteSize] = useState({ w: 260, h: 500 });
    const [settingsSize, setSettingsSize] = useState({ w: 320, h: 600 });
    const resizingRef = useRef(null); // 'palette' or 'settings'

    // Bounds Correction Effect
    useEffect(() => {
        const handleResize = () => {
            const container = containerRef.current;
            if (!container) return;
            const { offsetWidth: w, offsetHeight: h } = container;

            setPalettePopPos(prev => ({
                x: Math.min(prev.x, w - 60),
                y: Math.min(prev.y, h - 80)
            }));
            setSettingsPopPos(prev => ({
                x: Math.min(prev.x, w - 60),
                y: Math.min(prev.y, h - 80)
            }));
        };

        window.addEventListener('resize', handleResize);
        // Also run once on mount
        const timer = setTimeout(handleResize, 500);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timer);
        };
    }, []);

    const [currentSelection, setCurrentSelection] = useState([]);

    const [selectedComponentId, setSelectedComponentId] = useState(null);
    const [viewer, setViewer] = useState(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [availableProperties, setAvailableProperties] = useState([]);
    const [propsLoading, setPropsLoading] = useState(false);
    const [joinedData, setJoinedData] = useState({});

    // Master Data for Sync Aggregation (Single Source of Truth)
    const [masterData, setMasterData] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Node refs for react-draggable to avoid findDOMNode error
    const paletteRef = useRef(null);
    const settingsRef = useRef(null);
    const palettePopRef = useRef(null);
    const settingsPopRef = useRef(null);
    const containerRef = useRef(null);

    const [isFullScreen, setIsFullScreen] = useState(false);

    useEffect(() => {
        console.log('[DashboardBuilder] useEffect triggered. ID:', id);
        if (id) {
            try {
                const dashboard = storageService.getDashboard(id);
                console.log('[DashboardBuilder] Loaded dashboard from storage:', dashboard);
                if (dashboard) {
                    setDashboardName(dashboard.name);
                    setDashboardDescription(dashboard.description || '');
                    setComponents(dashboard.components || []);
                    setLayout(dashboard.layout || []);
                    setProjectData(dashboard.projectData || { model: dashboard.globalModel || null, sources: {} });
                    console.log('[DashboardBuilder] State updated with dashboard data.');
                } else {
                    console.error('[DashboardBuilder] Dashboard not found for ID:', id);
                    // Optional: navigate to overview or show error state
                }
            } catch (err) {
                console.error("Error loading dashboard for edit:", err);
            }
        } else {
            // NEW DASHBOARD: Initialize with a default 3D Viewer
            console.log('[DashboardBuilder] No ID provided. Initializing new dashboard.');
            const defaultViewer = {
                id: `viewer-${Date.now()}`,
                type: 'viewer',
                config: { title: '3D Viewer' }
            };
            setComponents([defaultViewer]);
            setLayout([{
                i: defaultViewer.id,
                x: 0,
                y: 0,
                w: 6,
                h: 4
            }]);
        }

        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullScreenChange);
        };
    }, [id]);

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



    // Resizing Logic: Global Listeners
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!resizingRef.current) return;

            if (resizingRef.current === 'palette') {
                setPaletteSize(prev => ({
                    w: Math.max(200, prev.w + e.movementX),
                    h: Math.max(300, prev.h + e.movementY)
                }));
            } else if (resizingRef.current === 'settings') {
                setSettingsSize(prev => ({
                    w: Math.max(250, prev.w + e.movementX), // Settings on right, dragging right increases width
                    h: Math.max(300, prev.h + e.movementY)
                }));
            }
        };

        const handleMouseUp = () => {
            if (resizingRef.current) {
                resizingRef.current = null;
                document.body.style.cursor = 'default';
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const addComponent = (type) => {
        const componentType = componentTypes.find(c => c.type === type);
        const newComponent = {
            id: `${type}-${Date.now()}`,
            type,
            config: {
                title: componentType?.label || 'Component'
            }
        };

        const newLayoutItem = {
            i: newComponent.id,
            x: (layout.length * 2) % 12,
            y: Infinity, // puts it at the bottom
            ...componentType.defaultSize
        };

        setComponents([...components, newComponent]);
        setLayout([...layout, newLayoutItem]);
    };

    // Responsive Canvas Logic
    const [canvasWidth, setCanvasWidth] = useState(1200);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                // Subtract padding (e.g. 32px total for var(--spacing-md))
                // or just use content box if styled correctly.
                // Using contentRect.width is safest.
                setCanvasWidth(entry.contentRect.width - 48); // 48px safety buffer for scrollbar/padding
            }
        });

        resizeObserver.observe(canvasRef.current);
        return () => resizeObserver.disconnect();
    }, [paletteCollapsed, settingsCollapsed]); // Re-observe if layout changes significantly (optional but safe)

    const removeComponent = (componentId) => {
        setComponents(components.filter(c => c.id !== componentId));
        setLayout(layout.filter(l => l.i !== componentId));
    };

    const saveDashboard = () => {
        const dashboard = {
            id: id || `dashboard-${Date.now()}`,
            projectId,
            name: dashboardName,
            description: dashboardDescription,
            components,
            layout,
            projectData,
            thumbnail: projectData.model ? '🏗️' : (components.find(c => c.type === 'viewer') ? '🏗️' : '📊')
        };

        storageService.saveDashboard(dashboard);
        navigate(projectId ? `/project/${projectId}` : '/projects');
    };


    // Legacy Join Effect - Removed in favor of explicit Save action
    // useEffect(() => { ... }, [projectData.sources, viewer]);

    // Effect: Join External Data when sources change
    // Clean up or remove old effect entirely (commented out above or replaced)

    // Effect: Refresh properties when sources change
    useEffect(() => {
        if (viewer && modelLoaded) {
            fetchProperties(viewer);
        }
    }, [projectData.sources, modelLoaded]);

    const handleViewerReady = (viewerInstance) => {
        setViewer(viewerInstance);

        // Listen for selection changes to update global selection state
        try {
            viewerInstance.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
                if (!interactionSync) return;

                const selection = viewerInstance.getSelection();
                console.log('[Dashboard] Selection changed (Sync ON):', selection);
                setCurrentSelection(selection);
            });
        } catch (err) {
            console.error("Error in viewer ready handler:", err);
        }
    };

    const handleModelLoaded = async (viewerInstance) => {
        console.log('[Builder] Model loaded, ready for data.');
        setViewer(viewerInstance);
        setModelLoaded(true);
        // Automatically trigger Save & Merge on load
        handleSaveData(viewerInstance);
    };

    const fetchProperties = async (viewerInstance) => {
        if (!viewerInstance || !viewerInstance.model) {
            setModelLoaded(false);
            return;
        }

        setPropsLoading(true);

        // FAST PATH: If we already have masterData, extract keys immediately
        // This ensures the dropdowns are populated instantly while the background scan runs
        if (masterData && masterData.length > 0) {
            console.log('[Builder] Fast-tracking properties from Master Data...');
            const masterKeys = new Set();
            // Sample first 50 records for relevant keys to avoid perf hit on massive datasets
            // but usually masterData objects already have consistent keys
            masterData.slice(0, 50).forEach(item => {
                Object.keys(item).forEach(key => {
                    if (key !== 'dbId' && key !== 'name') masterKeys.add(key);
                });
            });

            if (masterKeys.size > 0) {
                const sortedKeys = Array.from(masterKeys).sort();
                setAvailableProperties(sortedKeys);
                console.log('[Builder] Fast-track complete:', sortedKeys.length, 'props');
            }
        }

        console.log('[Builder] Starting background unified property scan...');
        try {
            const props = await analyticsService.getUnifiedPropertyNames(viewerInstance, projectData);
            if (props && props.length > 0) {
                // Update with full list from unified scan
                setAvailableProperties(props);
            } else if (!masterData || masterData.length === 0) {
                // Only clear if we have absolutely no data source
                setAvailableProperties([]);
            }
        } catch (err) {
            console.error('[Builder] Failed to load properties in background:', err);
            // Don't clear existing if scan fails
        } finally {
            setPropsLoading(false);
        }
    };

    const updateComponentConfig = (id, newConfig) => {
        setComponents(prevComponents => prevComponents.map(c =>
            c.id === id ? { ...c, config: { ...c.config, ...newConfig } } : c
        ));
    };

    const addFilter = (id) => {
        const comp = components.find(c => c.id === id);
        const filters = comp.config.filters || [];
        updateComponentConfig(id, {
            filters: [...filters, { attribute: '', operator: 'equals', value: '' }]
        });
    };

    const removeFilter = (compId, filterIndex) => {
        const comp = components.find(c => c.id === compId);
        const filters = (comp.config.filters || []).filter((_, i) => i !== filterIndex);
        updateComponentConfig(compId, { filters });
    };

    const updateFilter = (compId, filterIndex, filterUpdate) => {
        const comp = components.find(c => c.id === compId);
        const filters = (comp.config.filters || []).map((f, i) =>
            i === filterIndex ? { ...f, ...filterUpdate } : f
        );
        updateComponentConfig(compId, { filters });
    };

    const hexToVector4 = (hex) => {
        if (!hex) return null;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return new window.THREE.Vector4(r, g, b, 0.7); // 0.7 for slight transparency
    };

    const handleChartDataClick = (dbIds, colorHex) => {
        try {
            if (viewer && dbIds && dbIds.length > 0) {
                viewer.clearThemingColors();
                if (colorHex) {
                    const vec4 = hexToVector4(colorHex);
                    if (vec4) {
                        dbIds.forEach(id => viewer.setThemingColor(id, vec4));
                    }
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
            console.error("Error handling chart click:", err);
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
            console.error("Error setting thematic colors:", err);
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
                    modelUrn={projectData?.model?.urn}
                    modelName={projectData?.model?.name}
                    onViewerReady={handleViewerReady}
                    onModelLoaded={handleModelLoaded}
                    onRequestFileBrowse={() => {
                        setFileExplorerTarget('viewer');
                        setShowFileExplorer(true);
                    }}
                />
            );
        }

        return (
            <div
                onClick={() => setSelectedComponentId(comp.id)}
                style={{ height: '100%', cursor: 'pointer' }}
            >
                <ComponentType
                    config={comp.config}
                    viewer={modelLoaded ? viewer : null}
                    joinedData={joinedData}
                    masterData={masterData}
                    availableProperties={availableProperties}
                    propertiesLoading={propsLoading}
                    onDataClick={handleChartDataClick}
                    onThematicColorChange={handleThematicColorChange}
                    scopedDbIds={interactionSync && currentSelection.length > 0 ? currentSelection : null}
                />
            </div>
        );
    };

    const handleSaveData = async (viewerOverride = null) => {
        // Ensure viewerOverride is actually a viewer instance, not a React event object
        const targetViewer = (viewerOverride && viewerOverride.model) ? viewerOverride : viewer;

        if (!targetViewer) {
            alert("No viewer active. Cannot scan model.");
            return;
        }
        setIsRefreshing(true);
        console.log('[Builder] Starting Full Data Save & Merge...');

        try {
            // 1. Refresh External Files (Excel) - Update projectData state first
            const newSources = { ...projectData.sources };
            const token = await apsService.getAccessToken();

            // We need to wait for source updates before merging
            const updatePromises = Object.entries(newSources).map(async ([key, source]) => {
                // Optimization: Skip download if we already have data and it's not marked dirty
                // or if we're just refreshing but URN is same and we have data.
                if (source.fileUrn && source.type === 'excel') {
                    const isActuallyDirty = source.isDirty || !source.data;

                    if (!isActuallyDirty) {
                        console.log(`[Builder] Skipping download for ${source.fileName} (not dirty)`);
                        return;
                    }

                    try {
                        const arrayBuffer = await apsService.getFileContent(source.fileUrn, token);
                        const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const jsonData = window.XLSX.utils.sheet_to_json(worksheet);

                        // Update source object in place
                        newSources[key] = {
                            ...source,
                            data: jsonData,
                            lastUpdated: new Date().toISOString(),
                            isDirty: false // Reset dirty flag after successful download
                        };
                    } catch (err) {
                        console.error(`[Builder] Failed to refresh source ${source.fileName}:`, err);
                    }
                }
            });

            await Promise.all(updatePromises);

            // Update Local State for Project Data
            const updatedProjectData = { ...projectData, sources: newSources };
            setProjectData(updatedProjectData);

            // 2. Fetch ALL Master Data (Model + External)
            console.log('[Builder] Fetching master data...');
            const syncResult = await analyticsService.getAllData(targetViewer, updatedProjectData);

            const finalSources = { ...updatedProjectData.sources };

            if (syncResult && !syncResult.error) {
                const results = syncResult.results || [];
                setMasterData(results);

                // Update statuses from stats
                Object.keys(finalSources).forEach(key => {
                    if (key === 'model') {
                        finalSources[key] = { ...finalSources[key], syncStatus: 'success', error: null };
                        return;
                    }

                    const stats = syncResult.sourceStats && syncResult.sourceStats[key];
                    if (stats) {
                        finalSources[key] = {
                            ...finalSources[key],
                            syncStatus: stats.matchCount > 0 ? 'success' : 'warning',
                            matchStats: stats,
                            error: stats.matchCount === 0 ? 'No property matches found in 3D model. Check your mapping keys.' : null
                        };
                    } else {
                        // Source exists but wasn't in sync results (maybe no mapping set yet)
                        const hasMapping = finalSources[key].mapping?.modelKey && finalSources[key].mapping?.fileKey;
                        finalSources[key] = {
                            ...finalSources[key],
                            syncStatus: hasMapping ? 'warning' : null,
                            error: hasMapping ? 'No data merged for this source.' : null
                        };
                    }
                });
            } else {
                console.warn('[Builder] Sync failed or error returned:', syncResult?.error);
                setMasterData([]);
                // Mark all as error with specific message
                const errorMsg = syncResult?.error || 'Sync failed completely.';
                Object.keys(finalSources).forEach(key => {
                    finalSources[key] = { ...finalSources[key], syncStatus: 'error', error: errorMsg };
                });
            }

            setProjectData(prev => ({
                ...prev,
                sources: finalSources,
                isDirty: false // Reset global project dirty flag (used for calcs)
            }));

            // 3. Re-fetch Property List for UI
            await fetchProperties(targetViewer);

        } catch (error) {
            console.error('[Builder] Error during Save & Merge:', error);
            alert("Failed to save and merge data. See console.");
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div ref={containerRef} className={`w-full h-full ${isFullScreen ? 'bg-[var(--color-bg-base)]' : ''}`}>
            <ErrorBoundary onBack={() => navigate(projectId ? `/project/${projectId}` : '/projects')}>
                <>
                    {/* Blocking Overlay for Save/Merge (Global in Builder) */}
                    {isRefreshing && (
                        <div className="fixed inset-0 bg-black/85 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm">
                            <div className="w-16 h-16 border-4 border-white/10 border-t-cyan-400 rounded-full animate-spin mb-6"></div>
                            <div className="text-white font-bold text-2xl tracking-tight">Merging Data...</div>
                            <div className="text-white/70 text-sm mt-2 max-w-sm text-center leading-relaxed">
                                Scanning model properties and joining external sources.<br />
                                Please wait until this completes to ensure data consistency.
                            </div>
                        </div>
                    )}

                    <div className={`relative w-full ${isFullScreen ? 'h-full' : 'h-[calc(100vh-140px)]'} visible opacity-100 overflow-hidden flex flex-col`}>
                        {/* Floating Sidebars Wrap */}
                        <div className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-hidden">
                            {/* 1. Component Palette - Round Pop or Full Panel */}
                            <AnimatePresence mode="wait">
                                {isPaletteDocked ? (
                                    <Draggable
                                        key="palette-pop"
                                        nodeRef={palettePopRef}
                                        position={palettePopPos}
                                        onDrag={(e, data) => setPalettePopPos({ x: data.x, y: data.y })}
                                        bounds="parent"
                                    >
                                        <div
                                            ref={palettePopRef}
                                            className="absolute z-[60] w-14 h-14 pointer-events-auto"
                                            style={{ cursor: 'move' }}
                                        >
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                className="w-full h-full flex items-center justify-center"
                                            >
                                                <button
                                                    onClick={() => setIsPaletteDocked(false)}
                                                    className="w-full h-full rounded-full bg-gradient-to-br from-lime-400 to-lime-500 text-black shadow-[0_8px_32px_rgba(163,230,53,0.4)] flex items-center justify-center cursor-pointer border-none group transition-all duration-300"
                                                    title="Open Components"
                                                >
                                                    <Box className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                                </button>
                                            </motion.div>
                                        </div>
                                    </Draggable>
                                ) : (
                                    <Draggable
                                        key="palette-floating"
                                        nodeRef={paletteRef}
                                        handle=".panel-handle"
                                        bounds="parent"
                                    >
                                        <motion.div
                                            ref={paletteRef}
                                            initial={{ x: -20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: -20, opacity: 0 }}
                                            className="floating-panel border border-[var(--color-border)] rounded-2xl p-4 flex flex-col gap-4 shadow-2xl pointer-events-auto absolute left-6 top-6"
                                            style={{
                                                width: paletteCollapsed ? '64px' : `${paletteSize.w}px`,
                                                height: paletteCollapsed ? 'auto' : `${paletteSize.h}px`,
                                                minHeight: '200px',
                                                maxHeight: 'calc(100vh - 100px)',
                                                overflow: 'hidden',
                                                background: theme === 'light' ? '#ffffff' : '#1a1a1a',
                                                zIndex: 50
                                            }}
                                        >
                                            {/* Drag Handle & Controls */}
                                            <div className={`flex items-center mb-2 ${paletteCollapsed ? 'justify-center' : 'justify-between'}`}>
                                                {!paletteCollapsed && (
                                                    <div className="panel-handle cursor-move text-[var(--color-text-muted)] hover:text-[var(--color-text-base)] transition-colors">
                                                        <GripHorizontal className="w-5 h-5" />
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1">
                                                    {!paletteCollapsed && (
                                                        <button
                                                            onClick={() => setIsPaletteDocked(true)}
                                                            className="p-1.5 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-base)] transition-colors"
                                                            title="Minimize to Round Pop"
                                                        >
                                                            <ArrowDownToLine className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setPaletteCollapsed(!paletteCollapsed)}
                                                        className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer text-xs p-1.5 hover:text-[var(--color-text-base)] transition-colors flex items-center justify-center rounded-lg hover:bg-[var(--color-hover)]"
                                                        title={paletteCollapsed ? "Expand Panel" : "Collapse Panel"}
                                                    >
                                                        {paletteCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>


                                            <DataSourcesPanel
                                                projectData={projectData}
                                                onUpdateProjectData={(newData) => {
                                                    console.log('[Builder] Updating project data from panel', newData);
                                                    setProjectData(newData);
                                                }}
                                                viewer={viewer}
                                                onPropertiesLoaded={setAvailableProperties}
                                                hasViewerComponent={components.some(c => c.type === 'viewer')}
                                                onRefreshAll={handleSaveData}
                                                isRefreshing={isRefreshing}
                                                availableProperties={availableProperties}
                                                isCollapsed={paletteCollapsed}
                                                masterData={masterData}
                                            />


                                            {!paletteCollapsed && (
                                                <h3 className="text-sm font-semibold text-[var(--color-text-base)] uppercase tracking-widest mb-2">
                                                    Components
                                                </h3>
                                            )}

                                            <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
                                                <div className="flex flex-col gap-2">
                                                    {componentTypes.map((compType) => {
                                                        const Icon = compType.icon;
                                                        return (
                                                            <button
                                                                key={compType.type}
                                                                onClick={() => addComponent(compType.type)}
                                                                title={paletteCollapsed ? compType.label : ''}
                                                                className={`rounded-lg cursor-pointer flex items-center gap-3 text-sm font-medium transition-all ${paletteCollapsed ? 'justify-center p-2 bg-transparent hover:bg-[var(--color-hover)]' : 'justify-start p-3 border border-transparent hover:border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-hover)]'} ${paletteCollapsed ? 'text-[var(--color-text-muted)] hover:text-lime-400' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-base)]'}`}
                                                            >
                                                                <Icon className={paletteCollapsed ? "w-8 h-8" : "w-5 h-5"} />
                                                                {!paletteCollapsed && <span>{compType.label}</span>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {!paletteCollapsed && (
                                                    <div className="mt-auto p-3 bg-[var(--color-bg-elevated)] rounded-lg text-xs text-[var(--color-text-muted)] leading-relaxed border border-[var(--color-border)]">
                                                        💡 Click to add • Drag to move • Resize from corners
                                                    </div>
                                                )}
                                            </div>

                                            {/* Resize Handle */}
                                            {!paletteCollapsed && (
                                                <div
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        resizingRef.current = 'palette';
                                                        document.body.style.cursor = 'nwse-resize';
                                                    }}
                                                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 opacity-50 hover:opacity-100"
                                                    style={{ zIndex: 60 }}
                                                >
                                                    <div className="w-full h-full border-b-2 border-r-2 border-[var(--color-text-muted)] rounded-br-sm" />
                                                </div>
                                            )}
                                        </motion.div>
                                    </Draggable>
                                )}
                            </AnimatePresence>

                            {/* 2. Settings Panel - Round Pop or Full Panel */}
                            <AnimatePresence mode="wait">
                                {selectedComponentId && (
                                    isSettingsDocked ? (
                                        <Draggable
                                            key="settings-pop"
                                            nodeRef={settingsPopRef}
                                            position={settingsPopPos}
                                            onDrag={(e, data) => setSettingsPopPos({ x: data.x, y: data.y })}
                                            bounds="parent"
                                        >
                                            <div
                                                ref={settingsPopRef}
                                                className="absolute z-[60] w-14 h-14 pointer-events-auto"
                                                style={{ cursor: 'move' }}
                                            >
                                                <motion.div
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0, opacity: 0 }}
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    className="w-full h-full flex items-center justify-center"
                                                >
                                                    <button
                                                        onClick={() => setIsSettingsDocked(false)}
                                                        className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-[0_8px_32px_rgba(59,130,246,0.4)] flex items-center justify-center cursor-pointer border-none group transition-all duration-300"
                                                        title="Open Settings"
                                                    >
                                                        <Sliders className="w-6 h-6 group-hover:rotate-45 transition-transform" />
                                                    </button>
                                                </motion.div>
                                            </div>
                                        </Draggable>
                                    ) : (
                                        <Draggable
                                            key="settings-floating"
                                            nodeRef={settingsRef}
                                            handle=".panel-handle"
                                            bounds="parent"
                                        >
                                            <motion.div
                                                ref={settingsRef}
                                                initial={{ x: 20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                exit={{ x: 20, opacity: 0 }}
                                                className="floating-panel border border-[var(--color-border)] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl pointer-events-auto absolute right-6 top-6"
                                                style={{
                                                    width: settingsCollapsed ? '64px' : `${settingsSize.w}px`,
                                                    height: settingsCollapsed ? 'auto' : `${settingsSize.h}px`,
                                                    minHeight: '200px',
                                                    maxHeight: 'calc(100vh - 100px)',
                                                    overflow: 'hidden',
                                                    background: theme === 'light' ? '#ffffff' : '#1a1a1a',
                                                    zIndex: 50
                                                }}
                                            >
                                                {/* Drag Handle & Controls */}
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="panel-handle cursor-move text-[var(--color-text-muted)] hover:text-[var(--color-text-base)] transition-colors">
                                                        <GripHorizontal className="w-5 h-5" />
                                                    </div>
                                                    <button
                                                        onClick={() => setIsSettingsDocked(true)}
                                                        className="p-1.5 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-base)] transition-colors"
                                                        title="Minimize to Round Pop"
                                                    >
                                                        <ArrowDownToLine className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: settingsCollapsed ? 'center' : 'space-between',
                                                    alignItems: 'center',
                                                    flexDirection: settingsCollapsed ? 'column' : 'row',
                                                    gap: settingsCollapsed ? '12px' : '0'
                                                }}>

                                                    <button
                                                        onClick={() => setSettingsCollapsed(!settingsCollapsed)}
                                                        className="p-2 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-base)] transition-colors"
                                                        title={settingsCollapsed ? "Expand Settings" : "Collapse Settings"}
                                                    >
                                                        {settingsCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>

                                                    {!settingsCollapsed && (
                                                        <>
                                                            <h3 className="text-sm font-semibold text-[var(--color-text-base)] uppercase tracking-widest">Settings</h3>
                                                            <button onClick={() => setSelectedComponentId(null)} className="p-1 hover:bg-[var(--color-hover)] rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-base)]">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}

                                                    {settingsCollapsed && (
                                                        <button onClick={() => setSelectedComponentId(null)} className="p-1 hover:bg-[var(--color-hover)] rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-base)]">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>

                                                {!settingsCollapsed && (
                                                    <div style={{
                                                        flex: 1,
                                                        opacity: 1,
                                                        transition: 'opacity 0.2s 0.1s',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '16px',
                                                        height: '100%',
                                                        overflowY: 'auto',
                                                        overflowX: 'hidden',
                                                        paddingRight: '4px' // prevent scrollbar overlap
                                                    }}>
                                                        {/* Content Container to ensure stable width during collapse */}
                                                        <div style={{ minWidth: '250px' }}>
                                                            {components.find(c => c.id === selectedComponentId) && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>WIDGET TITLE</label>
                                                                        <input
                                                                            type="text"
                                                                            value={components.find(c => c.id === selectedComponentId).config.title}
                                                                            onChange={(e) => updateComponentConfig(selectedComponentId, { title: e.target.value })}
                                                                            style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                        />
                                                                    </div>

                                                                    {['pie', 'bar', 'kpi', 'table', 'schedule'].includes(components.find(c => c.id === selectedComponentId).type) && (
                                                                        <>
                                                                            <div>
                                                                                <div style={{ marginBottom: '8px' }}>
                                                                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                                                        {components.find(c => c.id === selectedComponentId).type === 'table' ? 'GROUP BY COLUMNS' :
                                                                                            components.find(c => c.id === selectedComponentId).type === 'kpi' ? 'KPI PARAMETER (MODEL/EXCEL)' : 'DATA ATTRIBUTE (BIM)'}
                                                                                    </label>
                                                                                </div>
                                                                                {components.find(c => c.id === selectedComponentId).type === 'table' ? (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                                        {(components.find(c => c.id === selectedComponentId).config.attributes || [components.find(c => c.id === selectedComponentId).config.attribute]).filter(Boolean).map((attr, idx) => (
                                                                                            <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                                                                                                <select
                                                                                                    value={attr}
                                                                                                    onChange={(e) => {
                                                                                                        const currentAttrs = components.find(c => c.id === selectedComponentId).config.attributes || [components.find(c => c.id === selectedComponentId).config.attribute];
                                                                                                        const nextAttrs = [...currentAttrs];
                                                                                                        nextAttrs[idx] = e.target.value;
                                                                                                        updateComponentConfig(selectedComponentId, { attributes: nextAttrs.filter(Boolean), attribute: nextAttrs[0] });
                                                                                                    }}
                                                                                                    style={{ flex: 1, padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)', fontSize: '12px' }}
                                                                                                >
                                                                                                    {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                                                </select>
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        const currentAttrs = components.find(c => c.id === selectedComponentId).config.attributes || [components.find(c => c.id === selectedComponentId).config.attribute];
                                                                                                        const nextAttrs = currentAttrs.filter((_, i) => i !== idx);
                                                                                                        updateComponentConfig(selectedComponentId, { attributes: nextAttrs, attribute: nextAttrs[0] || '' });
                                                                                                    }}
                                                                                                    style={{ padding: '0 8px', background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}
                                                                                                >×</button>
                                                                                            </div>
                                                                                        ))}
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                const currentAttrs = components.find(c => c.id === selectedComponentId).config.attributes || [components.find(c => c.id === selectedComponentId).config.attribute];
                                                                                                updateComponentConfig(selectedComponentId, { attributes: [...currentAttrs.filter(Boolean), availableProperties[0] || ''] });
                                                                                            }}
                                                                                            className="btn btn-secondary"
                                                                                            style={{ padding: '4px', fontSize: '10px' }}
                                                                                        >+ ADD COLUMN</button>
                                                                                    </div>

                                                                                ) : components.find(c => c.id === selectedComponentId).type === 'schedule' ? (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                                        <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                                                                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 'bold', marginBottom: '8px' }}>DATA SOURCE</div>
                                                                                            <button
                                                                                                className="btn btn-secondary"
                                                                                                onClick={() => {
                                                                                                    // Open File Explorer for Excel
                                                                                                    setFileExplorerTarget(selectedComponentId);
                                                                                                    setShowFileExplorer(true);
                                                                                                }}
                                                                                                style={{ width: '100%', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', gap: '8px' }}
                                                                                            >
                                                                                                📄 Link Excel Schedule...
                                                                                            </button>
                                                                                            {components.find(c => c.id === selectedComponentId).config.excelParams?.fileName && (
                                                                                                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                                    <span>✅ Linked:</span>
                                                                                                    <span style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                                        {components.find(c => c.id === selectedComponentId).config.excelParams.fileName}
                                                                                                    </span>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {components.find(c => c.id === selectedComponentId).config.excelParams ? (
                                                                                            // Excel Mapping UI
                                                                                            <>
                                                                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 'bold', marginTop: '4px' }}>MAPPING</div>

                                                                                                {/* Model Property (Reference) */}
                                                                                                <div>
                                                                                                    <div style={{ marginBottom: '4px' }}>
                                                                                                        <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block' }}>MODEL KEY (e.g. Classification)</label>
                                                                                                    </div>
                                                                                                    <select
                                                                                                        value={components.find(c => c.id === selectedComponentId).config.excelParams.modelKey || ''}
                                                                                                        onChange={(e) => {
                                                                                                            const oldParams = components.find(c => c.id === selectedComponentId).config.excelParams;
                                                                                                            updateComponentConfig(selectedComponentId, { excelParams: { ...oldParams, modelKey: e.target.value } });
                                                                                                        }}
                                                                                                        style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                    >
                                                                                                        <option value="">Select model property...</option>
                                                                                                        {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                                                    </select>
                                                                                                </div>

                                                                                                {/* Excel Key Column */}
                                                                                                <div>
                                                                                                    <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>EXCEL KEY COLUMN</label>
                                                                                                    <select
                                                                                                        value={components.find(c => c.id === selectedComponentId).config.excelParams.excelKey || ''}
                                                                                                        onChange={(e) => {
                                                                                                            const oldParams = components.find(c => c.id === selectedComponentId).config.excelParams;
                                                                                                            updateComponentConfig(selectedComponentId, { excelParams: { ...oldParams, excelKey: e.target.value } });
                                                                                                        }}
                                                                                                        style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                    >
                                                                                                        <option value="">Select Excel column...</option>
                                                                                                        {(components.find(c => c.id === selectedComponentId).config.excelParams.headers || []).map(h => <option key={h} value={h}>{h}</option>)}
                                                                                                    </select>
                                                                                                </div>

                                                                                                {/* Excel Activity Name */}
                                                                                                <div>
                                                                                                    <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>EXCEL ACTIVITY NAME</label>
                                                                                                    <select
                                                                                                        value={components.find(c => c.id === selectedComponentId).config.excelParams.excelName || ''}
                                                                                                        onChange={(e) => {
                                                                                                            const oldParams = components.find(c => c.id === selectedComponentId).config.excelParams;
                                                                                                            updateComponentConfig(selectedComponentId, { excelParams: { ...oldParams, excelName: e.target.value } });
                                                                                                        }}
                                                                                                        style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                    >
                                                                                                        <option value="">Select Excel column...</option>
                                                                                                        {(components.find(c => c.id === selectedComponentId).config.excelParams.headers || []).map(h => <option key={h} value={h}>{h}</option>)}
                                                                                                    </select>
                                                                                                </div>

                                                                                                {/* Excel Start Date */}
                                                                                                <div>
                                                                                                    <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>EXCEL START DATE</label>
                                                                                                    <select
                                                                                                        value={components.find(c => c.id === selectedComponentId).config.excelParams.excelStart || ''}
                                                                                                        onChange={(e) => {
                                                                                                            const oldParams = components.find(c => c.id === selectedComponentId).config.excelParams;
                                                                                                            updateComponentConfig(selectedComponentId, { excelParams: { ...oldParams, excelStart: e.target.value } });
                                                                                                        }}
                                                                                                        style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                    >
                                                                                                        <option value="">Select Excel column...</option>
                                                                                                        {(components.find(c => c.id === selectedComponentId).config.excelParams.headers || []).map(h => <option key={h} value={h}>{h}</option>)}
                                                                                                    </select>
                                                                                                </div>

                                                                                                {/* Excel End Date */}
                                                                                                <div>
                                                                                                    <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>EXCEL END DATE</label>
                                                                                                    <select
                                                                                                        value={components.find(c => c.id === selectedComponentId).config.excelParams.excelEnd || ''}
                                                                                                        onChange={(e) => {
                                                                                                            const oldParams = components.find(c => c.id === selectedComponentId).config.excelParams;
                                                                                                            updateComponentConfig(selectedComponentId, { excelParams: { ...oldParams, excelEnd: e.target.value } });
                                                                                                        }}
                                                                                                        style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                    >
                                                                                                        <option value="">Select Excel column...</option>
                                                                                                        {(components.find(c => c.id === selectedComponentId).config.excelParams.headers || []).map(h => <option key={h} value={h}>{h}</option>)}
                                                                                                    </select>
                                                                                                </div>
                                                                                            </>
                                                                                        ) : (
                                                                                            // Fallback to basic model property selection (Legacy)
                                                                                            <>
                                                                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>Or configure using model properties directly:</div>
                                                                                                {/* Activity Name */}
                                                                                                <div>
                                                                                                    <div style={{ marginBottom: '4px' }}>
                                                                                                        <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block' }}>ACTIVITY NAME PROPERTY</label>
                                                                                                    </div>
                                                                                                    <select
                                                                                                        value={components.find(c => c.id === selectedComponentId).config.attribute || ''}
                                                                                                        onChange={(e) => updateComponentConfig(selectedComponentId, { attribute: e.target.value })}
                                                                                                        style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                        disabled={propsLoading}
                                                                                                    >
                                                                                                        <option value="">Select property...</option>
                                                                                                        {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                                                    </select>
                                                                                                </div>

                                                                                                {/* Start Date */}
                                                                                                <div>
                                                                                                    <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>START DATE PROPERTY</label>
                                                                                                    <select
                                                                                                        value={components.find(c => c.id === selectedComponentId).config.startAttribute || ''}
                                                                                                        onChange={(e) => updateComponentConfig(selectedComponentId, { startAttribute: e.target.value })}
                                                                                                        style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                        disabled={propsLoading}
                                                                                                    >
                                                                                                        <option value="">Select property...</option>
                                                                                                        {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                                                    </select>
                                                                                                </div>

                                                                                                {/* End Date */}
                                                                                                <div>
                                                                                                    <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>END DATE PROPERTY</label>
                                                                                                    <select
                                                                                                        value={components.find(c => c.id === selectedComponentId).config.endAttribute || ''}
                                                                                                        onChange={(e) => updateComponentConfig(selectedComponentId, { endAttribute: e.target.value })}
                                                                                                        style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                        disabled={propsLoading}
                                                                                                    >
                                                                                                        <option value="">Select property...</option>
                                                                                                        {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                                                    </select>
                                                                                                </div>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                                        <div>
                                                                                            <div style={{ marginBottom: '4px' }}>
                                                                                                <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block' }}>
                                                                                                    {components.find(c => c.id === selectedComponentId).type === 'kpi' ? 'KPI PARAMETER (MODEL/EXCEL)' : 'GROUP BY (LEGEND)'}
                                                                                                </label>
                                                                                            </div>
                                                                                            <select
                                                                                                value={components.find(c => c.id === selectedComponentId).config.attribute || ''}
                                                                                                onChange={(e) => updateComponentConfig(selectedComponentId, { attribute: e.target.value })}
                                                                                                style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                disabled={propsLoading}
                                                                                            >
                                                                                                {propsLoading ? (
                                                                                                    <option>Scanning model properties...</option>
                                                                                                ) : availableProperties.length > 0 ? (
                                                                                                    <>
                                                                                                        <option value="">Select a property...</option>
                                                                                                        {availableProperties.map(prop => (
                                                                                                            <option key={prop} value={prop}>{prop}</option>
                                                                                                        ))}
                                                                                                    </>
                                                                                                ) : (
                                                                                                    <option>Generic Properties Only / Retry Scan</option>
                                                                                                )}
                                                                                            </select>
                                                                                        </div>

                                                                                        {components.find(c => c.id === selectedComponentId).type === 'kpi' && (
                                                                                            <div>
                                                                                                <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>TEXT SIZE</label>
                                                                                                <select
                                                                                                    value={components.find(c => c.id === selectedComponentId).config.fontSize || '4xl'}
                                                                                                    onChange={(e) => updateComponentConfig(selectedComponentId, { fontSize: e.target.value })}
                                                                                                    style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                >
                                                                                                    <option value="xs">Extra Small</option>
                                                                                                    <option value="sm">Small</option>
                                                                                                    <option value="base">Medium</option>
                                                                                                    <option value="lg">Large</option>
                                                                                                    <option value="xl">Extra Large</option>
                                                                                                    <option value="2xl">2XL</option>
                                                                                                    <option value="3xl">3XL</option>
                                                                                                    <option value="4xl">4XL (Default)</option>
                                                                                                    <option value="5xl">5XL</option>
                                                                                                    <option value="6xl">6XL</option>
                                                                                                </select>
                                                                                            </div>
                                                                                        )}

                                                                                        <div>
                                                                                            <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>AGGREGATION TYPE</label>
                                                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                                                {['count', 'sum'].map(method => (
                                                                                                    <button
                                                                                                        key={method}
                                                                                                        onClick={() => updateComponentConfig(selectedComponentId, { aggregationType: method })}
                                                                                                        style={{
                                                                                                            flex: 1,
                                                                                                            padding: '8px',
                                                                                                            background: components.find(c => c.id === selectedComponentId).config.aggregationType === method ? 'var(--color-primary)' : 'var(--color-bg-base)',
                                                                                                            color: components.find(c => c.id === selectedComponentId).config.aggregationType === method ? 'black' : 'var(--color-text-base)',
                                                                                                            border: '1px solid var(--color-border)',
                                                                                                            borderRadius: '4px',
                                                                                                            fontSize: '11px',
                                                                                                            fontWeight: '600',
                                                                                                            cursor: 'pointer',
                                                                                                            textTransform: 'uppercase'
                                                                                                        }}
                                                                                                    >
                                                                                                        {method}
                                                                                                    </button>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>

                                                                                        {components.find(c => c.id === selectedComponentId).config.aggregationType === 'sum' && (
                                                                                            <div>
                                                                                                <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>SUM PROPERTY (AREA/VOLUME/COST)</label>
                                                                                                <select
                                                                                                    value={components.find(c => c.id === selectedComponentId).config.sumAttribute || ''}
                                                                                                    onChange={(e) => updateComponentConfig(selectedComponentId, { sumAttribute: e.target.value })}
                                                                                                    style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                                                    disabled={propsLoading}
                                                                                                >
                                                                                                    {propsLoading ? (
                                                                                                        <option>Scanning for numeric properties...</option>
                                                                                                    ) : availableProperties.length > 0 ? (
                                                                                                        <>
                                                                                                            <option value="">Select numeric property...</option>
                                                                                                            {availableProperties.map(prop => (
                                                                                                                <option key={prop} value={prop}>{prop}</option>
                                                                                                            ))}
                                                                                                        </>
                                                                                                    ) : (
                                                                                                        <option>Scan Needed / Retry</option>
                                                                                                    )}
                                                                                                </select>
                                                                                            </div>
                                                                                        )}

                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(29, 185, 84, 0.1)', borderRadius: '4px', border: '1px solid rgba(29, 185, 84, 0.3)' }}>
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                id="applyColors"
                                                                                                checked={components.find(c => c.id === selectedComponentId).config.applyColorsToModel || false}
                                                                                                onChange={(e) => updateComponentConfig(selectedComponentId, { applyColorsToModel: e.target.checked })}
                                                                                                style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                                                                                            />
                                                                                            <label htmlFor="applyColors" style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-base)', cursor: 'pointer' }}>
                                                                                                🎨 SYNC COLORS TO MODEL
                                                                                            </label>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>FILTERS</label>
                                                                                    <button
                                                                                        onClick={() => addFilter(selectedComponentId)}
                                                                                        className="btn btn-secondary"
                                                                                        style={{ padding: '4px 8px', fontSize: '10px' }}
                                                                                    >
                                                                                        + ADD FILTER
                                                                                    </button>
                                                                                </div>

                                                                                {(components.find(c => c.id === selectedComponentId).config.filters || []).length > 0 && (
                                                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                                                                        <button
                                                                                            onClick={() => updateComponentConfig(selectedComponentId, { logicalOperator: 'AND' })}
                                                                                            style={{
                                                                                                flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px', border: '1px solid var(--color-border)',
                                                                                                background: components.find(c => c.id === selectedComponentId).config.logicalOperator !== 'OR' ? 'var(--color-primary)' : 'transparent'
                                                                                            }}
                                                                                        >AND</button>
                                                                                        <button
                                                                                            onClick={() => updateComponentConfig(selectedComponentId, { logicalOperator: 'OR' })}
                                                                                            style={{
                                                                                                flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px', border: '1px solid var(--color-border)',
                                                                                                background: components.find(c => c.id === selectedComponentId).config.logicalOperator === 'OR' ? 'var(--color-primary)' : 'transparent'
                                                                                            }}
                                                                                        >OR</button>
                                                                                    </div>
                                                                                )}

                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                                    {(components.find(c => c.id === selectedComponentId).config.filters || []).map((filter, idx) => (
                                                                                        <div key={idx} style={{ background: 'var(--color-bg-base)', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', position: 'relative' }}>
                                                                                            <button
                                                                                                onClick={() => removeFilter(selectedComponentId, idx)}
                                                                                                style={{ position: 'absolute', top: '2px', right: '2px', background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}
                                                                                            >×</button>

                                                                                            <select
                                                                                                value={filter.attribute}
                                                                                                onChange={(e) => updateFilter(selectedComponentId, idx, { attribute: e.target.value })}
                                                                                                style={{ width: '100%', marginBottom: '4px', fontSize: '11px', background: 'transparent', color: 'var(--color-text-base)', border: 'none' }}
                                                                                            >
                                                                                                <option value="">Property...</option>
                                                                                                {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                                            </select>

                                                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                                                <select
                                                                                                    value={filter.operator}
                                                                                                    onChange={(e) => updateFilter(selectedComponentId, idx, { operator: e.target.value })}
                                                                                                    style={{ flex: 1, fontSize: '10px', background: 'transparent', color: 'var(--color-text-base)', border: 'none' }}
                                                                                                >
                                                                                                    <option value="equals">Equals</option>
                                                                                                    <option value="contains">Contains</option>
                                                                                                    <option value="not_equals">≠</option>
                                                                                                </select>
                                                                                                <input
                                                                                                    type="text"
                                                                                                    value={filter.value}
                                                                                                    onChange={(e) => updateFilter(selectedComponentId, idx, { value: e.target.value })}
                                                                                                    placeholder="Value..."
                                                                                                    style={{ flex: 2, fontSize: '10px', background: 'transparent', color: 'var(--color-text-base)', border: 'none', borderBottom: '1px solid var(--color-border)' }}
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Resize Handle */}
                                                {!settingsCollapsed && !isSettingsDocked && (
                                                    <div
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            resizingRef.current = 'settings';
                                                            document.body.style.cursor = 'nwse-resize';
                                                        }}
                                                        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 opacity-50 hover:opacity-100"
                                                        style={{ zIndex: 60 }}
                                                    >
                                                        <div className="w-full h-full border-b-2 border-r-2 border-[var(--color-text-muted)] rounded-br-sm" />
                                                    </div>
                                                )}
                                            </motion.div>
                                        </Draggable>
                                    )
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Main Canvas Expand to full width */}
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-md)',
                            zIndex: 1,
                            minHeight: 0
                        }}>
                            {/* Dashboard Info */}
                            <div
                                style={{
                                    background: 'var(--color-bg-surface)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-md)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: 'var(--spacing-md)'
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <input
                                        type="text"
                                        value={dashboardName}
                                        onChange={(e) => setDashboardName(e.target.value)}
                                        placeholder="Dashboard Name"
                                        style={{
                                            width: '100%',
                                            fontSize: 'var(--font-size-2xl)',
                                            fontWeight: 'var(--font-weight-bold)',
                                            marginBottom: 'var(--spacing-xs)',
                                            background: 'transparent',
                                            border: 'none',
                                            padding: 0,
                                            color: 'var(--color-text-base)',
                                            outline: 'none'
                                        }}
                                    />
                                    <input
                                        type="text"
                                        value={dashboardDescription}
                                        onChange={(e) => setDashboardDescription(e.target.value)}
                                        placeholder="Add a description..."
                                        style={{
                                            width: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            padding: 0,
                                            color: 'var(--color-text-muted)',
                                            fontSize: 'var(--font-size-sm)',
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                {/* Header Right Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                    {/* Interaction Sync Toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--color-bg-base)', borderRadius: '20px', border: '1px solid var(--color-border)' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '600', color: interactionSync ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer' }}>
                                            ⚡ SYNC
                                        </label>
                                        <div
                                            onClick={() => {
                                                const newState = !interactionSync;
                                                setInteractionSync(newState);
                                                if (!newState) setCurrentSelection([]); // Clear selection when turning off
                                            }}
                                            style={{
                                                width: '32px',
                                                height: '18px',
                                                background: interactionSync ? 'var(--color-primary)' : 'var(--color-bg-base)',
                                                borderRadius: '10px',
                                                position: 'relative',
                                                cursor: 'pointer',
                                                border: '1px solid var(--color-border)',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: '14px',
                                                height: '14px',
                                                background: 'white',
                                                borderRadius: '50%',
                                                position: 'absolute',
                                                top: '1px',
                                                left: interactionSync ? '15px' : '1px',
                                                transition: 'all 0.2s'
                                            }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexShrink: 0 }}>
                                        <button
                                            onClick={() => exportUtils.downloadDashboard({ name: dashboardName, description: dashboardDescription, projectData, components, layout })}
                                            className="btn btn-secondary"
                                        >
                                            <span>
                                                <i data-eva="file-text-outline" className="w-4 h-4 text-cyan-400"></i>
                                            </span>
                                            EXPORT HTML
                                        </button>
                                        <button
                                            onClick={toggleFullScreen}
                                            className="btn btn-secondary"
                                            style={{ minWidth: '40px', padding: '0 10px' }}
                                            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                                        >
                                            {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={saveDashboard}
                                            className="btn btn-primary"
                                        >
                                            {id ? 'UPDATE DASHBOARD' : 'CREATE DASHBOARD'}
                                        </button>
                                    </div>
                                </div>
                            </div >

                            {/* Unmapped Sources Warning */}
                            {
                                projectData.sources && Object.values(projectData.sources).some(s => !s.mapping?.modelKey || !s.mapping?.fileKey) && (
                                    <div style={{
                                        margin: '0 var(--spacing-lg) var(--spacing-sm)',
                                        padding: '10px 16px',
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '16px' }}>⚠️</span>
                                            <span style={{ fontSize: '12px', color: '#fbbf24' }}>
                                                Some data sources are not mapped to the 3D model. Charts may not display data correctly.
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#fbbf24', opacity: 0.8 }}>
                                            Open "Manage Sources" to configure columns.
                                        </div>
                                    </div>
                                )
                            }



                            {/* Grid Canvas */}
                            <div
                                ref={canvasRef}
                                className="bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed"
                                style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    background: 'var(--color-bg-elevated)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-md)',
                                    position: 'relative',
                                    zIndex: 10
                                }}>
                                {components.length === 0 ? (
                                    <div
                                        style={{
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            textAlign: 'center',
                                            color: 'var(--color-text-base)',
                                            opacity: 1,
                                            visibility: 'visible'
                                        }}
                                    >
                                        <div style={{ fontSize: '64px', marginBottom: 'var(--spacing-lg)' }}>
                                            📊
                                        </div>
                                        <h3 style={{
                                            fontSize: 'var(--font-size-xl)',
                                            fontWeight: 'var(--font-weight-bold)',
                                            marginBottom: 'var(--spacing-sm)',
                                            color: 'var(--color-text-base)'
                                        }}>
                                            Start Building Your Dashboard
                                        </h3>
                                        <p style={{ fontSize: 'var(--font-size-sm)' }}>
                                            Add components from the palette • Drag to arrange • Resize as needed
                                        </p>
                                    </div>
                                ) : (
                                    <GridLayout
                                        className="layout"
                                        layout={layout}
                                        cols={12}
                                        rowHeight={80}
                                        width={canvasWidth}
                                        onLayoutChange={(newLayout) => setLayout(newLayout)}
                                        draggableHandle=".drag-handle"
                                        style={{
                                            minHeight: '600px'
                                        }}
                                    >
                                        {components.map((comp) => (
                                            <div
                                                key={comp.id}
                                                style={{
                                                    background: 'var(--color-bg-base)',
                                                    borderRadius: 'var(--radius-md)',
                                                    overflow: 'hidden',
                                                    position: 'relative',
                                                    border: '1px solid var(--color-border)',
                                                    boxShadow: selectedComponentId === comp.id ? '0 0 0 2px var(--color-primary)' : 'none'
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedComponentId(comp.id);
                                                }}
                                            >
                                                {/* Drag Handle */}
                                                <div
                                                    className="drag-handle"
                                                    style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        height: '24px',
                                                        background: 'var(--color-bg-highlight)',
                                                        cursor: 'grab',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        opacity: 0,
                                                        transition: 'opacity 0.2s',
                                                        zIndex: 10
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                                                >
                                                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Drag to move</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeComponent(comp.id);
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            right: '4px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: '#ff4444',
                                                            cursor: 'pointer',
                                                            fontSize: '14px'
                                                        }}
                                                    >×</button>
                                                </div>

                                                <div style={{ height: '100%', overflow: 'hidden' }}>
                                                    {renderComponent(comp)}
                                                </div>
                                            </div>
                                        ))}
                                    </GridLayout>
                                )}
                            </div>
                        </div>

                        {/* File Explorer Modal */}
                        <AnimatePresence>
                            {showFileExplorer && (
                                <div style={{
                                    position: 'fixed',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.8)',
                                    backdropFilter: 'blur(4px)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <div
                                        style={{
                                            width: '80%',
                                            height: '80%',
                                            background: 'var(--color-bg-elevated)',
                                            borderRadius: 'var(--radius-lg)',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        <div style={{
                                            padding: 'var(--spacing-md)',
                                            borderBottom: '1px solid var(--color-border)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <h3>Select 3D Model</h3>
                                            <button onClick={() => setShowFileExplorer(false)} className="btn-icon">×</button>
                                        </div>
                                        <div style={{ flex: 1, overflow: 'auto' }}>
                                            <FileExplorer
                                                onSelect={async (selection) => {
                                                    if (fileExplorerTarget === 'viewer') {
                                                        // Handle the structure returned by FileExplorer: { project, model, modelUrn }
                                                        setProjectData(prev => ({
                                                            ...prev,
                                                            model: {
                                                                urn: selection.modelUrn,
                                                                name: selection.model.name,
                                                                projectName: selection.project.name || 'Unknown Project'
                                                            }
                                                        }));
                                                        setModelLoaded(false);
                                                        setAvailableProperties([]);
                                                        setShowFileExplorer(false);
                                                    } else {
                                                        // Target is a component (e.g. Schedule) expecting an Excel file
                                                        if (selection.model.name.endsWith('.xlsx')) {
                                                            try {
                                                                console.log('Fetching Excel file...', selection.model.name);
                                                                console.log('Target Component ID:', fileExplorerTarget);

                                                                // Use the raw URN (Version ID) and Project ID
                                                                const buffer = await analyticsService.apsService.getFileContent(
                                                                    selection.model.projectId,
                                                                    selection.model.urn // Version ID
                                                                );

                                                                const workbook = XLSX.read(buffer, { type: 'array' });
                                                                const sheetName = workbook.SheetNames[0];
                                                                const worksheet = workbook.Sheets[sheetName];
                                                                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                                                                if (jsonData && jsonData.length > 0) {
                                                                    const headers = jsonData[0];
                                                                    console.log('Excel Headers:', headers);

                                                                    // Update the component config
                                                                    updateComponentConfig(fileExplorerTarget, {
                                                                        excelParams: {
                                                                            fileName: selection.model.name,
                                                                            urn: selection.model.urn,
                                                                            projectId: selection.model.projectId,
                                                                            headers: headers,
                                                                            // Initialize mappings
                                                                            modelKey: '',
                                                                            excelKey: '',
                                                                            excelName: '',
                                                                            excelStart: '',
                                                                            excelEnd: ''
                                                                        }
                                                                    });
                                                                } else {
                                                                    alert('Excel file appears strictly empty or invalid.');
                                                                }

                                                            } catch (error) {
                                                                console.error("Error processing Excel file:", error);
                                                                alert("Failed to download or parse Excel file. See console.");
                                                            }
                                                            setShowFileExplorer(false);
                                                        } else {
                                                            alert("Please select a valid .xlsx file.");
                                                            // Do NOT close explorer
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence >
                    </div >
                </>
            </ErrorBoundary>
        </div>
    );
};

export default DashboardBuilder;
