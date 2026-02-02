import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import analyticsService from '../../services/analyticsService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const LineChart = ({ config = {}, viewer, onDataClick, scopedDbIds, joinedData, masterData, timelineDate, globalSync }) => {
    const { theme } = useTheme();
    const { title = 'Line Chart', data: customData, attribute, filters, logicalOperator } = config;
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Define theme-aware colors for Chart.js
    const chartColors = {
        grid: theme === 'light' ? '#e2e8f0' : '#282828',
        ticks: theme === 'light' ? '#475569' : '#b3b3b3',
        tooltipBg: theme === 'light' ? '#ffffff' : '#181818',
        tooltipText: theme === 'light' ? '#0f172a' : '#ffffff',
        tooltipBorder: theme === 'light' ? '#cbd5e1' : '#282828'
    };

    useEffect(() => {
        if ((viewer && attribute) || (masterData && attribute)) {
            loadChartData();
        }
    }, [viewer, attribute, JSON.stringify(filters), logicalOperator, masterData, joinedData, scopedDbIds, timelineDate, globalSync, config.timelineDateAttribute]);

    const loadChartData = async () => {
        setLoading(true);
        try {
            let result;
            if (masterData && masterData.length > 0) {
                console.log('[LineChart] Using Master Data');
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

                const agg = analyticsService.aggregateFromMasterData(targetData, attribute, filters, logicalOperator, null, scopedDbIds);
                result = analyticsService.getChartData(agg.data);
            } else {
                console.log('[LineChart] Using Viewer Query Fallback');
                const agg = await analyticsService.aggregateByProperty(viewer, attribute, filters, logicalOperator, null, scopedDbIds, joinedData);
                result = analyticsService.getChartData(agg.data);
            }

            setChartData({
                labels: result.labels,
                datasets: [
                    {
                        label: attribute || 'Value',
                        data: result.data,
                        borderColor: 'rgba(99, 102, 241, 1)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        dbIds: result.dbIds
                    }
                ]
            });
        } catch (err) {
            console.error('[LineChart] Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const data = chartData || customData || {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'Sample Data',
            data: [10, 20, 15, 25, 22, 30],
            borderColor: 'rgba(99, 102, 241, 1)',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
            if (elements.length > 0 && onDataClick) {
                const index = elements[0].index;
                const dbIds = data.datasets[0].dbIds?.[index];
                if (dbIds) onDataClick(dbIds);
            }
        },
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: chartColors.ticks,
                    padding: 15,
                    font: {
                        size: 12
                    },
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: chartColors.tooltipBg,
                padding: 12,
                titleColor: chartColors.tooltipText,
                bodyColor: chartColors.tooltipText,
                borderColor: chartColors.tooltipBorder,
                borderWidth: 1
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
                    font: {
                        size: 11
                    }
                }
            },
            y: {
                grid: {
                    color: chartColors.grid,
                    borderColor: chartColors.tooltipBorder
                },
                ticks: {
                    color: chartColors.ticks,
                    font: {
                        size: 11
                    },
                    callback: function (value) {
                        return value + '%';
                    }
                }
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="card"
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
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-base)' }}>
                    {title}
                </h3>
                {loading && <div className="spinner-sm"></div>}
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <Line data={data} options={options} />
            </div>
        </motion.div>
    );
};

export default LineChart;
