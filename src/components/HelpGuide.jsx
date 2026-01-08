import React from 'react';

export default function HelpGuide() {
    return (
        <div className="help-container" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '30px' }}>
                <h2>📚 Help & Support</h2>
                <p className="subtitle">User Manual & Common Questions</p>
            </div>

            {/* =================================================================================
                                          ITEM 1: DOCUMENTATION
               ================================================================================= */}
            <div className="settings-card" style={{ marginBottom: '40px' }}>
                <h3 style={{ borderBottom: '2px solid #1E293B', paddingBottom: '10px', marginBottom: '25px', color: '#1E293B', display:'flex', alignItems:'center', gap:'10px' }}>
                    📖 1. Application Documentation
                </h3>
                
                <div style={{ display: 'grid', gap: '30px' }}>
                    
                    {/* --- PAGE: FRONT DESK --- */}
                    <div>
                        <h4 style={{ margin: '0 0 10px 0', color: '#D4AF37', fontSize:'18px', borderLeft: '4px solid #D4AF37', paddingLeft: '12px' }}>
                            A. Front Desk Page
                        </h4>
                        <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <p style={{marginTop:0, color:'#475569', fontSize:'14px'}}>The central hub for managing daily operations, guests, and payments.</p>
                            
                            <ul style={{ paddingLeft: '20px', fontSize: '14px', color: '#334155', lineHeight: '1.8' }}>
                                <li><strong>Global Search Bar:</strong> Instantly filter the booking table by Guest Name, Mobile Number, Room Number, or Booking Source (e.g., "OTA").</li>
                                <li><strong>New Booking Button:</strong> Opens the booking form with real-time "Conflict Detection" (warns you if a room is already occupied).</li>
                                <li><strong>Booking Actions (Table Icons):</strong>
                                    <ul style={{ marginTop: '5px', color:'#64748B' }}>
                                        <li>⬇️ <strong>Invoice:</strong> Generates a professional PDF invoice with your branding.</li>
                                        <li>✉️ <strong>Email:</strong> Sends the PDF invoice directly to the guest's email address.</li>
                                        <li>✏️ <strong>Edit:</strong> Modify guest details, upload ID proofs, or extend stays.</li>
                                        <li>🗑️ <strong>Delete:</strong> Permanently removes a booking record (Admin use recommended).</li>
                                    </ul>
                                </li>
                                <li><strong>Checkout Manager:</strong> Inside the Edit screen, use the <span style={{color:'#166534', fontWeight:'bold'}}>"Set to NOW"</span> button to auto-calculate the total rent based on the exact checkout time.</li>
                            </ul>
                        </div>
                    </div>

                    {/* --- PAGE: REPORTS --- */}
                    <div>
                        <h4 style={{ margin: '0 0 10px 0', color: '#D4AF37', fontSize:'18px', borderLeft: '4px solid #D4AF37', paddingLeft: '12px' }}>
                            B. Reports & Analytics Page
                        </h4>
                        <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <p style={{marginTop:0, color:'#475569', fontSize:'14px'}}>Financial insights and performance tracking.</p>
                            
                            <ul style={{ paddingLeft: '20px', fontSize: '14px', color: '#334155', lineHeight: '1.8' }}>
                                <li><strong>Period Filter:</strong> Use the Month/Year picker (top-right) to travel back in time. All KPIs and tables update instantly.</li>
                                <li><strong>Live Collection:</strong> The "Today's Collection" card updates in real-time as you add payments, separated by Cash, UPI, and Card.</li>
                                <li><strong>Interactive Charts:</strong>
                                    <ul style={{ marginTop: '5px', color:'#64748B' }}>
                                        <li><strong>Trend Line:</strong> Shows booking volume across the <em>entire selected year</em>.</li>
                                        <li><strong>Agent Performance:</strong> Ranks booking sources (OTAs, Agents) by revenue generated.</li>
                                        <li><strong>Drill Down:</strong> Clicking on the Pie Chart segments will automatically filter the Front Desk list for that source.</li>
                                    </ul>
                                </li>
                                <li><strong>Export Data:</strong> Two options available:
                                    <br/>• <strong>PDF:</strong> Visual report for management meetings.
                                    <br/>• <strong>Excel:</strong> Raw data file containing 3 sheets (Summary, Agent Stats, Detailed Booking List).
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* --- PAGE: SETTINGS --- */}
                    <div>
                        <h4 style={{ margin: '0 0 10px 0', color: '#D4AF37', fontSize:'18px', borderLeft: '4px solid #D4AF37', paddingLeft: '12px' }}>
                            C. Settings Page (Admin Only)
                        </h4>
                        <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <p style={{marginTop:0, color:'#475569', fontSize:'14px'}}>System configuration and inventory control.</p>
                            
                            <ul style={{ paddingLeft: '20px', fontSize: '14px', color: '#334155', lineHeight: '1.8' }}>
                                <li><strong>Room Management:</strong> Add new rooms, update standard rates, or delete rooms from inventory.</li>
                                <li><strong>Data Configuration:</strong> Change the folder path where Guest ID documents are stored on your computer.</li>
                                <li><strong>Security:</strong> Update the Admin Password used to access this Settings page.</li>
                            </ul>
                        </div>
                    </div>

                </div>
            </div>

            {/* =================================================================================
                                          ITEM 2: FAQs
               ================================================================================= */}
            <div className="settings-card">
                <h3 style={{ borderBottom: '2px solid #1E293B', paddingBottom: '10px', marginBottom: '25px', color: '#1E293B', display:'flex', alignItems:'center', gap:'10px' }}>
                    ❓ 2. Frequently Asked Questions (FAQs)
                </h3>

                <div className="faq-grid" style={{ display:'grid', gap:'15px' }}>
                    
                    <details style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '15px', cursor: 'pointer', backgroundColor: 'white' }}>
                        <summary style={{ fontWeight: '600', color: '#1E293B', fontSize: '15px' }}>How do I handle a guest extending their stay?</summary>
                        <p style={{ marginTop: '10px', color: '#475569', lineHeight: '1.6', fontSize: '14px' }}>
                            Open the booking using the ✏️ (Edit) button. Simply change the <strong>Check-Out Date</strong> or increase the <strong>Total Days</strong>. The system will automatically recalculate the Total Rent and Due Amount based on the room rate.
                        </p>
                    </details>

                    <details style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '15px', cursor: 'pointer', backgroundColor: 'white' }}>
                        <summary style={{ fontWeight: '600', color: '#1E293B', fontSize: '15px' }}>What should I do if the "Search" isn't showing all bookings?</summary>
                        <p style={{ marginTop: '10px', color: '#475569', lineHeight: '1.6', fontSize: '14px' }}>
                            This happens if a filter is active (e.g., you clicked "OTA" in the dashboard reports). To reset it, simply <strong>clear the text</strong> in the search bar on the Front Desk page.
                        </p>
                    </details>

                    <details style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '15px', cursor: 'pointer', backgroundColor: 'white' }}>
                        <summary style={{ fontWeight: '600', color: '#1E293B', fontSize: '15px' }}>Can I use this software on multiple computers?</summary>
                        <p style={{ marginTop: '10px', color: '#475569', lineHeight: '1.6', fontSize: '14px' }}>
                            Currently, Swarna Villa PMS is a <strong>desktop-based application</strong>. All data (database and guest files) is stored locally on the computer where it is installed. It does not sync across multiple devices automatically.
                        </p>
                    </details>

                    <details style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '15px', cursor: 'pointer', backgroundColor: 'white' }}>
                        <summary style={{ fontWeight: '600', color: '#1E293B', fontSize: '15px' }}>How do I back up my data?</summary>
                        <p style={{ marginTop: '10px', color: '#475569', lineHeight: '1.6', fontSize: '14px' }}>
                            Your data consists of two parts:
                            1. The Database (`swarna_pms.db`) in the AppData folder.
                            2. The Guest Documents folder (path visible in Settings).
                            We recommend copying the Guest Documents folder to an external drive regularly.
                        </p>
                    </details>

                    <details style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '15px', cursor: 'pointer', backgroundColor: 'white' }}>
                        <summary style={{ fontWeight: '600', color: '#1E293B', fontSize: '15px' }}>Why is the Invoice Email not sending?</summary>
                        <p style={{ marginTop: '10px', color: '#475569', lineHeight: '1.6', fontSize: '14px' }}>
                            Ensure that:
                            1. The computer is connected to the internet.
                            2. The guest has a valid email address entered.
                            3. The Admin email credentials in the system backend (`main.js`) are active and valid.
                        </p>
                    </details>

                    <details style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '15px', cursor: 'pointer', backgroundColor: 'white' }}>
                        <summary style={{ fontWeight: '600', color: '#1E293B', fontSize: '15px' }}>Can I edit a room rate for just one specific booking?</summary>
                        <p style={{ marginTop: '10px', color: '#475569', lineHeight: '1.6', fontSize: '14px' }}>
                            Yes. While creating or editing a booking, you can manually type a different amount in the <strong>Rent (₹)</strong> field. This will override the standard room rate for that specific guest only.
                        </p>
                    </details>

                </div>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '40px', color: '#94A3B8', fontSize: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
                <p>Swarna Villa PMS Documentation | v2.3.0</p>
            </div>
        </div>
    );
}