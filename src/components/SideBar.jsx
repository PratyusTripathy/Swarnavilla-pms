import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, onLogout }) {
    const menuItems = [
        { id: 'frontDesk', label: 'Front Desk', icon: '🏨' },
        
        // ✅ NEW: Modular Reports Section
        { 
            id: 'reports', 
            label: 'Analytics', 
            icon: '📊',
            subItems: [
                { id: 'reports-trend', label: 'Trend Analysis', icon: '📈' },
                { id: 'reports-source', label: 'Source Breakdown', icon: '🧩' },
                { id: 'reports-agent', label: 'Agent Performance', icon: '🏆' },
                { id: 'reports-occupancy', label: 'Room Occupancy', icon: '🛏️' }
            ]
        },

        // ✅ Settings Section
        { 
            id: 'settings', 
            label: 'Settings', 
            icon: '⚙️',
            subItems: [
                { id: 'settings-rooms', label: 'Room Manager', icon: '🛏️' },
                { id: 'settings-ota', label: 'OTA Channels', icon: '☁️' },
                { id: 'settings-docs', label: 'Data & Docs', icon: '📂' },
                { id: 'settings-password', label: 'Security', icon: '🔒' },
                { id: 'settings-backup', label: 'Backup & Restore', icon: '💾' }
            ]
        },
    ];

    // Helper to keep parent menu active
    const isActive = (item) => {
        if (activeTab === item.id) return true;
        if (item.subItems) return item.subItems.some(sub => sub.id === activeTab);
        return false;
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <h1>Swarna<span>Villa</span></h1>
                <p>PMS Admin</p>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map(item => (
                    <div key={item.id}>
                        <button 
                            className={`nav-item ${isActive(item) ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.subItems ? item.subItems[0].id : item.id)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </button>

                        {item.subItems && isActive(item) && (
                            <div className="nav-subgroup" style={{background: 'rgba(0,0,0,0.03)', paddingBottom:'5px', marginBottom: '5px'}}>
                                {item.subItems.map(sub => (
                                    <button
                                        key={sub.id}
                                        className={`nav-item sub-item ${activeTab === sub.id ? 'sub-active' : ''}`}
                                        onClick={() => setActiveTab(sub.id)}
                                        style={{
                                            paddingLeft: '48px', fontSize: '13px', 
                                            color: activeTab === sub.id ? '#D4AF37' : '#64748B',
                                            fontWeight: activeTab === sub.id ? '600' : '400',
                                            borderLeft: activeTab === sub.id ? '3px solid #D4AF37' : '3px solid transparent',
                                            background: activeTab === sub.id ? 'white' : 'transparent',
                                            margin: '2px 0'
                                        }}
                                    >
                                        <span style={{marginRight:'8px'}}>{sub.icon}</span>
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
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