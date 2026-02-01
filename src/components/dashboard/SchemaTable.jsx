import React, { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Search, Save, Filter, ChevronsUp, ChevronsDown, Box, FileSpreadsheet, RotateCcw, CheckSquare, Square } from 'lucide-react';

const SchemaTable = ({ schema = {}, onUpdateSchema }) => {
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'source', direction: 'asc' });

    // Helper to update a single property
    const handlePropUpdate = (key, field, value) => {
        const newSchema = { ...schema };
        if (newSchema.properties && newSchema.properties[key]) {
            newSchema.properties[key] = {
                ...newSchema.properties[key],
                [field]: value
            };
            onUpdateSchema(newSchema);
        }
    };

    // Bulk Actions
    const handleBulkAction = (action) => {
        const newSchema = { ...schema };
        if (!newSchema.properties) return;

        Object.keys(newSchema.properties).forEach(key => {
            if (action === 'enable_all') newSchema.properties[key].include = true;
            if (action === 'disable_all') newSchema.properties[key].include = false;
        });
        onUpdateSchema(newSchema);
    };

    // Derived Data
    const processedProps = useMemo(() => {
        if (!schema.properties) return [];

        let props = Object.entries(schema.properties).map(([key, config]) => ({
            key,
            ...config
        }));

        // Filter
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            props = props.filter(p =>
                p.originalName.toLowerCase().includes(lowerQuery) ||
                (p.alias && p.alias.toLowerCase().includes(lowerQuery))
            );
        }

        // Sort
        props.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return props;
    }, [schema, searchQuery, sortConfig]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <div style={{
                padding: '12px',
                background: 'var(--color-bg-base)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                gap: '12px',
                justifyContent: 'space-between',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '200px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="text"
                            placeholder="Search properties..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px 10px 6px 30px',
                                background: 'var(--color-bg-elevated)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '4px',
                                fontSize: '12px',
                                color: 'var(--color-text-base)'
                            }}
                        />
                        <Search className="w-3 h-3 text-[var(--color-text-subdued)]" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => handleBulkAction('enable_all')}
                        className="btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                        <CheckSquare className="w-3 h-3" /> Check All
                    </button>
                    <button
                        onClick={() => handleBulkAction('disable_all')}
                        className="btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                        <Square className="w-3 h-3" /> Uncheck All
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg-elevated)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>
                        <tr>
                            {['Sync', 'Source', 'Original Name', 'Alias', 'Type'].map(header => (
                                <th
                                    key={header}
                                    onClick={() => handleSort(header.toLowerCase().replace(' ', ''))}
                                    style={{
                                        textAlign: 'left',
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        color: 'var(--color-text-subdued)',
                                        fontWeight: '600'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {header}
                                        {sortConfig.key === header.toLowerCase().replace(' ', '') && (
                                            sortConfig.direction === 'asc' ? <ChevronsUp size={12} /> : <ChevronsDown size={12} />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {processedProps.map((prop) => (
                            <tr key={prop.key} style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-base)' }}>
                                {/* Include Toggle */}
                                <td style={{ padding: '8px 12px', textAlign: 'center', width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        checked={prop.include}
                                        onChange={(e) => handlePropUpdate(prop.key, 'include', e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </td>

                                {/* Source Icon */}
                                <td style={{ padding: '8px 12px', width: '60px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={prop.source}>
                                        {prop.source === 'model' ?
                                            <Box className="w-4 h-4 text-green-500" /> :
                                            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                                        }
                                    </div>
                                </td>

                                {/* Original Name */}
                                <td style={{ padding: '8px 12px', color: 'var(--color-text-subdued)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={prop.originalName}>
                                    {prop.originalName}
                                </td>

                                {/* Alias Input */}
                                <td style={{ padding: '8px 12px' }}>
                                    <input
                                        type="text"
                                        value={prop.alias || ''}
                                        placeholder={prop.originalName}
                                        onChange={(e) => handlePropUpdate(prop.key, 'alias', e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '4px',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '3px',
                                            background: 'transparent',
                                            color: 'var(--color-text-base)',
                                            fontSize: '11px'
                                        }}
                                    />
                                </td>

                                {/* Data Type */}
                                <td style={{ padding: '8px 12px' }}>
                                    <select
                                        value={prop.type}
                                        onChange={(e) => handlePropUpdate(prop.key, 'type', e.target.value)}
                                        style={{
                                            padding: '4px',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '3px',
                                            background: 'transparent',
                                            color: 'var(--color-text-base)',
                                            fontSize: '11px'
                                        }}
                                    >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="date">Date</option>
                                        <option value="boolean">Boolean</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                        {processedProps.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-subdued)' }}>
                                    No properties found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ padding: '8px', borderTop: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--color-text-subdued)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{processedProps.length} properties ({processedProps.filter(p => p.include).length} active)</span>
                <span>Sorted by {sortConfig.key}</span>
            </div>
        </div>
    );
};

export default SchemaTable;
