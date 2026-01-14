import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import analyticsService from '../../services/analyticsService';

const PropertyFilter = ({ config, viewer, onFilterChange, scopedDbIds }) => {
    const [selectedProperty, setSelectedProperty] = useState('Category');
    const [availableProperties, setAvailableProperties] = useState([]);
    const [propertyValues, setPropertyValues] = useState([]);
    const [filteredValues, setFilteredValues] = useState([]); // Values filtered by dropdown search
    const [selectedValues, setSelectedValues] = useState([]);
    const [dropdownSearch, setDropdownSearch] = useState(''); // Search text inside dropdown
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (viewer) {
            loadProperties();
        }
    }, [viewer]);

    useEffect(() => {
        if (viewer && selectedProperty) {
            loadValues(selectedProperty);
        }
    }, [viewer, selectedProperty, scopedDbIds]);

    const loadProperties = async () => {
        const props = await analyticsService.getModelPropertyNames(viewer);
        setAvailableProperties(props);
    };

    const loadValues = async (propName) => {
        setLoading(true);
        const values = await analyticsService.getUniquePropertyValues(viewer, propName, scopedDbIds);
        setPropertyValues(values);
        setFilteredValues(values);
        setLoading(false);
    };

    // Filter values when dropdown search changes
    useEffect(() => {
        const lower = dropdownSearch.toLowerCase();
        setFilteredValues(propertyValues.filter(v =>
            String(v).toLowerCase().includes(lower)
        ));
    }, [dropdownSearch, propertyValues]);



    const handleValueToggle = (value) => {
        const newSelection = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];

        setSelectedValues(newSelection);
        applyFilter(newSelection);
    };

    const applyFilter = async (values) => {
        if (!viewer) return;

        if (values.length === 0) {
            viewer.clearSelection();
            viewer.showAll();
            return;
        }

        // Aggregate to find IDs for selected values
        // We can check each value
        const allIds = [];
        // We construct a filter for EACH value (OR logic)
        // searchElements usually does AND. We might need multiple calls or update searchElements to support OR.
        // For now, let's use aggregateByProperty which effectively groups by value.

        const aggregation = await analyticsService.aggregateByProperty(viewer, selectedProperty);

        values.forEach(val => {
            if (aggregation[val]) {
                allIds.push(...aggregation[val].dbIds);
            }
        });

        viewer.isolate(allIds);
        viewer.fitToView(allIds);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-bg-elevated)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)'
            }}
        >
            <div style={{
                padding: 'var(--spacing-md)',
                borderBottom: '1px solid var(--color-border)',
                background: 'rgba(255,255,255,0.02)'
            }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                    🔍 Model Filter
                </h3>



                {/* Property Select */}
                <div style={{ marginBottom: '8px' }}>
                    <select
                        value={selectedProperty}
                        onChange={(e) => {
                            setSelectedProperty(e.target.value);
                            setSelectedValues([]);
                        }}
                        style={{
                            width: '100%',
                            background: 'var(--color-bg-base)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                            padding: '6px',
                            color: 'white',
                            fontSize: '12px'
                        }}
                    >
                        {availableProperties.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Values Multi-Select Dropdown */}
            <div style={{ padding: '0 var(--spacing-md) var(--spacing-md)' }}>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            width: '100%',
                            background: 'var(--color-bg-base)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                            padding: '8px',
                            color: 'white',
                            fontSize: '12px',
                            textAlign: 'left',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedValues.length === 0
                                ? 'Select values...'
                                : `${selectedValues.length} selected`
                            }
                        </span>
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--color-bg-elevated)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    maxHeight: '300px', // Increased height
                                    display: 'flex',
                                    flexDirection: 'column',
                                    zIndex: 1000,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                }}
                            >
                                {/* Dropdown Search Input */}
                                <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                                    <input
                                        type="text"
                                        value={dropdownSearch}
                                        onChange={(e) => setDropdownSearch(e.target.value)}
                                        placeholder="Search values..."
                                        onClick={(e) => e.stopPropagation()} // Prevent close on click
                                        style={{
                                            width: '100%',
                                            background: 'var(--color-bg-base)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '3px',
                                            padding: '6px',
                                            color: 'white',
                                            fontSize: '11px'
                                        }}
                                    />
                                </div>

                                <div style={{ overflowY: 'auto', maxHeight: '200px' }}>
                                    {loading ? (
                                        <div style={{ textAlign: 'center', padding: '12px', color: 'gray', fontSize: '11px' }}>Loading...</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {filteredValues.map(val => (
                                                <label key={val} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '8px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    background: selectedValues.includes(val) ? 'rgba(29, 185, 84, 0.1)' : 'transparent',
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedValues.includes(val)}
                                                        onChange={() => handleValueToggle(val)}
                                                    />
                                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {val}
                                                    </span>
                                                </label>
                                            ))}
                                            {propertyValues.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '12px', color: 'gray', fontSize: '11px' }}>
                                                    No values found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div style={{ flex: 1 }}></div>

            {
                selectedValues.length > 0 && (
                    <div style={{
                        padding: '8px',
                        borderTop: '1px solid var(--color-border)',
                        textAlign: 'center'
                    }}>
                        <button
                            onClick={() => {
                                setDropdownSearch('');
                                setSelectedValues([]);
                                viewer.clearSelection();
                                viewer.showAll();
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-text-subdued)',
                                fontSize: '11px',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Clear Filters
                        </button>
                    </div>
                )
            }
        </motion.div >
    );
};

export default PropertyFilter;
