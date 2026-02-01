import { useState, useEffect, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { motion } from 'framer-motion';
import analyticsService from '../../services/analyticsService';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BarChart = ({ config = {}, viewer, onDataClick, onThematicColorChange, scopedDbIds, joinedData, masterData, timelineDate, globalSync }) => {
    const { theme } = useTheme();
    const chartRef = useRef();
    const { title = 'Bar Chart', data: customData, orientation = 'vertical', attribute, filters, logicalOperator } = config;

    // Define theme-aware colors for Chart.js (Canvas doesn't resolve CSS variables)
    const chartColors = {
        grid: theme === 'light' ? '#e2e8f0' : '#282828',
        ticks: theme === 'light' ? '#475569' : '#b3b3b3',
        tooltipBg: theme === 'light' ? '#ffffff' : '#181818',
        tooltipText: theme === 'light' ? '#0f172a' : '#ffffff',
        tooltipBorder: theme === 'light' ? '#cbd5e1' : '#282828'
    };
    const [chartData, setChartData] = useState(null);
    const [aggregation, setAggregation] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (viewer && attribute) {
            loadModelData();
        }
    }, [viewer, attribute, JSON.stringify(filters), logicalOperator, config.aggregationType, config.sumAttribute, scopedDbIds, joinedData, masterData, timelineDate, globalSync, config.timelineDateAttribute]);

    const loadModelData = async () => {
        setLoading(true);
        try {
            const aggType = config.aggregationType || 'count';
            const sumAttr = aggType === 'sum' ? (config.sumAttribute || null) : null;

            let res;
            if (masterData && masterData.length > 0) {
                console.log('[BarChart] Using Master Data for aggregation');
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

                res = analyticsService.aggregateFromMasterData(targetData, attribute, filters, logicalOperator, sumAttr, scopedDbIds);
            } else {
                console.log('[BarChart] Using Viewer Query (Legacy) for aggregation');
                res = await analyticsService.aggregateByProperty(viewer, attribute, filters, logicalOperator, sumAttr, scopedDbIds, joinedData);
            }

            const agg = res.data;
            const detectedUnit = res.unit;

            setAggregation(agg);
            const data = analyticsService.getChartData(agg, attribute, 'Total', 'bar', aggType);

            // Add unit metadata to datasets for formatting
            if (data.datasets?.[0]) {
                data.datasets[0].unit = detectedUnit || config.unit || '';
            }

            setChartData(data);
        } catch (err) {
            console.error('Failed to load chart data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (chartData && aggregation && config.applyColorsToModel && onThematicColorChange) {
            onThematicColorChange(aggregation, chartData.datasets[0].backgroundColor);
        }
    }, [chartData, aggregation, config.applyColorsToModel]);

    const data = chartData || customData || {
        labels: ['Foundation', 'Structure', 'Walls', 'Roof', 'MEP', 'Finishes'],
        datasets: [{
            label: 'Cost ($1000s)',
            data: [450, 680, 320, 280, 520, 380],
            backgroundColor: '#1db954',
            borderRadius: 4
        }]
    };


    const options = {
        indexAxis: orientation === 'horizontal' ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: chartColors.tooltipBg,
                padding: 12,
                titleColor: chartColors.tooltipText,
                bodyColor: chartColors.tooltipText,
                borderColor: chartColors.tooltipBorder,
                borderWidth: 1,
                cornerRadius: 8,
                callbacks: {
                    label: (context) => {
                        const val = context.raw;
                        const unit = context.dataset.unit || '';
                        return analyticsService.formatValue(val, {
                            exact: config.exact !== undefined ? config.exact : true,
                            decimals: 2,
                            unit
                        });
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: chartColors.grid,
                    borderColor: chartColors.tooltipBorder
                },
                ticks: {
                    color: chartColors.ticks,
                    font: { size: 10, family: 'Inter' }
                }
            },
            y: {
                grid: {
                    color: chartColors.grid,
                    borderColor: chartColors.tooltipBorder
                },
                ticks: {
                    color: chartColors.ticks,
                    font: { size: 10, family: 'Inter' },
                    callback: (value) => analyticsService.formatValue(value, {
                        exact: false, // Use abbreviated for Y-axis generally
                        decimals: 0
                    })
                }
            }
        },
        onClick: (event, elements) => {
            if (elements.length > 0 && aggregation && onDataClick) {
                const index = elements[0].index;
                const label = data.labels[index];
                const dbIds = aggregation[label].dbIds || aggregation[label];

                // Get the color of the clicked bar
                const color = config.applyColorsToModel ? data.datasets[0].backgroundColor[index] : null;

                console.log(`[BarChart] Clicked "${label}", mapping to ${dbIds?.length || 0} elements. Color: ${color}`);
                onDataClick(dbIds, color);
            }
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <Bar ref={chartRef} data={data} options={options} />
            </div>
        </motion.div>
    );
};

export default BarChart;
