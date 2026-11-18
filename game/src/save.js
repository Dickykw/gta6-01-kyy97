// Save: localStorage with schema version + validation. Corrupt or foreign data
// is ignored and a fresh save starts — never crash the game on a bad save.
const SAVE_KEY = 'solmara-heat-save-v1';
const SAVE_VERSION = 1;

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    if (typeof data.money !== 'number' || data.money < 0 || data.money > 1000000) return null;
    if (typeof data.missionIndex !== 'number' || data.missionIndex < 0 || data.missionIndex > 10) return null;
    if (typeof data.completed !== 'number' || data.completed < 0) return null;
    if (data.player && (typeof data.player.x !== 'number' || typeof data.player.z !== 'number')) return null;
    return {
      money: Math.floor(data.money),
      missionIndex: Math.floor(data.missionIndex),
      completed: Math.floor(data.completed),
      player: data.player || null,
      savedAt: data.savedAt || 0,
    };
  } catch (e) {
    return null;
  }
}

export function saveGameData(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION,
      money: Math.floor(data.money || 0),
      missionIndex: Math.floor(data.missionIndex || 0),
      completed: Math.floor(data.completed || 0),
      player: data.player || null,
      savedAt: Date.now(),
    }));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
