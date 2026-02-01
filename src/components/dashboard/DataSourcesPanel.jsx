import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import FileExplorer from '../viewer/FileExplorer';
import analyticsService from '../../services/analyticsService';
import { useTheme } from '../../context/ThemeContext';

import {
    Box, Calendar, DollarSign, Leaf, Calculator, Eye, AlertTriangle, CheckSquare,
    Database, Save, X, Info, Trash2, Plus, RefreshCw, Inbox, FileSpreadsheet, Search,
    CheckCircle2, XCircle, TableProperties
} from 'lucide-react';
import SchemaTable from './SchemaTable';

const TABS = [
    { id: 'model', label: '3D Model', icon: Box },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'cost', label: 'Cost', icon: DollarSign },
    { id: 'carbon', label: 'Carbon', icon: Leaf },
    { id: 'calculations', label: 'Calculations', icon: Calculator },
    { id: 'schema', label: 'Schema', icon: TableProperties },
    { id: 'preview', label: 'Data Preview', icon: Eye },
    { id: 'clash', label: 'Clash', icon: AlertTriangle },
    { id: 'checker', label: 'Model Checker', icon: CheckSquare }
];

const DataSourcesPanel = ({ projectData, onUpdateProjectData, viewer, onPropertiesLoaded, hasViewerComponent, onRefreshAll, isRefreshing, availableProperties, isCollapsed, masterData, modelLoaded }) => {
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState('model');
    const [showFileExplorer, setShowFileExplorer] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [localProperties, setLocalProperties] = useState([]);
    const [visibleColumns, setVisibleColumns] = useState([]);
    const [showSchemaPopup, setShowSchemaPopup] = useState(false);
    const [pendingSchema, setPendingSchema] = useState(null);
    const [pendingSourceData, setPendingSourceData] = useState(null);
    const [pendingModelScan, setPendingModelScan] = useState(false); // Track if we're waiting for model to load

    // Use props if available, otherwise local state
    // const availableProperties = propProperties || localProperties;

    // Helper to merge new properties into schema
    const mergeSchema = (newProps, sourceName, sourceType, detectedTypes = {}) => {
        const currentSchema = projectData.schemaConfig || { properties: {} };
        const newProperties = { ...currentSchema.properties };

        if (!newProps || newProps.length === 0) return;

        newProps.forEach(prop => {
            const uniqueKey = `${sourceName}:${prop}`;

            if (!newProperties[uniqueKey]) {
                newProperties[uniqueKey] = {
                    source: sourceType,
                    sourceName: sourceName,
                    originalName: prop,
                    alias: '',
                    type: detectedTypes[prop] || 'text',
                    include: true
                };
            }
        });

        onUpdateProjectData({
            ...projectData,
            schemaConfig: { properties: newProperties }
        });
    };

    const openSchemaConfig = (newProps, sourceName, sourceType, dataSample = []) => {
        // Auto-detect types if data sample exists
        const detectedTypes = {};
        if (dataSample.length > 0) {
            newProps.forEach(prop => {
                const values = dataSample.map(row => row[prop]).filter(v => v !== undefined && v !== null && v !== '');
                if (values.length === 0) {
                    detectedTypes[prop] = 'text';
                    return;
                }

                const firstVal = values[0];
                if (firstVal instanceof Date) {
                    detectedTypes[prop] = 'date';
                } else if (typeof firstVal === 'number') {
                    detectedTypes[prop] = 'number';
                } else if (typeof firstVal === 'boolean') {
                    detectedTypes[prop] = 'boolean';
                } else {
                    // Try parsing string as date or number
                    const asNum = Number(firstVal);
                    const asDate = new Date(firstVal);
                    if (!isNaN(asNum) && String(firstVal).trim() !== '') {
                        detectedTypes[prop] = 'number';
                    } else if (!isNaN(asDate.getTime()) && String(firstVal).length > 5) {
                        detectedTypes[prop] = 'date';
                    } else {
                        detectedTypes[prop] = 'text';
                    }
                }
            });
        }

        const pendingProps = {};
        newProps.forEach(prop => {
            pendingProps[`${sourceName}:${prop}`] = {
                source: sourceType,
                sourceName: sourceName,
                originalName: prop,
                alias: '',
                type: detectedTypes[prop] || 'text',
                include: true
            };
        });

        setPendingSchema({ properties: pendingProps });
        setPendingSourceData({ sourceName, sourceType, props: newProps });
        setShowSchemaPopup(true);
    };

    const confirmSchemaMerge = () => {
        if (!pendingSchema) return;

        const currentSchema = projectData.schemaConfig || { properties: {} };
        const updatedProperties = { ...currentSchema.properties, ...pendingSchema.properties };

        onUpdateProjectData({
            ...projectData,
            schemaConfig: { properties: updatedProperties },
            isDirty: true
        });

        setShowSchemaPopup(false);
        setPendingSchema(null);
        setPendingSourceData(null);
    };

    // Auto-populate on tab switch if empty and data exists
    useEffect(() => {
        if (activeTab === 'schema') {
            const hasSchema = projectData.schemaConfig && Object.keys(projectData.schemaConfig.properties).length > 0;
            if (!hasSchema) {
                // Priority: availableProperties (Master List) > localProperties (Local Scan)
                if (availableProperties && availableProperties.length > 0) {
                    console.log("Auto-populating schema from Master List...", availableProperties.length);
                    mergeSchema(availableProperties, 'model', 'model');
                } else if (localProperties.length > 0) {
                    console.log("Auto-populating schema from Local Scan...", localProperties.length);
                    mergeSchema(localProperties, 'model', 'model');
                }
            }
        }
    }, [activeTab, localProperties, availableProperties, projectData.schemaConfig]);

    // AUTO-SCAN LOGIC: Trigger scan when model is loaded if pending
    useEffect(() => {
        if (pendingModelScan && modelLoaded && viewer) {
            console.log("Model loaded! Triggering auto-scan...");
            setPendingModelScan(false);
            fetchProperties();
        }
    }, [modelLoaded, pendingModelScan, viewer]);


    // Fetch model properties for mapping
    const fetchProperties = async () => {
        if (!viewer) {
            if (!hasViewerComponent) {
                alert("⚠️ scanning requires a 3D Viewer.\n\nPlease add a '3D Viewer' component to your dashboard from the palette on the left.");
            } else {
                alert("⏳ Model is initializing...\n\nPlease wait a moment for the 3D Viewer to fully load the model, then try scanning again.");
            }
            return;
        }
        setIsLoading(true);
        try {
            const props = await analyticsService.getModelPropertyNames(viewer);
            if (props && props.length > 0) {
                setLocalProperties(props);
                // Update Global Property List in Parent
                if (onPropertiesLoaded) {
                    onPropertiesLoaded(props);
                }
                // Open Schema Config instead of auto-merging
                openSchemaConfig(props, 'model', 'model');
            } else {
                alert("No properties found in the model. Please ensure the model is fully loaded.");
            }
        } catch (err) {
            console.error("Error fetching props:", err);
            alert("Failed to fetch properties from the model.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = async (selection) => {
        if (activeTab === 'model') {
            // Update Global Model
            onUpdateProjectData({
                ...projectData,
                model: {
                    urn: selection.modelUrn, // Use the proper URN from Explorer
                    name: selection.model.name,
                    projectName: selection.project.name
                }
            });
            // Set pending scan flag to true - waiting for model to load
            setPendingModelScan(true);
            setIsLoading(true); // Show loading state while waiting
        } else {
            // Handle External Data Sources (Excel)
            if (!selection.model.name.endsWith('.xlsx')) {
                alert("Please select a valid .xlsx file");
                return;
            }

            try {
                setIsLoading(true);
                const buffer = await analyticsService.apsService.getFileContent(
                    selection.model.projectId,
                    selection.model.urn
                );

                const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData && jsonData.length > 0) {
                    const headers = Object.keys(jsonData[0]);
                    // Initialize source config
                    const newSource = {
                        fileName: selection.model.name,
                        urn: selection.model.urn,
                        projectId: selection.model.projectId,
                        headers: headers,
                        data: jsonData,
                        mapping: {
                            modelKey: '',
                            fileKey: ''
                        },
                        isDirty: true
                    };

                    onUpdateProjectData({
                        ...projectData,
                        sources: {
                            ...projectData.sources,
                            [activeTab]: newSource
                        }
                    });

                    // Open Schema Config instead of auto-merging
                    openSchemaConfig(headers, selection.model.name, 'excel', jsonData.slice(0, 10));
                }
            } catch (err) {
                console.error("Error parsing Excel:", err);
                alert("Failed to parse file.");
            } finally {
                setIsLoading(false);
            }
        }
        setShowFileExplorer(false);
    };

    const updateMapping = (key, value) => {
        if (!projectData.sources[activeTab]) return;

        const updatedSource = {
            ...projectData.sources[activeTab],
            mapping: {
                ...projectData.sources[activeTab].mapping,
                [key]: value
            },
            isDirty: true
        };

        onUpdateProjectData({
            ...projectData,
            sources: {
                ...projectData.sources,
                [activeTab]: updatedSource
            }
        });
    };

    const [isExpanded, setIsExpanded] = useState(false);

    const containerStyle = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '900px',
        height: '700px',
        background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        opacity: 1,
        backdropFilter: 'none',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflow: 'hidden'
    };

    const renderContent = () => (
        <div style={containerStyle}>
            {(isRefreshing || isLoading || pendingModelScan) && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(4px)',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="spinner-sm" style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid var(--color-border)',
                        borderTopColor: 'var(--color-primary)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <div style={{
                        marginTop: '16px',
                        color: 'var(--color-text-base)',
                        fontWeight: '700',
                        fontSize: '16px',
                        letterSpacing: '-0.02em'
                    }}>
                        {pendingModelScan
                            ? "Waiting for Model to Load..."
                            : isRefreshing
                                ? "Merging Data..."
                                : "Processing..."}
                    </div>
                </div>
            )}
            {/* Header */}
            <div style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-[var(--color-text-base)]" />
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--color-text-base)' }}>Project Data Sources</h3>
                    </div>
                    {/* Status Indicator */}
                    <div style={{ fontSize: '11px', color: 'var(--color-text-subdued)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isRefreshing ? (
                            <>
                                <span className="spinner-sm" style={{ width: '8px', height: '8px', border: '1px solid var(--color-text-subdued)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                                <span>Syncing data...</span>
                            </>
                        ) : masterData && masterData.length > 0 ? (
                            <>
                                <span style={{ color: '#4ade80' }}>●</span>
                                <span>Data Loaded: <strong>{masterData.length}</strong> records</span>
                            </>
                        ) : (
                            <>
                                <span style={{ color: '#fbbf24' }}>●</span>
                                <span>Ready to sync</span>
                            </>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => onRefreshAll()} // This will now serve as "Save & Merge" passed from parent
                        disabled={isRefreshing}
                        className="btn btn-primary"
                        style={{ fontSize: '12px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Saving changes and merging data"
                    >
                        {isRefreshing ? (
                            <>
                                <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-3 h-3" /> {projectData.isDirty || Object.values(projectData.sources || {}).some(s => s.isDirty) ? 'Sync & Save Changes' : 'Save Changes'}
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="btn-icon"
                        title="Close"
                        style={{ fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>





            {/* Main Content Area with Vertical Sidebar */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Vertical Sidebar for Tabs */}
                <div style={{ width: '200px', background: 'var(--color-bg-base)', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const source = projectData.sources[tab.id];
                        const status = source?.syncStatus;
                        const stats = source?.matchStats;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '12px 16px',
                                    background: activeTab === tab.id ? 'var(--color-bg-elevated)' : 'transparent',
                                    border: 'none',
                                    borderLeft: activeTab === tab.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                                    color: activeTab === tab.id ? 'var(--color-text-base)' : 'var(--color-text-subdued)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: activeTab === tab.id ? '600' : '500',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    textAlign: 'left',
                                    transition: 'all 0.2s',
                                    width: '100%'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {isRefreshing ? (
                                        <RefreshCw className="w-3 h-3 animate-spin opacity-50" />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {/* Show Match Count if available */}
                                            {tab.id === 'calculations' ? (
                                                projectData.calculations?.length > 0 && (
                                                    <span style={{ fontSize: '10px', opacity: 0.7 }}>{projectData.calculations.length}</span>
                                                )
                                            ) : stats && stats.matchCount >= 0 && (
                                                <span style={{ fontSize: '10px', opacity: 0.7 }}>{stats.matchCount}</span>
                                            )}

                                            {/* Status Dot */}
                                            {tab.id === 'calculations' ? (
                                                projectData.isDirty && (
                                                    <div style={{
                                                        width: '6px',
                                                        height: '6px',
                                                        borderRadius: '50%',
                                                        background: '#f59e0b',
                                                        boxShadow: '0 0 8px #f59e0b'
                                                    }} title="Changes require sync" />
                                                )
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {source?.isDirty ? (
                                                        <div style={{
                                                            width: '6px',
                                                            height: '6px',
                                                            borderRadius: '50%',
                                                            background: '#f59e0b',
                                                            boxShadow: '0 0 8px #f59e0b'
                                                        }} title="Changes require sync" />
                                                    ) : status && (
                                                        <div style={{
                                                            width: '6px',
                                                            height: '6px',
                                                            borderRadius: '50%',
                                                            background: status === 'success' ? '#10b981' : status === 'warning' ? '#f59e0b' : '#ef4444',
                                                            boxShadow: status === 'success' ? '0 0 8px #10b981' : 'none'
                                                        }} />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, padding: '16px', overflowY: 'auto', position: 'relative' }}>

                    {activeTab === 'calculations' ? (
                        <div>
                            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#93c5fd', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Info className="w-4 h-4" /> Create Custom Columns
                                </div>
                                <div style={{ fontSize: '11px', color: '#bfdbfe' }}>
                                    Define new properties using mathematical formulas based on existing data.
                                    <br />Supported: <code>+ - * / ( )</code> and numbers. Use <code>[PropertyName]</code> to reference columns.
                                </div>
                            </div>

                            {/* List Existing Calculations */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                                {(!projectData.calculations || projectData.calculations.length === 0) && (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-subdued)', fontStyle: 'italic' }}>
                                        No calculations defined yet.
                                    </div>
                                )}
                                {(projectData.calculations || []).map((calc, idx) => (
                                    <div key={idx} style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '12px', color: 'var(--color-text-base)' }}>{calc.name}</div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#a78bfa' }}>= {calc.formula}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newCalcs = projectData.calculations.filter((_, i) => i !== idx);
                                                onUpdateProjectData({ ...projectData, calculations: newCalcs, isDirty: true });
                                            }}
                                            className="btn-icon"
                                            style={{ color: '#ef4444' }}
                                            title="Delete Calculation"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add New Calculation Form */}
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-base)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Plus className="w-4 h-4" /> Add New Calculation
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>COLUMN NAME</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Total Cost"
                                            id="new-calc-name"
                                            style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)', fontSize: '12px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>FORMULA</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                placeholder="e.g. [Volume] * 100"
                                                id="new-calc-formula"
                                                style={{ flex: 1, padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)', fontFamily: 'monospace', fontSize: '12px' }}
                                            />
                                            {/* Helper for Fields could go here */}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            const nameInput = document.getElementById('new-calc-name');
                                            const formulaInput = document.getElementById('new-calc-formula');
                                            const name = nameInput.value.trim();
                                            const formula = formulaInput.value.trim();

                                            if (!name || !formula) {
                                                alert("Please provide both a name and a formula.");
                                                return;
                                            }

                                            // Simple validation
                                            if (projectData.calculations && projectData.calculations.some(c => c.name === name)) {
                                                alert("A calculation with this name already exists.");
                                                return;
                                            }

                                            const newCalc = { name, formula };
                                            const currentCalcs = projectData.calculations || [];
                                            onUpdateProjectData({ ...projectData, calculations: [...currentCalcs, newCalc], isDirty: true });

                                            // Clear inputs
                                            nameInput.value = '';
                                            formulaInput.value = '';
                                        }}
                                    >
                                        Add Calculation
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'schema' ? (
                        <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {(!projectData.schemaConfig || Object.keys(projectData.schemaConfig.properties).length === 0) && (
                                <div style={{ padding: '10px', background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--color-text-subdued)' }}>
                                            No properties in schema.
                                        </span>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => {
                                                // Priority: availableProperties (Master List) > localProperties
                                                if (availableProperties && availableProperties.length > 0) {
                                                    mergeSchema(availableProperties, 'model', 'model');
                                                } else if (localProperties.length > 0) {
                                                    mergeSchema(localProperties, 'model', 'model');
                                                } else {
                                                    fetchProperties();
                                                }
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            {(availableProperties?.length > 0 || localProperties.length > 0) ? 'Populate from Master List' : 'Scan Model'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <SchemaTable
                                schema={projectData.schemaConfig}
                                onUpdateSchema={(newSchema) => onUpdateProjectData({ ...projectData, schemaConfig: newSchema })}
                            />
                        </div>
                    ) : activeTab === 'preview' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {!masterData || masterData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-subdued)' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Inbox className="w-8 h-8 opacity-50" /></div>
                                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>No Data Available</div>
                                    <div style={{ fontSize: '12px' }}>Please click <strong>Save Changes</strong> to generate the preview.</div>
                                </div>
                            ) : (
                                <>
                                    {/* Column Selector */}
                                    <div style={{ padding: '12px', background: 'var(--color-bg-base)', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
                                        <details>
                                            <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-subdued)', userSelect: 'none' }}>
                                                Select Columns ({visibleColumns.length > 0 ? visibleColumns.length : 'All'}) ⬇
                                            </summary>
                                            <div style={{ marginTop: '8px', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '4px' }}>
                                                {Object.keys(masterData[0] || {}).map(key => (
                                                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'var(--color-bg-elevated)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={visibleColumns.length === 0 || visibleColumns.includes(key)}
                                                            onChange={(e) => {
                                                                const isChecked = e.target.checked;
                                                                let newCols = [...visibleColumns];
                                                                if (newCols.length === 0) {
                                                                    // If empty (showing all), initialize with all EXCEPT the one being unchecked if that's the case
                                                                    // But simpler: just add all current keys then toggle
                                                                    newCols = Object.keys(masterData[0]);
                                                                }

                                                                if (isChecked) {
                                                                    if (!newCols.includes(key)) newCols.push(key);
                                                                } else {
                                                                    newCols = newCols.filter(c => c !== key);
                                                                }
                                                                setVisibleColumns(newCols);
                                                            }}
                                                        />
                                                        {key}
                                                    </label>
                                                ))}
                                                <button
                                                    onClick={() => setVisibleColumns([])}
                                                    style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-bg-highlight)', border: 'none', borderRadius: '4px', color: 'var(--color-text-base)', cursor: 'pointer' }}
                                                >
                                                    Reset (Show All)
                                                </button>
                                            </div>
                                        </details>
                                    </div>

                                    {/* Data Table */}
                                    <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                            <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg-elevated)', zIndex: 10 }}>
                                                <tr>
                                                    {(visibleColumns.length > 0 ? visibleColumns : Object.keys(masterData[0] || {})).map(key => (
                                                        <th key={key} style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', color: 'var(--color-text-base)' }}>
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {masterData.slice(0, 100).map((row, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                                        {(visibleColumns.length > 0 ? visibleColumns : Object.keys(masterData[0] || {})).map(key => (
                                                            <td key={`${idx}-${key}`} style={{ padding: '6px 8px', color: 'var(--color-text-subdued)', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {row[key] !== undefined && row[key] !== null ? String(row[key]) : '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--color-text-subdued)', textAlign: 'right' }}>
                                        Showing first 100 rows of {masterData.length} total items
                                    </div>
                                </>
                            )}
                        </div>
                    ) : activeTab === 'model' ? (
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>CURRENT MODEL</label>
                                {projectData.model ? (
                                    <div style={{ padding: '12px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px' }}><Box className="w-6 h-6 text-green-400" /></span>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#4ade80' }}>{projectData.model.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--color-text-subdued)' }}>{projectData.model.projectName}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: '4px', color: 'var(--color-text-subdued)' }}>
                                        No model linked.
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setShowFileExplorer(true)}
                                className="btn btn-primary"
                                style={{ width: '100%', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {projectData.model ? <><RefreshCw className="w-4 h-4" /> Switch Model</> : <><Plus className="w-4 h-4" /> Select Model</>}
                            </button>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                                <strong style={{ fontSize: '12px', color: 'var(--color-text-base)' }}>MODEL PROPERTIES</strong>
                                <button onClick={fetchProperties} disabled={isLoading} className="btn-icon" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', padding: '0 12px' }}>
                                    {isLoading ? (
                                        <>
                                            <div className="spinner-sm" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                            <span>Scanning...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-3 h-3" /> Scan Properties
                                        </>
                                    )}
                                </button>
                            </div>

                            <div style={{ padding: '16px', background: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--color-text-subdued)', fontSize: '12px' }}>Status</span>
                                    <span style={{ color: availableProperties.length > 0 ? '#4ade80' : 'var(--color-text-subdued)', fontSize: '12px', fontWeight: '600' }}>
                                        {availableProperties.length > 0 ? 'Loaded' : 'Not Loaded'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-subdued)', fontSize: '12px' }}>Properties Found</span>
                                    <span style={{ color: 'var(--color-text-base)', fontSize: '12px', fontFamily: 'monospace' }}>
                                        {availableProperties.length}
                                    </span>
                                </div>
                                {availableProperties.length > 0 && (
                                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)', maxHeight: '150px', overflowY: 'auto' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--color-text-subdued)', marginBottom: '8px' }}>PREVIEW</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {availableProperties.slice(0, 10).map(p => (
                                                <span key={p} style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-bg-highlight)', borderRadius: '4px', color: 'var(--color-text-base)' }}>
                                                    {p}
                                                </span>
                                            ))}
                                            {availableProperties.length > 10 && (
                                                <span style={{ fontSize: '10px', padding: '2px 6px', color: 'var(--color-text-subdued)' }}>
                                                    +{availableProperties.length - 10} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // External Data Tabs (Schedule, Cost, etc.)
                        <div>
                            {/* Status Banner */}
                            {projectData.sources[activeTab] && (projectData.sources[activeTab].syncStatus || !projectData.sources[activeTab].mapping?.modelKey) && (
                                <div style={{
                                    padding: '10px 14px',
                                    borderRadius: '6px',
                                    marginBottom: '16px',
                                    background: !projectData.sources[activeTab].mapping?.modelKey
                                        ? 'rgba(245, 158, 11, 0.1)'
                                        : projectData.sources[activeTab].syncStatus === 'success'
                                            ? 'rgba(16, 185, 129, 0.1)'
                                            : projectData.sources[activeTab].syncStatus === 'warning'
                                                ? 'rgba(245, 158, 11, 0.1)'
                                                : 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid',
                                    borderColor: !projectData.sources[activeTab].mapping?.modelKey
                                        ? 'rgba(245, 158, 11, 0.3)'
                                        : projectData.sources[activeTab].syncStatus === 'success'
                                            ? 'rgba(16, 185, 129, 0.3)'
                                            : projectData.sources[activeTab].syncStatus === 'warning'
                                                ? 'rgba(245, 158, 11, 0.3)'
                                                : 'rgba(239, 68, 68, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    {!projectData.sources[activeTab].mapping?.modelKey ? (
                                        <>
                                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                                            <div style={{ fontSize: '12px', color: 'var(--color-text-base)' }}>
                                                <strong>Action Required:</strong> Map a Model Property to link your Excel data.
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {projectData.sources[activeTab].syncStatus === 'success' ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            ) : projectData.sources[activeTab].syncStatus === 'warning' ? (
                                                <AlertTriangle className="w-4 h-4 text-orange-400" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-red-500" />
                                            )}
                                            <div style={{ fontSize: '12px', color: 'var(--color-text-base)' }}>
                                                {projectData.sources[activeTab].syncStatus === 'success' && (
                                                    <span><strong>Linked Successfully:</strong> {projectData.sources[activeTab].matchStats?.matchCount} items matched from {projectData.sources[activeTab].fileName}</span>
                                                )}
                                                {projectData.sources[activeTab].syncStatus === 'warning' && (
                                                    <span><strong>Sync Warning:</strong> {projectData.sources[activeTab].error || "Zero matches. Check your mapping keys."}</span>
                                                )}
                                                {projectData.sources[activeTab].syncStatus === 'error' && (
                                                    <span><strong>Sync Error:</strong> {projectData.sources[activeTab].error || "Failed to merge data."}</span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            <div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '11px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>LINKED FILE</label>
                                    {projectData.sources && projectData.sources[activeTab] ? (
                                        <div style={{ padding: '12px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '18px' }}><FileSpreadsheet className="w-5 h-5 text-green-400" /></span>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#4ade80', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                    {projectData.sources[activeTab].fileName}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newSources = { ...projectData.sources };
                                                    delete newSources[activeTab];
                                                    onUpdateProjectData({ ...projectData, sources: newSources });
                                                }}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex' }}
                                                title="Remove Link"
                                            >
                                                <X className="w-4 h-4 text-red-400" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowFileExplorer(true)}
                                            className="btn btn-secondary"
                                            style={{ width: '100%', borderStyle: 'dashed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        >
                                            <Plus className="w-4 h-4" /> Link Excel File...
                                        </button>
                                    )}
                                </div>

                                {projectData.sources && projectData.sources[activeTab] && (
                                    <div style={{ animation: 'fadeIn 0.3s ease' }}>
                                        <hr style={{ borderColor: 'var(--color-border)', margin: '16px 0' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <strong style={{ fontSize: '12px', color: 'var(--color-text-base)' }}>DATA MAPPING</strong>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            {/* Model Key */}
                                            <div>
                                                <label style={{ fontSize: '10px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>MODEL PROPERTY</label>
                                                <select
                                                    value={projectData.sources[activeTab].mapping.modelKey}
                                                    onChange={(e) => updateMapping('modelKey', e.target.value)}
                                                    style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)', fontSize: '11px' }}
                                                >
                                                    <option value="">Select Property...</option>
                                                    {availableProperties.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>

                                            {/* Excel Key */}
                                            <div>
                                                <label style={{ fontSize: '10px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>EXCEL COLUMN</label>
                                                <select
                                                    value={projectData.sources[activeTab].mapping.fileKey}
                                                    onChange={(e) => updateMapping('fileKey', e.target.value)}
                                                    style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-base)', fontSize: '11px' }}
                                                >
                                                    <option value="">Select Column...</option>
                                                    {projectData.sources[activeTab].headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', fontSize: '11px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Info className="w-4 h-4" /> Ensure these two properties share common values to link the data successfully.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Schema Selection Popup */}
                    <AnimatePresence>
                        {showSchemaPopup && (
                            <div style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.85)', zIndex: 3000,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backdropFilter: 'blur(8px)'
                            }}>
                                <motion.div
                                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                    style={{
                                        width: '850px',
                                        height: '650px',
                                        background: 'var(--color-bg-elevated)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--color-border)',
                                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--color-text-base)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <TableProperties className="w-5 h-5 text-lime-400" />
                                                Configure Data Schema
                                            </h3>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-subdued)' }}>
                                                Source: <strong style={{ color: 'var(--color-text-base)' }}>{pendingSourceData?.sourceName}</strong> ({pendingSourceData?.sourceType})
                                            </p>
                                        </div>
                                        <button onClick={() => setShowSchemaPopup(false)} className="btn-icon">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, overflow: 'hidden', padding: '0' }}>
                                        <SchemaTable
                                            schema={pendingSchema}
                                            onUpdateSchema={setPendingSchema}
                                        />
                                    </div>

                                    {/* Footer */}
                                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-base)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                        <button
                                            onClick={() => setShowSchemaPopup(false)}
                                            className="btn btn-secondary"
                                            style={{ padding: '8px 20px' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmSchemaMerge}
                                            className="btn btn-primary"
                                            style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Confirm & Add to Schema
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* File Explorer Modal */}
                    <AnimatePresence>
                        {showFileExplorer && (
                            <div style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.8)', zIndex: 2000,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    style={{ width: '800px', height: '600px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                                >
                                    <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                                        <h3>Select {activeTab === 'model' ? '3D Model' : 'Excel File'}</h3>
                                        <button onClick={() => setShowFileExplorer(false)} className="btn-icon">×</button>
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <FileExplorer onSelect={handleFileSelect} />
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <div style={{
                padding: isCollapsed ? '12px 8px' : '16px',
                background: 'var(--color-bg-base)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isCollapsed ? 'center' : 'stretch'
            }}>
                {!isCollapsed && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--color-text-base)' }}>PROJECT DATA</h3>
                            {projectData.model && <span style={{ fontSize: '10px', color: '#4ade80' }}>● Active</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-subdued)', marginBottom: '12px' }}>
                            {projectData.model ? projectData.model.name : 'No model linked'}
                        </div>
                    </>
                )}
                <button
                    onClick={() => setIsExpanded(true)}
                    className={isCollapsed ? 'rounded-lg cursor-pointer p-2 bg-transparent hover:bg-[var(--color-hover)] transition-all flex items-center justify-center text-[var(--color-text-muted)] hover:text-lime-400' : 'btn btn-primary'}
                    style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: isCollapsed ? 0 : '8px'
                    }}
                    title="Manage Sources"
                >
                    <Database className={isCollapsed ? "w-8 h-8" : "w-4 h-4"} />
                    {!isCollapsed && <span>Manage Sources</span>}
                </button>
            </div>

            {isExpanded && ReactDOM.createPortal(
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, backdropFilter: 'blur(4px)' }} onClick={() => setIsExpanded(false)} />
                    {renderContent()}
                </>,
                document.body
            )}
        </>
    );
};

export default DataSourcesPanel;
