import React, { useState, useEffect, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import './App.css';

// --- CONSTANTS ---
const COLORS = ['#D4AF37', '#1E293B', '#F59E0B', '#64748B', '#B45309', '#94A3B8'];
const OTA_LIST = ["Booking.com", "Agoda", "MakeMyTrip", "Goibibo", "Airbnb", "Expedia"];
const ITEMS_PER_PAGE = 10;
const ADMIN_PASS = "admin123"; 

// --- HELPER COMPONENT: COLLAPSIBLE SECTION ---
const Section = ({ title, isOpen, toggle, children }) => {
    return (
        <div className="section-group">
            <div className="section-header" onClick={toggle}>
                <span>{title}</span>
                <span className={`arrow ${isOpen ? 'open' : ''}`}>▼</span>
            </div>
            <div className={`section-content ${isOpen ? '' : 'hidden'}`}>
                {children}
            </div>
        </div>
    );
};

function App() {
  const [activeTab, setActiveTab] = useState('frontDesk');
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [rateCard, setRateCard] = useState({});
  const [drillDownSource, setDrillDownSource] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sections, setSections] = useState({ stay: true, guest: true, billing: true });
  
  // SETTINGS STATE
  const [showLogin, setShowLogin] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  
  // ROOM EDITING STATE
  const [newRoom, setNewRoom] = useState({ room_no: '', room_type: '', rate: '' });
  const [editingRoomNo, setEditingRoomNo] = useState(null); // Tracks which room is being edited

  const toggleSection = (sec) => setSections(prev => ({ ...prev, [sec]: !prev[sec] }));

  const [formData, setFormData] = useState({
    room: '', name: '', mobile: '', email: '', 
    idType: 'Aadhar', idNumber: '',
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: '', days: 1, 
    refBy: 'Walk-in', otaName: '', agentName: '',
    commission: 0, rent: 0, advance: 0, total: 0, due: 0,
    paymentMode: 'Cash', paymentRef: '', savedFilePath: 'No File'
  });
  
  const [file, setFile] = useState(null);
  const [fileMsg, setFileMsg] = useState("");
  const [printData, setPrintData] = useState(null);
  const invoiceRef = useRef();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (window.api) {
        setBookings(await window.api.getBookings());
        setStats(await window.api.getDashboardStats());
        const rates = await window.api.getRates();
        setRateCard(rates);
    }
  };

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentBookings = bookings.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(bookings.length / ITEMS_PER_PAGE);

  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  useEffect(() => {
    if (!editingId && formData.room && rateCard[formData.room]) {
      setFormData(prev => ({ ...prev, rent: rateCard[prev.room].rate }));
    }
  }, [formData.room, rateCard]);

  useEffect(() => {
    const d = parseInt(formData.days) || 0;
    const r = parseFloat(formData.rent) || 0;
    const a = parseFloat(formData.advance) || 0;
    const cDate = new Date(formData.checkIn);
    cDate.setDate(cDate.getDate() + d);
    setFormData(prev => ({
      ...prev, checkOut: cDate.toISOString().split('T')[0],
      total: d * r, due: (d * r) - a
    }));
  }, [formData.checkIn, formData.days, formData.rent, formData.advance]);

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) { setFile(selected); setFileMsg(selected.name); }
  };

  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleSubmit = async () => {
    if (!formData.room || !formData.name) return alert("Room & Name Required");
    let finalSource = formData.refBy;
    if (formData.refBy === 'OTA' && formData.otaName) finalSource = `OTA - ${formData.otaName}`;
    else if (formData.refBy === 'Agent' && formData.agentName) finalSource = `Agent - ${formData.agentName}`;

    let fileBase64 = null, fileExt = null;
    if (file) {
      fileBase64 = await toBase64(file);
      fileExt = file.name.split('.').pop();
    }
    const payload = { ...formData, refBy: finalSource, fileBase64, fileExt };

    if (window.api) {
      if (editingId) {
        await window.api.updateBooking({ ...payload, id: editingId });
        alert("✅ Updated!");
      } else {
        await window.api.addBooking(payload);
        alert("✅ Saved!");
      }
      loadData(); resetForm();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      room: '', name: '', mobile: '', email: '', 
      idType: 'Aadhar', idNumber: '',
      checkIn: new Date().toISOString().split('T')[0], checkOut: '',
      days: 1, refBy: 'Walk-in', otaName: '', agentName: '',
      commission: 0, rent: 0, advance: 0, total: 0, due: 0,
      paymentMode: 'Cash', paymentRef: '', savedFilePath: 'No File'
    });
    setFile(null); setFileMsg(""); 
  };

  const handleEdit = (b) => {
    setEditingId(b.id);
    let source = 'Walk-in', ota = '', agent = '';
    const dbRef = b.refBy || '';
    if (dbRef.startsWith("OTA - ")) { source = 'OTA'; ota = dbRef.replace("OTA - ", ""); } 
    else if (dbRef.startsWith("Agent - ")) { source = 'Agent'; agent = dbRef.replace("Agent - ", ""); } 
    else { source = dbRef || 'Walk-in'; }

    setFormData({ ...b, refBy: source, otaName: ota, agentName: agent, savedFilePath: b.fileBase64 });
    setFile(null); setFileMsg("");
    setActiveTab('frontDesk');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(confirm("Delete this booking?")) {
      if(window.api) await window.api.deleteBooking(id);
      loadData();
    }
  };

  const getFileName = (b) => `SwarnaVilla_Inv_${b.name.replace(/\s/g,'_')}_${b.room}_${b.checkIn}.pdf`;

  const generatePDF = (b) => {
    setPrintData(b);
    setTimeout(() => {
        const element = invoiceRef.current;
        const opt = {
            margin:       0, 
            filename:     getFileName(b),
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 4, useCORS: true, letterRendering: true }, 
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    }, 200);
  };

  const handleEmail = (b) => {
    if(!b.email) return alert("Guest has no email address!");
    if(!confirm(`Send invoice to ${b.email}?`)) return;
    setPrintData(b);
    setTimeout(async () => {
        const opt = { margin: 0, filename: getFileName(b), image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 4, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
        const pdfBase64 = await html2pdf().set(opt).from(invoiceRef.current).outputPdf('datauristring');
        if(window.api) {
            const res = await window.api.sendEmail({
                to: b.email, subject: `Invoice - Stay at Swarna Villa (${b.checkIn})`,
                body: `Dear ${b.name},\n\nPlease find attached the invoice for your stay in Room ${b.room}.\n\nThank you,\nSwarna Villa`,
                pdfBase64: pdfBase64, fileName: getFileName(b) 
            });
            if(res.success) alert("✅ Email Sent Successfully!"); else alert("❌ Email Failed: " + res.error);
        }
    }, 500); 
  };

  // --- SETTINGS & ROOM LOGIC ---
  const handleSettingsClick = () => {
      if (isAdmin) { setActiveTab('settings'); } 
      else { setShowLogin(true); }
  };

  const handleLogin = () => {
      if (passwordInput === ADMIN_PASS) {
          setIsAdmin(true); setShowLogin(false); setActiveTab('settings');
      } else { alert("❌ Wrong Password!"); }
  };

  // START EDITING ROOM
  const startEditRoom = (roomNo) => {
      const room = rateCard[roomNo];
      setNewRoom({ room_no: roomNo, room_type: room.type, rate: room.rate });
      setEditingRoomNo(roomNo); // Activate Edit Mode
  };

  // CANCEL EDITING
  const cancelEditRoom = () => {
      setNewRoom({ room_no: '', room_type: '', rate: '' });
      setEditingRoomNo(null);
  };

  // SAVE OR UPDATE ROOM
  const handleSaveRoom = async () => {
      if(!newRoom.room_no || !newRoom.room_type || !newRoom.rate) return alert("Fill all fields");
      
      if(window.api) {
          try {
              if (editingRoomNo) {
                  // UPDATE EXISTING
                  await window.api.updateRoom(newRoom);
                  alert("✅ Room Updated!");
              } else {
                  // ADD NEW
                  await window.api.addRoom(newRoom);
                  alert("✅ Room Added!");
              }
              cancelEditRoom(); // Reset Form
              loadData(); // Refresh list
          } catch(e) { alert("Error saving room (ID might exist)"); }
      }
  };

  const handleDeleteRoom = async (roomNo) => {
      if(confirm(`Delete Room ${roomNo}?`)) {
          if(window.api) {
              await window.api.deleteRoom(roomNo);
              loadData();
          }
      }
  };

  return (
    <div className="container">
      {/* LOGIN MODAL */}
      {showLogin && (
          <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000}}>
              <div style={{background:'white', padding:'30px', borderRadius:'8px', width:'300px', textAlign:'center'}}>
                  <h3>🔒 Admin Login</h3>
                  <input type="password" placeholder="Enter Password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} style={{width:'100%', padding:'10px', marginBottom:'15px', border:'1px solid #ccc', borderRadius:'4px'}}/>
                  <div style={{display:'flex', gap:'10px'}}>
                      <button className="btn-main" onClick={handleLogin}>Login</button>
                      <button className="btn-action" onClick={()=>setShowLogin(false)}>Cancel</button>
                  </div>
              </div>
          </div>
      )}

      <header>
        <div className="header-title"><h1><span>Swarna</span> Villa PMS</h1></div>
        <div className="nav-tabs">
            <button className={activeTab==='frontDesk'?'active':''} onClick={()=>setActiveTab('frontDesk')}>Front Desk</button>
            <button className={activeTab==='reports'?'active':''} onClick={()=>{loadData(); setActiveTab('reports'); setDrillDownSource(null);}}>📊 Reports & P&L</button>
            <button className={activeTab==='settings'?'active':''} onClick={handleSettingsClick}>⚙️ Settings</button>
        </div>
      </header>

      {/* ================= TAB 1: FRONT DESK ================= */}
      {activeTab === 'frontDesk' && (
        <>
            <div className="form-section">
                <Section title="🏨 Stay Information" isOpen={sections.stay} toggle={() => toggleSection('stay')}>
                    <div className="input-group"><label>Room Selection</label>
                        <select name="room" value={formData.room || ''} onChange={handleInputChange}>
                            <option value="">-- Select Room --</option>
                            {Object.keys(rateCard).map(r => <option key={r} value={r}>{r} - {rateCard[r].type}</option>)}
                        </select>
                    </div>
                    <div className="input-group"><label>Check-In Date</label><input type="date" name="checkIn" value={formData.checkIn || ''} onChange={handleInputChange}/></div>
                    <div className="input-group"><label>Duration (Days)</label><input type="number" name="days" value={formData.days || ''} onChange={handleInputChange}/></div>
                    <div className="input-group"><label>Check-Out (Auto)</label><input type="date" value={formData.checkOut || ''} readOnly style={{backgroundColor: '#f1f5f9'}}/></div>
                </Section>
                <Section title="👤 Guest Identity & Documents" isOpen={sections.guest} toggle={() => toggleSection('guest')}>
                    <div className="input-group"><label>Full Name</label><input name="name" value={formData.name || ''} onChange={handleInputChange}/></div>
                    <div className="input-group"><label>Mobile Number</label><input name="mobile" value={formData.mobile || ''} onChange={handleInputChange}/></div>
                    <div className="input-group"><label>Email Address</label><input name="email" value={formData.email || ''} onChange={handleInputChange}/></div>
                    <div className="input-group"><label>ID Type</label>
                        <select name="idType" value={formData.idType || 'Aadhar'} onChange={handleInputChange}><option>Aadhar</option><option>Passport</option><option>Driving License</option><option>PAN Card</option></select>
                    </div>
                    <div className="input-group"><label>ID Number</label><input name="idNumber" value={formData.idNumber || ''} onChange={handleInputChange}/></div>
                    <div className="input-group" style={{gridColumn: "1 / -1"}}> 
                        <label>Upload ID Document</label>
                        <div style={{border: '2px dashed #cbd5e1', padding: '15px', borderRadius: '6px', textAlign: 'center', backgroundColor:'#f8fafc', position:'relative'}}>
                            <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} style={{width:'100%', cursor:'pointer'}}/>
                            <div style={{marginTop:'10px', fontSize:'13px', fontWeight:'600'}}>
                                {file ? (<span style={{color:'#15803d'}}>✅ Selected: {fileMsg}</span>) : (editingId && formData.savedFilePath && formData.savedFilePath !== "No File") ? (<span style={{color:'var(--primary)'}}>📂 Existing Document Saved</span>) : (<span style={{color:'#94a3b8'}}>No file selected</span>)}
                            </div>
                        </div>
                    </div>
                </Section>
                <Section title="💰 Billing & Source" isOpen={sections.billing} toggle={() => toggleSection('billing')}>
                    <div className="input-group"><label>Source Type</label><select name="refBy" value={formData.refBy || 'Walk-in'} onChange={handleInputChange}><option>Walk-in</option><option>OTA</option><option>Agent</option></select></div>
                    {formData.refBy === 'OTA' && <div className="input-group"><label>Select Platform</label><select name="otaName" value={formData.otaName || ''} onChange={handleInputChange}><option value="">-- Select OTA --</option>{OTA_LIST.map(ota => <option key={ota} value={ota}>{ota}</option>)}</select></div>}
                    {formData.refBy === 'Agent' && <div className="input-group"><label>Agent Name</label><input name="agentName" placeholder="Name..." value={formData.agentName || ''} onChange={handleInputChange}/></div>}
                    <div className="input-group"><label>Rent / Night</label><input type="number" name="rent" value={formData.rent || ''} onChange={handleInputChange}/></div>
                    <div className="input-group"><label>Commission</label><input type="number" name="commission" value={formData.commission || ''} onChange={handleInputChange}/></div>
                    <div className="input-group"><label>Advance Paid</label><input type="number" name="advance" value={formData.advance || ''} onChange={handleInputChange}/></div>
                    <div className="input-group"><label>Payment Mode</label><select name="paymentMode" value={formData.paymentMode || 'Cash'} onChange={handleInputChange}><option>Cash</option><option>UPI</option></select></div>
                    <div className="input-group"><label>Total Bill</label><input value={formData.total || 0} readOnly style={{backgroundColor:'#e2e8f0'}}/></div>
                    <div className="input-group"><label style={{color: formData.due > 0 ? 'red' : 'green'}}>Due Amount</label><input value={formData.due || 0} readOnly style={{fontWeight:'bold', color: formData.due > 0 ? 'red' : 'green'}}/></div>
                </Section>
                <button className={editingId ? "btn btn-update" : "btn btn-main"} onClick={handleSubmit} style={{marginTop:'10px'}}>{editingId ? "Update Booking" : "+ Check-In Guest"}</button>
            </div>
            <div className="table-card">
                <table><thead><tr><th>Room</th><th>Name</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{currentBookings.map(b => (
                        <tr key={b.id}>
                            <td>{b.room}</td><td>{b.name}</td><td><strong>{b.refBy}</strong></td><td style={{color: b.due>0?'#b91c1c':'#15803d', fontWeight:'bold'}}>{b.due>0 ? `Due: ₹${b.due}` : 'Paid'}</td>
                            <td className="action-buttons"><button className="btn-action" onClick={() => generatePDF(b)} title="Download Invoice">⬇️</button><button className="btn-action" onClick={() => handleEmail(b)} title="Send Email">✉️</button><button className="btn-action btn-edit" onClick={() => handleEdit(b)} title="Edit">✏️</button><button className="btn-action btn-del" onClick={() => handleDelete(b.id)} title="Delete">🗑️</button></td>
                        </tr>
                    ))}</tbody>
                </table>
                {bookings.length > ITEMS_PER_PAGE && (<div className="pagination"><button onClick={prevPage} disabled={currentPage === 1}>Previous</button><span>Page {currentPage} of {totalPages}</span><button onClick={nextPage} disabled={currentPage === totalPages}>Next</button></div>)}
            </div>
        </>
      )}

      {/* ================= TAB 2: REPORTS ================= */}
      {activeTab === 'reports' && stats && (
        <div className="reports-container">
            {!drillDownSource && (
                <>
                    <div className="kpi-grid">
                        <div className="kpi-card"><h3>Total Revenue</h3><p className="kpi-value">₹{stats.summary.totalRevenue.toLocaleString()}</p></div>
                        <div className="kpi-card"><h3>Net Profit</h3><p className="kpi-value">₹{stats.summary.netProfit.toLocaleString()}</p></div>
                        <div className="kpi-card"><h3>Pending Dues</h3><p className="kpi-value">₹{stats.summary.totalDue.toLocaleString()}</p></div>
                        <div className="kpi-card"><h3>Total Bookings</h3><p className="kpi-value">{stats.summary.totalBookings}</p></div>
                    </div>
                    <div className="charts-grid">
                        <div className="chart-card"><h3>💰 Monthly Revenue</h3><div style={{ width: '100%', height: 300 }}><ResponsiveContainer><BarChart data={stats.pnlData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/><Bar dataKey="revenue" fill="#D4AF37"/><Bar dataKey="profit" fill="#1E293B"/></BarChart></ResponsiveContainer></div></div>
                        <div className="chart-card"><h3>🌍 Bookings by Source</h3><div style={{ width: '100%', height: 300 }}><ResponsiveContainer><PieChart><Pie data={stats.sourceData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label onClick={(d) => setDrillDownSource(d.name)} cursor="pointer">{stats.sourceData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></div>
                    </div>
                </>
            )}
            {drillDownSource && (
                <div className="drill-down-view"><div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}><h2>🔍 {drillDownSource} Details</h2><button className="btn-main" onClick={() => setDrillDownSource(null)} style={{padding:'8px 15px'}}>⬅ Back</button></div><div className="table-card"><table><thead><tr><th>Guest</th><th>Source</th><th>Room</th><th>Amount</th><th>Status</th></tr></thead><tbody>{bookings.filter(b => (b.refBy||'').startsWith(drillDownSource)).map(b => <tr key={b.id}><td>{b.name}</td><td>{b.refBy}</td><td>{b.room}</td><td>₹{b.total}</td><td>{b.due>0?'Pending':'Paid'}</td></tr>)}</tbody></table></div></div>
            )}
        </div>
      )}

      {/* ================= TAB 3: SETTINGS ================= */}
      {activeTab === 'settings' && isAdmin && (
          <div className="settings-container" style={{maxWidth:'800px', margin:'0 auto'}}>
              <h2 style={{color:'var(--secondary)'}}>⚙️ Room Management</h2>
              <p style={{marginBottom:'20px'}}>Manage the rooms available in the Front Desk dropdown.</p>

              {/* Add/Edit Room Form */}
              <div className="form-section" style={{background:'white', padding:'20px', borderRadius:'8px', border:'1px solid #e2e8f0', marginBottom:'30px'}}>
                  <h3 style={{marginTop:0}}>{editingRoomNo ? `Edit Room ${editingRoomNo}` : 'Add New Room'}</h3>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 2fr 1fr', gap:'15px', alignItems:'end'}}>
                      <div className="input-group">
                        <label>Room No</label>
                        {/* Disabled when editing to prevent ID changes */}
                        <input placeholder="e.g. 301" value={newRoom.room_no} onChange={e=>setNewRoom({...newRoom, room_no: e.target.value})} disabled={!!editingRoomNo} style={editingRoomNo ? {backgroundColor:'#e2e8f0', cursor:'not-allowed'} : {}} />
                      </div>
                      <div className="input-group">
                        <label>Description</label>
                        <input placeholder="e.g. Sea View Suite" value={newRoom.room_type} onChange={e=>setNewRoom({...newRoom, room_type: e.target.value})}/>
                      </div>
                      <div className="input-group">
                        <label>Rate (₹)</label>
                        <input type="number" placeholder="3500" value={newRoom.rate} onChange={e=>setNewRoom({...newRoom, rate: e.target.value})}/>
                      </div>
                  </div>
                  
                  <div style={{marginTop:'20px', display:'flex', gap:'10px'}}>
                    <button className={editingRoomNo ? "btn-update" : "btn-main"} style={{width:'auto'}} onClick={handleSaveRoom}>
                        {editingRoomNo ? "Update Room" : "+ Add Room"}
                    </button>
                    {editingRoomNo && (
                        <button className="btn-action" style={{fontSize:'16px'}} onClick={cancelEditRoom}>Cancel</button>
                    )}
                  </div>
              </div>

              {/* Room List Table */}
              <div className="table-card">
                  <table>
                      <thead><tr><th>Room No</th><th>Type</th><th>Rate</th><th>Action</th></tr></thead>
                      <tbody>
                          {Object.keys(rateCard).map(r => (
                              <tr key={r}>
                                  <td><strong>{r}</strong></td>
                                  <td>{rateCard[r].type}</td>
                                  <td>₹{rateCard[r].rate}</td>
                                  <td>
                                      <button className="btn-action btn-edit" onClick={()=>startEditRoom(r)} title="Edit Room">✏️</button>
                                      <button className="btn-action btn-del" onClick={()=>handleDeleteRoom(r)} title="Delete Room">🗑️</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
      
      {/* INVOICE TEMPLATE */}
      <div className="invoice-hidden-container"><div ref={invoiceRef} className="invoice-box">
         {printData && (
             <>
             <div className="invoice-header"><div className="company-details"><h1>SWARNA VILLA</h1><p>123, Sea Beach Road, Puri, Odisha - 752001</p><p>Phone: +91 98765 43210 | Email: info@swarnavilla.com</p></div><div className="invoice-meta"><h2>INVOICE</h2><p><strong>Ref #:</strong> INV-{new Date().getFullYear()}-{printData.id.toString().padStart(4, '0')}</p><p><strong>Date:</strong> {new Date().toLocaleDateString()}</p><p><strong>Status:</strong> {printData.due > 0 ? <span style={{color:'red'}}>Unpaid</span> : <span style={{color:'green'}}>Paid</span>}</p></div></div>
             <div className="guest-grid"><div className="guest-col"><h3>Bill To</h3><p><strong>{printData.name}</strong></p><p>{printData.mobile}</p><p>{printData.email}</p></div><div className="guest-col"><h3>Stay Details</h3><p><strong>Room:</strong> {printData.room}</p><p><strong>Check-In:</strong> {printData.checkIn}</p><p><strong>Check-Out:</strong> {printData.checkOut}</p><p><strong>Total Nights:</strong> {printData.days}</p></div></div>
             <table className="invoice-table"><thead><tr><th>Description</th><th style={{textAlign:'center'}}>Rate</th><th style={{textAlign:'center'}}>Days</th><th style={{textAlign:'right'}}>Amount</th></tr></thead><tbody><tr><td>Room Charges - {printData.room}</td><td style={{textAlign:'center'}}>₹{printData.rent}</td><td style={{textAlign:'center'}}>{printData.days}</td><td className="amount">₹{printData.total.toLocaleString()}</td></tr></tbody></table>
             <div className="totals-section"><table className="totals-table"><tr><td>Subtotal:</td><td>₹{printData.total.toLocaleString()}</td></tr><tr><td>Less: Advance Paid:</td><td style={{color:'#ef4444'}}>- ₹{printData.advance.toLocaleString()}</td></tr><tr className="total-row"><td>Total Due:</td><td>₹{printData.due.toLocaleString()}</td></tr></table></div>
             <div className="invoice-footer"><p><strong>Terms & Conditions:</strong> Check-out time is 11:00 AM. Payment is due upon presentation.</p><p>This is a computer-generated invoice and does not require a signature.</p><p>Thank you for choosing Swarna Villa!</p></div>
             </>
         )}
      </div></div>
    </div>
  );
}

export default App;