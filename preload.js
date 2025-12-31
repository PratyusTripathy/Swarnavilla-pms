const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getBookings: () => ipcRenderer.invoke('get-bookings'),
  addBooking: (data) => ipcRenderer.invoke('add-booking', data),
  updateBooking: (data) => ipcRenderer.invoke('update-booking', data),
  deleteBooking: (id) => ipcRenderer.invoke('delete-booking', id),
  // MAKE SURE THESE TWO LINES EXIST:
  sendEmail: (data) => ipcRenderer.invoke('send-email', data), 
  openFile: (path) => ipcRenderer.invoke('open-file', path)
});