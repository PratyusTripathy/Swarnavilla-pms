import React, { useMemo, useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid 
} from 'recharts';

const COLORS = ['#D4AF37', '#1E293B', '#F59E0B', '#64748B', '#10B981', '#EF4444'];
const LINE_COLORS = { OTA: '#F59E0B', Agent: '#1E293B', WalkIn: '#10B981' };

export default function DashboardStats({ stats, bookings, onDrillDown, view = 'trend' }) {
    if (!bookings || !stats) return <div style={{padding:'20px'}}>Loading Statistics...</div>;

    const dashboardRef = useRef(null);
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

    // --- HELPER: Date Calculations ---
    const { filterYear, filterMonth, monthName } = useMemo(() => {
        const date = new Date(selectedDate + "-01"); 
        return {
            filterYear: date.getFullYear(),
            filterMonth: date.getMonth(),
            monthName: date.toLocaleString('default', { month: 'long', year: 'numeric' })
        };
    }, [selectedDate]);

    // --- DATA FILTERS ---
    const monthBookings = useMemo(() => bookings.filter(b => {
        if (!b.checkIn) return false;
        const d = new Date(b.checkIn);
        return d.getFullYear() === filterYear && d.getMonth() === filterMonth;
    }), [bookings, filterYear, filterMonth]);

    const yearBookings = useMemo(() => bookings.filter(b => {
        if (!b.checkIn) return false;
        return new Date(b.checkIn).getFullYear() === filterYear;
    }), [bookings, filterYear]);

    // --- DATA PROCESSING FOR VIEWS ---

    // 1. Trend Data (Line Chart)
    const trendData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => ({
            name: new Date(filterYear, i).toLocaleString('default', { month: 'short' }),
            OTA: 0, Agent: 0, WalkIn: 0
        }));
        yearBookings.forEach(b => {
            const monthIdx = new Date(b.checkIn).getMonth();
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

    // 3. Agent Performance Data
    const agentStats = useMemo(() => {
        const map = {};
        monthBookings.forEach(b => {
            if (b.refBy) {
                const key = b.refBy;
                if (!map[key]) map[key] = { name: key, revenue: 0, commission: 0, bookings: 0 };
                map[key].revenue += parseFloat(b.total || 0);
                map[key].commission += parseFloat(b.commission || 0);
                map[key].bookings += 1;
            }
        });
        return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    }, [monthBookings]);

    // 4. Room Occupancy Data
    const occupancyStats = useMemo(() => {
        const map = {};
        monthBookings.forEach(b => {
            // Clean room name "Unassigned (Type)" -> "Type"
            let roomName = b.room;
            if(roomName.includes('Unassigned')) {
                const match = roomName.match(/\(([^)]+)\)/);
                roomName = match ? match[1] : roomName;
            }
            if (!map[roomName]) map[roomName] = { name: roomName, nights: 0, revenue: 0 };
            map[roomName].nights += parseInt(b.days) || 1;
            map[roomName].revenue += parseFloat(b.total) || 0;
        });
        return Object.values(map).sort((a, b) => b.nights - a.nights);
    }, [monthBookings]);

    // --- COMMON HEADER ---
    const Header = ({ title, sub }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <div><h2 style={{margin:0, color:'#1E293B'}}>{title}</h2><p style={{margin:0, color:'#64748B', fontSize:'14px'}}>{sub}</p></div>
            <div style={{display:'flex', gap:'10px'}}>
                <input type="month" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
                <button onClick={() => window.print()} className="btn-action" style={{border:'1px solid #64748B'}}>🖨️</button>
            </div>
        </div>
    );

    // ================= VIEWS =================

    // VIEW 1: TREND ANALYSIS
    if (view === 'trend') return (
        <div className="reports-container" ref={dashboardRef}>
            <Header title="📈 Trend Analysis" sub={`Revenue & Booking Trends for ${filterYear}`} />
            
            <div className="charts-grid" style={{gridTemplateColumns: '1fr'}}>
                {/* Line Chart */}
                <div className="chart-card">
                    <h3>Booking Source Trends ({filterYear})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="OTA" stroke={LINE_COLORS.OTA} strokeWidth={3} />
                            <Line type="monotone" dataKey="Agent" stroke={LINE_COLORS.Agent} strokeWidth={3} />
                            <Line type="monotone" dataKey="WalkIn" stroke={LINE_COLORS.WalkIn} strokeWidth={3} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Bar Chart */}
                <div className="chart-card">
                    <h3>Monthly Revenue ({filterYear})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={yearPnLData.length > 0 ? yearPnLData : [{name:'No Data', revenue:0}]}>
                            <XAxis dataKey="name" tickFormatter={(val) => {
                                const d = new Date(val + "-01");
                                return !isNaN(d) ? d.toLocaleString('default', {month:'short'}) : val;
                            }} />
                            <YAxis />
                            <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                            <Legend />
                            <Bar dataKey="revenue" fill="#D4AF37" name="Revenue" />
                            <Bar dataKey="profit" fill="#1E293B" name="Net Profit" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );

    // VIEW 2: SOURCE BREAKDOWN
    if (view === 'source') return (
        <div className="reports-container" ref={dashboardRef}>
            <Header title="🧩 Source Breakdown" sub="Distribution by Booking Channel" />
            <div className="chart-card" style={{height:'500px'}}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={stats.sourceData} cx="50%" cy="50%" labelLine={true} 
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={150} fill="#8884d8" dataKey="value"
                            onClick={(data) => { if(data && data.name) onDrillDown(data.name); }}
                            style={{ cursor: 'pointer' }}
                        >
                            {stats.sourceData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );

    // VIEW 3: AGENT PERFORMANCE
    if (view === 'agent') return (
        <div className="reports-container" ref={dashboardRef}>
            <Header title="🏆 Agent Performance" sub={`Top performers for ${monthName}`} />
            <div className="chart-card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'left' }}>Agent / Source</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>Bookings</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Revenue</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Commission</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agentStats.map((agent, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '15px', fontWeight: '500' }}>
                                    {i<3 ? ['🥇','🥈','🥉'][i] : ''} {agent.name}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{agent.bookings}</td>
                                <td style={{ padding: '15px', textAlign: 'right', fontWeight:'bold', color:'#16A34A' }}>₹{agent.revenue.toLocaleString()}</td>
                                <td style={{ padding: '15px', textAlign: 'right', color:'#DC2626' }}>₹{agent.commission.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // VIEW 4: ROOM OCCUPANCY
    if (view === 'occupancy') return (
        <div className="reports-container" ref={dashboardRef}>
            <Header title="🛏️ Room Occupancy" sub={`Most popular rooms for ${monthName}`} />
            <div style={{ display: 'grid', gap: '15px' }}>
                {occupancyStats.map((room, i) => (
                    <div key={i} className="chart-card" style={{padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                            <span style={{fontWeight:'600', color:'#1E293B', fontSize:'16px'}}>{room.name}</span>
                            <span style={{color:'#64748B'}}>{room.nights} nights</span>
                        </div>
                        {/* Custom Progress Bar */}
                        <div style={{width:'100%', height:'12px', background:'#F1F5F9', borderRadius:'6px', overflow:'hidden'}}>
                            <div style={{
                                width: `${Math.min(100, (room.nights / 30) * 100)}%`, 
                                height:'100%', background: 'linear-gradient(90deg, #3B82F6, #2563EB)'
                            }}></div>
                        </div>
                        <div style={{textAlign:'right', fontSize:'12px', color:'#94A3B8', marginTop:'8px'}}>
                            Revenue Contribution: ₹{room.revenue.toLocaleString()}
                        </div>
                    </div>
                ))}
                {occupancyStats.length === 0 && <div style={{padding:'20px', textAlign:'center', color:'#94a3b8'}}>No occupancy data for this month.</div>}
            </div>
        </div>
    );

    return null;
}

const inputStyle = {
    padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', 
    fontFamily: 'Inter, sans-serif', fontWeight: '500', cursor:'pointer'
};