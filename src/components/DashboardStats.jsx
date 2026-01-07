import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#D4AF37', '#1E293B', '#F59E0B', '#64748B', '#10B981', '#EF4444'];

export default function DashboardStats({ stats }) {
    if (!stats || !stats.summary) return <div style={{padding:'20px'}}>Loading Statistics...</div>;

    // Helper to calculate percentages for Pie Chart
    const renderLabel = ({ name, value }) => `${name}: ${value}`;

    return (
        <div className="reports-container">
            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card"><h3>Total Revenue</h3><p>₹{stats.summary.totalRevenue.toLocaleString()}</p></div>
                <div className="kpi-card"><h3>Net Profit</h3><p>₹{stats.summary.netProfit.toLocaleString()}</p></div>
                <div className="kpi-card"><h3>Pending Dues</h3><p style={{color:'#b91c1c'}}>₹{stats.summary.totalDue.toLocaleString()}</p></div>
                <div className="kpi-card"><h3>Total Bookings</h3><p>{stats.summary.totalBookings}</p></div>
            </div>

            <div className="charts-grid">
                {/* 1. Monthly Revenue Bar Chart */}
                <div className="chart-card">
                    <h3>📅 Monthly Revenue</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.pnlData}>
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip formatter={(value) => `₹${value}`} />
                            <Legend />
                            <Bar dataKey="revenue" fill="#D4AF37" name="Revenue" />
                            <Bar dataKey="profit" fill="#1E293B" name="Profit" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. Source Pie Chart (OTA vs Direct) */}
                <div className="chart-card">
                    <h3>🌍 Bookings by Source</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={stats.sourceData}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                label={renderLabel}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {stats.sourceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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