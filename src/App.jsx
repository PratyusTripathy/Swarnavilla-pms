import React, { useState, useEffect, useRef } from 'react'; //
import toast, { Toaster } from 'react-hot-toast';
import html2pdf from 'html2pdf.js';
import './App.css';

// Components
import Sidebar from './components/Sidebar';
import BookingTable from './components/BookingTable';
import BookingModal from './components/BookingModal';
import DashboardStats from './components/DashboardStats';
import LoginModal from './components/LoginModal';
import HelpGuide from './components/HelpGuide'; 
import { useBookings } from './hooks/useBookings';

function App() {
  const { bookings, stats, reload } = useBookings();
  const [activeTab, setActiveTab] = useState('frontDesk');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [rateCard, setRateCard] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  
  // View & Search States
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [autoSearch, setAutoSearch] = useState("");

  // Settings States
  const [guestDocPath, setGuestDocPath] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [newRoom, setNewRoom] = useState({ room_no: '', room_type: '', rate: '' });
  const [editingRoomNo, setEditingRoomNo] = useState(null);
  
  // OTA Settings State
  const [otaChannels, setOtaChannels] = useState([]);
  const [editingOTA, setEditingOTA] = useState(null); 
  const [newOTA, setNewOTA] = useState({ name: '', apiUrl: '', apiKey: '', hotelId: '', enabled: true });

  const [printBooking, setPrintBooking] = useState(null);
  const invoiceRef = useRef(); 

  // --- INITIALIZATION ---
  useEffect(() => {
    if (window.api) {
      loadRates();
      window.api.getConfig().then(cfg => {
          setGuestDocPath(cfg.guestDocsPath);
          setOtaChannels(cfg.otaChannels || []); 
      });
    }
  }, []);

  // Listen for Menu Bar Navigation (Help/FAQs)
  useEffect(() => {
    if (window.api && window.api.onNavigate) {
      window.api.onNavigate((route) => {
        if (route === 'help') setActiveTab('help');
      });
    }
  }, []);

  const loadRates = () => window.api.getRates().then(setRateCard);

  // --- HANDLERS: SETTINGS & OTA ---
  const handleSaveOTA = async () => {
    if (!newOTA.name || !newOTA.apiUrl) return toast.error("Name & URL required");
    let updatedList;
    if (editingOTA) {
        updatedList = otaChannels.map(ch => ch.id === editingOTA ? { ...newOTA, id: editingOTA } : ch);
    } else {
        updatedList = [...otaChannels, { ...newOTA, id: Date.now() }];
    }
    setOtaChannels(updatedList);
    await window.api.updateOTAConfig(updatedList);
    toast.success("Channel Saved");
    setNewOTA({ name: '', apiUrl: '', apiKey: '', hotelId: '', enabled: true });
    setEditingOTA(null);
  };

  const handleDeleteOTA = async (id) => {
      if(!confirm("Remove this OTA?")) return;
      const updatedList = otaChannels.filter(c => c.id !== id);
      setOtaChannels(updatedList);
      await window.api.updateOTAConfig(updatedList);
      toast.success("Channel Removed");
  };

  const handleEditOTA = (ch) => { setNewOTA(ch); setEditingOTA(ch.id); };

  const handleUpdateSettings = async () => { 
      if (guestDocPath) await window.api.updateGuestDocPath(guestDocPath); 
      if (adminPassword) await window.api.changePassword(adminPassword); 
      toast.success("Configuration Saved!"); 
      setAdminPassword(''); 
  };

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

  // --- HANDLERS: BACKUP & EXPORT ---
  const handleSystemBackup = async () => {
      const toastId = toast.loading("Creating System Backup...");
      try {
          const res = await window.api.backupSystem();
          if (res.success) toast.success("Backup Saved Successfully!", { id: toastId });
          else if (res.msg) toast.dismiss(toastId);
          else toast.error("Backup Failed: " + res.error, { id: toastId });
      } catch(e) { toast.error("Backup Error", { id: toastId }); }
  };

  const handleDataExport = async (format) => {
      const toastId = toast.loading(`Exporting as ${format.toUpperCase()}...`);
      try {
          const res = await window.api.exportData(format);
          if (res.success) toast.success("Export Complete!", { id: toastId });
          else if (res.msg) toast.dismiss(toastId);
          else toast.error("Export Failed: " + res.error, { id: toastId });
      } catch(e) { toast.error("Export Error", { id: toastId }); }
  };

  // --- HANDLERS: FRONT DESK ---
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

  const handleViewBooking = (booking) => { setEditingBooking(booking); setIsViewOnly(true); setIsModalOpen(true); };
  const handleEditBooking = (booking) => { setEditingBooking(booking); setIsViewOnly(false); setIsModalOpen(true); };
  const handleNewBooking = () => { setEditingBooking(null); setIsViewOnly(false); setIsModalOpen(true); };
  const handleDrillDown = (sourceName) => { setActiveTab('frontDesk'); setAutoSearch(sourceName); toast(`Filtered by: ${sourceName}`, { icon: '🔍' }); };
  
  const handleSyncOTA = async () => {
      const toastId = toast.loading("Syncing active OTA Channels...");
      try {
          const result = await window.api.syncOTA();
          if (result.success) {
              if (result.added > 0) {
                  toast.success(`Sync Complete! Added ${result.added} new bookings.`, { id: toastId });
                  reload(); 
              } else {
                  toast.success("Sync Complete. No new bookings found.", { id: toastId });
              }
          } else {
              toast.error("Sync Failed: " + result.error, { id: toastId });
          }
      } catch (e) { toast.error("Connection Error", { id: toastId }); }
  };

  // --- INVOICE ---
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
          const opt = { margin: 0, filename: getFileName(booking), image: { type: 'jpeg', quality: 1.0 }, html2canvas: { scale: 4, useCORS: true, letterRendering: true, scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
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
              const opt = { margin: 0, image: { type: 'jpeg', quality: 1.0 }, html2canvas: { scale: 4, useCORS: true, letterRendering: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
              const pdfBase64 = await html2pdf().set(opt).from(element).outputPdf('datauristring');
              const res = await window.api.sendEmail({ to: booking.email, subject: `Invoice - Stay at Swarna Villa`, body: `Dear ${booking.name},\n\nPlease find attached the invoice for your stay.\n\nThank you,\nSwarna Villa Management`, pdfBase64: pdfBase64, fileName: getFileName(booking) });
              if (res.success) toast.success("Email Sent Successfully!", { id: toastId }); else toast.error("Email Failed: " + res.error, { id: toastId });
          } catch (e) { toast.error("Error generating PDF", { id: toastId }); }
      }, 1000);
  };

  // --- AUTH CHECK FOR SETTINGS ---
  const handleTabChange = (tab) => {
      if (tab.startsWith('settings') && !isAdmin) {
          setShowLogin(true);
      } else {
          setActiveTab(tab);
      }
  };

  return (
    <div className="app-container">
      <Toaster position="top-right" />
      
      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} onLogout={() => window.close()} />

      <main className="main-content">
        
        {/* --- FRONT DESK --- */}
        {activeTab === 'frontDesk' && (
          <>
            <div className="toolbar">
              <div className="page-header"><h2>Front Desk</h2><p className="subtitle">Manage bookings and guests</p></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-action" onClick={handleSyncOTA} style={{ borderColor: '#3b82f6', color: '#2563eb' }}>🔄 Sync OTA</button>
                <button className="btn-main" onClick={handleNewBooking}>+ New Booking</button>
              </div>
            </div>
            <BookingTable bookings={bookings} onEdit={handleEditBooking} onDelete={handleDelete} onInvoice={handleInvoice} onEmail={handleEmail} onView={handleViewBooking} initialSearch={autoSearch} onSearchUpdate={(val) => setAutoSearch(val)} />
          </>
        )}
        
        {/* --- ANALYTICS / REPORTS SECTIONS --- */}
        {activeTab === 'reports-trend' && <DashboardStats stats={stats} bookings={bookings} onDrillDown={handleDrillDown} view="trend" />}
        {activeTab === 'reports-source' && <DashboardStats stats={stats} bookings={bookings} onDrillDown={handleDrillDown} view="source" />}
        {activeTab === 'reports-agent' && <DashboardStats stats={stats} bookings={bookings} onDrillDown={handleDrillDown} view="agent" />}
        {activeTab === 'reports-occupancy' && <DashboardStats stats={stats} bookings={bookings} onDrillDown={handleDrillDown} view="occupancy" />}
        
        {/* --- HELP --- */}
        {activeTab === 'help' && <HelpGuide />}

        {/* --- SETTINGS: ROOMS --- */}
        {activeTab === 'settings-rooms' && (
          <div className="settings-container">
            <div className="page-header"><h2>Room Management</h2><p className="subtitle">Configure room numbers and rates</p></div>
            <div className="settings-card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '15px', alignItems: 'end', marginBottom: '25px' }}>
                    <div className="input-group"><label>Room No</label><input value={newRoom.room_no} onChange={e => setNewRoom({...newRoom, room_no:e.target.value})} disabled={!!editingRoomNo} /></div>
                    <div className="input-group"><label>Type</label><input value={newRoom.room_type} onChange={e => setNewRoom({...newRoom, room_type:e.target.value})} /></div>
                    <div className="input-group"><label>Rate</label><input type="number" value={newRoom.rate} onChange={e => setNewRoom({...newRoom, rate:e.target.value})} /></div>
                    <div style={{display:'flex', gap:'5px'}}>
                        <button className="btn-main" onClick={handleSaveRoom} style={{ background:'#1e293b', color:'white', height:'38px' }}>{editingRoomNo ? 'UPDATE' : 'ADD'}</button>
                        {editingRoomNo && <button className="btn-action" onClick={() => { setEditingRoomNo(null); setNewRoom({room_no:'', room_type:'', rate:''}); }} style={{ height: '38px' }}>Cancel</button>}
                    </div>
                </div>
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead>
                        <tr style={{borderBottom:'1px solid #f1f5f9'}}><th style={{padding:'15px', textAlign:'left'}}>ROOM</th><th style={{padding:'15px', textAlign:'left'}}>TYPE</th><th style={{padding:'15px', textAlign:'left'}}>RATE</th><th style={{padding:'15px', textAlign:'center'}}>ACTION</th></tr>
                    </thead>
                    <tbody>
                        {Object.keys(rateCard).map(r => (
                            <tr key={r} style={{borderBottom:'1px solid #f8fafc'}}>
                                <td style={{padding:'15px'}}>{r}</td><td style={{padding:'15px'}}>{rateCard[r].type}</td><td style={{padding:'15px'}}>₹{rateCard[r].rate}</td>
                                <td style={{padding:'15px', textAlign:'center'}}>
                                    <button onClick={()=>handleEditRoom(r)} style={{background:'white', border:'1px solid #e2e8f0', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', marginRight:'5px'}}>✏️</button>
                                    <button onClick={()=>handleDeleteRoom(r)} style={{background:'white', border:'1px solid #e2e8f0', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', color:'#DC2626'}}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}

        {/* --- SETTINGS: OTA CHANNELS --- */}
        {activeTab === 'settings-ota' && (
          <div className="settings-container">
            <div className="page-header"><h2>OTA Channel Manager</h2><p className="subtitle">Connect external booking platforms</p></div>
            <div className="settings-card" style={{ border: '1px solid #93C5FD', background: '#EFF6FF' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', marginBottom: '20px' }}>
                    <div className="input-group"><label>OTA Name</label><input placeholder="e.g. Agoda" value={newOTA.name} onChange={e => setNewOTA({...newOTA, name:e.target.value})} /></div>
                    <div className="input-group"><label>API URL</label><input placeholder="https://api..." value={newOTA.apiUrl} onChange={e => setNewOTA({...newOTA, apiUrl:e.target.value})} /></div>
                    <div className="input-group"><label>API Key</label><input type="password" placeholder="Secret Key" value={newOTA.apiKey} onChange={e => setNewOTA({...newOTA, apiKey:e.target.value})} /></div>
                    <div style={{display:'flex', gap:'5px'}}>
                         <button className="btn-main" onClick={handleSaveOTA} style={{background:'#2563EB'}}>{editingOTA ? 'Update' : 'Add'}</button>
                         {editingOTA && <button className="btn-action" onClick={() => { setEditingOTA(null); setNewOTA({ name: '', apiUrl: '', apiKey: '', hotelId: '', enabled: true }); }}>Cancel</button>}
                    </div>
                </div>
                <table style={{width:'100%', borderCollapse:'collapse', background:'white', borderRadius:'8px', overflow:'hidden'}}>
                    <thead><tr style={{background:'#DBEAFE', color:'#1e3a8a'}}><th style={{padding:'12px', textAlign:'left'}}>Platform</th><th style={{padding:'12px', textAlign:'left'}}>API Endpoint</th><th style={{padding:'12px', textAlign:'center'}}>Status</th><th style={{padding:'12px', textAlign:'center'}}>Actions</th></tr></thead>
                    <tbody>
                        {otaChannels.map(ch => (
                            <tr key={ch.id} style={{borderBottom:'1px solid #EFF6FF'}}>
                                <td style={{padding:'12px', fontWeight:'600'}}>{ch.name}</td>
                                <td style={{padding:'12px', fontSize:'12px', color:'#64748B'}}>{ch.apiUrl}</td>
                                <td style={{padding:'12px', textAlign:'center'}}><span style={{background: ch.enabled ? '#DCFCE7' : '#F1F5F9', color: ch.enabled ? '#166534' : '#64748B', padding:'4px 8px', borderRadius:'12px', fontSize:'11px', fontWeight:'bold'}}>{ch.enabled ? 'Active' : 'Disabled'}</span></td>
                                <td style={{padding:'12px', textAlign:'center'}}>
                                    <button onClick={()=>handleEditOTA(ch)} style={{cursor:'pointer', marginRight:'8px', border:'none', background:'none'}}>✏️</button>
                                    <button onClick={()=>handleDeleteOTA(ch.id)} style={{cursor:'pointer', border:'none', background:'none'}}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}

        {/* --- SETTINGS: DOCUMENTS --- */}
        {activeTab === 'settings-docs' && (
          <div className="settings-container">
            <div className="page-header"><h2>Data & Documents</h2><p className="subtitle">Manage file storage paths</p></div>
            <div className="settings-card">
              <div className="input-group">
                  <label>Guest Documents Path</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop:'10px' }}>
                      <input value={guestDocPath} readOnly style={{ flex: 1, background: '#f1f5f9' }} />
                      <button className="btn-action" onClick={() => { const newPath = prompt("Enter new path:", guestDocPath); if(newPath) setGuestDocPath(newPath); }}>Change Folder</button>
                  </div>
                  <p style={{fontSize:'12px', color:'#64748B', marginTop:'10px'}}>⚠️ Ensure this folder is backed up regularly.</p>
              </div>
              <div style={{ marginTop: '20px', textAlign: 'right' }}><button className="btn-main" onClick={handleUpdateSettings}>Save Configuration</button></div>
            </div>
          </div>
        )}

        {/* --- SETTINGS: SECURITY --- */}
        {activeTab === 'settings-password' && (
          <div className="settings-container">
            <div className="page-header"><h2>Security Settings</h2><p className="subtitle">Update admin credentials</p></div>
            <div className="settings-card">
              <div className="input-group">
                  <label>New Admin Password</label>
                  <input type="password" placeholder="Enter new password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{marginTop:'10px'}} />
              </div>
              <div style={{ marginTop: '20px', textAlign: 'right' }}><button className="btn-main" onClick={handleUpdateSettings}>Update Password</button></div>
            </div>
          </div>
        )}

        {/* --- SETTINGS: BACKUP & RESTORE --- */}
        {activeTab === 'settings-backup' && (
          <div className="settings-container">
            <div className="page-header"><h2>Backup & Recovery</h2><p className="subtitle">Secure your data</p></div>
            
            <div className="settings-card" style={{borderLeft:'4px solid #D4AF37', marginBottom:'25px'}}>
                <h3 style={{color:'#1E293B', marginBottom:'15px', borderBottom:'1px solid #f1f5f9', paddingBottom:'10px'}}>💾 Full System Backup</h3>
                <p style={{fontSize:'14px', color:'#64748B', marginBottom:'20px'}}>
                    Create a complete copy of your database. Use this file to restore the entire system state (rooms, bookings, history) in case of computer failure.
                </p>
                <button className="btn-main" onClick={handleSystemBackup} style={{width:'auto', background:'#1E293B'}}>Create System Backup (.db)</button>
            </div>

            <div className="settings-card">
                <h3 style={{color:'#1E293B', marginBottom:'15px', borderBottom:'1px solid #f1f5f9', paddingBottom:'10px'}}>📤 Data Export (Readable)</h3>
                <p style={{fontSize:'14px', color:'#64748B', marginBottom:'20px'}}>
                    Download your booking history in a readable format for Excel analysis or external auditing.
                </p>
                <div style={{display:'flex', gap:'10px'}}>
                    <button className="btn-action" onClick={() => handleDataExport('csv')}>Export as CSV (Excel)</button>
                    <button className="btn-action" onClick={() => handleDataExport('json')}>Export as JSON</button>
                </div>
            </div>
          </div>
        )}

      </main>

      <BookingModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setAutoSearch(""); }} editingBooking={editingBooking} rateCard={rateCard} allBookings={bookings} onSave={handleSaveBooking} readOnly={isViewOnly} />
      {showLogin && <LoginModal onLogin={async (pwd) => { if(await window.api.checkPassword(pwd)) { setIsAdmin(true); setShowLogin(false); setActiveTab('settings-rooms'); } else toast.error("Invalid"); }} onCancel={() => setShowLogin(false)} />}
      
      {/* Invoice Template (Hidden) */}
      <div className="invoice-hidden-container">
        <div ref={invoiceRef} className="invoice-box" style={{padding:'40px', fontFamily:"'Inter', sans-serif"}}>
            {printBooking && (
                <>
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