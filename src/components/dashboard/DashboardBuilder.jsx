import { useState, useEffect, Component } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import FileExplorer from '../viewer/FileExplorer';
import PropertyFilter from './PropertyFilter';
import analyticsService from '../../services/analyticsService';
import exportUtils from '../../utils/exportUtils';

const componentTypes = [
    { type: 'viewer', icon: '🏗️', label: '3D Viewer', component: APSViewer, defaultSize: { w: 6, h: 4 } },
    { type: 'filter', icon: '🔍', label: 'Property Filter', component: PropertyFilter, defaultSize: { w: 3, h: 4 } },
    { type: 'pie', icon: '🥧', label: 'Pie Chart', component: PieChart, defaultSize: { w: 3, h: 3 } },
    { type: 'bar', icon: '📊', label: 'Bar Chart', component: BarChart, defaultSize: { w: 4, h: 3 } },
    { type: 'line', icon: '📈', label: 'Line Chart', component: LineChart, defaultSize: { w: 6, h: 3 } },
    { type: 'kpi', icon: '🎯', label: 'KPI Card', component: KPICard, defaultSize: { w: 2, h: 2 } },
    { type: 'table', icon: '📋', label: 'Data Table', component: DataTable, defaultSize: { w: 6, h: 3 } },
    { type: 'chatbot', icon: '🤖', label: 'AI Assistant', component: AIChatBot, defaultSize: { w: 4, h: 5 } }
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
    const { id } = useParams();
    const [dashboardName, setDashboardName] = useState('New Dashboard');
    const [dashboardDescription, setDashboardDescription] = useState('');
    const [layout, setLayout] = useState([]);
    const [components, setComponents] = useState([]);
    const [globalModel, setGlobalModel] = useState(null);
    const [showFileExplorer, setShowFileExplorer] = useState(false);

    // Interaction Sync State
    const [interactionSync, setInteractionSync] = useState(false);
    const [currentSelection, setCurrentSelection] = useState([]);

    useEffect(() => {
        if (id) {
            try {
                const dashboard = storageService.getDashboard(id);
                if (dashboard) {
                    setDashboardName(dashboard.name);
                    setDashboardDescription(dashboard.description || '');
                    setComponents(dashboard.components || []);
                    setLayout(dashboard.layout || []);
                    setGlobalModel(dashboard.globalModel || null);
                }
            } catch (err) {
                console.error("Error loading dashboard for edit:", err);
            }
        }
    }, [id]);

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

    const removeComponent = (componentId) => {
        setComponents(components.filter(c => c.id !== componentId));
        setLayout(layout.filter(l => l.i !== componentId));
    };

    const saveDashboard = () => {
        const dashboard = {
            id: id || `dashboard-${Date.now()}`,
            name: dashboardName,
            description: dashboardDescription,
            components,
            layout,
            globalModel,
            thumbnail: globalModel ? '🏗️' : (components.find(c => c.type === 'viewer') ? '🏗️' : '📊')
        };

        storageService.saveDashboard(dashboard);
        navigate('/overview');
    };

    const [selectedComponentId, setSelectedComponentId] = useState(null);
    const [viewer, setViewer] = useState(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [availableProperties, setAvailableProperties] = useState([]);
    const [propsLoading, setPropsLoading] = useState(false);

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
        fetchProperties(viewerInstance);
    };

    const fetchProperties = async (viewerInstance) => {
        if (!viewerInstance || !viewerInstance.model) {
            setModelLoaded(false);
            return;
        }
        setPropsLoading(true);
        setAvailableProperties([]); // Clear old properties immediately
        console.log('[Builder] Fetching properties for viewer...');
        try {
            const props = await analyticsService.getModelPropertyNames(viewerInstance);
            if (props && props.length > 0) {
                setAvailableProperties(props);
            } else {
                console.warn('[Builder] No properties returned from scan.');
                setAvailableProperties([]);
            }
        } catch (err) {
            console.error('[Builder] Failed to load properties:', err);
            setAvailableProperties([]);
        } finally {
            setPropsLoading(false);
        }
    };

    const updateComponentConfig = (id, newConfig) => {
        setComponents(components.map(c =>
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
                    modelUrn={globalModel?.modelUrn}
                    modelName={globalModel?.model?.name}
                    onViewerReady={handleViewerReady}
                    onModelLoaded={handleModelLoaded}
                    onRequestFileBrowse={() => setShowFileExplorer(true)}
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
                    onDataClick={handleChartDataClick}
                    onThematicColorChange={handleThematicColorChange}
                    scopedDbIds={interactionSync && currentSelection.length > 0 ? currentSelection : null}
                />
            </div>
        );
    };

    return (
        <ErrorBoundary onBack={() => navigate('/overview')}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    display: 'flex',
                    gap: 'var(--spacing-lg)',
                    height: 'calc(100vh - 140px)'
                }}
            >
                {/* Component Palette */}
                <motion.div
                    initial={{ x: -300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    style={{
                        width: '240px',
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--spacing-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--spacing-md)'
                    }}
                >
                    <div style={{ paddingBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
                        <h3 style={{
                            fontSize: 'var(--font-size-base)',
                            fontWeight: 'var(--font-weight-semibold)',
                            color: 'var(--color-text-base)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: 'var(--spacing-sm)'
                        }}>
                            Global Model
                        </h3>
                        {globalModel ? (
                            <div style={{
                                background: 'var(--color-bg-press)',
                                padding: '10px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{globalModel.model.name}</div>
                                    <div style={{ color: 'var(--color-text-subdued)' }}>{globalModel.project.name}</div>
                                </div>
                                <button
                                    onClick={() => setShowFileExplorer(true)}
                                    className="btn btn-secondary"
                                    style={{ fontSize: '10px', width: '100%' }}
                                >Change Model</button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowFileExplorer(true)}
                                className="btn btn-primary"
                                style={{ width: '100%', fontSize: '12px' }}
                            >
                                Select Model
                            </button>
                        )}
                    </div>

                    <h3 style={{
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 'var(--font-weight-semibold)',
                        color: 'var(--color-text-base)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: 'var(--spacing-sm)'
                    }}>
                        Components
                    </h3>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--spacing-xs)'
                    }}>
                        {componentTypes.map((compType) => {
                            // Defensive check to prevent "Objects are not valid as React child" error
                            const isIconValid = typeof compType.icon === 'string';
                            const isLabelValid = typeof compType.label === 'string';

                            if (!isIconValid || !isLabelValid) {
                                console.error('[Builder] Invalid component type definition:', compType);
                                return null;
                            }

                            return (
                                <motion.button
                                    key={compType.type}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => addComponent(compType.type)}
                                    style={{
                                        background: 'var(--color-bg-highlight)',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-sm)',
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-text-base)',
                                        fontWeight: 'var(--font-weight-medium)',
                                        transition: 'all var(--transition-base)'
                                    }}
                                >
                                    <span style={{ fontSize: '20px' }}>{compType.icon}</span>
                                    <span>{compType.label}</span>
                                </motion.button>
                            );
                        })}
                    </div>

                    <div style={{
                        marginTop: 'auto',
                        padding: 'var(--spacing-sm)',
                        background: 'var(--color-bg-press)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-subdued)',
                        lineHeight: 1.4
                    }}>
                        💡 Click to add • Drag to move • Resize from corners
                    </div>
                </motion.div>

                {/* Settings Panel (Conditional) */}
                <AnimatePresence>
                    {selectedComponentId && (
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            style={{
                                width: '280px',
                                background: 'var(--color-bg-elevated)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--spacing-md)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--spacing-md)',
                                boxShadow: 'var(--shadow-lg)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '800', textTransform: 'uppercase' }}>🔧 Widget Settings</h3>
                                <button onClick={() => setSelectedComponentId(null)} className="btn-icon">×</button>
                            </div>

                            {components.find(c => c.id === selectedComponentId) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '8px' }}>WIDGET TITLE</label>
                                        <input
                                            type="text"
                                            value={components.find(c => c.id === selectedComponentId).config.title}
                                            onChange={(e) => updateComponentConfig(selectedComponentId, { title: e.target.value })}
                                            style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white' }}
                                        />
                                    </div>

                                    {['pie', 'bar', 'table'].includes(components.find(c => c.id === selectedComponentId).type) && (
                                        <>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-subdued)' }}>
                                                        {components.find(c => c.id === selectedComponentId).type === 'table' ? 'GROUP BY COLUMNS' : 'DATA ATTRIBUTE (BIM)'}
                                                    </label>
                                                    <button
                                                        onClick={() => fetchProperties(viewer)}
                                                        className="btn-icon"
                                                        style={{ width: '20px', height: '20px', fontSize: '12px' }}
                                                        title="Refresh properties from model"
                                                        disabled={propsLoading}
                                                    >
                                                        {propsLoading ? '⏳' : '🔄'}
                                                    </button>
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
                                                                    style={{ flex: 1, padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white', fontSize: '12px' }}
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
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                                <label style={{ fontSize: '0.65rem', color: 'var(--color-text-subdued)', display: 'block' }}>GROUP BY (LEGEND)</label>
                                                                <button
                                                                    onClick={() => fetchProperties(viewer)}
                                                                    disabled={propsLoading}
                                                                    title="Refresh Properties"
                                                                    style={{
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        color: 'var(--color-primary)',
                                                                        cursor: 'pointer',
                                                                        fontSize: '12px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        padding: '0 4px'
                                                                    }}
                                                                >
                                                                    {propsLoading ? '⏳' : '🔄'}
                                                                </button>
                                                            </div>
                                                            <select
                                                                value={components.find(c => c.id === selectedComponentId).config.attribute || ''}
                                                                onChange={(e) => updateComponentConfig(selectedComponentId, { attribute: e.target.value })}
                                                                style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white' }}
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

                                                        <div>
                                                            <label style={{ fontSize: '0.65rem', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>AGGREGATION TYPE</label>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                {['count', 'sum'].map(method => (
                                                                    <button
                                                                        key={method}
                                                                        onClick={() => updateComponentConfig(selectedComponentId, { aggregationType: method })}
                                                                        style={{
                                                                            flex: 1,
                                                                            padding: '8px',
                                                                            background: components.find(c => c.id === selectedComponentId).config.aggregationType === method ? 'var(--color-primary)' : 'var(--color-bg-base)',
                                                                            color: components.find(c => c.id === selectedComponentId).config.aggregationType === method ? 'black' : 'white',
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
                                                                <label style={{ fontSize: '0.65rem', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>SUM PROPERTY (AREA/VOLUME/COST)</label>
                                                                <select
                                                                    value={components.find(c => c.id === selectedComponentId).config.sumAttribute || ''}
                                                                    onChange={(e) => updateComponentConfig(selectedComponentId, { sumAttribute: e.target.value })}
                                                                    style={{ width: '100%', padding: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white' }}
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
                                                            <label htmlFor="applyColors" style={{ fontSize: '11px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
                                                                🎨 SYNC COLORS TO MODEL
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-subdued)' }}>FILTERS</label>
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
                                                                style={{ width: '100%', marginBottom: '4px', fontSize: '11px', background: 'transparent', color: 'white', border: 'none' }}
                                                            >
                                                                <option value="">Property...</option>
                                                                {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>

                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <select
                                                                    value={filter.operator}
                                                                    onChange={(e) => updateFilter(selectedComponentId, idx, { operator: e.target.value })}
                                                                    style={{ flex: 1, fontSize: '10px', background: 'transparent', color: 'white', border: 'none' }}
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
                                                                    style={{ flex: 2, fontSize: '10px', background: 'transparent', color: 'white', border: 'none', borderBottom: '1px solid var(--color-border)' }}
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
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Canvas */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-md)'
                }}>
                    {/* Dashboard Info */}
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        style={{
                            background: 'var(--color-bg-elevated)',
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
                                    color: 'var(--color-text-subdued)',
                                    fontSize: 'var(--font-size-sm)',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Header Right Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                            {/* Interaction Sync Toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--color-bg-base)', borderRadius: '20px', border: '1px solid var(--color-border)' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: interactionSync ? 'var(--color-primary)' : 'var(--color-text-subdued)', cursor: 'pointer' }}>
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
                                    onClick={() => exportUtils.downloadDashboard({ name: dashboardName, description: dashboardDescription, globalModel, components, layout })}
                                    className="btn btn-secondary"
                                    style={{ padding: '8px 16px', whiteSpace: 'nowrap', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}
                                >
                                    📥 EXPORT HTML
                                </button>
                                <button
                                    onClick={saveDashboard}
                                    className="btn btn-primary"
                                    style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}
                                >
                                    {id ? 'UPDATE DASHBOARD' : 'CREATE DASHBOARD'}
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Grid Canvas */}
                    <div style={{
                        flex: 1,
                        overflow: 'auto',
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--spacing-md)',
                        position: 'relative'
                    }}>
                        {components.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    color: 'var(--color-text-subdued)'
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
                            </motion.div>
                        ) : (
                            <GridLayout
                                className="layout"
                                layout={layout}
                                cols={12}
                                rowHeight={80}
                                width={1200}
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
                                            <span style={{ fontSize: '12px', color: 'var(--color-text-subdued)' }}>Drag to move</span>
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
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
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
                                        onSelect={(selection) => {
                                            console.log('[Builder] Selected:', selection);
                                            // Handle the structure returned by FileExplorer: { project, model, modelUrn }
                                            setGlobalModel({
                                                modelUrn: selection.modelUrn,
                                                model: { name: selection.model.name },
                                                project: { name: selection.project.name || 'Unknown Project' }
                                            });
                                            setModelLoaded(false);
                                            setAvailableProperties([]);
                                            setShowFileExplorer(false);
                                        }}
                                    />
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </ErrorBoundary>
    );
};

export default DashboardBuilder;
