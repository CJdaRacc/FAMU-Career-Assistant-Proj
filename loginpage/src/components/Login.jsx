import { useState } from 'react';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Request failed');
      }
      setMessage({ type: 'success', text: data?.message || `${mode} successful` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '40px auto', padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2 style={{ textAlign: 'center' }}>{mode === 'login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: '#555' }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 6 }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#555' }}>Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 6 }}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff' }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </div>
      </form>
      <div style={{ marginTop: 12, fontSize: 14 }}>
        {mode === 'login' ? (
          <span>
            Dont have an account?{' '}
            <button onClick={() => setMode('register')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>
              Register
            </button>
          </span>
        ) : (
          <span>
            Already have an account?{' '}
            <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>
              Login
            </button>
          </span>
        )}
      </div>
      {message && (
        <div style={{ marginTop: 12, color: message.type === 'error' ? '#b91c1c' : '#065f46' }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
