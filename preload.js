const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // --- CONFIG & AUTH (These were missing!) ---
  getConfig: () => ipcRenderer.invoke('get-config'),
  checkPassword: (password) => ipcRenderer.invoke('check-password', password),
  changePassword: (newPassword) => ipcRenderer.invoke('change-password', newPassword),
  updateGuestDocPath: (path) => ipcRenderer.invoke('update-guest-doc-path', path),

  // --- ROOMS ---
  getRates: () => ipcRenderer.invoke('get-rates'),
  addRoom: (room) => ipcRenderer.invoke('add-room', room),
  updateRoom: (room) => ipcRenderer.invoke('update-room', room),
  deleteRoom: (roomNo) => ipcRenderer.invoke('delete-room', roomNo),

  // --- BOOKINGS ---
  getBookings: () => ipcRenderer.invoke('get-bookings'),
  addBooking: (data) => ipcRenderer.invoke('add-booking', data),
  updateBooking: (data) => ipcRenderer.invoke('update-booking', data),
  deleteBooking: (id) => ipcRenderer.invoke('delete-booking', id),

  // --- DASHBOARD ---
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),

  // --- EMAIL ---
  sendEmail: (data) => ipcRenderer.invoke('send-email', data)
});