import { demoUsers } from '../demoData'
import { StatusPill } from './AppViews'

export function AuthScreen({
  busy,
  error,
  loginEmail,
  loginPassword,
  message,
  mode,
  onDemoLogin,
  onLogin,
  onLoginEmailChange,
  onLoginPasswordChange,
}) {
  return (
    <div className="app-shell auth-screen">
      <div className="auth-card">
        <div className="brand-block">
          <div className="brand-icon">RB</div>
          <div>
            <h1>RBSHIFT</h1>
          </div>
        </div>

        <form className="auth-form" onSubmit={onLogin}>
          <label>
            E-mail
            <input value={loginEmail} onChange={(event) => onLoginEmailChange(event.target.value)} placeholder="např. dispecink@firma.cz" />
          </label>
          <label>
            Heslo
            <input type="password" value={loginPassword} onChange={(event) => onLoginPasswordChange(event.target.value)} placeholder={mode === 'demo' ? 'V demo režimu není potřeba' : 'Heslo'} />
          </label>
          <button className="primary-button" disabled={busy}>{busy ? 'Přihlašuji…' : 'Přihlásit se'}</button>
        </form>

        {mode === 'demo' && (
          <div className="demo-grid">
            {demoUsers.map((user) => (
              <button
                key={user.profileId}
                className="demo-user"
                type="button"
                onClick={() => onDemoLogin(user.profileId, user.email)}
              >
                <strong>{user.label}</strong>
                <span>{user.email}</span>
              </button>
            ))}
          </div>
        )}

        <div className="notice-row">
          <StatusPill tone={mode === 'demo' ? 'warning' : 'success'}>{mode === 'demo' ? 'Demo režim bez Supabase' : 'Supabase připojeno'}</StatusPill>
        </div>

        {error && <div className="banner error">{error}</div>}
        {message && <div className="banner success">{message}</div>}
      </div>
    </div>
  )
}
