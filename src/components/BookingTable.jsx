import React, { useState, useMemo, useEffect } from 'react';

const ITEMS_PER_PAGE = 10;

// --- ICONS (SVGs for Professional Look) ---
const Icons = {
    Cloud: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
        </svg>
    ),
    Alert: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
    ),
    Invoice: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
    ),
    Mail: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
    ),
    Edit: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
    ),
    Trash: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    )
};

export default function BookingTable({ bookings, onEdit, onDelete, onInvoice, onEmail, onView, initialSearch = "", onSearchUpdate }) {
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [debouncedSearch, setDebouncedSearch] = useState(initialSearch); 
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if(initialSearch !== searchTerm) {
            setSearchTerm(initialSearch);
            setDebouncedSearch(initialSearch);
        }
    }, [initialSearch]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch]);

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (onSearchUpdate) onSearchUpdate(val);
    };

    const processedData = useMemo(() => {
        if (!bookings) return [];
        let data = [...bookings].sort((a, b) => b.id - a.id);

        if (debouncedSearch) {
            const lower = debouncedSearch.toLowerCase();
            data = data.filter(b => 
                (b.name || '').toLowerCase().includes(lower) || 
                (b.mobile || '').includes(debouncedSearch) || 
                (b.room || '').includes(debouncedSearch) ||
                (b.refBy || '').toLowerCase().includes(lower)
            );
        }
        return data;
    }, [bookings, debouncedSearch]);

    const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
    const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
    const currentItems = processedData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(processedData.length / ITEMS_PER_PAGE);

    const formatDate = (isoString) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    const isSynced = (b) => {
        return b.refBy && b.refBy.startsWith('OTA') && b.paymentRef;
    };

    return (
        <div className="table-card" style={{borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0', overflow: 'hidden', background: 'white'}}>
            {/* Search Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9', background: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{position: 'relative', width: '100%', maxWidth: '400px'}}>
                    <span style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8'}}>🔍</span>
                    <input 
                        className="search-input" 
                        placeholder="Search guest, mobile, room..." 
                        value={searchTerm}
                        onChange={handleSearchChange}
                        style={{ width: '100%', paddingLeft: '36px', height: '42px', fontSize: '14px', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', transition: 'border-color 0.2s' }}
                        onFocus={(e) => e.target.style.borderColor = '#D4AF37'}
                        onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                    />
                </div>
                <span style={{fontSize: '13px', color: '#64748B', fontWeight: '500', background: '#F8FAFC', padding: '6px 12px', borderRadius: '20px'}}>
                    {processedData.length} Total Bookings
                </span>
            </div>

            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead style={{background: '#F8FAFC', borderBottom: '1px solid #E2E8F0'}}>
                    <tr>
                        <th style={{padding: '16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Room</th>
                        <th style={{padding: '16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Guest Name</th>
                        <th style={{padding: '16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Source</th>
                        <th style={{padding: '16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Check-In</th>
                        <th style={{padding: '16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Check-Out</th>
                        <th style={{padding: '16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Status</th>
                        <th style={{padding: '16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {currentItems.length > 0 ? (
                        currentItems.map(b => (
                            <tr 
                                key={b.id} 
                                onDoubleClick={() => onView && onView(b)} 
                                style={{
                                    cursor: 'pointer', 
                                    borderBottom: '1px solid #F1F5F9',
                                    transition: 'background 0.2s',
                                    background: b.room.includes('Unassigned') ? '#FFF7ED' : 'white' // Subtle orange tint for unassigned
                                }}
                                onMouseEnter={(e) => { if(!b.room.includes('Unassigned')) e.currentTarget.style.background = '#F8FAFC' }}
                                onMouseLeave={(e) => { if(!b.room.includes('Unassigned')) e.currentTarget.style.background = 'white' }}
                                title="Double click to View Details"
                            >
                                <td style={{padding: '16px'}}>
                                    {b.room.includes('Unassigned') ? (
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            background: '#FEE2E2', color: '#DC2626', 
                                            padding: '6px 10px', borderRadius: '6px', 
                                            fontSize: '12px', fontWeight: '600', border: '1px solid #FECACA'
                                        }}>
                                            <Icons.Alert /> Assign Room
                                        </div>
                                    ) : (
                                        <span style={{
                                            background: '#F1F5F9', color: '#1E293B', 
                                            padding: '6px 12px', borderRadius: '6px', 
                                            fontSize: '13px', fontWeight: '600', border: '1px solid #E2E8F0'
                                        }}>
                                            {b.room}
                                        </span>
                                    )}
                                </td>
                                
                                <td style={{padding: '16px'}}>
                                    <div style={{fontWeight: '600', color: '#1E293B', fontSize: '14px'}}>{b.name}</div>
                                    <div style={{fontSize: '12px', color: '#64748B', marginTop: '2px'}}>{b.mobile}</div>
                                </td>

                                <td style={{padding: '16px'}}>
                                    {isSynced(b) ? (
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', 
                                            background: '#EFF6FF', color: '#2563EB', 
                                            padding: '4px 10px', borderRadius: '20px', 
                                            fontSize: '12px', fontWeight: '600', border: '1px solid #DBEAFE'
                                        }}>
                                            <Icons.Cloud /> {b.refBy.replace('OTA - ', '')}
                                        </div>
                                    ) : (
                                        <span style={{color: '#64748B', fontSize: '13px'}}>{b.refBy}</span>
                                    )}
                                </td>

                                <td style={{padding: '16px', fontSize: '13px', color: '#334155'}}>{formatDate(b.checkIn)}</td>
                                <td style={{padding: '16px', fontSize: '13px', color: '#334155'}}>{formatDate(b.checkOut)}</td>
                                
                                <td style={{padding: '16px'}}>
                                    {b.due > 0 
                                        ? <span style={{background: '#FEF2F2', color: '#DC2626', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700'}}>Due: ₹{b.due}</span> 
                                        : <span style={{background: '#DCFCE7', color: '#16A34A', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700'}}>Paid</span>}
                                </td>
                                
                                <td style={{padding: '16px', textAlign: 'center'}}>
                                    <div style={{display: 'flex', justifyContent: 'center', gap: '8px'}}>
                                        <button className="btn-icon-action" onClick={(e) => { e.stopPropagation(); onInvoice(b); }} title="Invoice" style={iconBtnStyle}>
                                            <Icons.Invoice />
                                        </button>
                                        <button className="btn-icon-action" onClick={(e) => { e.stopPropagation(); onEmail(b); }} title="Email" style={iconBtnStyle}>
                                            <Icons.Mail />
                                        </button>
                                        <button className="btn-icon-action" onClick={(e) => { e.stopPropagation(); onEdit(b); }} title="Edit" style={{...iconBtnStyle, color: '#D97706'}}>
                                            <Icons.Edit />
                                        </button>
                                        <button className="btn-icon-action" onClick={(e) => { e.stopPropagation(); onDelete(b.id); }} title="Delete" style={{...iconBtnStyle, color: '#DC2626', borderColor: '#FECACA'}}>
                                            <Icons.Trash />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                                <div style={{fontSize: '40px', marginBottom: '10px'}}>📭</div>
                                <div>No bookings found matching your search.</div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {totalPages > 1 && (
                <div className="pagination" style={{borderTop: '1px solid #E2E8F0', background: '#FAFAFA'}}>
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1}
                        style={{opacity: currentPage === 1 ? 0.5 : 1}}
                    >
                        Prev
                    </button>
                    <span style={{fontSize:'13px', color:'#475569', fontWeight:'600'}}>
                        Page {currentPage} of {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages}
                        style={{opacity: currentPage === totalPages ? 0.5 : 1}}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}

// Inline Style for Action Buttons to keep JSX clean
const iconBtnStyle = {
    background: 'white',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#475569',
    transition: 'all 0.2s',
    padding: 0
};