import { motion } from 'framer-motion';

const KPICard = ({ config = {} }) => {
    const {
        title = 'KPI Metric',
        value = '0',
        unit = '',
        trend = 0,
        icon = '📊',
        color = '#1db954'
    } = config;

    const trendIcon = trend > 0 ? '↗' : trend < 0 ? '↘' : '→';
    const trendColor = trend > 0 ? '#1db954' : trend < 0 ? '#f44336' : '#b3b3b3';

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
                overflow: 'hidden'
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

            <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-subdued)',
                    marginBottom: 'var(--spacing-md)',
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
                    marginBottom: 'var(--spacing-sm)'
                }}>
                    <div
                        style={{
                            fontSize: 'var(--font-size-4xl)',
                            fontWeight: 'var(--font-weight-black)',
                            color: color,
                            lineHeight: 1
                        }}
                    >
                        {value}
                    </div>
                    {unit && (
                        <div style={{
                            fontSize: 'var(--font-size-lg)',
                            color: 'var(--color-text-subdued)',
                            fontWeight: 'var(--font-weight-medium)'
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
                            fontWeight: 'var(--font-weight-semibold)'
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
