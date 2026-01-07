import React, { useState } from 'react';

export default function LoginModal({ onLogin, onCancel }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);

    const handleSubmit = () => {
        if (!password) {
            setError(true);
            return;
        }
        onLogin(password);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSubmit();
    };

    return (
        <div className="modal-overlay">
            <div className="login-card">
                <div className="login-header">
                    <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>🔒</span>
                    <h3>Admin Access</h3>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                        Please enter your password to continue.
                    </p>
                </div>
                
                <div style={{ marginTop: '20px' }}>
                    <input 
                        type="password" 
                        className={`login-input ${error ? 'input-error' : ''}`}
                        placeholder="Password" 
                        value={password} 
                        onChange={e => { setPassword(e.target.value); setError(false); }} 
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                </div>

                <div className="login-actions" style={{ marginTop: '20px' }}>
                    <button className="btn-main" onClick={handleSubmit}>Unlock</button>
                    <button className="btn-action" onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
}