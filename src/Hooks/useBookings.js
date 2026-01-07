import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

export function useBookings() {
    const [bookings, setBookings] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!window.api) return;
        setLoading(true);
        try {
            const b = await window.api.getBookings();
            const s = await window.api.getDashboardStats();
            setBookings(b);
            setStats(s);
        } catch (err) {
            toast.error("Failed to load data");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial Load
    useEffect(() => { loadData(); }, [loadData]);

    return { bookings, stats, loading, reload: loadData };
}