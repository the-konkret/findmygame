// Preload script: the safe bridge between the desktop side and the UI.
// Empty for now; in Step 5 it will expose the local database (favourites, notes).
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('findMyGame', {
  platform: process.platform,
});
