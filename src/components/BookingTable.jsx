import React, { useState, useMemo, useEffect } from 'react';

const ITEMS_PER_PAGE = 10;

// ✅ Added onSearchUpdate to props
export default function BookingTable({ bookings, onEdit, onDelete, onInvoice, onEmail, onView, initialSearch = "", onSearchUpdate }) {
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [debouncedSearch, setDebouncedSearch] = useState(initialSearch); 
    const [currentPage, setCurrentPage] = useState(1);

    // Sync local state if parent updates initialSearch (e.g. Dashboard Drill-down)
    useEffect(() => {
        setSearchTerm(initialSearch);
        setDebouncedSearch(initialSearch);
    }, [initialSearch]);

    // Debounce Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Pagination Reset
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch]);

    // --- HANDLER FOR INPUT CHANGE ---
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchTerm(val);
        
        // ✅ Notify Parent (App.jsx) immediately so it doesn't hold onto old values
        if (onSearchUpdate) {
            onSearchUpdate(val);
        }
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

    return (
        <div className="table-card">
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input 
                    className="search-input" 
                    placeholder="🔍 Search guest, mobile, room, or source..." 
                    value={searchTerm}
                    onChange={handleSearchChange} // ✅ Use the new handler
                    style={{ width: '100%', maxWidth: '400px' }}
                />
                <span style={{fontSize: '0.85rem', color: '#64748b'}}>
                    Showing {currentItems.length} of {processedData.length} bookings
                </span>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Room</th>
                        <th>Guest Name</th>
                        <th>Check-In</th>
                        <th>Check-Out</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {currentItems.length > 0 ? (
                        currentItems.map(b => (
                            <tr 
                                key={b.id} 
                                onDoubleClick={() => onView && onView(b)} 
                                style={{cursor: 'pointer'}} 
                                title="Double click to View Details"
                            >
                                <td><span className="badge">{b.room}</span></td>
                                <td style={{ fontWeight: '500' }}>
                                    {b.name}
                                    <div style={{fontSize:'0.75rem', color:'#64748b'}}>{b.mobile}</div>
                                </td>
                                <td>{formatDate(b.checkIn)}</td>
                                <td>{formatDate(b.checkOut)}</td>
                                <td>
                                    {b.due > 0 
                                        ? <span className="badge-danger">Due: ₹{b.due}</span> 
                                        : <span className="badge-success">Paid</span>}
                                </td>
                                <td className="action-buttons" style={{ justifyContent: 'center' }}>
                                    <button className="btn-action" onClick={(e) => { e.stopPropagation(); onInvoice(b); }} title="Invoice">⬇️</button>
                                    <button className="btn-action" onClick={(e) => { e.stopPropagation(); onEmail(b); }} title="Email">✉️</button>
                                    <button className="btn-action" onClick={(e) => { e.stopPropagation(); onEdit(b); }} title="Edit">✏️</button>
                                    <button className="btn-action btn-del" onClick={(e) => { e.stopPropagation(); onDelete(b.id); }} title="Delete">🗑️</button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                                No bookings found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {totalPages > 1 && (
                <div className="pagination">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1}
                        style={{opacity: currentPage === 1 ? 0.5 : 1}}
                    >
                        Prev
                    </button>
                    <span style={{fontSize:'0.9rem', color:'#475569', fontWeight:'500'}}>
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