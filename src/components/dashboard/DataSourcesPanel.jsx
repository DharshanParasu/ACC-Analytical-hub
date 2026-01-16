import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import FileExplorer from '../viewer/FileExplorer';
import analyticsService from '../../services/analyticsService';

const TABS = [
    { id: 'model', label: '3D Model', icon: '🏗️' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'cost', label: 'Cost', icon: '💰' },
    { id: 'carbon', label: 'Carbon', icon: '🌱' },
    { id: 'calculations', label: 'Calculations', icon: '🧮' },
    { id: 'preview', label: 'Data Preview', icon: '👁️' },
    { id: 'clash', label: 'Clash', icon: '💥' },
    { id: 'checker', label: 'Model Checker', icon: '✅' }
];

const DataSourcesPanel = ({ projectData, onUpdateProjectData, viewer, onPropertiesLoaded, hasViewerComponent, onRefreshAll, isRefreshing, availableProperties, isCollapsed, masterData }) => {
    const [activeTab, setActiveTab] = useState('model');
    const [showFileExplorer, setShowFileExplorer] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [localProperties, setLocalProperties] = useState([]);
    const [visibleColumns, setVisibleColumns] = useState([]);

    // Use props if available, otherwise local state
    // const availableProperties = propProperties || localProperties;

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

                const workbook = XLSX.read(buffer, { type: 'array' });
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
                        }
                    };

                    onUpdateProjectData({
                        ...projectData,
                        sources: {
                            ...projectData.sources,
                            [activeTab]: newSource
                        }
                    });
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
            }
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
        backgroundColor: 'var(--color-bg-elevated)',
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
            {/* Header */}
            <div style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'white' }}>🗄️ Project Data Sources</h3>
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
                                <span>Waiting for data sync</span>
                            </>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={onRefreshAll} // This will now serve as "Save & Merge" passed from parent
                        disabled={isRefreshing}
                        className="btn btn-primary"
                        style={{ fontSize: '12px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Save changes and merge data"
                    >
                        <span>💾</span> Save Changes
                    </button>
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="btn-icon"
                        title="Close"
                        style={{ fontSize: '16px' }}
                    >
                        ✕
                    </button>
                </div>
            </div>



            {/* Tabs */}
            <div style={{ display: 'flex', overflowX: 'auto', background: 'var(--color-bg-base)', borderBottom: '1px solid var(--color-border)' }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '10px 16px',
                            background: activeTab === tab.id ? 'var(--color-bg-elevated)' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : 'none',
                            color: activeTab === tab.id ? 'white' : 'var(--color-text-subdued)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center'
                        }}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>



            {/* Content Area */}
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', position: 'relative' }}>

                {activeTab === 'calculations' ? (
                    <div>
                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#93c5fd', marginBottom: '4px' }}>ℹ️ Create Custom Columns</div>
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
                                        <div style={{ fontWeight: '600', fontSize: '12px', color: 'white' }}>{calc.name}</div>
                                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#a78bfa' }}>= {calc.formula}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newCalcs = projectData.calculations.filter((_, i) => i !== idx);
                                            onUpdateProjectData({ ...projectData, calculations: newCalcs });
                                        }}
                                        className="btn-icon"
                                        style={{ color: '#ef4444' }}
                                        title="Delete Calculation"
                                    >🗑️</button>
                                </div>
                            ))}
                        </div>

                        {/* Add New Calculation Form */}
                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'white', marginBottom: '12px' }}>➕ Add New Calculation</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>COLUMN NAME</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Total Cost"
                                        id="new-calc-name"
                                        style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white', fontSize: '12px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>FORMULA</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            placeholder="e.g. [Volume] * 100"
                                            id="new-calc-formula"
                                            style={{ flex: 1, padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white', fontFamily: 'monospace', fontSize: '12px' }}
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
                                        onUpdateProjectData({ ...projectData, calculations: [...currentCalcs, newCalc] });

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
                ) : activeTab === 'preview' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {!masterData || masterData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-subdued)' }}>
                                <div style={{ fontSize: '24px', marginBottom: '16px' }}>📭</div>
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
                                                style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-bg-highlight)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
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
                                    <span style={{ fontSize: '18px' }}>🏗️</span>
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
                            style={{ width: '100%', marginBottom: '20px' }}
                        >
                            {projectData.model ? '🔄 Switch Model' : '➕ Select Model'}
                        </button>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                            <strong style={{ fontSize: '12px', color: 'white' }}>MODEL PROPERTIES</strong>
                            <button onClick={fetchProperties} disabled={isLoading} className="btn-icon" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', padding: '0 12px' }}>
                                {isLoading ? (
                                    <>
                                        <div className="spinner-sm" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                        <span>Scanning...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🔎</span> Scan Properties
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
                                <span style={{ color: 'white', fontSize: '12px', fontFamily: 'monospace' }}>
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
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>LINKED FILE</label>
                            {projectData.sources && projectData.sources[activeTab] ? (
                                <div style={{ padding: '12px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '18px' }}>📄</span>
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
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                        title="Remove Link"
                                    >❌</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowFileExplorer(true)}
                                    className="btn btn-secondary"
                                    style={{ width: '100%', borderStyle: 'dashed' }}
                                >
                                    ➕ Link Excel File...
                                </button>
                            )}
                        </div>

                        {projectData.sources && projectData.sources[activeTab] && (
                            <div style={{ animation: 'fadeIn 0.3s ease' }}>
                                <hr style={{ borderColor: 'var(--color-border)', margin: '16px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <strong style={{ fontSize: '12px', color: 'white' }}>DATA MAPPING</strong>
                                    <button onClick={fetchProperties} disabled={isLoading} className="btn-icon" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {isLoading ? (
                                            <>
                                                <div className="spinner-sm" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                                <span>Loading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>🔄</span> Refresh Props
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    {/* Model Key */}
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '4px' }}>MODEL PROPERTY</label>
                                        <select
                                            value={projectData.sources[activeTab].mapping.modelKey}
                                            onChange={(e) => updateMapping('modelKey', e.target.value)}
                                            style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white', fontSize: '11px' }}
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
                                            style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white', fontSize: '11px' }}
                                        >
                                            <option value="">Select Column...</option>
                                            {projectData.sources[activeTab].headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', fontSize: '11px', color: '#60a5fa' }}>
                                    ℹ️ Ensure these two properties share common values to link the data successfully.
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
        </div >
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
                    className="btn btn-primary"
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
                    <span>🗄️</span>
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
