import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import analyticsService from '../../services/analyticsService';

const DataTable = ({ config = {}, viewer, onDataClick, masterData, joinedData, timelineDate, globalSync, scopedDbIds }) => {
    const { title = 'Data Table', data: customData, attribute, attributes = [], filters, logicalOperator } = config;
    const [tableData, setTableData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Backward compatibility for 'attribute' prop
    const targetAttributes = attributes.length > 0 ? attributes : (attribute ? [attribute] : []);

    useEffect(() => {
        if (viewer && targetAttributes.length > 0) {
            loadModelData();
        }
    }, [viewer, JSON.stringify(targetAttributes), JSON.stringify(filters), logicalOperator, masterData, joinedData, timelineDate, globalSync, config.timelineDateAttribute, JSON.stringify(scopedDbIds)]);

    const loadModelData = async () => {
        setLoading(true);
        try {
            let data;
            let agg;

            if (masterData && masterData.length > 0) {
                // FAST PATH: Sync Table generation
                console.log('[DataTable] Using Master Data');
                let targetData = masterData;

                // --- TIMELINE SYNC FILTER ---
                if (globalSync && timelineDate) {
                    const dateAttr = config.timelineDateAttribute || 'Start Date'; // Fallback
                    targetData = masterData.filter(row => {
                        const val = row[dateAttr];
                        if (!val) return false;
                        const rowDate = new Date(val);
                        return !isNaN(rowDate.getTime()) && rowDate <= timelineDate;
                    });
                }

                // --- GLOBAL SYNC (CROSS-FILTER) ---
                if (globalSync && scopedDbIds && scopedDbIds.length > 0) {
                    const scopeSet = new Set(scopedDbIds);
                    targetData = targetData.filter(row => scopeSet.has(row.dbId));
                }

                data = analyticsService.getTableDataFromMaster(targetData, targetAttributes, filters, logicalOperator);
                // We need agg for total count calculation
                // For now, reconstruct 'agg' or simplify total calc
                const tempAgg = {};
                data.forEach(d => {
                    const key = JSON.stringify(targetAttributes.map(a => d[a]));
                    if (!tempAgg[key]) tempAgg[key] = d.dbIds;
                });
                agg = tempAgg;

            } else {
                // SLOW PATH: Async
                console.log('[DataTable] Using Viewer Query (Legacy)');
                agg = await analyticsService.aggregateByMultipleProperties(viewer, targetAttributes, filters, logicalOperator, null, joinedData);
                data = analyticsService.getTableData(agg, targetAttributes);
            }

            const totalInView = Object.values(agg).reduce((sum, ids) => sum + ids.length, 0);

            setTableData({
                headers: [...targetAttributes, 'Count', '%'],
                rows: data.map(item => [
                    ...targetAttributes.map(attr => item[attr]),
                    item.count,
                    `${((item.count / (totalInView || 1)) * 100).toFixed(1)}%`,
                    item.dbIds // Hidden for click
                ])
            });
        } catch (err) {
            console.error('Failed to load table data:', err);
            setTableData(null);
        } finally {
            setLoading(false);
        }
    };

    const data = tableData || customData || {
        headers: ['Component', 'Quantity', 'Material', 'Cost', 'Status'],
        rows: [
            ['Columns', '24', 'Concrete', '$45,000', '✅ Complete'],
            ['Beams', '48', 'Steel', '$68,000', '✅ Complete'],
            ['Walls', '156', 'Brick', '$32,000', '🔄 In Progress'],
            ['Windows', '84', 'Glass', '$28,000', '⏳ Pending'],
            ['Doors', '36', 'Wood', '$15,000', '⏳ Pending']
        ]
    };

    const handleRowClick = (dbIds) => {
        if (dbIds && onDataClick) {
            console.log(`[DataTable] Row clicked, mapping to ${dbIds?.length || 0} elements`);
            onDataClick(dbIds);
        }
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
                padding: 'var(--spacing-md)',
                border: loading ? '1px solid var(--color-primary)' : '1px solid var(--color-border)'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-base)' }}>
                    {title} {attribute && `(${attribute})`}
                </h3>
                {loading && <div className="spinner-sm"></div>}
            </div>

            <div style={{ flex: 1, overflow: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, zIndex: 1 }}>
                            {data.headers.map((header, index) => (
                                <th key={index} style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: 'var(--color-text-subdued)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                onClick={() => handleRowClick(row[row.length - 1])}
                                style={{
                                    borderBottom: '1px solid var(--color-border)',
                                    cursor: onDataClick ? 'pointer' : 'default',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                {row.slice(0, data.headers.length).map((cell, cellIndex) => {
                                    // Auto-format numeric cells except 'Count'
                                    let content = cell;

                                    if (cell instanceof Date) {
                                        content = cell.toLocaleDateString();
                                    } else {
                                        const isNumeric = !isNaN(parseFloat(cell)) && isFinite(cell);
                                        if (isNumeric && data.headers[cellIndex] !== 'Count' && !String(cell).includes('%')) {
                                            content = analyticsService.formatValue(cell, {
                                                exact: config.exact !== undefined ? config.exact : true,
                                                decimals: 2
                                            });
                                        }
                                    }

                                    return (
                                        <td key={cellIndex} style={{ padding: '12px', fontSize: '0.85rem', color: cellIndex === 0 ? 'var(--color-text-base)' : 'var(--color-text-subdued)' }}>
                                            {content}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

export default DataTable;
