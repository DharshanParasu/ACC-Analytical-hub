import { useState, useEffect, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { motion } from 'framer-motion';
import analyticsService from '../../services/analyticsService';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BarChart = ({ config = {}, viewer, onDataClick, onThematicColorChange, scopedDbIds, joinedData }) => {
    const chartRef = useRef();
    const { title = 'Bar Chart', data: customData, orientation = 'vertical', attribute, filters, logicalOperator } = config;
    const [chartData, setChartData] = useState(null);
    const [aggregation, setAggregation] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (viewer && attribute) {
            loadModelData();
        }
    }, [viewer, attribute, JSON.stringify(filters), logicalOperator, config.aggregationType, config.sumAttribute, scopedDbIds, joinedData]);

    const loadModelData = async () => {
        setLoading(true);
        try {
            const aggType = config.aggregationType || 'count';
            const sumAttr = aggType === 'sum' ? (config.sumAttribute || null) : null;
            const agg = await analyticsService.aggregateByProperty(viewer, attribute, filters, logicalOperator, sumAttr, scopedDbIds, joinedData);
            setAggregation(agg);
            const data = analyticsService.getChartData(agg, attribute, 'Total', 'bar', aggType);
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
                backgroundColor: '#181818',
                padding: 12,
                titleColor: '#ffffff',
                bodyColor: '#b3b3b3',
                borderColor: '#282828',
                borderWidth: 1,
                cornerRadius: 8
            }
        },
        scales: {
            x: { grid: { color: '#1a1a1a', borderColor: '#282828' }, ticks: { color: '#b3b3b3', font: { size: 10, family: 'Inter' } } },
            y: { grid: { color: '#1a1a1a', borderColor: '#282828' }, ticks: { color: '#b3b3b3', font: { size: 10, family: 'Inter' } } }
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
