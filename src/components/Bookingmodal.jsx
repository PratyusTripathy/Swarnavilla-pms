import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const OTA_LIST = ["Booking.com", "Agoda", "MakeMyTrip", "Goibibo", "Airbnb", "Expedia"];

export default function BookingModal({ isOpen, onClose, editingBooking, rateCard, allBookings, onSave }) {
    if (!isOpen) return null;

    const [formData, setFormData] = useState(initialState());
    const [file, setFile] = useState(null);
    const [filePreview, setFilePreview] = useState("");

    function initialState() {
        // Default: 1 Day Stay from NOW
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return {
            room: '', name: '', mobile: '', email: '', 
            idType: 'Aadhar', idNumber: '',
            checkIn: now.toISOString().slice(0, 16), 
            checkOut: tomorrow.toISOString().slice(0, 16), 
            days: 1, rent: 0, advance: 0, 
            paymentMode: 'Cash', sourceType: 'Walk-in', sourceName: '', 
            commission: 0, // ✅ Commission initialized
            savedFilePath: 'No File'
        };
    }

    useEffect(() => {
        if (editingBooking) {
            let sType = 'Walk-in';
            let sName = '';
            const ref = editingBooking.refBy || '';
            
            if (ref.startsWith('OTA - ')) { sType = 'OTA'; sName = ref.replace('OTA - ', ''); }
            else if (ref.startsWith('Agent - ')) { sType = 'Agent'; sName = ref.replace('Agent - ', ''); }
            
            setFormData({ 
                ...editingBooking,
                sourceType: sType,
                sourceName: sName,
                checkIn: editingBooking.checkIn ? editingBooking.checkIn.slice(0, 16) : '',
                checkOut: editingBooking.checkOut ? editingBooking.checkOut.slice(0, 16) : '',
                savedFilePath: editingBooking.fileBase64 || 'No File'
            });
            
            if (editingBooking.fileBase64 && editingBooking.fileBase64 !== "No File") {
                setFilePreview("📂 Existing File Attached");
            } else {
                setFilePreview("");
            }
        } else {
            setFormData(initialState());
            setFile(null);
            setFilePreview("");
        }
    }, [editingBooking, isOpen]);

    // --- HANDLERS ---
    
    const handleRoomChange = (e) => {
        const r = e.target.value;
        const rate = rateCard[r] ? rateCard[r].rate : 0;
        setFormData(prev => ({ ...prev, room: r, rent: rate }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- 🕒 DATE VALIDATION & AUTO-CALCULATION ---

    // 1. When Check-In Changes: Shift Check-Out to maintain 'Days' duration
    const handleCheckInChange = (e) => {
        const newCheckIn = e.target.value;
        if (!newCheckIn) return;

        const inDate = new Date(newCheckIn);
        const days = parseInt(formData.days) || 1;
        const outDate = new Date(inDate.getTime() + (days * 24 * 60 * 60 * 1000));
        
        setFormData(prev => ({
            ...prev,
            checkIn: newCheckIn,
            checkOut: outDate.toISOString().slice(0, 16)
        }));
    };

    // 2. When Check-Out Changes: Recalculate 'Days'
    const handleCheckOutChange = (e) => {
        const newCheckOut = e.target.value;
        setFormData(prev => ({ ...prev, checkOut: newCheckOut }));

        if (formData.checkIn && newCheckOut) {
            const inDate = new Date(formData.checkIn);
            const outDate = new Date(newCheckOut);
            
            if (outDate > inDate) {
                const diffTime = Math.abs(outDate - inDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                setFormData(prev => ({ ...prev, days: diffDays }));
            }
        }
    };

    // 3. When 'Days' Changes: Update Check-Out Date
    const handleDaysChange = (e) => {
        const newDays = parseInt(e.target.value) || 1;
        setFormData(prev => ({ ...prev, days: newDays }));

        if (formData.checkIn) {
            const inDate = new Date(formData.checkIn);
            const outDate = new Date(inDate.getTime() + (newDays * 24 * 60 * 60 * 1000));
            setFormData(prev => ({ ...prev, checkOut: outDate.toISOString().slice(0, 16) }));
        }
    };

    const handleCheckOutNow = () => {
        const now = new Date();
        const checkInDate = new Date(formData.checkIn);
        
        // Validation: Ensure checkout is after checkin
        if (now <= checkInDate) {
            toast.error("Cannot checkout before check-in time!");
            return;
        }

        const diffTime = Math.abs(now - checkInDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const finalDays = diffDays > 0 ? diffDays : 1;

        setFormData(prev => ({
            ...prev,
            checkOut: now.toISOString().slice(0, 16),
            days: finalDays
        }));
    };

    const handleMobileBlur = () => {
        if (!formData.mobile || !allBookings) return;
        const existing = allBookings.find(b => b.mobile === formData.mobile);
        if (existing) {
            if(window.confirm(`Guest Found: ${existing.name}\nAuto-fill details?`)) {
                setFormData(prev => ({ 
                    ...prev, 
                    name: existing.name, 
                    email: existing.email || prev.email, 
                    idType: existing.idType || prev.idType, 
                    idNumber: existing.idNumber || prev.idNumber,
                    savedFilePath: existing.fileBase64 || "No File"
                }));
                if (existing.fileBase64 && existing.fileBase64 !== "No File") {
                    setFilePreview("📂 Previous File Found");
                }
            }
        }
    };

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) { setFile(selected); setFilePreview(`📄 ${selected.name}`); }
    };

    const handleSubmit = async () => {
        // --- VALIDATION START ---
        if (!formData.checkOut) {
            toast.error("Check-out date is required");
            return;
        }
        if (new Date(formData.checkOut) <= new Date(formData.checkIn)) {
            toast.error("Check-out time must be greater than Check-in time!");
            return;
        }
        // --- VALIDATION END ---

        const total = parseInt(formData.days || 0) * parseInt(formData.rent || 0);
        const due = total - parseInt(formData.advance || 0);
        
        let finalRef = 'Walk-in';
        if (formData.sourceType === 'OTA') finalRef = `OTA - ${formData.sourceName}`;
        if (formData.sourceType === 'Agent') finalRef = `Agent - ${formData.sourceName}`;

        let fileData = formData.savedFilePath;
        let fileExt = null;

        if (file) {
            const toBase64 = (f) => new Promise((resolve, reject) => { 
                const reader = new FileReader(); 
                reader.readAsDataURL(f); 
                reader.onload = () => resolve(reader.result); 
                reader.onerror = error => reject(error); 
            });
            fileData = await toBase64(file); 
            fileExt = file.name.split('.').pop();
        }

        onSave({ 
            ...formData, 
            total, 
            due, 
            refBy: finalRef, 
            fileBase64: fileData, 
            fileExt: fileExt 
        });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>{editingBooking ? "Edit Booking / Checkout" : "New Booking"}</h3>
                    <button onClick={onClose} style={{background:'none', border:'none', fontSize:'1.5rem', cursor:'pointer'}}>✖</button>
                </div>
                
                <div className="modal-body">
                    {/* --- SECTION 1: STAY DETAILS --- */}
                    <h4 style={{gridColumn:'1/-1', borderBottom:'1px solid #eee', marginTop:'0', color:'#475569'}}>🏨 Stay Details</h4>
                    
                    <div className="input-group">
                        <label>Room</label>
                        <select name="room" value={formData.room} onChange={handleRoomChange}>
                            <option value="">Select Room</option>
                            {Object.keys(rateCard).map(r => <option key={r} value={r}>{r} ({rateCard[r].type})</option>)}
                        </select>
                    </div>
                    
                    {/* DATE INPUTS */}
                    <div className="input-group">
                        <label>Check-In Date</label>
                        <input type="datetime-local" name="checkIn" value={formData.checkIn} onChange={handleCheckInChange} />
                    </div>
                    
                    {/* CHECKOUT MANAGER */}
                    <div className="input-group" style={{gridColumn: '1 / -1', background: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', alignItems: 'end'}}>
                        <div style={{gridColumn: '1 / -1', fontSize:'0.85rem', fontWeight:'bold', color:'#166534', marginBottom:'-10px'}}>CHECKOUT MANAGER</div>
                        <div>
                            <label>Check-Out Date</label>
                            <input type="datetime-local" name="checkOut" value={formData.checkOut} onChange={handleCheckOutChange} />
                        </div>
                        <div>
                            <label>Total Days</label>
                            <input type="number" name="days" value={formData.days} onChange={handleDaysChange} min="1" />
                        </div>
                        <button type="button" onClick={handleCheckOutNow} className="btn-main" style={{background:'#16a34a', color:'white', height:'42px', fontSize:'0.9rem'}}>
                            Set to NOW
                        </button>
                    </div>

                    <div className="input-group">
                        <label>Rent (₹)</label>
                        <input type="number" name="rent" value={formData.rent} onChange={handleChange} />
                    </div>

                    {/* --- SECTION 2: GUEST DETAILS --- */}
                    <h4 style={{gridColumn:'1/-1', borderBottom:'1px solid #eee', marginTop:'10px', color:'#475569'}}>👤 Guest Details</h4>
                    
                    <div className="input-group">
                        <label>Mobile</label>
                        <input name="mobile" value={formData.mobile} onChange={handleChange} onBlur={handleMobileBlur} placeholder="Search..." />
                    </div>
                    <div className="input-group">
                        <label>Name</label>
                        <input name="name" value={formData.name} onChange={handleChange} />
                    </div>
                    
                    {/* EMAIL FIELD */}
                    <div className="input-group">
                        <label>Email</label>
                        <input name="email" value={formData.email} onChange={handleChange} placeholder="For invoice emailing" />
                    </div>

                    <div className="input-group">
                        <label>ID Type</label>
                        <select name="idType" value={formData.idType} onChange={handleChange}>
                            <option>Aadhar</option><option>Passport</option><option>Driving License</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>ID Number</label>
                        <input name="idNumber" value={formData.idNumber} onChange={handleChange} />
                    </div>
                    <div className="input-group" style={{gridColumn: '1 / -1'}}>
                        <label>Upload ID</label>
                        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                            <input type="file" onChange={handleFileChange} />
                            <span style={{fontSize:'0.8rem', color:'green', fontWeight:'600'}}>{filePreview}</span>
                        </div>
                    </div>

                    {/* --- SECTION 3: BILLING --- */}
                    <h4 style={{gridColumn:'1/-1', borderBottom:'1px solid #eee', marginTop:'10px', color:'#475569'}}>💰 Billing</h4>
                    
                    <div className="input-group">
                        <label>Source</label>
                        <select name="sourceType" value={formData.sourceType} onChange={handleChange}>
                            <option>Walk-in</option><option>OTA</option><option>Agent</option>
                        </select>
                    </div>
                    
                    {formData.sourceType === 'OTA' && (
                        <div className="input-group">
                            <label>OTA Name</label>
                            <select name="sourceName" value={formData.sourceName} onChange={handleChange}>
                                <option value="">Select OTA</option>
                                {OTA_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    )}
                    
                    {formData.sourceType === 'Agent' && (
                        <div className="input-group">
                            <label>Agent Name</label>
                            <input name="sourceName" value={formData.sourceName} onChange={handleChange} placeholder="Agent Name" />
                        </div>
                    )}

                    {/* ✅ ADDED COMMISSION FIELD */}
                    <div className="input-group">
                        <label>Commission (₹)</label>
                        <input 
                            type="number" 
                            name="commission" 
                            value={formData.commission} 
                            onChange={handleChange} 
                            placeholder="0"
                        />
                    </div>

                    <div className="input-group">
                        <label>Advance Paid</label>
                        <input type="number" name="advance" value={formData.advance} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                        <label>Payment Mode</label>
                        <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}>
                            <option>Cash</option><option>UPI</option><option>Card</option>
                        </select>
                    </div>
                </div>

                <div className="modal-footer">
                    <div style={{marginRight:'auto', fontWeight:'bold', fontSize:'1.1rem', color: ((parseInt(formData.days||0)*parseInt(formData.rent||0)) - parseInt(formData.advance||0)) > 0 ? '#b91c1c' : '#166534'}}>
                        Total Due: ₹{(parseInt(formData.days || 0)*parseInt(formData.rent || 0)) - parseInt(formData.advance || 0)}
                    </div>
                    <button className="btn-action" onClick={onClose}>Cancel</button>
                    <button className="btn-main" onClick={handleSubmit}>Save & Close</button>
                </div>
            </div>
        </div>
    );
}