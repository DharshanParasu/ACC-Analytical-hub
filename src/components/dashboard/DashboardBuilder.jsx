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
    {
        type: 'schedule', icon: Calendar, label: 'Schedule Visual', component: ScheduleVisual, defaultSize: { w: 12, h: 6 }, defaultConfig: {
            activityNameAttribute: 'Activity Name',
            startDateAttribute: 'Start Date',
            endDateAttribute: 'End Date'
        }
    }
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

    // Unified Sync State
    const [globalSync, setGlobalSync] = useState(false);
    const [paletteCollapsed, setPaletteCollapsed] = useState(false);
    const [settingsCollapsed, setSettingsCollapsed] = useState(false);
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);

    // Panel Resizing State (Simplified for docked panels)
    const [paletteWidth, setPaletteWidth] = useState(280);
    const [settingsWidth, setSettingsWidth] = useState(320);


    const [currentSelection, setCurrentSelection] = useState([]);
    const [selectedComponentId, setSelectedComponentId] = useState(null);
    const resizingRef = useRef(null);
    const [viewer, setViewer] = useState(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [availableProperties, setAvailableProperties] = useState([]);
    const [propsLoading, setPropsLoading] = useState(false);
    const [joinedData, setJoinedData] = useState({});

    // Master Data for Sync Aggregation (Single Source of Truth)
    const [masterData, setMasterData] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [timelineDate, setTimelineDate] = useState(null);

    const paletteRef = useRef(null);
    const settingsRef = useRef(null);
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
                setPaletteWidth(prev => Math.max(200, Math.min(600, prev + e.movementX)));
            } else if (resizingRef.current === 'settings') {
                // Dragging left (negative movementX) should increase width for right sidebar
                setSettingsWidth(prev => Math.max(250, Math.min(800, prev - e.movementX)));
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
                if (!globalSync) return;

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
                    scopedDbIds={globalSync && currentSelection.length > 0 ? currentSelection : null}
                    globalSync={globalSync}
                    timelineDate={timelineDate}
                    onTimelineDateChange={setTimelineDate}
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
                        const workbook = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const jsonData = window.XLSX.utils.sheet_to_json(worksheet);
                        const headers = Object.keys(jsonData[0] || {});
                        console.log(`[Builder] Extracted Excel headers for ${source.fileName}:`, headers);

                        // Update source object in place
                        newSources[key] = {
                            ...source,
                            data: jsonData,
                            headers: headers,
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

            // 2. Prepare Property List for Fetching
            // If Schema exists, only ask for Included Model Properties
            let modelPropsToFetch = null;
            if (updatedProjectData.schemaConfig && updatedProjectData.schemaConfig.properties) {
                modelPropsToFetch = Object.values(updatedProjectData.schemaConfig.properties)
                    .filter(p => p.source === 'model' && p.include)
                    .map(p => p.originalName);

                // Ensure mapping keys are always fetched even if not explicitly "included" in schema
                // otherwise merging will fail
                Object.values(updatedProjectData.sources).forEach(src => {
                    if (src.mapping?.modelKey) modelPropsToFetch.push(src.mapping.modelKey);
                });
                modelPropsToFetch = [...new Set(modelPropsToFetch)]; // Dedupe
            }

            // 3. Fetch Master Data
            console.log('[Builder] Fetching master data with props:', modelPropsToFetch);
            const syncResult = await analyticsService.getAllData(targetViewer, updatedProjectData, modelPropsToFetch);

            const finalSources = { ...updatedProjectData.sources };

            if (syncResult && !syncResult.error) {
                let results = syncResult.results || [];

                // 4. Apply Schema Transformations (Aliasing & Typing)
                if (updatedProjectData.schemaConfig && updatedProjectData.schemaConfig.properties) {
                    console.log('[Builder] Applying Schema Transformations...');
                    const schemaProps = Object.values(updatedProjectData.schemaConfig.properties).filter(p => p.include);

                    results = results.map(row => {
                        const newRow = { dbId: row.dbId, name: row.name }; // Always keep ID and Name

                        schemaProps.forEach(prop => {
                            const val = row[prop.originalName];
                            const finalKey = prop.alias || prop.originalName;

                            // 1. Source Collision Prevention
                            // If we already have a value for this alias (finalKey) from a previous schema prop 
                            // (e.g. from a different source), and the current value is null/empty, don't overwrite.
                            if (newRow[finalKey] !== undefined && (val === undefined || val === null || val === '')) {
                                return;
                            }

                            // 2. Specialized Type Conversion
                            let finalVal = val;
                            if (val !== undefined && val !== null && val !== '') {
                                if (prop.type === 'number') {
                                    const num = parseFloat(val);
                                    finalVal = isNaN(num) ? 0 : num;
                                } else if (prop.type === 'date') {
                                    // Handle JS Date objects (from XLSX cellDates: true)
                                    if (val instanceof Date) {
                                        finalVal = val;
                                    }
                                    // Handle Excel Serial Numbers (e.g. 45000+ is recent years)
                                    else if (typeof val === 'number' && val > 30000) {
                                        finalVal = new Date(Math.round((val - 25569) * 86400 * 1000));
                                    }
                                    // Fallback to string parsing
                                    else {
                                        const date = new Date(val);
                                        finalVal = isNaN(date.getTime()) ? val : date;
                                    }

                                    // Final Safety: If conversion resulted in 1970 and original wasn't 0, it's likely wrong
                                    if (finalVal instanceof Date && finalVal.getFullYear() <= 1970 && val !== 0 && val !== '0') {
                                        finalVal = val; // Revert to raw string if suspicious
                                    }
                                } else if (prop.type === 'boolean') {
                                    const strVal = String(val).toLowerCase();
                                    finalVal = strVal === 'true' || strVal === '1' || strVal === 'yes';
                                } else {
                                    finalVal = String(val);
                                }
                            } else {
                                // Explicitly set null if empty
                                finalVal = null;
                            }
                            newRow[finalKey] = finalVal;
                        });
                        return newRow;
                    });
                }

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

            // 5. Re-fetch Property List for UI (if needed, but schema is now source of truth)
            if (!projectData.schemaConfig) {
                await fetchProperties(targetViewer);
            }

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

                    <div className={`w-full ${isFullScreen ? 'h-full' : 'h-[calc(100vh-140px)]'} visible opacity-100 overflow-hidden flex flex-col`}>
                        {/* Header Section (Info + Warnings) */}
                        <div style={{
                            padding: '20px 40px 10px 40px',
                            background: 'var(--color-bg-base)',
                            borderBottom: '1px solid var(--color-border)',
                            zIndex: 120, // Keep header above panels if needed
                            position: 'relative'
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
                                    {/* Clear Filters Button */}
                                    <button
                                        onClick={() => {
                                            setCurrentSelection([]);
                                            setTimelineDate(null); // Stop 4D Timeline
                                            if (viewer) {
                                                viewer.clearSelection();
                                                viewer.showAll();
                                            }
                                        }}
                                        className="btn btn-secondary"
                                        style={{
                                            padding: '6px 12px',
                                            background: currentSelection.length > 0 ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                            borderColor: currentSelection.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border)',
                                            color: currentSelection.length > 0 ? '#ef4444' : 'var(--color-text-muted)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            transition: 'all 0.2s'
                                        }}
                                        title="Clear all filters and selections"
                                    >
                                        <X className="w-3 h-3" />
                                        CLEAR
                                    </button>

                                    {/* Interaction Sync Toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--color-bg-base)', borderRadius: '20px', border: '1px solid var(--color-border)' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '600', color: globalSync ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer' }}>
                                            ⚡ SYNC
                                        </label>
                                        <div
                                            onClick={() => {
                                                const newState = !globalSync;
                                                setGlobalSync(newState);
                                                if (!newState) setCurrentSelection([]); // Clear selection when turning off
                                            }}
                                            style={{
                                                width: '32px',
                                                height: '18px',
                                                background: globalSync ? 'var(--color-primary)' : 'var(--color-bg-base)',
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
                                                left: globalSync ? '15px' : '1px',
                                                transition: 'all 0.2s'
                                            }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexShrink: 0 }}>
                                        <button
                                            onClick={() => {
                                                // Pre-calculate data snapshots for export
                                                const componentData = {};

                                                components.forEach(comp => {
                                                    try {
                                                        const config = comp.config || {};
                                                        const attribute = config.attribute || 'Category';

                                                        if (['pie', 'bar', 'line', 'table', 'kpi'].includes(comp.type)) {
                                                            let result;

                                                            if (masterData && masterData.length > 0) {
                                                                // Use Master Data (Offline-ready)
                                                                const aggType = config.aggregationType || 'count';
                                                                const sumAttr = aggType === 'sum' ? (config.sumAttribute || null) : null;
                                                                const filters = config.filters || [];
                                                                const operator = config.logicalOperator || 'AND';

                                                                // Calculate correct value for KPI vs Charts
                                                                if (comp.type === 'kpi') {
                                                                    const res = analyticsService.aggregateFromMasterData(masterData, attribute, filters, operator, sumAttr, currentSelection);
                                                                    // KPI usually wants total count or specific value. aggregateFromMasterData returns { labels, values }
                                                                    // For KPI, we often want total of values or just count of matches
                                                                    const total = res.values.reduce((a, b) => a + b, 0);
                                                                    result = { value: total.toLocaleString(), label: attribute };
                                                                } else {
                                                                    result = analyticsService.aggregateFromMasterData(masterData, attribute, filters, operator, sumAttr, currentSelection);
                                                                }
                                                            } else {
                                                                // Fallback if no masterData (empty or loading)
                                                                result = null;
                                                            }

                                                            if (result) {
                                                                componentData[comp.id] = result;
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error('Error calculating export data for', comp.id, err);
                                                    }
                                                });

                                                exportUtils.downloadDashboard({
                                                    name: dashboardName,
                                                    description: dashboardDescription,
                                                    projectData,
                                                    components,
                                                    layout
                                                }, componentData); // Pass snapshot
                                            }}
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
                            </div>

                            {/* Unmapped Sources Warning */}
                            {
                                projectData.sources && Object.values(projectData.sources).some(s => !s.mapping?.modelKey || !s.mapping?.fileKey) && (
                                    <div style={{
                                        margin: '10px 0 0 0',
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
                        </div>

                        {/* Main Content Area (Panels + Canvas) */}
                        <div className="flex-1 relative flex overflow-hidden">
                            {/* 1. Left Sidebar (Palette) */}
                            <div
                                style={{
                                    width: paletteCollapsed ? '0px' : `${paletteWidth}px`,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    borderRight: paletteCollapsed ? 'none' : '1px solid var(--color-border)',
                                    background: 'var(--color-bg-base)',
                                    display: 'flex',
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    zIndex: 110,
                                    boxShadow: paletteCollapsed ? 'none' : '4px 0 16px rgba(0,0,0,0.2)',
                                    overflow: 'visible'
                                }}
                            >
                                <div style={{ flex: 1, overflow: 'hidden', opacity: paletteCollapsed ? 0 : 1, transition: 'opacity 0.2s' }}>
                                    <div style={{ padding: '0px', display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                                            isCollapsed={false}
                                            masterData={masterData}
                                            modelLoaded={modelLoaded} // Pass model status for auto-scanning
                                        />

                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <h3 className="text-sm font-semibold text-[var(--color-text-base)] uppercase tracking-widest mb-0">
                                                Components
                                            </h3>

                                            <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
                                                <div className="flex flex-col gap-2">
                                                    {componentTypes.map((compType) => {
                                                        const Icon = compType.icon;
                                                        return (
                                                            <button
                                                                key={compType.type}
                                                                onClick={() => addComponent(compType.type)}
                                                                className="rounded-lg cursor-pointer flex items-center gap-3 text-sm font-medium transition-all justify-start p-3 border border-transparent hover:border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-base)]"
                                                            >
                                                                <Icon className="w-5 h-5" />
                                                                <span>{compType.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-auto p-3 bg-[var(--color-bg-elevated)] rounded-lg text-xs text-[var(--color-text-muted)] leading-relaxed border border-[var(--color-border)]">
                                                    💡 Click to add • Drag to move • Resize from corners
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Resize Handle (Left) */}
                                {!paletteCollapsed && (
                                    <div
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            resizingRef.current = 'palette';
                                            document.body.style.cursor = 'ew-resize';
                                        }}
                                        style={{
                                            position: 'absolute',
                                            right: '0',
                                            top: 0,
                                            bottom: 0,
                                            width: '4px',
                                            cursor: 'ew-resize',
                                            zIndex: 102,
                                            transition: 'background 0.2s',
                                            background: 'transparent'
                                        }}
                                        className="hover:bg-[var(--color-primary)] opacity-30"
                                    />
                                )}

                                {/* Collapse Toggle Arrow (Left) */}
                                <button
                                    onClick={() => setPaletteCollapsed(!paletteCollapsed)}
                                    style={{
                                        position: 'absolute',
                                        right: paletteCollapsed ? '-12px' : '-12px',
                                        left: paletteCollapsed ? '0px' : 'auto',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: 'var(--color-bg-base)',
                                        border: '1px solid var(--color-border)',
                                        color: 'var(--color-text-base)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        zIndex: 103,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    {paletteCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                                </button>
                            </div>

                            {/* Middle Content (Canvas) */}
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0,
                                paddingLeft: '0px',
                                paddingRight: '0px',
                                transition: 'padding 0.3s ease'
                            }}>
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
                                        zIndex: 10,
                                        margin: '20px 40px' // Restore some margin for the grid area
                                    }}>
                                    {components.length === 0 ? (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                                            <h3 className="text-xl font-bold mb-2">Start Building Your Dashboard</h3>
                                            <p>Add components from the palette • Drag to arrange • Resize as needed</p>
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
                                            margin={[20, 20]}
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
                                                        className="drag-handle opacity-0 hover:opacity-100 transition-opacity"
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
                                                            zIndex: 10
                                                        }}
                                                    >
                                                        <GripHorizontal className="w-4 h-4 text-[var(--color-text-muted)]" />
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeComponent(comp.id);
                                                            }}
                                                            className="absolute right-1 p-0.5 hover:bg-red-500/20 rounded transition-colors text-red-500"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>

                                                    <div style={{ height: '100%', padding: '0', overflow: 'hidden' }}>
                                                        {renderComponent(comp)}
                                                    </div>
                                                </div>
                                            ))}
                                        </GridLayout>
                                    )}
                                </div>
                            </div>

                            {/* Right Sidebar (Settings) */}
                            <div
                                style={{
                                    width: (settingsCollapsed || !selectedComponentId) ? '0px' : `${settingsWidth}px`,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    borderLeft: (settingsCollapsed || !selectedComponentId) ? 'none' : '1px solid var(--color-border)',
                                    background: 'var(--color-bg-base)',
                                    display: 'flex',
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    zIndex: 110,
                                    boxShadow: settingsCollapsed ? 'none' : '-4px 0 16px rgba(0,0,0,0.2)',
                                    overflow: 'visible'
                                }}
                            >
                                {/* Resize Handle (Right) */}
                                {selectedComponentId && !settingsCollapsed && (
                                    <div
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            resizingRef.current = 'settings';
                                            document.body.style.cursor = 'ew-resize';
                                        }}
                                        style={{
                                            position: 'absolute',
                                            left: '0',
                                            top: 0,
                                            bottom: 0,
                                            width: '4px',
                                            cursor: 'ew-resize',
                                            zIndex: 102,
                                            transition: 'background 0.2s',
                                            background: 'transparent'
                                        }}
                                        className="hover:bg-[var(--color-primary)] opacity-30"
                                    />
                                )}
                                <div style={{ flex: 1, overflow: 'hidden', opacity: (settingsCollapsed || !selectedComponentId) ? 0 : 1, transition: 'opacity 0.2s' }}>
                                    {selectedComponentId && (
                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <h3 className="text-sm font-semibold text-[var(--color-text-base)] uppercase tracking-widest">Settings</h3>
                                                <button onClick={() => setSelectedComponentId(null)} className="p-1 hover:bg-[var(--color-hover)] rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-base)]">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                                {/* Settings Content (Reused from previous implementation) */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>WIDGET TITLE</label>
                                                        <input
                                                            type="text"
                                                            value={components.find(c => c.id === selectedComponentId)?.config.title || ''}
                                                            onChange={(e) => updateComponentConfig(selectedComponentId, { title: e.target.value })}
                                                            style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                        />
                                                    </div>

                                                    {/* Other simplified settings components here... using current logic */}
                                                    {['pie', 'bar', 'kpi', 'table', 'schedule'].includes(components.find(c => c.id === selectedComponentId)?.type) && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                            {/* Attribute Picker, Filters, etc. - reused */}
                                                            {/* Standard Attribute Picker for Single-Value Charts */}
                                                            {['pie', 'bar', 'kpi'].includes(components.find(c => c.id === selectedComponentId)?.type) && (
                                                                <div>
                                                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>DATA ATTRIBUTE</label>
                                                                    <select
                                                                        value={components.find(c => c.id === selectedComponentId)?.config.attribute || ''}
                                                                        onChange={(e) => updateComponentConfig(selectedComponentId, { attribute: e.target.value })}
                                                                        style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                    >
                                                                        <option value="">Select property...</option>
                                                                        {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                    </select>
                                                                </div>
                                                            )}

                                                            {/* Global Sync Settings for all charts */}
                                                            <div className="flex flex-col gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                                                                <div className="flex flex-col gap-1.5 border-l-2 border-lime-400/30 pl-3">
                                                                    <label className="text-[10px] text-lime-400 uppercase font-bold">Timeline Sync Property</label>
                                                                    <select
                                                                        value={components.find(c => c.id === selectedComponentId)?.config.timelineDateAttribute || ''}
                                                                        onChange={(e) => updateComponentConfig(selectedComponentId, { timelineDateAttribute: e.target.value })}
                                                                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-lime-400/50 outline-none"
                                                                    >
                                                                        <option value="">Auto-detect...</option>
                                                                        {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                    </select>
                                                                    <p className="text-[9px] text-white/40 italic">When Global SYNC is ON, this widget will filter by this date property.</p>
                                                                </div>
                                                            </div>

                                                            {/* Table Settings: Multi-Column Picker */}
                                                            {components.find(c => c.id === selectedComponentId)?.type === 'table' && (
                                                                <div className="flex flex-col gap-2">
                                                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>COLUMNS</label>
                                                                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md max-h-40 overflow-y-auto p-2">
                                                                        {availableProperties.map(p => {
                                                                            const currentAttrs = components.find(c => c.id === selectedComponentId)?.config.attributes || [];
                                                                            const isChecked = currentAttrs.includes(p);
                                                                            return (
                                                                                <label key={p} className="flex items-center gap-2 p-1 hover:bg-[var(--color-hover)] rounded cursor-pointer text-xs text-[var(--color-text-base)]">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isChecked}
                                                                                        onChange={(e) => {
                                                                                            const newAttrs = e.target.checked
                                                                                                ? [...currentAttrs, p]
                                                                                                : currentAttrs.filter(a => a !== p);
                                                                                            updateComponentConfig(selectedComponentId, { attributes: newAttrs });
                                                                                        }}
                                                                                        className="accent-[var(--color-primary)]"
                                                                                    />
                                                                                    {p}
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <p className="text-[10px] text-[var(--color-text-muted)]">Select columns to display in the table.</p>
                                                                </div>
                                                            )}

                                                            {/* Schedule Settings: Start/End Dates */}
                                                            {components.find(c => c.id === selectedComponentId)?.type === 'schedule' && (
                                                                <div className="flex flex-col gap-4">
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>ACTIVITY NAME</label>
                                                                        <select
                                                                            value={components.find(c => c.id === selectedComponentId)?.config.activityNameAttribute || ''}
                                                                            onChange={(e) => updateComponentConfig(selectedComponentId, { activityNameAttribute: e.target.value })}
                                                                            style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--color-text-base)' }}
                                                                        >
                                                                            <option value="">(Optional) Select ID/Name...</option>
                                                                            {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>START DATE</label>
                                                                        <select
                                                                            value={components.find(c => c.id === selectedComponentId)?.config.startDateAttribute || ''}
                                                                            onChange={(e) => updateComponentConfig(selectedComponentId, { startDateAttribute: e.target.value })}
                                                                            style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--color-text-base)' }}
                                                                        >
                                                                            <option value="">Select start date...</option>
                                                                            {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>END DATE</label>
                                                                        <select
                                                                            value={components.find(c => c.id === selectedComponentId)?.config.endDateAttribute || ''}
                                                                            onChange={(e) => updateComponentConfig(selectedComponentId, { endDateAttribute: e.target.value })}
                                                                            style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--color-text-base)' }}
                                                                        >
                                                                            <option value="">Select end date...</option>
                                                                            {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>PROGRESS %</label>
                                                                        <select
                                                                            value={components.find(c => c.id === selectedComponentId)?.config.progressAttribute || ''}
                                                                            onChange={(e) => updateComponentConfig(selectedComponentId, { progressAttribute: e.target.value })}
                                                                            style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--color-text-base)' }}
                                                                        >
                                                                            <option value="">(Optional) Select progress...</option>
                                                                            {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Aggregation Selector for KPI */}
                                                            {components.find(c => c.id === selectedComponentId)?.type === 'kpi' && (
                                                                <div>
                                                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>AGGREGATION</label>
                                                                    <div className="flex bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md p-1">
                                                                        {['count', 'sum'].map(type => {
                                                                            const currentType = components.find(c => c.id === selectedComponentId)?.config.aggregationType || 'count';
                                                                            const isActive = currentType === type;
                                                                            return (
                                                                                <button
                                                                                    key={type}
                                                                                    onClick={() => updateComponentConfig(selectedComponentId, { aggregationType: type })}
                                                                                    className={`flex-1 py-1.5 text-xs font-semibold rounded uppercase tracking-wider transition-all ${isActive ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-base)]'}`}
                                                                                >
                                                                                    {type}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* Add more setting controls as needed based on old logic */}
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>DISPLAY FORMAT</label>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => {
                                                                    const current = components.find(c => c.id === selectedComponentId)?.config.exact;
                                                                    updateComponentConfig(selectedComponentId, { exact: current === undefined ? false : !current });
                                                                }}>
                                                                    <div style={{
                                                                        width: '32px',
                                                                        height: '18px',
                                                                        borderRadius: '9px',
                                                                        background: (components.find(c => c.id === selectedComponentId)?.config.exact !== false) ? 'var(--color-primary)' : '#555',
                                                                        position: 'relative',
                                                                        transition: 'background 0.2s'
                                                                    }}>
                                                                        <div style={{
                                                                            width: '14px',
                                                                            height: '14px',
                                                                            borderRadius: '50%',
                                                                            background: 'white',
                                                                            position: 'absolute',
                                                                            top: '2px',
                                                                            left: (components.find(c => c.id === selectedComponentId)?.config.exact !== false) ? '16px' : '2px',
                                                                            transition: 'left 0.2s'
                                                                        }} />
                                                                    </div>
                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-base)' }}>Exact Numbers (no K/M)</span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>UNIT OVERRIDE</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Auto-detecting..."
                                                                    value={components.find(c => c.id === selectedComponentId)?.config.unit || ''}
                                                                    onChange={(e) => updateComponentConfig(selectedComponentId, { unit: e.target.value })}
                                                                    style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Collapse Toggle Arrow (Right) */}
                                {selectedComponentId && (
                                    <button
                                        onClick={() => setSettingsCollapsed(!settingsCollapsed)}
                                        style={{
                                            position: 'absolute',
                                            left: '-12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: 'var(--color-bg-base)',
                                            border: '1px solid var(--color-border)',
                                            color: 'var(--color-text-base)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            zIndex: 103,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                        }}
                                    >
                                        {settingsCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                )}
                            </div>
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
                    </AnimatePresence>

                    {/* Floating AI Chat */}
                    <AnimatePresence>
                        {isAIChatOpen ? (
                            <AIChatBot
                                isOpen={isAIChatOpen}
                                onClose={() => setIsAIChatOpen(false)}
                                viewer={viewer}
                                onDataClick={(ids) => setCurrentSelection(ids)}
                            />
                        ) : (
                            <motion.button
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setIsAIChatOpen(true)}
                                style={{
                                    position: 'fixed',
                                    bottom: '24px',
                                    right: '24px',
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '28px',
                                    background: 'var(--color-primary)',
                                    color: '#000',
                                    border: 'none',
                                    boxShadow: '0 8px 32px rgba(29, 185, 84, 0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 9999,
                                    cursor: 'pointer'
                                }}
                                title="AI Assistant"
                            >
                                <MessageSquare className="w-6 h-6" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </>
            </ErrorBoundary >
        </div >
    );
};

export default DashboardBuilder;
