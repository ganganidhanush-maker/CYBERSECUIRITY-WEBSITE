import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    // Prevent unhandled rejection from killing the page
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070d18', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ maxWidth: '520px', width: '100%', padding: '32px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', textAlign: 'center', color: '#f8fafc', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <span style={{ fontSize: '44px', display: 'block', marginBottom: '14px' }}>🛡️</span>
            <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 700, color: '#52bbf5' }}>Portal View Recovered</h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
              A temporary display exception occurred while loading this view.
            </p>
            {this.state.error?.message && (
              <div style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '12px', fontSize: '11px', color: '#ef4444', textAlign: 'left', overflow: 'auto', maxHeight: '120px', marginBottom: '20px', fontFamily: 'monospace' }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
                style={{ background: '#52bbf5', color: '#07121c', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                ↻ Reload Application
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.href = '/'
                }}
                style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', cursor: 'pointer' }}
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
