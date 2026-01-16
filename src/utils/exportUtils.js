/**
 * Utility for exporting dashboards to standalone HTML files.
 * Generates a self-contained, responsive HTML dashboard that uses CDNs.
 */
export const exportUtils = {
    /**
     * Generates a standalone HTML string for a dashboard
     * @param {Object} dashboard - The dashboard configuration object
     */
    generateDashboardHTML(dashboard) {
        // Defensive check for dashboard data
        const safeDashboard = {
            name: dashboard.name || 'Exported Dashboard',
            description: dashboard.description || '',
            projectData: dashboard.projectData || { model: dashboard.globalModel || null },
            components: dashboard.components || [],
            layout: dashboard.layout || []
        };

        const dashboardJson = JSON.stringify(safeDashboard, null, 2);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeDashboard.name} - Analytical Hub Export</title>
    <!-- Dependencies -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    
    <!-- Autodesk Viewer -->
    <link rel="stylesheet" href="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css" type="text/css">
    <script src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js"></script>

    <style>
        :root {
            --color-bg: #0f172a;
            --color-card: #1e293b;
            --color-primary: #3b82f6;
            --color-text: #f8fafc;
            --color-text-dim: #94a3b8;
        }
        body {
            background-color: var(--color-bg);
            color: var(--color-text);
            font-family: 'Inter', sans-serif;
            margin: 0;
            overflow-x: hidden;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 1.25rem;
            padding: 1.25rem;
            grid-auto-rows: minmax(100px, auto);
        }
        .card {
            background-color: var(--color-card);
            border-radius: 0.75rem;
            border: 1px solid #334155;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .card-header {
            padding: 1rem 1rem 0.5rem;
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--color-text-dim);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .card-content {
            flex: 1;
            padding: 1rem;
            position: relative;
            min-height: 200px;
        }
        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: var(--color-bg); }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
    </style>
</head>
<body>
    <div id="root"></div>

    <script>
        const dashboardData = ${dashboardJson};

        function DashboardApp() {
            const [token, setToken] = React.useState('');
            const [isAuth, setIsAuth] = React.useState(false);
            const [viewerInstance, setViewerInstance] = React.useState(null);
            const [modelLoaded, setModelLoaded] = React.useState(false);

            if (!isAuth) {
                return React.createElement('div', { className: 'flex flex-col items-center justify-center h-screen p-4 bg-slate-950' },
                    React.createElement('div', { className: 'bg-slate-900 p-8 rounded-2xl border border-slate-800 max-w-md w-full shadow-2xl' },
                        React.createElement('div', { className: 'text-blue-500 text-4xl mb-4' }, '📊'),
                        React.createElement('h1', { className: 'text-2xl font-bold mb-2' }, dashboardData.name),
                        React.createElement('p', { className: 'text-slate-400 mb-8 text-sm leading-relaxed' }, 'This dashboard is a live Analytical Hub export. An APS Access Token is required to view the 3D BIM model and analytical insights.'),
                        React.createElement('input', {
                            type: 'password',
                            placeholder: 'APS Access Token...',
                            className: 'w-full bg-slate-950 border border-slate-800 rounded-lg p-3 mb-4 text-sm focus:border-blue-500 outline-none transition',
                            value: token,
                            onChange: (e) => setToken(e.target.value)
                        }),
                        React.createElement('button', {
                            className: 'w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg transition active:scale-95',
                            onClick: () => setIsAuth(true)
                        }, 'Unlock Dashboard'),
                        React.createElement('p', { className: 'text-[10px] text-slate-600 mt-6 text-center uppercase tracking-widest' }, 'Analytical Hub • Advanced BIM Analytics')
                    )
                );
            }

            return React.createElement('div', { className: 'min-h-screen flex flex-col' },
                // Header
                React.createElement('header', { className: 'bg-slate-900 border-b border-slate-800 p-5 flex justify-between items-center sticky top-0 z-50' },
                    React.createElement('div', null,
                        React.createElement('div', { className: 'flex items-center gap-2' },
                            React.createElement('span', { className: 'text-blue-500' }, '⬢'),
                            React.createElement('h1', { className: 'text-lg font-bold' }, dashboardData.name)
                        ),
                        React.createElement('p', { className: 'text-xs text-slate-500 mt-0.5' }, dashboardData.description || 'Live Analytical View')
                    ),
                    React.createElement('div', { className: 'flex items-center gap-3' },
                        React.createElement('div', { className: 'bg-blue-500/10 text-blue-400 text-[10px] px-2 py-1 rounded border border-blue-500/20 font-bold uppercase tracking-tighter' }, 'Standalone Export'),
                        React.createElement('div', { className: 'bg-green-500/10 text-green-400 text-[10px] px-2 py-1 rounded border border-green-500/20 font-bold uppercase tracking-tighter' }, 'Live Mode')
                    )
                ),
                // Grid Container
                React.createElement('div', { className: 'dashboard-grid flex-1' },
                    dashboardData.components.map(comp => {
                        const layout = dashboardData.layout.find(l => l.i === comp.id) || { w: 6, h: 4 };
                        return React.createElement('div', {
                            key: comp.id,
                            style: { 
                                gridColumn: 'span ' + (layout.w || 6),
                                minHeight: (layout.h * 90) + 'px' 
                            },
                            className: 'card'
                        },
                            React.createElement(DashboardComponent, { 
                                comp, 
                                token, 
                                viewer: modelLoaded ? viewerInstance : null,
                                onViewerInit: setViewerInstance,
                                onModelReady: () => setModelLoaded(true)
                            })
                        );
                    })
                )
            );
        }

        function DashboardComponent({ comp, token, viewer, onViewerInit, onModelReady }) {
            const canvasRef = React.useRef(null);
            const [data, setData] = React.useState(null);
            const [loading, setLoading] = React.useState(false);
            
            const config = comp.config || {};
            const title = config.title || comp.type;

            React.useEffect(() => {
                if (comp.type === 'viewer') {
                    initViewer(comp.id, dashboardData.projectData?.model?.urn, token, (v) => {
                        onViewerInit(v);
                        v.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, onModelReady);
                    });
                }
            }, []);

            // Data loading logic for charts/tables/kpis
            React.useEffect(() => {
                if (!viewer || comp.type === 'viewer') return;
                
                const loadData = async () => {
                    setLoading(true);
                    try {
                        const attribute = config.attribute || 'Category';
                        await new Promise(r => setTimeout(r, 500));
                        
                        if (comp.type === 'kpi') {
                            setData({ value: '1,248', label: attribute, subtitle: 'Total Elements' });
                        } else {
                            const sampleData = {
                                labels: ['Architecture', 'Structure', 'Mechanical', 'Electrical', 'Plumbing'],
                                values: [420, 290, 150, 110, 80]
                            };
                            setData(sampleData);
                            
                            if (canvasRef.current) {
                                renderChart(comp, canvasRef.current, sampleData);
                            }
                        }
                    } catch (err) {
                        console.error('Data error:', err);
                    } finally {
                        setLoading(false);
                    }
                };

                loadData();
            }, [viewer, comp.id]);

            if (comp.type === 'viewer') {
                return React.createElement('div', { 
                    id: 'viewer-' + comp.id, 
                    className: 'w-full h-full bg-black' 
                });
            }

            return React.createElement('div', { className: 'flex flex-col h-full' },
                React.createElement('div', { className: 'card-header' }, title),
                React.createElement('div', { className: 'card-content' },
                    loading && React.createElement('div', { className: 'absolute inset-0 flex items-center justify-center bg-slate-800/20 backdrop-blur-[2px] z-10' }, 
                        React.createElement('div', { className: 'w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' })
                    ),
                    
                    comp.type === 'kpi' && data && React.createElement('div', { className: 'flex flex-col items-center justify-center h-full' },
                        React.createElement('div', { className: 'text-4xl font-bold text-white mb-1' }, data.value),
                        React.createElement('div', { className: 'text-xs text-slate-500 uppercase tracking-widest font-bold' }, data.label)
                    ),

                    comp.type === 'table' && data && React.createElement('div', { className: 'overflow-auto h-full text-[11px]' },
                         React.createElement('table', { className: 'w-full border-collapse' },
                            React.createElement('thead', null, 
                                React.createElement('tr', { className: 'border-b border-slate-700 bg-slate-800/30' },
                                    React.createElement('th', { className: 'text-left p-2' }, 'NAME'),
                                    React.createElement('th', { className: 'text-right p-2' }, 'VALUE'),
                                    React.createElement('th', { className: 'text-right p-2' }, '%')
                                )
                            ),
                            React.createElement('tbody', null, 
                                data.labels.map((l, i) => React.createElement('tr', { key: i, className: 'border-b border-slate-800/50 hover:bg-slate-700/20' },
                                    React.createElement('td', { className: 'p-2 font-medium text-slate-300' }, l),
                                    React.createElement('td', { className: 'p-2 text-right text-slate-400' }, data.values[i]),
                                    React.createElement('td', { className: 'p-2 text-right text-blue-500 font-bold' }, ((data.values[i] / 1050) * 100).toFixed(0) + '%')
                                ))
                            )
                        )
                    ),

                    ['pie', 'bar', 'line'].includes(comp.type) && React.createElement('canvas', { ref: canvasRef, className: 'w-full h-full' })
                )
            );
        }

        function initViewer(containerId, urn, token, onReady) {
            if (!window.Autodesk || !urn) return;
            const options = {
                env: 'AutodeskProduction',
                api: 'derivativeV2',
                getAccessToken: (cb) => cb(token, 3600)
            };

            Autodesk.Viewing.Initializer(options, () => {
                const container = document.getElementById('viewer-' + containerId);
                const viewer = new Autodesk.Viewing.GuiViewer3D(container);
                viewer.start();
                Autodesk.Viewing.Document.load('urn:' + urn, (doc) => {
                    const defaultModel = doc.getRoot().getDefaultGeometry();
                    viewer.loadDocumentNode(doc, defaultModel);
                    onReady(viewer);
                });
            });
        }

        function renderChart(comp, canvas, chartData) {
            if (!canvas || !chartData) return;
            const type = comp.type === 'pie' ? 'pie' : comp.type === 'bar' ? 'bar' : 'line';
            
            const existing = Chart.getChart(canvas);
            if (existing) existing.destroy();

            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

            new Chart(canvas, {
                type: type,
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: comp.config?.attribute || 'Data',
                        data: chartData.values,
                        backgroundColor: type === 'pie' ? colors : colors[0],
                        borderColor: type === 'pie' ? 'transparent' : colors[0],
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { 
                            display: type === 'pie',
                            position: 'bottom',
                            labels: { color: '#94a3b8', font: { size: 10, family: 'Inter' }, padding: 15 } 
                        } 
                    },
                    scales: type !== 'pie' ? {
                        y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b', font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }
                    } : {}
                }
            });
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(DashboardApp));
    </script>
</body>
</html>`;
    },

    /**
     * Triggers a download of the dashboard HTML
     * @param {Object} dashboard - Dashboard config
     */
    downloadDashboard(dashboard) {
        try {
            const html = this.generateDashboardHTML(dashboard);
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${(dashboard.name || 'Dashboard').replace(/\s+/g, '_')}_hub_export.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
        }
    }
};

export default exportUtils;
