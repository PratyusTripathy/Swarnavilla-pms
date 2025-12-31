import React, { useState, useEffect, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import './App.css';

const RATE_CARD = {
  "101": { type: "Super Deluxe Room", rate: 3000 },
  "102": { type: "Super Deluxe Room", rate: 3000 },
  "301": { type: "Deluxe Non-AC Room", rate: 2000 },
  "302": { type: "Deluxe Non-AC Room", rate: 2000 },
  "201": { type: "Swarna Family Suite", rate: 5000 },
  "202": { type: "Swarna Family Suite", rate: 5000 },
};

function App() {
  const [bookings, setBookings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    room: '', name: '', mobile: '', email: '', 
    idType: 'Aadhar', idNumber: '',
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: '', days: 1, 
    refBy: 'Walk-in', commission: 0,
    rent: 0, advance: 0, total: 0, due: 0,
    paymentMode: 'Cash', paymentRef: '',
    savedFilePath: 'No File'
  });
  
  const [file, setFile] = useState(null);
  const [fileMsg, setFileMsg] = useState(""); // NEW: To show file status
  const [printData, setPrintData] = useState(null);
  const invoiceRef = useRef();

  useEffect(() => { loadBookings(); }, []);

  // --- LOGIC ---
  useEffect(() => {
    if (!editingId && formData.room && RATE_CARD[formData.room]) {
      setFormData(prev => ({ ...prev, rent: RATE_CARD[prev.room].rate }));
    }
  }, [formData.room]);

  useEffect(() => {
    const d = parseInt(formData.days) || 0;
    const r = parseFloat(formData.rent) || 0;
    const a = parseFloat(formData.advance) || 0;
    const cDate = new Date(formData.checkIn);
    cDate.setDate(cDate.getDate() + d);
    
    setFormData(prev => ({
      ...prev,
      checkOut: cDate.toISOString().split('T')[0],
      total: d * r,
      due: (d * r) - a
    }));
  }, [formData.checkIn, formData.days, formData.rent, formData.advance]);

  const loadBookings = async () => {
    if (window.api) setBookings(await window.api.getBookings());
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) {
        setFile(selected);
        setFileMsg(`✅ Selected: ${selected.name}`);
    }
  };

  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleSubmit = async () => {
    if (!formData.room || !formData.name) return alert("Room & Name Required");

    let fileBase64 = null, fileExt = null;
    if (file) {
      fileBase64 = await toBase64(file);
      fileExt = file.name.split('.').pop();
    }

    if (window.api) {
      if (editingId) {
        await window.api.updateBooking({ ...formData, id: editingId, fileBase64, fileExt });
        alert("✅ Booking Updated Successfully!");
      } else {
        const res = await window.api.addBooking({ ...formData, fileBase64, fileExt });
        
        // NEW: Explicit Upload Confirmation
        if(res.savedFilePath && res.savedFilePath !== "No File") {
            alert(`✅ Booking Saved & File Uploaded Successfully!\nLocation: ${res.savedFilePath}`);
        } else {
            alert("✅ Booking Saved (No File Attached)");
        }
      }
      
      loadBookings();
      resetForm();
    }
  };

  const handleEdit = (b) => {
    setEditingId(b.id);
    setFormData({ ...b, savedFilePath: b.fileBase64 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(confirm("Delete this booking permanently?")) {
      if(window.api) await window.api.deleteBooking(id);
      loadBookings();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      room: '', name: '', mobile: '', email: '', 
      idType: 'Aadhar', idNumber: '',
      checkIn: new Date().toISOString().split('T')[0], checkOut: '',
      days: 1, refBy: 'Walk-in', commission: 0, 
      rent: 0, advance: 0, total: 0, due: 0,
      paymentMode: 'Cash', paymentRef: '',
      savedFilePath: 'No File'
    });
    setFile(null);
    setFileMsg("");
  };

  // --- PDF & EMAIL ---
  const generatePDF = (b) => {
    setPrintData(b);
    setTimeout(() => {
      const cleanName = b.name.replace(/\s+/g, '_');
      html2pdf().from(invoiceRef.current).set({
        margin: 0, filename: `invoice_${b.room}_${cleanName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' }
      }).save();
    }, 100);
  };

  const sendEmailWithAttachment = async (b) => {
    if (!b.email) return alert("Please add an email address first.");
    setPrintData(b);
    setTimeout(async () => {
      const element = invoiceRef.current;
      const worker = html2pdf().from(element).set({
        margin: 0, image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' }
      }).outputPdf('blob');
      const pdfBlob = await worker;
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        if (window.api) {
          alert("Sending email...");
          const res = await window.api.sendEmail({
            to: b.email,
            subject: `Invoice - Swarna Villa Room ${b.room}`,
            body: `Dear ${b.name},\n\nPlease find attached invoice.\n\nSwarna Villa`,
            pdfBase64: reader.result,
            fileName: `Invoice_${b.id}.pdf`
          });
          alert(res.success ? "✅ Email Sent!" : "❌ Failed to send.");
        }
      };
    }, 500);
  };

  return (
    <div className="container">
      {/* --- INVOICE TEMPLATE (UPDATED) --- */}
      <div className="invoice-hidden-container">
        <div ref={invoiceRef} className="invoice-box">
            {printData && (
                <>
                <div className="inv-header">
                    <div className="inv-brand"><h2>Swarna <span>Villa</span></h2><p>Station Road, Puri</p></div>
                    <div className="inv-title"><h1>INVOICE</h1><p>#{printData.id}</p></div>
                </div>
                <div className="inv-grid">
                    <div className="inv-col"><h3>Bill To</h3><p>{printData.name}</p><p>{printData.email}</p></div>
                    <div className="inv-col" style={{textAlign:'right'}}><h3>Details</h3><p>Room: {printData.room}</p><p>In: {printData.checkIn}</p></div>
                </div>
                <table className="inv-table">
                    <thead><tr><th>Desc</th><th style={{textAlign:'right'}}>Amt</th></tr></thead>
                    <tbody><tr><td>Room Charges ({printData.days} days)</td><td style={{textAlign:'right'}}>{printData.total}</td></tr></tbody>
                </table>
                <div className="inv-totals">
                    <table><tbody>
                        <tr><td>Subtotal</td><td>{printData.total}</td></tr>
                        <tr><td>Advance</td><td>-{printData.advance}</td></tr>
                        <tr className="inv-total-row"><td>Total Due</td><td>{printData.due}</td></tr>
                    </tbody></table>
                </div>
                
                {/* NEW: PAYMENT DETAILS SECTION ON INVOICE */}
                <div style={{marginTop:'30px', borderTop:'1px dashed #ccc', paddingTop:'10px'}}>
                    <h4 style={{fontSize:'12px', color:'#666'}}>Payment History</h4>
                    <p style={{fontSize:'13px'}}>
                        <strong>Paid via:</strong> {printData.paymentMode} 
                        {printData.paymentRef && <span> (Ref: {printData.paymentRef})</span>}
                    </p>
                </div>
                </>
            )}
        </div>
      </div>

      <header>
        <div className="header-title"><h1><span>Swarna</span> Villa PMS</h1></div>
        {editingId && <button className="btn" style={{background:'#f59e0b', width:'auto'}} onClick={resetForm}>Cancel Edit</button>}
      </header>

      <div className="form-section">
        <div className="input-grid">
          {/* Guest Info */}
          <div className="section-title">Guest Info</div>
          <div className="input-group">
            <label>Room</label>
            <select name="room" value={formData.room} onChange={handleInputChange}>
              <option value="">Select</option>
              <option value="101">101 - Super Deluxe</option>
              <option value="102">102 - Super Deluxe</option>
              <option value="201">201 - Suite</option>
              <option value="202">202 - Suite</option>
              <option value="301">301 - Deluxe Non-AC</option>
              <option value="302">302 - Deluxe Non-AC</option>
            </select>
          </div>
          <div className="input-group"><label>Name</label><input name="name" value={formData.name} onChange={handleInputChange}/></div>
          <div className="input-group"><label>Mobile</label><input name="mobile" value={formData.mobile} onChange={handleInputChange}/></div>
          <div className="input-group"><label>Email</label><input name="email" value={formData.email} onChange={handleInputChange}/></div>

          {/* ID & Upload */}
          <div className="section-title">Identity & Source</div>
          <div className="input-group">
            <label>ID Type</label>
            <select name="idType" value={formData.idType} onChange={handleInputChange}>
                <option>Aadhar</option><option>PAN</option><option>Passport</option>
            </select>
          </div>
          <div className="input-group"><label>ID Number</label><input name="idNumber" value={formData.idNumber} onChange={handleInputChange}/></div>
          
          <div className="input-group">
             <label>Upload Scan</label>
             <input type="file" onChange={handleFileSelect} />
             {/* NEW: File Status Message */}
             {fileMsg && <small style={{color:'green', display:'block', fontSize:'11px'}}>{fileMsg}</small>}
          </div>
          
          <div className="input-group">
            <label>Source</label>
            <select name="refBy" value={formData.refBy} onChange={handleInputChange}>
                <option>Walk-in</option><option>OTA</option><option>Agent</option>
            </select>
          </div>
          <div className="input-group"><label>Commission</label><input type="number" name="commission" value={formData.commission} onChange={handleInputChange}/></div>

          {/* Payment */}
          <div className="section-title">Stay & Payment</div>
          <div className="input-group"><label>Check-In</label><input type="date" name="checkIn" value={formData.checkIn} onChange={handleInputChange}/></div>
          <div className="input-group"><label>Days</label><input type="number" name="days" value={formData.days} onChange={handleInputChange}/></div>
          <div className="input-group"><label>Rate</label><input type="number" name="rent" value={formData.rent} onChange={handleInputChange}/></div>
          <div className="input-group"><label>Advance</label><input type="number" name="advance" value={formData.advance} onChange={handleInputChange}/></div>
          
          <div className="input-group">
            <label>Pay Mode</label>
            <select name="paymentMode" value={formData.paymentMode} onChange={handleInputChange}>
                <option>Cash</option><option>UPI</option><option>Card</option><option>Transfer</option>
            </select>
          </div>
          <div className="input-group"><label>Txn Ref #</label><input name="paymentRef" placeholder="e.g. UPI ID" value={formData.paymentRef} onChange={handleInputChange}/></div>
          <div className="input-group"><label>Due</label><input value={formData.due} readOnly style={{color: formData.due>0?'red':'green', fontWeight:'bold'}}/></div>
        </div>

        <button className={editingId ? "btn btn-update" : "btn btn-main"} onClick={handleSubmit}>
            {editingId ? "Update Booking" : "+ Save Booking"}
        </button>
      </div>

      <div className="table-card">
         <table>
            <thead><tr><th>ID</th><th>Room</th><th>Name</th><th>Pay Mode</th><th>Due</th><th>Actions</th></tr></thead>
            <tbody>
               {bookings.map(b => (
                 <tr key={b.id}>
                    <td>#{b.id}</td>
                    <td>{b.room}</td>
                    <td>{b.name}<br/><small>{b.mobile}</small></td>
                    <td>{b.paymentMode}<br/><small>{b.paymentRef}</small></td>
                    <td style={{color: b.due>0?'red':'green'}}>{b.due}</td>
                    <td>
                        <button className="btn-action btn-print" onClick={() => generatePDF(b)}>⬇️</button>
                        <button className="btn-action" style={{background:'#dbeafe', color:'#1e40af'}} onClick={() => sendEmailWithAttachment(b)}>✉️</button>
                        <button className="btn-action btn-edit" onClick={() => handleEdit(b)}>✏️</button>
                        <button className="btn-action btn-del" onClick={() => handleDelete(b.id)}>🗑️</button>
                    </td>
                 </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
}

export default App;