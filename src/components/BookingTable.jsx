import React, { useState, useEffect } from 'react';

const ITEMS_PER_PAGE = 10;

export default function BookingTable({ bookings, onEdit, onDelete, onInvoice, onEmail }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [filteredData, setFilteredData] = useState([]);

    // Filter Logic
    useEffect(() => {
        if (!bookings) return;
        let result = bookings;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = bookings.filter(b => 
                (b.name || '').toLowerCase().includes(lower) || 
                (b.mobile || '').includes(searchTerm) || 
                (b.room || '').includes(searchTerm)
            );
        }
        setFilteredData(result);
        setCurrentPage(1); 
    }, [searchTerm, bookings]);

    // Pagination Logic
    const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
    const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

    // Date Formatter (DD Mon, HH:MM)
    const formatDate = (isoString) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="table-card">
            {/* Search Bar */}
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
                <input 
                    className="search-input" 
                    placeholder="🔍 Search guest, mobile, or room..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px' }}
                />
            </div>

            {/* Table */}
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
                            <tr key={b.id}>
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
                                    <button className="btn-action" onClick={() => onInvoice(b)} title="Invoice">⬇️</button>
                                    <button className="btn-action" onClick={() => onEmail(b)} title="Email">✉️</button>
                                    {/* Edit button now serves as View/Edit/Checkout */}
                                    <button className="btn-action" onClick={() => onEdit(b)} title="Edit / Checkout">✏️</button>
                                    <button className="btn-action btn-del" onClick={() => onDelete(b.id)} title="Delete">🗑️</button>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1}
                    >
                        Prev
                    </button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}