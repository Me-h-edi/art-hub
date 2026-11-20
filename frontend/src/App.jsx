import { useState, useEffect } from 'react'
import './App.css'

const API = 'http://127.0.0.1:8000/api'

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('arthub_user')
    return saved ? JSON.parse(saved) : null
  })
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', role: 'buyer' })
  const [message, setMessage] = useState('')
  const [artworks, setArtworks] = useState([])

  function loadArtworks() {
    fetch(`${API}/artworks/`)
      .then((res) => res.json())
      .then((data) => setArtworks(Array.isArray(data) ? data : []))
      .catch(() => setMessage('Cannot reach the server. Is Django running?'))
  }

  useEffect(() => {
    loadArtworks()
  }, [])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    const url = mode === 'login' ? `${API}/auth/login/` : `${API}/auth/register/`
    const body =
      mode === 'login'
        ? { username: form.username, password: form.password }
        : form
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || JSON.stringify(data))
        return
      }
      localStorage.setItem('arthub_user', JSON.stringify(data))
      setUser(data)
      setForm({ username: '', password: '', role: 'buyer' })
    } catch {
      setMessage('Cannot reach the server. Is Django running?')
    }
  }

  function logout() {
    localStorage.removeItem('arthub_user')
    setUser(null)
  }

  return (
    <div className="page">
      <header className="top">
        <h1>Art-Hub</h1>
        {user && (
          <div className="who">
            <span>
              {user.username} ({user.role})
            </span>
            <button onClick={logout}>Logout</button>
          </div>
        )}
      </header>

      {!user && (
        <form className="card" onSubmit={handleSubmit}>
          <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
          <input name="username" placeholder="Username" value={form.username} onChange={handleChange} required />
          <input name="password" type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={handleChange} required />
          {mode === 'register' && (
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="buyer">I want to buy art</option>
              <option value="artist">I am an artist</option>
            </select>
          )}
          <button type="submit">{mode === 'login' ? 'Login' : 'Create account'}</button>
          <p className="switch" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'No account? Register' : 'Have an account? Login'}
          </p>
          {message && <p className="error">{message}</p>}
        </form>
      )}

      <h2>Artworks</h2>
      {artworks.length === 0 && <p>No artwork yet.</p>}
      <div className="grid">
        {artworks.map((a) => (
          <div className="art" key={a.id}>
            {a.image && <img src={a.image} alt={a.title} />}
            <h3>{a.title}</h3>
            <p>by {a.artist_name}</p>
            {a.category && <small>{a.category}</small>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App