import { useState, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import OverviewPage from './components/overview/OverviewPage';
import ProjectsPage from './components/projects/ProjectsPage';
import DashboardBuilder from './components/dashboard/DashboardBuilder';
import DashboardView from './components/dashboard/DashboardView';
import apsService from './services/apsService';
import { Zap, LogIn, AlertCircle } from 'lucide-react';

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: 'red', background: 'white', height: '100vh', overflow: 'auto' }}>
          <h1>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button onClick={() => window.location.href = '/'} style={{ marginTop: '20px', padding: '10px' }}>
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? '64px' : '240px';
  const [directToken, setDirectToken] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      // Handle the OAuth callback if present
      const searchParams = new URLSearchParams(window.location.search);

      // Option 1: Handle Redirect Code
      if (searchParams.has('code')) {
        const success = await apsService.handleCallback();
        if (success) {
          setIsAuthenticated(true);
          const profile = await apsService.getUserProfile();
          setUser(profile);
        }
      }
      // Option 2: Handle Direct Token in URL (e.g. ?token=...)
      else if (searchParams.has('token')) {
        const success = await apsService.setDirectToken(searchParams.get('token'));
        if (success) {
          setIsAuthenticated(true);
          const profile = await apsService.getUserProfile();
          setUser(profile);
          // Clear token from URL for security
          window.history.replaceState(null, null, '/');
        }
      }
      else {
        // Check if we already have a valid session
        const token = await apsService.getAccessToken();
        if (token) {
          setIsAuthenticated(true);
          const profile = await apsService.getUserProfile();
          setUser(profile);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const handleDirectTokenSubmit = async (e) => {
    e.preventDefault();
    if (!directToken) return;

    setIsLoading(true);
    const success = await apsService.setDirectToken(directToken);
    if (success) {
      setIsAuthenticated(true);
      const profile = await apsService.getUserProfile();
      setUser(profile);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // Eva icons removed
  }, [isAuthenticated, user]);

  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <Router>
          <div className="flex min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-base)] transition-colors duration-200">
            <Sidebar
              user={user}
              isCollapsed={sidebarCollapsed}
              toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
              <Header user={user} onLogin={() => apsService.login()} />

              <main className="flex-1 p-8 overflow-auto bg-[var(--color-bg-base)] relative">
                {!isAuthenticated ? (
                  <div className="flex flex-col items-center justify-center min-h-[80vh] text-center max-w-2xl mx-auto animate-fade-in relative z-10">

                    {/* Hero Icon */}
                    <div className="w-24 h-24 mb-8 rounded-3xl bg-gradient-to-br from-lime-400 to-cyan-400 flex items-center justify-center shadow-[0_0_40px_rgba(204,246,85,0.3)] animate-scale-in">
                      <span className="text-4xl text-black/80 flex items-center justify-center w-full h-full">
                        <span>
                          <Zap className="w-12 h-12" />
                        </span>
                      </span>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tighter">
                      Analytical <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-300 to-cyan-300">Hub</span>
                    </h1>

                    <p className="text-gray-400 mb-10 text-lg max-w-lg leading-relaxed">
                      Visualize data-driven insights from your Autodesk projects.
                      <span className="block mt-2 text-sm font-mono text-lime-400/80">Connect. Analyze. Optimize.</span>
                    </p>

                    <div className="w-full glass-panel p-8 border border-white/10 relative overflow-hidden group">
                      {/* Glow Effect */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-lime-400/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-lime-400/20 transition-all duration-700"></div>

                      {/* Option 1: Standard Login */}
                      <div className="mb-8 relative z-10">
                        <div className="text-xs font-mono text-gray-500 mb-3 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span> Recommended
                        </div>
                        <button
                          onClick={() => apsService.login()}
                          className="btn btn-primary w-full py-4 text-lg shadow-[0_0_20px_rgba(204,246,85,0.2)] hover:shadow-[0_0_35px_rgba(204,246,85,0.5)] flex items-center justify-center gap-3"
                        >
                          <span>
                            <LogIn className="w-5 h-5 text-black" />
                          </span>
                          Login with Autodesk
                        </button>
                      </div>

                      <div className="flex items-center gap-4 my-6 opacity-30">
                        <div className="h-px bg-white flex-1"></div>
                        <span className="text-xs font-mono uppercase">Or via Token</span>
                        <div className="h-px bg-white flex-1"></div>
                      </div>

                      {/* Option 2: Direct Token */}
                      <form onSubmit={handleDirectTokenSubmit} className="text-left relative z-10">
                        <div className="flex gap-3">
                          <input
                            type="password"
                            placeholder="Paste Access Token..."
                            value={directToken}
                            onChange={(e) => setDirectToken(e.target.value)}
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:bg-black/60 transition-all"
                          />
                          <button
                            type="submit"
                            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium transition-all hover:scale-105 active:scale-95"
                          >
                            Go
                          </button>
                        </div>
                        <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                          <span>
                            <AlertCircle className="w-3 h-3" />
                          </span>
                          Direct tokens expire in 60 minutes
                        </p>
                      </form>
                    </div>
                  </div>
                ) : (
                  <Routes>
                    <Route path="/" element={<Navigate to="/projects" replace />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/project/:projectId" element={<OverviewPage />} />
                    <Route path="/project/:projectId/dashboard/new" element={<DashboardBuilder />} />
                    <Route path="/project/:projectId/dashboard/edit/:id" element={<DashboardBuilder />} />
                    <Route path="/project/:projectId/dashboard/view/:id" element={<DashboardView />} />

                    {/* Legacy Routes */}
                    <Route path="/overview" element={<Navigate to="/projects" replace />} />
                    <Route path="/dashboard/new" element={<DashboardBuilder />} />
                    <Route path="/dashboard/edit/:id" element={<DashboardBuilder />} />
                    <Route path="/dashboard/view/:id" element={<DashboardView />} />
                  </Routes>
                )}
              </main>
            </div>
          </div>
        </Router>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
