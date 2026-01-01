const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getBookings: () => ipcRenderer.invoke('get-bookings'),
  addBooking: (data) => ipcRenderer.invoke('add-booking', data),
  updateBooking: (data) => ipcRenderer.invoke('update-booking', data),
  deleteBooking: (id) => ipcRenderer.invoke('delete-booking', id),
  
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  sendEmail: (data) => ipcRenderer.invoke('send-email', data),
  
  // ROOM MANAGEMENT
  getRates: () => ipcRenderer.invoke('get-rates'),
  addRoom: (data) => ipcRenderer.invoke('add-room', data),
  deleteRoom: (roomNo) => ipcRenderer.invoke('delete-room', roomNo),
  // *** THIS IS THE MISSING LINK FOR UPDATES ***
  updateRoom: (data) => ipcRenderer.invoke('update-room', data)
});