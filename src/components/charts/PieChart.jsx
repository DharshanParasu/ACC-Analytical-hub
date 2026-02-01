import { useState, useEffect, useRef } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { motion } from 'framer-motion';
import analyticsService from '../../services/analyticsService';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

const PieChart = ({ config = {}, viewer, onDataClick, onThematicColorChange, scopedDbIds, joinedData, masterData, timelineDate, globalSync }) => {
    const { theme } = useTheme();
    const chartRef = useRef();
    const { title = 'Pie Chart', data: customData, attribute, filters, logicalOperator } = config;

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
                // FAST PATH: Synchronous Aggregation from Master Data
                console.log('[PieChart] Using Master Data for aggregation');
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
                // SLOW PATH: Async Query against Viewer
                console.log('[PieChart] Using Viewer Query (Legacy) for aggregation');
                res = await analyticsService.aggregateByProperty(viewer, attribute, filters, logicalOperator, sumAttr, scopedDbIds, joinedData);
            }

            const agg = res.data;
            const detectedUnit = res.unit;

            setAggregation(agg);
            const data = analyticsService.getChartData(agg, attribute, 'Total', 'pie', aggType);

            // Add unit metadata
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
        labels: ['Concrete', 'Steel', 'Glass', 'Wood', 'Other'],
        datasets: [{
            label: 'Materials',
            data: [35, 25, 15, 15, 10],
            backgroundColor: ['#1db954', '#2e77d0', '#8b5cf6', '#ec4899', '#f59e0b'],
            borderWidth: 0
        }]
    };


    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: chartColors.ticks,
                    padding: 16,
                    font: { size: 11, family: 'Inter' },
                    boxWidth: 8,
                    boxHeight: 8
                }
            },
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
                        return `${context.label}: ${analyticsService.formatValue(val, {
                            exact: config.exact !== undefined ? config.exact : true,
                            decimals: 2,
                            unit
                        })}`;
                    }
                }
            }
        },
        onClick: (event, elements) => {
            if (elements.length > 0 && aggregation && onDataClick) {
                const index = elements[0].index;
                const label = data.labels[index];
                const dbIds = aggregation[label].dbIds || aggregation[label];

                // Get the color of the clicked slice
                const color = config.applyColorsToModel ? data.datasets[0].backgroundColor[index] : null;

                console.log(`[PieChart] Clicked "${label}", mapping to ${dbIds?.length || 0} elements. Color: ${color}`);
                onDataClick(dbIds, color);
            }
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
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
                <Pie ref={chartRef} data={data} options={options} />
            </div>
        </motion.div>
    );
};

export default PieChart;
