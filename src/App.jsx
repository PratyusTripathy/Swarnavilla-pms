import React, { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import html2pdf from 'html2pdf.js';
import './App.css';

// Components
import Sidebar from './components/Sidebar';
import BookingTable from './components/BookingTable';
import BookingModal from './components/BookingModal';
import DashboardStats from './components/DashboardStats';
import LoginModal from './components/LoginModal';
import { useBookings } from './hooks/useBookings';

function App() {
  const { bookings, stats, reload } = useBookings();
  const [activeTab, setActiveTab] = useState('frontDesk');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [rateCard, setRateCard] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  
  // Settings
  const [guestDocPath, setGuestDocPath] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [newRoom, setNewRoom] = useState({ room_no: '', room_type: '', rate: '' });
  const [editingRoomNo, setEditingRoomNo] = useState(null);

  // Invoice State
  const [printBooking, setPrintBooking] = useState(null);
  const invoiceRef = useRef(); 

  // Load Data
  useEffect(() => {
    if (window.api) {
      loadRates();
      window.api.getConfig().then(cfg => setGuestDocPath(cfg.guestDocsPath));
    }
  }, []);

  const loadRates = () => window.api.getRates().then(setRateCard);

  // --- HANDLERS ---
  const handleSaveBooking = async (data) => {
    try {
        const promise = editingBooking
          ? window.api.updateBooking({ ...data, id: editingBooking.id })
          : window.api.addBooking(data);
        await promise;
        toast.success(editingBooking ? "Booking Updated" : "Booking Created");
        setIsModalOpen(false);
        reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this booking?")) return;
    await window.api.deleteBooking(id);
    toast.success("Booking Deleted");
    reload();
  };

  // --- 📄 INVOICE GENERATION (HIGH RESOLUTION) ---
  const getFileName = (b) => {
      const safeName = (b.name || 'Guest').replace(/\s/g, '_');
      const safeDate = b.checkIn ? b.checkIn.split('T')[0] : 'Date';
      return `SwarnaVilla_Inv_${safeName}_${b.room}_${safeDate}.pdf`;
  };

  const handleInvoice = (booking) => {
      setPrintBooking(booking);
      toast.loading("Generating High-Res Invoice...", { duration: 1500 });
      
      setTimeout(() => {
          const element = invoiceRef.current;
          
          // ✅ HIGH RESOLUTION SETTINGS
          const opt = {
              margin: 0, 
              filename: getFileName(booking),
              image: { type: 'jpeg', quality: 1.0 }, // Max Quality
              html2canvas: { 
                  scale: 4, // 🚀 4x Scale = Crystal Clear Text
                  useCORS: true, 
                  letterRendering: true, // Better font kerning
                  scrollY: 0
              },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } // A4 Format
          };
          
          html2pdf().set(opt).from(element).save();
      }, 500);
  };

  const handleEmail = (booking) => {
      if (!booking.email) return toast.error("Guest has no email address!");
      if (!confirm(`Send Invoice to ${booking.email}?`)) return;

      setPrintBooking(booking);
      const toastId = toast.loading("Processing High-Res Email...");

      setTimeout(async () => {
          try {
              const element = invoiceRef.current;
              
              // ✅ HIGH RESOLUTION SETTINGS FOR EMAIL
              const opt = { 
                  margin: 0, 
                  image: { type: 'jpeg', quality: 1.0 }, 
                  html2canvas: { scale: 4, useCORS: true, letterRendering: true }, 
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
              };
              
              const pdfBase64 = await html2pdf().set(opt).from(element).outputPdf('datauristring');
              
              const res = await window.api.sendEmail({
                  to: booking.email,
                  subject: `Invoice - Stay at Swarna Villa`,
                  body: `Dear ${booking.name},\n\nPlease find attached the invoice for your stay.\n\nThank you,\nSwarna Villa Management`,
                  pdfBase64: pdfBase64,
                  fileName: getFileName(booking)
              });

              if (res.success) {
                  toast.success("Email Sent Successfully!", { id: toastId });
              } else {
                  toast.error("Email Failed: " + res.error, { id: toastId });
              }
          } catch (e) {
              toast.error("Error generating PDF", { id: toastId });
          }
      }, 1000);
  };

  // Settings Handlers
  const handleSaveRoom = async () => {
      if(!newRoom.room_no || !newRoom.room_type || !newRoom.rate) return toast.error("Fill all fields");
      try {
          if (editingRoomNo) { await window.api.updateRoom(newRoom); toast.success("Room Updated"); } 
          else { await window.api.addRoom(newRoom); toast.success("Room Added"); }
          setNewRoom({ room_no: '', room_type: '', rate: '' });
          setEditingRoomNo(null);
          loadRates();
      } catch(e) { toast.error("Error saving room"); }
  };
  const handleDeleteRoom = async (roomNo) => { if(!confirm(`Delete Room ${roomNo}?`)) return; await window.api.deleteRoom(roomNo); toast.success("Room Deleted"); loadRates(); };
  const handleEditRoom = (roomNo) => { const r = rateCard[roomNo]; setNewRoom({ room_no: roomNo, room_type: r.type, rate: r.rate }); setEditingRoomNo(roomNo); };
  const handleUpdateSettings = async () => { if (guestDocPath) await window.api.updateGuestDocPath(guestDocPath); if (adminPassword) await window.api.changePassword(adminPassword); toast.success("Settings Updated!"); setAdminPassword(''); };

  return (
    <div className="app-container">
      <Toaster position="top-right" />
      <Sidebar activeTab={activeTab} setActiveTab={(tab) => { if(tab==='settings' && !isAdmin) setShowLogin(true); else setActiveTab(tab); }} onLogout={() => window.close()} />

      <main className="main-content">
        {activeTab === 'frontDesk' && (
          <>
            <div className="toolbar">
              <div className="page-header"><h2>Front Desk</h2><p className="subtitle">Manage bookings and guests</p></div>
              <button className="btn-main" onClick={() => { setEditingBooking(null); setIsModalOpen(true); }}>+ New Booking</button>
            </div>
            <BookingTable bookings={bookings} onEdit={(b)=>{setEditingBooking(b); setIsModalOpen(true);}} onDelete={handleDelete} onInvoice={handleInvoice} onEmail={handleEmail} />
          </>
        )}
        
        {activeTab === 'reports' && <DashboardStats stats={stats} />}

        {activeTab === 'settings' && (
          <div className="settings-container">
            <div className="page-header"><h2>System Settings</h2></div>
            
            {/* --- ROOM MANAGEMENT --- */}
            <div className="settings-card">
                <h3 style={{color:'#1e293b', borderBottom:'none', marginBottom:'15px'}}>🏨 Room Management</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '15px', alignItems: 'end', marginBottom: '25px' }}>
                    <div className="input-group">
                        <label style={{color:'#64748b', fontSize:'11px', fontWeight:'700', textTransform:'uppercase'}}>Room No</label>
                        <input style={{padding:'10px', borderRadius:'4px', border:'1px solid #e2e8f0'}} value={newRoom.room_no} onChange={e => setNewRoom({...newRoom, room_no:e.target.value})} disabled={!!editingRoomNo} />
                    </div>
                    <div className="input-group">
                        <label style={{color:'#64748b', fontSize:'11px', fontWeight:'700', textTransform:'uppercase'}}>Type</label>
                        <input style={{padding:'10px', borderRadius:'4px', border:'1px solid #e2e8f0'}} value={newRoom.room_type} onChange={e => setNewRoom({...newRoom, room_type:e.target.value})} />
                    </div>
                    <div className="input-group">
                        <label style={{color:'#64748b', fontSize:'11px', fontWeight:'700', textTransform:'uppercase'}}>Rate</label>
                        <input type="number" style={{padding:'10px', borderRadius:'4px', border:'1px solid #e2e8f0'}} value={newRoom.rate} onChange={e => setNewRoom({...newRoom, rate:e.target.value})} />
                    </div>
                    <div style={{display:'flex', gap:'5px'}}>
                        <button className="btn-main" onClick={handleSaveRoom} style={{ background:'#1e293b', color:'white', height:'38px', borderRadius:'4px', padding:'0 20px', letterSpacing:'1px' }}>
                            {editingRoomNo ? 'UPDATE' : 'ADD'}
                        </button>
                        {editingRoomNo && (
                            <button className="btn-action" onClick={() => { setEditingRoomNo(null); setNewRoom({room_no:'', room_type:'', rate:''}); }} style={{ height: '38px' }}>Cancel</button>
                        )}
                    </div>
                </div>

                <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead>
                        <tr style={{borderBottom:'1px solid #f1f5f9'}}>
                            <th style={{color:'#94a3b8', fontSize:'11px', textTransform:'uppercase', padding:'15px', textAlign:'left'}}>ROOM</th>
                            <th style={{color:'#94a3b8', fontSize:'11px', textTransform:'uppercase', padding:'15px', textAlign:'left'}}>TYPE</th>
                            <th style={{color:'#94a3b8', fontSize:'11px', textTransform:'uppercase', padding:'15px', textAlign:'left'}}>RATE</th>
                            <th style={{color:'#94a3b8', fontSize:'11px', textTransform:'uppercase', padding:'15px', textAlign:'center'}}>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.keys(rateCard).map(r => (
                            <tr key={r} style={{borderBottom:'1px solid #f8fafc'}}>
                                <td style={{padding:'15px', color:'#334155'}}>{r}</td>
                                <td style={{padding:'15px', color:'#334155'}}>{rateCard[r].type}</td>
                                <td style={{padding:'15px', fontWeight:'600', color:'#334155'}}>₹{rateCard[r].rate}</td>
                                <td style={{padding:'15px', textAlign:'center'}}>
                                    <button onClick={()=>handleEditRoom(r)} style={{background:'white', border:'1px solid #e2e8f0', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', marginRight:'5px', color:'#f59e0b'}}>✏️</button>
                                    <button onClick={()=>handleDeleteRoom(r)} style={{background:'white', border:'1px solid #e2e8f0', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', color:'#94a3b8'}}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="settings-card" style={{marginTop:'20px'}}>
              <h3>⚙️ Configuration</h3>
              <div className="input-group"><label>Guest Documents Path</label><div style={{ display: 'flex', gap: '10px' }}><input value={guestDocPath} readOnly style={{ flex: 1, background: '#f1f5f9' }} /><button className="btn-action" onClick={() => { const newPath = prompt("Enter new path:", guestDocPath); if(newPath) setGuestDocPath(newPath); }}>Change</button></div></div>
              <div className="input-group" style={{ marginTop: '20px' }}><label>Change Admin Password</label><input type="password" placeholder="New password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></div>
              <div style={{ marginTop: '20px', textAlign: 'right' }}><button className="btn-main" onClick={handleUpdateSettings}>Save Config</button></div>
            </div>
          </div>
        )}
      </main>

      <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} editingBooking={editingBooking} rateCard={rateCard} allBookings={bookings} onSave={handleSaveBooking} />
      {showLogin && <LoginModal onLogin={async (pwd) => { if(await window.api.checkPassword(pwd)) { setIsAdmin(true); setShowLogin(false); setActiveTab('settings'); } else toast.error("Invalid"); }} onCancel={() => setShowLogin(false)} />}

      {/* --- HIDDEN INVOICE TEMPLATE --- */}
      <div className="invoice-hidden-container">
        <div ref={invoiceRef} className="invoice-box" style={{padding:'40px', fontFamily:"'Inter', sans-serif"}}>
            {printBooking && (
                <>
                    {/* Header */}
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'30px'}}>
                        <div>
                            <h1 style={{color:'#1e293b', fontSize:'32px', margin:'0 0 10px 0', textTransform:'uppercase', letterSpacing:'1px', fontFamily:"'Playfair Display', serif"}}>SWARNA VILLA</h1>
                            <p style={{margin:'2px 0', fontSize:'13px', color:'#475569'}}>Station Road, Badasankha (Near Senapati Sweets), Puri, Odisha - 752001</p>
                            <p style={{margin:'2px 0', fontSize:'13px', color:'#475569'}}>Phone: +91 9777831405 | Email: Swarnavilla.info@gmail.com</p>
                        </div>
                        <div style={{textAlign:'right'}}>
                            <h2 style={{color:'#D4AF37', fontSize:'24px', margin:'0 0 10px 0', fontWeight:'400', letterSpacing:'2px'}}>INVOICE</h2>
                            <p style={{margin:'4px 0', fontSize:'13px'}}><strong>Ref #:</strong> {printBooking.id.toString().padStart(4, '0')}</p>
                            <p style={{margin:'4px 0', fontSize:'13px'}}><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                            <p style={{margin:'4px 0', fontSize:'13px'}}><strong>Status:</strong> <span style={{color: printBooking.due > 0 ? '#DC2626' : '#16A34A'}}>{printBooking.due > 0 ? 'Unpaid' : 'Paid'}</span></p>
                        </div>
                    </div>
                    
                    <div style={{borderBottom:'2px solid #D4AF37', marginBottom:'30px'}}></div>

                    <div style={{display:'flex', justifyContent:'space-between', padding:'25px', backgroundColor:'#fffbeb', border:'1px solid #fde68a', borderRadius:'4px', marginBottom:'30px'}}>
                        <div style={{width:'48%'}}>
                            <h3 style={{fontSize:'12px', color:'#D4AF37', textTransform:'uppercase', margin:'0 0 10px 0', borderBottom:'1px solid #fde68a', paddingBottom:'5px', display:'inline-block'}}>BILL TO</h3>
                            <p style={{margin:'4px 0', fontSize:'14px', fontWeight:'700', color:'#1e293b'}}>{printBooking.name}</p>
                            <p style={{margin:'4px 0', fontSize:'14px', color:'#475569'}}>{printBooking.mobile}</p>
                            {printBooking.email && <p style={{margin:'4px 0', fontSize:'14px', color:'#475569'}}>{printBooking.email}</p>}
                        </div>
                        <div style={{width:'48%'}}>
                            <h3 style={{fontSize:'12px', color:'#D4AF37', textTransform:'uppercase', margin:'0 0 10px 0', borderBottom:'1px solid #fde68a', paddingBottom:'5px', display:'inline-block'}}>STAY DETAILS</h3>
                            <p style={{margin:'4px 0', fontSize:'14px'}}><strong>Room:</strong> {printBooking.room}</p>
                            <p style={{margin:'4px 0', fontSize:'14px'}}><strong>Check-In:</strong> {printBooking.checkIn ? printBooking.checkIn.split('T')[0] : ''}</p>
                            <p style={{margin:'4px 0', fontSize:'14px'}}><strong>Check-Out:</strong> {printBooking.checkOut ? printBooking.checkOut.split('T')[0] : ''}</p>
                            <p style={{margin:'4px 0', fontSize:'14px'}}><strong>Total Nights:</strong> {printBooking.days}</p>
                        </div>
                    </div>

                    <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'30px'}}>
                        <thead>
                            <tr style={{backgroundColor:'#1e293b'}}>
                                <th style={{padding:'12px 15px', textAlign:'left', color:'#D4AF37', fontSize:'12px', textTransform:'uppercase'}}>DESCRIPTION</th>
                                <th style={{padding:'12px 15px', textAlign:'center', color:'#D4AF37', fontSize:'12px', textTransform:'uppercase'}}>RATE</th>
                                <th style={{padding:'12px 15px', textAlign:'center', color:'#D4AF37', fontSize:'12px', textTransform:'uppercase'}}>DAYS</th>
                                <th style={{padding:'12px 15px', textAlign:'right', color:'#D4AF37', fontSize:'12px', textTransform:'uppercase'}}>AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{padding:'15px', borderBottom:'1px solid #e2e8f0', fontSize:'14px', color:'#333'}}>Room Charges - {printBooking.room}</td>
                                <td style={{padding:'15px', borderBottom:'1px solid #e2e8f0', fontSize:'14px', textAlign:'center', color:'#333'}}>₹{printBooking.rent}</td>
                                <td style={{padding:'15px', borderBottom:'1px solid #e2e8f0', fontSize:'14px', textAlign:'center', color:'#333'}}>{printBooking.days}</td>
                                <td style={{padding:'15px', borderBottom:'1px solid #e2e8f0', fontSize:'14px', textAlign:'right', fontWeight:'700', color:'#333'}}>₹{printBooking.total.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'40px'}}>
                        <table style={{width:'300px'}}>
                            <tbody>
                                <tr>
                                    <td style={{padding:'5px 0', textAlign:'right', fontSize:'14px'}}>Subtotal:</td>
                                    <td style={{padding:'5px 0', textAlign:'right', fontSize:'14px', fontWeight:'600'}}>₹{printBooking.total.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td style={{padding:'5px 0', textAlign:'right', fontSize:'14px'}}>Less: Advance Paid:</td>
                                    <td style={{padding:'5px 0', textAlign:'right', fontSize:'14px', color:'#DC2626'}}>- ₹{printBooking.advance.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td style={{paddingTop:'10px', textAlign:'right', fontSize:'18px', fontWeight:'700', color:'#1e293b', borderTop:'2px solid #D4AF37'}}>Total Due:</td>
                                    <td style={{paddingTop:'10px', textAlign:'right', fontSize:'18px', fontWeight:'700', color:'#1e293b', borderTop:'2px solid #D4AF37'}}>₹{printBooking.due.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style={{textAlign:'center', borderTop:'1px solid #e2e8f0', paddingTop:'20px', color:'#94a3b8', fontSize:'11px', fontStyle:'italic'}}>
                        <p style={{marginBottom:'4px'}}><strong>Terms & Conditions:</strong> Check-out time is 11:00 AM. Payment is due upon presentation.</p>
                        <p style={{margin:'0'}}>This is a computer-generated invoice and does not require a signature.</p>
                        <p style={{marginTop:'4px'}}>Thank you for choosing Swarna Villa!</p>
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
}

export default App;