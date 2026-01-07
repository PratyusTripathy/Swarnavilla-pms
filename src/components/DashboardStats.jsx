import React, { useMemo, useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid 
} from 'recharts';

const COLORS = ['#D4AF37', '#1E293B', '#F59E0B', '#64748B', '#10B981', '#EF4444'];
const LINE_COLORS = { OTA: '#F59E0B', Agent: '#1E293B', WalkIn: '#10B981' };

export default function DashboardStats({ stats, bookings, onDrillDown }) {
    if (!bookings || !stats) return <div style={{padding:'20px'}}>Loading Statistics...</div>;

    const dashboardRef = useRef(null);

    // --- 1. STATE: REPORT FILTER (Default to Current Month) ---
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return now.toISOString().slice(0, 7); // Format: "YYYY-MM"
    });

    // Helper to get Year and Month from state
    const { filterYear, filterMonth, monthName } = useMemo(() => {
        const date = new Date(selectedDate + "-01"); 
        return {
            filterYear: date.getFullYear(),
            filterMonth: date.getMonth(),
            monthName: date.toLocaleString('default', { month: 'long', year: 'numeric' })
        };
    }, [selectedDate]);

    const renderLabel = ({ name, value }) => `${name}: ${value}`;

    // --- 2. FILTERED DATASETS ---
    
    // A. BOOKINGS FOR THE SELECTED MONTH
    const monthBookings = useMemo(() => {
        return bookings.filter(b => {
            if (!b.checkIn) return false;
            const d = new Date(b.checkIn);
            return d.getFullYear() === filterYear && d.getMonth() === filterMonth;
        });
    }, [bookings, filterYear, filterMonth]);

    // B. BOOKINGS FOR THE SELECTED YEAR
    const yearBookings = useMemo(() => {
        return bookings.filter(b => {
            if (!b.checkIn) return false;
            const d = new Date(b.checkIn);
            return d.getFullYear() === filterYear;
        });
    }, [bookings, filterYear]);

    // --- 3. DYNAMIC CALCULATIONS ---

    const monthlySummary = useMemo(() => {
        return monthBookings.reduce((acc, b) => {
            const total = parseFloat(b.total || 0);
            const comm = parseFloat(b.commission || 0);
            const due = parseFloat(b.due || 0);
            
            acc.revenue += total;
            acc.commission += comm;
            acc.netProfit += (total - comm);
            acc.pendingDue += due;
            acc.count += 1;
            return acc;
        }, { revenue: 0, commission: 0, netProfit: 0, pendingDue: 0, count: 0 });
    }, [monthBookings]);

    const dailyCollection = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        return bookings.reduce((acc, b) => {
            const bDate = b.createdAt ? b.createdAt.slice(0, 10) : '';
            if (bDate === today) {
                const amount = parseFloat(b.advance || 0); 
                if (b.paymentMode === 'Cash') acc.Cash += amount;
                else if (b.paymentMode === 'UPI') acc.UPI += amount;
                else if (b.paymentMode === 'Card') acc.Card += amount;
                acc.Total += amount;
            }
            return acc;
        }, { Cash: 0, UPI: 0, Card: 0, Total: 0 });
    }, [bookings]);

    const agentStats = useMemo(() => {
        const map = {};
        monthBookings.forEach(b => {
            if (b.refBy && b.refBy !== 'Walk-in') {
                if (!map[b.refBy]) map[b.refBy] = { name: b.refBy, revenue: 0, commission: 0, bookings: 0 };
                map[b.refBy].revenue += parseFloat(b.total || 0);
                map[b.refBy].commission += parseFloat(b.commission || 0);
                map[b.refBy].bookings += 1;
            }
        });
        return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    }, [monthBookings]);

    const trendData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => ({
            name: new Date(filterYear, i).toLocaleString('default', { month: 'short' }),
            OTA: 0, Agent: 0, WalkIn: 0
        }));

        yearBookings.forEach(b => {
            const date = new Date(b.checkIn);
            const monthIdx = date.getMonth();
            const ref = (b.refBy || 'Walk-in').toLowerCase();

            if (ref.includes('ota')) months[monthIdx].OTA += 1;
            else if (ref.includes('agent')) months[monthIdx].Agent += 1;
            else months[monthIdx].WalkIn += 1;
        });

        return months;
    }, [yearBookings, filterYear]);

    const yearPnLData = useMemo(() => {
        if(!stats.pnlData) return [];
        return stats.pnlData.filter(d => d.name.startsWith(filterYear.toString()));
    }, [stats.pnlData, filterYear]);

    // --- 4. EXPORT HANDLERS ---
    
    // 📄 EXPORT PDF
    const handleExportPDF = () => {
        const element = dashboardRef.current;
        const opt = {
            margin: 5,
            filename: `Report_${selectedDate}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 }, // Higher scale = better chart quality
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save();
    };

    // 📊 EXPORT EXCEL
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary & KPIs
        const summaryData = [
            ["Swarna Villa - Monthly Report", monthName],
            [],
            ["Metric", "Value"],
            ["Total Revenue", monthlySummary.revenue],
            ["Net Profit", monthlySummary.netProfit],
            ["Commission Paid", monthlySummary.commission],
            ["Pending Dues (This Month)", monthlySummary.pendingDue],
            ["Total Bookings", monthlySummary.count],
            [],
            ["Today's Collection", new Date().toLocaleDateString()],
            ["Cash", dailyCollection.Cash],
            ["UPI", dailyCollection.UPI],
            ["Card", dailyCollection.Card],
            ["TOTAL", dailyCollection.Total]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Overview");

        // Sheet 2: Agent Performance
        const agentData = agentStats.map(a => ({
            "Source": a.name,
            "Bookings": a.bookings,
            "Revenue": a.revenue,
            "Commission": a.commission
        }));
        const wsAgents = XLSX.utils.json_to_sheet(agentData);
        XLSX.utils.book_append_sheet(wb, wsAgents, "Agent Performance");

        // Sheet 3: Detailed Bookings List
        const bookingData = monthBookings.map(b => ({
            "Booking ID": b.id,
            "Guest Name": b.name,
            "Mobile": b.mobile,
            "Room": b.room,
            "Check In": b.checkIn ? b.checkIn.split('T')[0] : '',
            "Check Out": b.checkOut ? b.checkOut.split('T')[0] : '',
            "Source": b.refBy,
            "Total Bill": b.total,
            "Advance": b.advance,
            "Due": b.due,
            "Status": b.due > 0 ? 'Unpaid' : 'Paid'
        }));
        const wsBookings = XLSX.utils.json_to_sheet(bookingData);
        XLSX.utils.book_append_sheet(wb, wsBookings, "Detailed Bookings");

        // Save File
        XLSX.writeFile(wb, `Report_${selectedDate}.xlsx`);
    };

    return (
        <div className="reports-container" ref={dashboardRef}>
            {/* --- HEADER CONTROLS --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }} data-html2canvas-ignore="true">
                <div>
                    <h2 style={{ margin: 0, color: '#1E293B' }}>Dashboard & Reports</h2>
                    <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Overview for <strong style={{color:'#D4AF37'}}>{monthName}</strong></p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{display:'flex', gap:'5px'}}>
                        <button onClick={handleExportPDF} className="btn-action" style={{border:'1px solid #ef4444', color:'#ef4444'}}>📄 PDF</button>
                        <button onClick={handleExportExcel} className="btn-action" style={{border:'1px solid #16a34a', color:'#16a34a'}}>📊 Excel</button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft:'1px solid #e2e8f0', paddingLeft:'15px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>Period:</label>
                        <input 
                            type="month" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{ 
                                padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', 
                                fontFamily: 'Inter, sans-serif', fontWeight: '500', cursor:'pointer' 
                            }} 
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card"><h3>Revenue ({monthName})</h3><p>₹{monthlySummary.revenue.toLocaleString()}</p></div>
                <div className="kpi-card"><h3>Net Profit ({monthName})</h3><p>₹{monthlySummary.netProfit.toLocaleString()}</p></div>
                <div className="kpi-card"><h3>Pending Dues</h3><p style={{color:'#b91c1c'}}>₹{monthlySummary.pendingDue.toLocaleString()}</p></div>
                <div className="kpi-card"><h3>Bookings ({monthName})</h3><p>{monthlySummary.count}</p></div>
            </div>

            {/* Middle Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '20px' }}>
                <div className="chart-card" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <h3 style={{color:'#166534'}}>💵 Today's Collection (Live)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                        <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #DCFCE7', paddingBottom:'5px'}}>
                            <span>Cash</span> <strong>₹{dailyCollection.Cash.toLocaleString()}</strong>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #DCFCE7', paddingBottom:'5px'}}>
                            <span>UPI</span> <strong>₹{dailyCollection.UPI.toLocaleString()}</strong>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #DCFCE7', paddingBottom:'5px'}}>
                            <span>Card</span> <strong>₹{dailyCollection.Card.toLocaleString()}</strong>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'1.2rem', fontWeight:'bold', color:'#166534', marginTop:'5px'}}>
                            <span>TOTAL</span> <span>₹{dailyCollection.Total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="chart-card">
                    <h3>📅 Monthly Revenue ({filterYear})</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={yearPnLData.length > 0 ? yearPnLData : [{name: 'No Data', revenue:0, profit:0}]}>
                            <XAxis dataKey="name" tickFormatter={(val) => {
                                const d = new Date(val + "-01");
                                return !isNaN(d) ? d.toLocaleString('default', {month:'short'}) : val;
                            }} />
                            <YAxis />
                            <Tooltip formatter={(value) => `₹${value}`} />
                            <Legend />
                            <Bar dataKey="revenue" fill="#D4AF37" name="Revenue" />
                            <Bar dataKey="profit" fill="#1E293B" name="Profit" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- 📈 TREND LINE CHART --- */}
            <div className="chart-card" style={{ marginBottom: '20px' }}>
                <h3>📈 Booking Source Trends ({filterYear})</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend iconType="circle" />
                        <Line type="monotone" dataKey="OTA" stroke={LINE_COLORS.OTA} strokeWidth={3} dot={{r:4}} activeDot={{r:6}} name="OTAs" />
                        <Line type="monotone" dataKey="Agent" stroke={LINE_COLORS.Agent} strokeWidth={3} dot={{r:4}} activeDot={{r:6}} name="Agents" />
                        <Line type="monotone" dataKey="WalkIn" stroke={LINE_COLORS.WalkIn} strokeWidth={3} dot={{r:4}} activeDot={{r:6}} name="Walk-Ins" />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Bottom Row */}
            <div className="charts-grid">
                <div className="chart-card" style={{ overflowX: 'auto' }}>
                    <h3>🤝 Agent Performance ({monthName})</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                            <tr>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Source</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>Bkgs</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Rev</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Comm.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agentStats.length > 0 ? agentStats.map((agent, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '10px', fontWeight: '500' }}>{agent.name}</td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>{agent.bookings}</td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>₹{agent.revenue.toLocaleString()}</td>
                                    <td style={{ padding: '10px', textAlign: 'right', color: '#DC2626' }}>₹{agent.commission.toLocaleString()}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" style={{padding:'20px', textAlign:'center', color:'#94a3b8'}}>No bookings found for {monthName}.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="chart-card">
                    <h3>🌍 Booking Distribution (All Time)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={stats.sourceData} cx="50%" cy="50%" labelLine={true} label={renderLabel} outerRadius={80} fill="#8884d8" dataKey="value"
                                onClick={(data) => { if(data && data.name) onDrillDown(data.name); }}
                                style={{ cursor: 'pointer' }}
                            >
                                {stats.sourceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{cursor:'pointer'}} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}