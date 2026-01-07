import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const OTA_LIST = ["Booking.com", "Agoda", "MakeMyTrip", "Goibibo", "Airbnb", "Expedia"];

export default function BookingModal({ isOpen, onClose, editingBooking, rateCard, allBookings, onSave, readOnly = false }) {
    if (!isOpen) return null;

    const [formData, setFormData] = useState(initialState());
    const [file, setFile] = useState(null);
    const [filePreview, setFilePreview] = useState("");
    const [conflict, setConflict] = useState(null);
    
    // Calendar State
    const [showCalendar, setShowCalendar] = useState(false);
    const [viewDate, setViewDate] = useState(new Date()); 
    const calendarRef = useRef(null);

    function initialState() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        now.setHours(12, 0, 0, 0);
        tomorrow.setHours(11, 0, 0, 0);

        return {
            room: '', name: '', mobile: '', email: '', 
            idType: 'Aadhar', idNumber: '',
            checkIn: formatDateTimeLocal(now), 
            checkOut: formatDateTimeLocal(tomorrow), 
            days: 1, rent: 0, advance: 0, 
            paymentMode: 'Cash', sourceType: 'Walk-in', sourceName: '', 
            commission: 0,
            savedFilePath: 'No File'
        };
    }

    function formatDateTimeLocal(date) {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
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
            setFilePreview(editingBooking.fileBase64 && editingBooking.fileBase64 !== "No File" ? "📂 Existing File Attached" : "");
        } else {
            setFormData(initialState());
            setFile(null);
            setFilePreview("");
        }
    }, [editingBooking, isOpen]);

    // Close calendar on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                setShowCalendar(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [calendarRef]);

    // Conflict Detection
    useEffect(() => {
        if (!formData.room || !formData.checkIn || !formData.checkOut || !allBookings) {
            setConflict(null);
            return;
        }
        const start = new Date(formData.checkIn);
        const end = new Date(formData.checkOut);
        
        const found = allBookings.find(b => {
            if (editingBooking && b.id === editingBooking.id) return false;
            if (b.room !== formData.room) return false;
            if (b.due === 0 && b.checkOut && new Date(b.checkOut) < new Date()) return false;

            const bStart = new Date(b.checkIn);
            const bEnd = new Date(b.checkOut);
            return start < bEnd && end > bStart;
        });
        setConflict(found ? found : null);
    }, [formData.room, formData.checkIn, formData.checkOut, allBookings]);

    // --- HANDLERS ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRoomChange = (e) => {
        const r = e.target.value;
        const rate = rateCard[r] ? rateCard[r].rate : 0;
        setFormData(prev => ({ ...prev, room: r, rent: rate }));
    };

    const handleCheckInChange = (e) => {
        const newCheckIn = e.target.value;
        if (!newCheckIn) return;
        const inDate = new Date(newCheckIn);
        const days = parseInt(formData.days) || 1;
        const outDate = new Date(inDate.getTime() + (days * 24 * 60 * 60 * 1000));
        setFormData(prev => ({ ...prev, checkIn: newCheckIn, checkOut: formatDateTimeLocal(outDate) }));
    };

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

    const handleDaysChange = (e) => {
        const newDays = parseInt(e.target.value) || 1;
        setFormData(prev => ({ ...prev, days: newDays }));
        if (formData.checkIn) {
            const inDate = new Date(formData.checkIn);
            const outDate = new Date(inDate.getTime() + (newDays * 24 * 60 * 60 * 1000));
            setFormData(prev => ({ ...prev, checkOut: formatDateTimeLocal(outDate) }));
        }
    };

    const handleCheckOutNow = () => {
        const now = new Date();
        setFormData(prev => ({ ...prev, checkOut: formatDateTimeLocal(now) }));
        if(formData.checkIn) {
             const inDate = new Date(formData.checkIn);
             const diffTime = Math.abs(now - inDate);
             const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
             setFormData(prev => ({ ...prev, days: diffDays }));
        }
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
                    setFilePreview("📂 Document Found");
                }
            }
        }
    };

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) { setFile(selected); setFilePreview(`📄 New: ${selected.name}`); }
    };

    const handleSubmit = async () => {
        if(conflict) {
            if(!window.confirm(`⚠️ WARNING: Room ${formData.room} is ALREADY BOOKED.\n\nProceed anyway?`)) return;
        }
        if (!formData.room) return toast.error("Please select a room");
        
        const total = parseInt(formData.days || 0) * parseInt(formData.rent || 0);
        const due = total - parseInt(formData.advance || 0);
        
        let finalRef = 'Walk-in';
        if (formData.sourceType === 'OTA') finalRef = `OTA - ${formData.sourceName}`;
        if (formData.sourceType === 'Agent') finalRef = `Agent - ${formData.sourceName}`;

        let fileData = formData.savedFilePath;
        let fileExt = null;

        if (file) {
            const toBase64 = (f) => new Promise((resolve, reject) => { 
                const reader = new FileReader(); reader.readAsDataURL(f); reader.onload = () => resolve(reader.result); reader.onerror = error => reject(error); 
            });
            fileData = await toBase64(file); 
            fileExt = file.name.split('.').pop();
        }

        onSave({ ...formData, total, due, refBy: finalRef, fileBase64: fileData, fileExt: fileExt });
    };

    // Calendar Handlers
    const handleCalendarDateClick = (day) => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const selectedDate = new Date(year, month, day, 12, 0, 0);
        
        const days = parseInt(formData.days) || 1;
        const outDate = new Date(selectedDate.getTime() + (days * 24 * 60 * 60 * 1000));
        
        setFormData(prev => ({ 
            ...prev, 
            checkIn: formatDateTimeLocal(selectedDate), 
            checkOut: formatDateTimeLocal(outDate) 
        }));
        
        setShowCalendar(false);
    };

    const changeMonth = (offset) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(viewDate.getMonth() + offset);
        setViewDate(newDate);
    };

    const renderCalendarPopup = () => {
        if (!formData.room) return <div className="calendar-popup" style={{padding:'10px', color:'red'}}>⚠️ Select a Room First</div>;
        
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay(); 
        
        const grid = [];
        for (let i = 0; i < firstDayOfWeek; i++) grid.push(<div key={`empty-${i}`} className="cal-day empty"></div>);

        for(let d=1; d<=daysInMonth; d++) {
            const currentDay = new Date(year, month, d);
            const isBooked = allBookings && allBookings.some(b => {
                if (b.room !== formData.room) return false;
                if (editingBooking && b.id === editingBooking.id) return false;
                const bStart = new Date(b.checkIn); bStart.setHours(0,0,0,0);
                const bEnd = new Date(b.checkOut); bEnd.setHours(0,0,0,0);
                return currentDay >= bStart && currentDay < bEnd;
            });
            const selectedStart = new Date(formData.checkIn);
            const isSelected = selectedStart.getDate() === d && selectedStart.getMonth() === month && selectedStart.getFullYear() === year;
            const status = isBooked ? 'booked' : isSelected ? 'selected' : 'available';

            grid.push(
                <div key={d} className={`cal-day ${status}`} onClick={() => !isBooked && handleCalendarDateClick(d)} title={isBooked ? "Occupied" : "Select Check-In"}>
                    {d}
                </div>
            );
        }

        return (
            <div className="calendar-popup" ref={calendarRef}>
                <div className="cal-header">
                    <button type="button" onClick={() => changeMonth(-1)}>&lt;</button>
                    <span>{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    <button type="button" onClick={() => changeMonth(1)}>&gt;</button>
                </div>
                <div className="cal-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
                <div className="cal-grid">{grid}</div>
                <div className="cal-legend"><span><span className="dot booked"></span> Booked</span><span><span className="dot selected"></span> Selected</span><span><span className="dot available"></span> Free</span></div>
            </div>
        );
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>{readOnly ? "View Booking Details" : (editingBooking ? "Edit Booking" : "New Booking")}</h3>
                    <button onClick={onClose} style={{background:'none', border:'none', fontSize:'1.5rem', cursor:'pointer'}}>✖</button>
                </div>
                
                <div className="modal-body">
                    {/* ✅ FIELDSET: This is what physically disables the inputs */}
                    <fieldset disabled={readOnly} style={{border:'none', padding:0, margin:0, display:'contents'}}>
                        
                        <h4 style={{gridColumn:'1/-1', borderBottom:'1px solid #eee', marginTop:'0', color:'#475569'}}>🏨 Stay Details</h4>
                        
                        <div className="input-group">
                            <label>Room</label>
                            <select name="room" value={formData.room} onChange={handleRoomChange}>
                                <option value="">Select Room</option>
                                {Object.keys(rateCard).map(r => <option key={r} value={r}>{r} ({rateCard[r].type})</option>)}
                            </select>
                        </div>
                        
                        <div className="input-group" style={{position:'relative'}}>
                            <label>Check-In Date</label>
                            <input 
                                type="datetime-local" name="checkIn" value={formData.checkIn} onChange={handleCheckInChange} 
                                onFocus={() => !readOnly && setShowCalendar(true)} 
                                autoComplete="off"
                            />
                            {showCalendar && !readOnly && renderCalendarPopup()}
                        </div>

                        {conflict && (
                            <div style={{gridColumn:'1/-1', background:'#FEE2E2', border:'1px solid #DC2626', color:'#B91C1C', padding:'10px', borderRadius:'6px', display:'flex', alignItems:'center', gap:'10px', fontSize:'0.9rem'}}>
                                <span style={{fontSize:'1.5rem'}}>⚠️</span>
                                <div><strong>Conflict!</strong> Room {formData.room} is booked by <u>{conflict.name}</u> until {new Date(conflict.checkOut).toLocaleDateString()}.</div>
                            </div>
                        )}
                        
                        <div className="input-group" style={{gridColumn: '1 / -1', background: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', alignItems: 'end'}}>
                            <div style={{gridColumn: '1 / -1', fontSize:'0.85rem', fontWeight:'bold', color:'#166534', marginBottom:'-10px'}}>CHECKOUT MANAGER</div>
                            <div><label>Check-Out Date</label><input type="datetime-local" name="checkOut" value={formData.checkOut} onChange={handleCheckOutChange} /></div>
                            <div><label>Total Days</label><input type="number" name="days" value={formData.days} onChange={handleDaysChange} min="1" /></div>
                            {!readOnly && <button type="button" onClick={handleCheckOutNow} className="btn-main" style={{background:'#16a34a', color:'white', height:'42px', fontSize:'0.9rem'}}>Set to NOW</button>}
                        </div>

                        <div className="input-group"><label>Rent (₹)</label><input type="number" name="rent" value={formData.rent} onChange={handleChange} /></div>

                        <h4 style={{gridColumn:'1/-1', borderBottom:'1px solid #eee', marginTop:'10px', color:'#475569'}}>👤 Guest Details</h4>
                        <div className="input-group"><label>Mobile</label><input name="mobile" value={formData.mobile} onChange={handleChange} onBlur={handleMobileBlur} placeholder="Search..." /></div>
                        <div className="input-group"><label>Name</label><input name="name" value={formData.name} onChange={handleChange} /></div>
                        <div className="input-group"><label>Email</label><input name="email" value={formData.email} onChange={handleChange} placeholder="For invoice" /></div>
                        <div className="input-group"><label>ID Type</label><select name="idType" value={formData.idType} onChange={handleChange}><option>Aadhar</option><option>Passport</option><option>Driving License</option></select></div>
                        <div className="input-group"><label>ID Number</label><input name="idNumber" value={formData.idNumber} onChange={handleChange} /></div>
                        <div className="input-group" style={{gridColumn: '1 / -1'}}><label>Upload ID</label><div style={{display:'flex', gap:'10px', alignItems:'center'}}><input type="file" onChange={handleFileChange} /><span style={{fontSize:'0.8rem', color:'green', fontWeight:'600'}}>{filePreview}</span></div></div>

                        <h4 style={{gridColumn:'1/-1', borderBottom:'1px solid #eee', marginTop:'10px', color:'#475569'}}>💰 Billing</h4>
                        <div className="input-group"><label>Source</label><select name="sourceType" value={formData.sourceType} onChange={handleChange}><option>Walk-in</option><option>OTA</option><option>Agent</option></select></div>
                        {formData.sourceType === 'OTA' && <div className="input-group"><label>OTA Name</label><select name="sourceName" value={formData.sourceName} onChange={handleChange}><option value="">Select OTA</option>{OTA_LIST.map(o => <option key={o} value={o}>{o}</option>)}</select></div>}
                        {formData.sourceType === 'Agent' && <div className="input-group"><label>Agent Name</label><input name="sourceName" value={formData.sourceName} onChange={handleChange} placeholder="Agent Name" /></div>}
                        <div className="input-group"><label>Commission (₹)</label><input type="number" name="commission" value={formData.commission} onChange={handleChange} placeholder="0"/></div>
                        <div className="input-group"><label>Advance Paid</label><input type="number" name="advance" value={formData.advance} onChange={handleChange} /></div>
                        <div className="input-group"><label>Payment Mode</label><select name="paymentMode" value={formData.paymentMode} onChange={handleChange}><option>Cash</option><option>UPI</option><option>Card</option></select></div>
                    
                    </fieldset>
                </div>

                <div className="modal-footer">
                    <div style={{marginRight:'auto', fontWeight:'bold', fontSize:'1.1rem', color: ((parseInt(formData.days||0)*parseInt(formData.rent||0)) - parseInt(formData.advance||0)) > 0 ? '#b91c1c' : '#166534'}}>
                        Due: ₹{(parseInt(formData.days || 0)*parseInt(formData.rent || 0)) - parseInt(formData.advance || 0)}
                    </div>
                    
                    {/* ✅ FOOTER LOGIC: Hide Save button in View Mode */}
                    {readOnly ? (
                        <button className="btn-main" onClick={onClose}>Close</button>
                    ) : (
                        <>
                            <button className="btn-action" onClick={onClose}>Cancel</button>
                            <button className="btn-main" onClick={handleSubmit} disabled={!!conflict} style={{opacity: conflict ? 0.5 : 1, cursor: conflict ? 'not-allowed' : 'pointer'}}>
                                {conflict ? "⚠️ Conflict" : "Save & Close"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}