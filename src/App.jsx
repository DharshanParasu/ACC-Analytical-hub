import { useState, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import OverviewPage from './components/overview/OverviewPage';
import DashboardBuilder from './components/dashboard/DashboardBuilder';
import DashboardView from './components/dashboard/DashboardView';
import apsService from './services/apsService';

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

  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <Router>
          <div style={{
            display: 'flex',
            minHeight: '100vh',
            background: 'var(--color-bg-base)',
            color: 'var(--color-text-base)',
            transition: 'background-color 0.2s, color 0.2s'
          }}>
            <Sidebar
              user={user}
              isCollapsed={sidebarCollapsed}
              toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              marginLeft: sidebarWidth,
              transition: 'margin-left 0.3s ease'
            }}>
              <Header user={user} onLogin={() => apsService.login()} />

              <main style={{
                flex: 1,
                padding: 'var(--spacing-xl)',
                overflow: 'auto',
                background: 'var(--color-bg-base)'
              }}>
                {!isAuthenticated ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center',
                    maxWidth: '600px',
                    margin: '0 auto'
                  }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🔐</div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '800' }}>
                      Analytical Hub
                    </h1>
                    <p style={{
                      color: 'var(--color-text-subdued)',
                      marginBottom: '2.5rem',
                      fontSize: '1.1rem',
                      lineHeight: '1.6'
                    }}>
                      Connect your Autodesk projects to visualize data-driven insights.
                      Login to browse your ACC files or paste a token directly.
                    </p>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--spacing-lg)',
                      width: '100%',
                      background: 'var(--color-bg-elevated)',
                      padding: 'var(--spacing-xl)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)'
                    }}>
                      {/* Option 1: Standard Login */}
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-subdued)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recommended</div>
                        <button
                          onClick={() => apsService.login()}
                          className="btn btn-primary"
                          style={{ padding: '14px 32px', fontSize: '1rem', width: '100%', fontWeight: '600' }}
                        >
                          Login with Autodesk
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }}></div>
                        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-subdued)' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }}></div>
                      </div>

                      {/* Option 2: Direct Token */}
                      <form onSubmit={handleDirectTokenSubmit} style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-subdued)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Developer / Direct Access</div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                          <input
                            type="password"
                            placeholder="Paste Access Token here..."
                            value={directToken}
                            onChange={(e) => setDirectToken(e.target.value)}
                            style={{
                              flex: 1,
                              background: 'var(--color-bg-base)',
                              border: '1px solid var(--color-border)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              color: 'var(--color-text-base)',
                              outline: 'none',
                              fontSize: '0.9rem'
                            }}
                          />
                          <button
                            type="submit"
                            className="btn"
                            style={{ background: 'var(--color-bg-highlight)', color: 'white', padding: '0 20px' }}
                          >
                            Go
                          </button>
                        </div>
                        <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-subdued)' }}>
                          Note: Direct tokens are for testing and usually expire in 60 minutes.
                        </p>
                      </form>
                    </div>
                  </div>
                ) : (
                  <Routes>
                    <Route path="/" element={<Navigate to="/overview" replace />} />
                    <Route path="/overview" element={<OverviewPage />} />
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
