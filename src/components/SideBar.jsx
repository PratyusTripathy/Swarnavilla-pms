import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, onLogout }) {
    const menuItems = [
        { id: 'frontDesk', label: 'Front Desk', icon: '🏨' },
        { id: 'reports', label: 'Reports & Analytics', icon: '📊' },
        { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <h1>Swarna<span>Villa</span></h1>
                <p>PMS Admin</p>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map(item => (
                    <button 
                        key={item.id}
                        className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(item.id)}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <button className="nav-item logout" onClick={onLogout}>
                    <span className="nav-icon">🚪</span> Logout / Exit
                </button>
            </div>
        </aside>
    );
}