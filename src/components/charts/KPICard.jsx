import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import analyticsService from '../../services/analyticsService';

const KPICard = ({ config = {}, masterData }) => {
    const {
        title = 'KPI Metric',
        unit = '',
        trend = 0,
        icon = '📊',
        color = '#1db954',
        attribute,
        aggregationType = 'count',
        filters = [],
        logicalOperator = 'AND',
        fontSize = '4xl' // xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl
    } = config;

    const [displayValue, setDisplayValue] = useState(config.value || '0');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (masterData && (attribute || aggregationType === 'count')) {
            calculateMetric();
        }
    }, [masterData, attribute, aggregationType, JSON.stringify(filters), logicalOperator]);

    const calculateMetric = () => {
        setLoading(true);
        try {
            const val = analyticsService.calculateKPI(masterData, attribute, aggregationType, filters, logicalOperator);

            // Format number if large
            let formattedVal = val;
            if (typeof val === 'number') {
                if (val >= 1000000) {
                    formattedVal = (val / 1000000).toFixed(1) + 'M';
                } else if (val >= 1000) {
                    formattedVal = (val / 1000).toFixed(1) + 'K';
                } else {
                    formattedVal = Math.round(val * 100) / 100;
                }
            }

            setDisplayValue(String(formattedVal));
        } catch (err) {
            console.error('[KPICard] Calculation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const trendIcon = trend > 0 ? '↗' : trend < 0 ? '↘' : '→';
    const trendColor = trend > 0 ? '#1db954' : trend < 0 ? '#f44336' : '#b3b3b3';

    // Map tailwind-like sizes to actual CSS sizes
    const fontSizeMap = {
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        'lg': '18px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
        '5xl': '48px',
        '6xl': '60px'
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: 'var(--color-bg-elevated)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-lg)',
                position: 'relative',
                overflow: 'hidden',
                border: loading ? '1px solid var(--color-primary)' : '1px solid transparent'
            }}
        >
            {/* Background icon */}
            <div style={{
                position: 'absolute',
                top: -10,
                right: -10,
                fontSize: '80px',
                opacity: 0.05
            }}>
                {icon}
            </div>

            <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-subdued)',
                    marginBottom: 'var(--spacing-sm)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontWeight: 'var(--font-weight-semibold)'
                }}>
                    {title}
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 'var(--spacing-xs)',
                    flex: 1,
                    justifyContent: 'center',
                    flexDirection: 'column'
                }}>
                    <div
                        style={{
                            fontSize: fontSizeMap[fontSize] || fontSizeMap['4xl'],
                            fontWeight: 'var(--font-weight-black)',
                            color: color,
                            lineHeight: 1,
                            transition: 'font-size 0.3s ease'
                        }}
                    >
                        {loading ? '...' : displayValue}
                    </div>
                    {unit && !loading && (
                        <div style={{
                            fontSize: 'var(--font-size-lg)',
                            color: 'var(--color-text-subdued)',
                            fontWeight: 'var(--font-weight-medium)',
                            marginTop: '4px'
                        }}>
                            {unit}
                        </div>
                    )}
                </div>

                {trend !== 0 && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-xs)',
                            fontSize: 'var(--font-size-sm)',
                            color: trendColor,
                            fontWeight: 'var(--font-weight-semibold)',
                            marginTop: 'auto',
                            paddingTop: '8px'
                        }}
                    >
                        <span>{trendIcon}</span>
                        <span>{Math.abs(trend)}% vs last period</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default KPICard;
