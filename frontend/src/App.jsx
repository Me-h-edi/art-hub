import { useEffect, useState } from 'react';
import './App.css';

const API = 'http://127.0.0.1:8000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '', role: 'artist' });
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Active Tab: 'gallery' | 'copy' | 'fraud' | 'arch'
  const [activeTab, setActiveTab] = useState('gallery');

  const [artworks, setArtworks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedArt, setSelectedArt] = useState(null);

  // Copy Detection, AI Classification & Upload State
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    category: 'General',
    image: null,
  });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [predictingCategory, setPredictingCategory] = useState(false);
  const [categoryPrediction, setCategoryPrediction] = useState(null);

  // Fraud Alert State
  const [fraudInput, setFraudInput] = useState({
    account_age_days: 120,
    orders_per_day: 0,
    avg_price_bdt: 1800,
    failed_payments: 0,
    same_address_orders: 0,
  });
  const [fraudResult, setFraudResult] = useState(null);
  const [toast, setToast] = useState('');

  const headers = token ? { Authorization: `Token ${token}` } : {};

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  const loadArtworks = async () => {
    try {
      const res = await fetch(`${API}/artworks/`, { headers });
      if (res.ok) setArtworks(await res.json());
    } catch {
      showToast('Backend server is offline. Run Django server first.');
    }
  };

  useEffect(() => {
    loadArtworks();
  }, [token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? 'login' : 'register';
    try {
      const res = await fetch(`${API}/auth/${endpoint}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ username: data.username, role: data.role }));
        setToken(data.token);
        setUser({ username: data.username, role: data.role });
        setShowAuthModal(false);
        showToast(`Welcome, ${data.username}! (${data.role})`);
      } else {
        const firstErr = Object.values(data).flat()[0];
        showToast(typeof firstErr === 'string' ? firstErr : data.error || 'Authentication failed');
      }
    } catch {
      showToast('Cannot connect to Django server at http://127.0.0.1:8000');
    }
  };

  const logout = () => {
    localStorage.clear();
    setToken('');
    setUser(null);
    showToast('Logged out successfully.');
  };

  const predictArtworkCategory = async (file, defaultTitle) => {
    setPredictingCategory(true);
    setCategoryPrediction(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${API}/artworks/predict-category/`, {
        method: 'POST',
        headers,
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setCategoryPrediction(data);
        setUploadForm((prev) => ({
          ...prev,
          image: file,
          title: prev.title || defaultTitle,
          category: data.category,
        }));
      } else {
        showToast(data.detail || 'AI prediction failed');
      }
    } catch {
      showToast('Backend server unreachable for AI prediction');
    } finally {
      setPredictingCategory(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const autoTitle = uploadForm.title || file.name.split('.')[0];
    setUploadForm({
      ...uploadForm,
      image: file,
      title: autoTitle,
    });
    setPreviewUrl(URL.createObjectURL(file));
    setUploadResult(null);
    predictArtworkCategory(file, autoTitle);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.image) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('title', uploadForm.title);
    fd.append('description', uploadForm.description);
    fd.append('category', uploadForm.category);
    fd.append('image', uploadForm.image);

    const res = await fetch(`${API}/artworks/`, {
      method: 'POST',
      headers,
      body: fd,
    });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      setUploadResult(data);
      loadArtworks();
    } else {
      showToast(data.detail || 'Upload failed. Ensure you are logged in as an Artist.');
    }
  };

  const triggerSearch = async (queryText) => {
    setSearchQuery(queryText);
    if (!queryText.trim()) {
      loadArtworks();
      return;
    }
    setSearching(true);
    const res = await fetch(`${API}/artworks/search/?q=${encodeURIComponent(queryText)}`, { headers });
    if (res.ok) setArtworks(await res.json());
    setSearching(false);
  };

  const loadSampleFraud = (type) => {
    setFraudResult(null);
    if (type === 'safe') {
      setFraudInput({ account_age_days: 120, orders_per_day: 0, avg_price_bdt: 1800, failed_payments: 0, same_address_orders: 0 });
    } else {
      setFraudInput({ account_age_days: 1, orders_per_day: 9, avg_price_bdt: 14000, failed_payments: 6, same_address_orders: 5 });
    }
  };

  const checkFraud = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/fraud/check/`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(fraudInput),
    });
    const data = await res.json();
    if (res.ok) setFraudResult(data);
    else showToast(data.error || 'Please login first to run Fraud Check.');
  };

  const flaggedCount = artworks.filter((a) => a.is_flagged).length;

  return (
    <div className="app-shell">
      <header className="navbar">
        <div className="nav-container">
          <div className="brand" onClick={() => setActiveTab('gallery')}>
            <div className="logo-icon">✦</div>
            <div>
              <span className="brand-title">Art-Hub</span>
              <span className="brand-sub">AI Marketplace</span>
            </div>
          </div>

          <nav className="tab-pills">
            <button
              className={`tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
              onClick={() => setActiveTab('gallery')}
            >
              🎨 Gallery & Search
            </button>
            <button
              className={`tab-btn ${activeTab === 'copy' ? 'active' : ''}`}
              onClick={() => setActiveTab('copy')}
            >
              🛡️ Studio & Screening
            </button>
            <button
              className={`tab-btn ${activeTab === 'fraud' ? 'active' : ''}`}
              onClick={() => setActiveTab('fraud')}
            >
              🚨 Fraud Guard
            </button>
            <button
              className={`tab-btn ${activeTab === 'arch' ? 'active' : ''}`}
              onClick={() => setActiveTab('arch')}
            >
              ⚙️ AI Pipeline
            </button>
          </nav>

          <div className="auth-area">
            {user ? (
              <div className="user-chip">
                <span className="avatar">{user.username[0].toUpperCase()}</span>
                <div className="user-meta">
                  <strong>{user.username}</strong>
                  <small>{user.role}</small>
                </div>
                <button className="btn-ghost" onClick={logout}>Logout</button>
              </div>
            ) : (
              <button className="btn-primary" onClick={() => setShowAuthModal(true)}>
                Login / Sign Up
              </button>
            )}
          </div>
        </div>
      </header>

      {toast && <div className="toast-banner">{toast}</div>}

      <section className="hero-strip">
        <div className="hero-inner">
          <div>
            <h1>Authentic Art Protected by Multi-Modal AI</h1>
            <p>Auto-classify artwork medium with EfficientNet-B0, discover art by natural language, verify originality via CLIP embeddings, and block fraudulent orders.</p>
          </div>
          <div className="stats-cards">
            <div className="stat-box">
              <span className="stat-num">{artworks.length}</span>
              <span className="stat-lbl">Indexed Artworks</span>
            </div>
            <div className="stat-box">
              <span className="stat-num">91.2%</span>
              <span className="stat-lbl">Classifier Accuracy</span>
            </div>
            <div className="stat-box">
              <span className="stat-num">{flaggedCount}</span>
              <span className="stat-lbl">Copies Flagged</span>
            </div>
          </div>
        </div>
      </section>

      <main className="content-area">
        {activeTab === 'gallery' && (
          <div className="fade-in">
            <div className="search-panel">
              <form
                className="search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  triggerSearch(searchQuery);
                }}
              >
                <span className="search-icon">🔍</span>
                <input
                  placeholder="Describe a scene, mood, or style (e.g., 'blue flowers in vase', 'stormy sea')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn-clear"
                    onClick={() => triggerSearch('')}
                  >
                    ✕
                  </button>
                )}
                <button type="submit" className="btn-primary">
                  {searching ? 'Thinking...' : 'AI Search'}
                </button>
              </form>

              <div className="quick-chips">
                <span>Try quick prompts:</span>
                {['blue flowers', 'stormy ocean boat', 'woman in black dress', 'men playing cards'].map((chip) => (
                  <button key={chip} type="button" className="chip-btn" onClick={() => triggerSearch(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="gallery-grid">
              {artworks.map((art) => (
                <div
                  className={`art-card ${art.is_flagged ? 'flagged' : ''}`}
                  key={art.id}
                  onClick={() => setSelectedArt(art)}
                >
                  <div className="img-wrap">
                    <img src={art.image} alt={art.title} />
                    {art.match_score !== undefined && (
                      <span className="float-badge match">
                        {(art.match_score * 100).toFixed(0)}% Match
                      </span>
                    )}
                    {art.is_flagged && (
                      <span className="float-badge warn">⚠️ Copy Flagged</span>
                    )}
                  </div>
                  <div className="art-body">
                    <h3>{art.title}</h3>
                    <p>by {art.artist_name} · {art.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'copy' && (
          <div className="fade-in">
            <div className="section-intro">
              <h2>AI Artwork Classification & Copy Screening Studio</h2>
              <p>Upload an artwork to automatically classify its medium using EfficientNet-B0 and verify originality via CLIP 512-D embeddings.</p>
            </div>

            <div className="two-col">
              <div className="panel-card">
                <form onSubmit={handleUpload}>
                  <div
                    className={`drop-area ${isDragging ? 'dragging' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      handleFileSelect(e.dataTransfer.files[0]);
                    }}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="preview-thumb" />
                    ) : (
                      <>
                        <div className="upload-emoji">🖼️</div>
                        <p className="drop-main">Drag & drop artwork image here</p>
                        <p className="drop-sub">Supports JPG, PNG • Auto-detects Category on Select</p>
                      </>
                    )}
                    <label className="btn-secondary file-picker">
                      {previewUrl ? 'Change Image' : 'Browse File'}
                      <input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
                    </label>
                  </div>

                  <div className="input-pair">
                    <input
                      placeholder="Artwork Title"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      required
                    />
                    <input
                      placeholder={predictingCategory ? 'AI Detecting Category...' : 'Category (Auto-detected)'}
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    />
                  </div>

                  <div className="card-footer">
                    <span className="hint-text">
                      {predictingCategory
                        ? '🤖 EfficientNet-B0 analyzing artwork style...'
                        : user?.role === 'artist'
                        ? `Ready as ${user.username}`
                        : '⚠️ Login as an Artist to scan & publish'}
                    </span>
                    <button type="submit" className="btn-primary" disabled={uploading || user?.role !== 'artist'}>
                      {uploading ? 'Scanning Vector Space...' : 'Scan & Upload'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="panel-card result-panel">
                <h3>AI Diagnostic & Screening</h3>

                {predictingCategory && (
                  <div className="placeholder-box">
                    🤖 Running EfficientNet-B0 inference to detect artwork medium...
                  </div>
                )}

                {categoryPrediction && !predictingCategory && (
                  <div className="result-view" style={{ marginBottom: '1.25rem' }}>
                    <div className="alert-pill safe">
                      ✨ AI DETECTED MEDIUM: {categoryPrediction.category.toUpperCase()} ({categoryPrediction.confidence}%)
                    </div>
                    <div className="reasons-card">
                      <strong>Class Probability Breakdown (EfficientNet-B0):</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {Object.entries(categoryPrediction.scores)
                          .sort((a, b) => b[1] - a[1])
                          .map(([label, score]) => (
                            <span
                              key={label}
                              className="chip-btn"
                              style={{
                                fontWeight: label.toLowerCase() === categoryPrediction.category.toLowerCase() ? '700' : '400',
                              }}
                            >
                              {label.charAt(0).toUpperCase() + label.slice(1)}: {score}%
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {!uploadResult && !categoryPrediction && !predictingCategory && (
                  <div className="placeholder-box">
                    Select an image on the left for instant <strong>AI Category Detection</strong>, then click <strong>Scan & Upload</strong> for originality verification.
                  </div>
                )}

                {uploadResult && (
                  <div className="result-view">
                    <div className={`alert-pill ${uploadResult.is_flagged ? 'danger' : 'safe'}`}>
                      {uploadResult.is_flagged ? '⚠️ DUPLICATE / COPY DETECTED' : '✅ VERIFIED ORIGINAL ARTWORK'}
                    </div>

                    <div className="meter-group">
                      <div className="meter-labels">
                        <span>Similarity Score</span>
                        <strong>
                          {uploadResult.similarity_score !== null
                            ? `${(uploadResult.similarity_score * 100).toFixed(1)}%`
                            : '0.0%'}
                        </strong>
                      </div>
                      <div className="meter-bar">
                        <div
                          className={`meter-fill ${uploadResult.is_flagged ? 'danger' : 'safe'}`}
                          style={{ width: `${Math.min(100, (uploadResult.similarity_score || 0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {uploadResult.similar_to_title && (
                      <p className="detail-text">
                        Closest match in database: <strong>"{uploadResult.similar_to_title}"</strong>
                      </p>
                    )}
                    <p className="sub-note">
                      {uploadResult.is_flagged
                        ? 'Flagged automatically because similarity exceeded 92%. Hidden from public marketplace.'
                        : `Published to gallery under "${uploadResult.category}" category.`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fraud' && (
          <div className="fade-in">
            <div className="section-intro">
              <h2>Real-Time Order Fraud Risk Analyzer</h2>
              <p>Powered by Isolation Forest anomaly detection trained on behavioral e-commerce order telemetry.</p>
            </div>

            <div className="two-col">
              <div className="panel-card">
                <div className="preset-row">
                  <button type="button" className="btn-safe-outline" onClick={() => loadSampleFraud('safe')}>
                    ✅ Load Safe Buyer Profile
                  </button>
                  <button type="button" className="btn-danger-outline" onClick={() => loadSampleFraud('fraud')}>
                    🚨 Load High-Risk Fraud Profile
                  </button>
                </div>

                <form onSubmit={checkFraud} className="telemetry-form">
                  <label className="input-group">
                    <span>Account Age (Days)</span>
                    <input
                      type="number"
                      value={fraudInput.account_age_days}
                      onChange={(e) => setFraudInput({ ...fraudInput, account_age_days: Number(e.target.value) })}
                    />
                  </label>
                  <label className="input-group">
                    <span>Orders Placed Today</span>
                    <input
                      type="number"
                      value={fraudInput.orders_per_day}
                      onChange={(e) => setFraudInput({ ...fraudInput, orders_per_day: Number(e.target.value) })}
                    />
                  </label>
                  <label className="input-group">
                    <span>Avg Order Value (BDT)</span>
                    <input
                      type="number"
                      value={fraudInput.avg_price_bdt}
                      onChange={(e) => setFraudInput({ ...fraudInput, avg_price_bdt: Number(e.target.value) })}
                    />
                  </label>
                  <label className="input-group">
                    <span>Failed Payment Attempts</span>
                    <input
                      type="number"
                      value={fraudInput.failed_payments}
                      onChange={(e) => setFraudInput({ ...fraudInput, failed_payments: Number(e.target.value) })}
                    />
                  </label>
                  <label className="input-group full-width">
                    <span>Orders From Same Shipping Address</span>
                    <input
                      type="number"
                      value={fraudInput.same_address_orders}
                      onChange={(e) => setFraudInput({ ...fraudInput, same_address_orders: Number(e.target.value) })}
                    />
                  </label>

                  <div className="card-footer full-width">
                    <span className="hint-text">{token ? 'API Connected' : '⚠️ Login required to run check'}</span>
                    <button type="submit" className="btn-primary" disabled={!token}>
                      Evaluate Fraud Risk
                    </button>
                  </div>
                </form>
              </div>

              <div className="panel-card result-panel">
                <h3>Anomaly Detection Output</h3>
                {!fraudResult ? (
                  <div className="placeholder-box">
                    Click one of the preset profiles above or enter custom values, then click <strong>Evaluate Fraud Risk</strong>.
                  </div>
                ) : (
                  <div className="result-view">
                    <div className={`alert-pill ${fraudResult.flagged ? 'danger' : 'safe'}`}>
                      {fraudResult.flagged ? '🚨 FRAUD ALERT — TRANSACTION BLOCKED' : '✅ LEGITIMATE ORDER — APPROVED'}
                    </div>

                    <div className="meter-group">
                      <div className="meter-labels">
                        <span>Calculated Risk Score</span>
                        <strong>{fraudResult.risk_score}%</strong>
                      </div>
                      <div className="meter-bar">
                        <div
                          className={`meter-fill ${fraudResult.flagged ? 'danger' : 'safe'}`}
                          style={{ width: `${fraudResult.risk_score}%` }}
                        />
                      </div>
                    </div>

                    {fraudResult.reasons?.length > 0 ? (
                      <div className="reasons-card">
                        <strong>Triggered Risk Indicators:</strong>
                        <ul>
                          {fraudResult.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="sub-note">All behavioral parameters match normal customer activity.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'arch' && (
          <div className="fade-in">
            <div className="section-intro">
              <h2>System Architecture & AI Pipelines</h2>
              <p>How Art-Hub combines Django REST Framework, React, EfficientNet-B0, CLIP Vision-Language Models, and Isolation Forest.</p>
            </div>

            <div className="two-col">
              <div className="panel-card">
                <h3>1. Automated Artwork Medium Classification</h3>
                <div className="flow-steps">
                  <div className="step-item"><strong>Step 1:</strong> Transfer learning on EfficientNet-B0 (91.22% val accuracy)</div>
                  <div className="step-item"><strong>Step 2:</strong> Image resized to 224×224 and normalized with ImageNet stats</div>
                  <div className="step-item"><strong>Step 3:</strong> Softmax probabilities predicted across 5 art mediums</div>
                  <div className="step-item"><strong>Step 4:</strong> Category auto-populated in UI & stored in database</div>
                </div>
              </div>

              <div className="panel-card">
                <h3>2. Visual Embedding & Copy Detection Pipeline</h3>
                <div className="flow-steps">
                  <div className="step-item"><strong>Step 1:</strong> Artist uploads artwork image via React UI</div>
                  <div className="step-item"><strong>Step 2:</strong> CLIP ViT-B/32 extracts 512-D normalized vector</div>
                  <div className="step-item"><strong>Step 3:</strong> Cosine similarity computed against all stored vectors</div>
                  <div className="step-item"><strong>Step 4:</strong> Score ≥ 0.92 flags copy automatically</div>
                </div>
              </div>

              <div className="panel-card">
                <h3>3. Behavioral Fraud Detection Pipeline</h3>
                <div className="flow-steps">
                  <div className="step-item"><strong>Step 1:</strong> Offline training on synthetic order behavior dataset</div>
                  <div className="step-item"><strong>Step 2:</strong> Isolation Forest isolates outlier order patterns</div>
                  <div className="step-item"><strong>Step 3:</strong> Real-time REST endpoint scores checkout telemetry</div>
                  <div className="step-item"><strong>Step 4:</strong> High-risk orders blocked with explainable reasons</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showAuthModal && (
        <div className="modal-backdrop" onClick={() => setShowAuthModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h3>{authMode === 'login' ? 'Welcome Back' : 'Create Art-Hub Account'}</h3>
              <button className="btn-clear" onClick={() => setShowAuthModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAuth} className="modal-form">
              <input
                placeholder="Username"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
              {authMode === 'register' && (
                <select value={authForm.role} onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}>
                  <option value="artist">Artist (Can upload & scan art)</option>
                  <option value="buyer">Buyer (Can browse & test fraud check)</option>
                </select>
              )}
              <button type="submit" className="btn-primary full-width">
                {authMode === 'login' ? 'Login' : 'Register Account'}
              </button>
            </form>
            <p className="modal-switch" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
            </p>
          </div>
        </div>
      )}

      {selectedArt && (
        <div className="modal-backdrop" onClick={() => setSelectedArt(null)}>
          <div className="modal-card art-modal" onClick={(e) => e.stopPropagation()}>
            <img src={selectedArt.image} alt={selectedArt.title} className="modal-art-img" />
            <div className="modal-art-body">
              <div className="modal-top">
                <h3>{selectedArt.title}</h3>
                <button className="btn-clear" onClick={() => setSelectedArt(null)}>✕</button>
              </div>
              <p className="sub-note">Artist: <strong>{selectedArt.artist_name}</strong> · Category: {selectedArt.category}</p>
              {selectedArt.description && <p className="detail-text">{selectedArt.description}</p>}
              <div className="modal-actions">
                <button
                  className="btn-primary"
                  onClick={() => {
                    setSelectedArt(null);
                    setActiveTab('fraud');
                  }}
                >
                  Test Order Fraud Check →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;