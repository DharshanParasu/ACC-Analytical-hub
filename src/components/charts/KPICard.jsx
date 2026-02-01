import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import analyticsService from '../../services/analyticsService';

const KPICard = ({ config = {}, masterData, timelineDate, globalSync, scopedDbIds }) => {
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
    const [displayUnit, setDisplayUnit] = useState(config.unit || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (masterData && (attribute || aggregationType === 'count')) {
            calculateMetric();
        }
    }, [masterData, attribute, aggregationType, JSON.stringify(filters), logicalOperator, timelineDate, globalSync, config.timelineDateAttribute, JSON.stringify(scopedDbIds)]);

    const calculateMetric = () => {
        setLoading(true);
        try {
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

            const { value, unit: detectedUnit } = analyticsService.calculateKPI(targetData, attribute, aggregationType, filters, logicalOperator);

            // Use exact mode by default (2 decimal rounding) as per user request
            const isExact = config.exact !== undefined ? config.exact : true;

            // Format number ONLY using centralized helper
            const formattedVal = analyticsService.formatValue(value, {
                exact: isExact,
                decimals: 2,
                unit: '' // Handle unit separately in JSX
            });

            setDisplayValue(formattedVal);
            // Save detected unit if we don't have a manual one
            if (detectedUnit && !config.unit) {
                // We can't easily update config, but we can store it in state if needed.
                // However, let's just use it in the JSX.
                setDisplayUnit(detectedUnit);
            } else {
                setDisplayUnit(config.unit || ''); // Use config.unit if provided, otherwise empty
            }
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
                    {displayUnit && !loading && (
                        <div style={{
                            fontSize: 'var(--font-size-lg)',
                            color: 'var(--color-text-subdued)',
                            fontWeight: 'var(--font-weight-medium)',
                            marginTop: '4px'
                        }}>
                            {displayUnit}
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
