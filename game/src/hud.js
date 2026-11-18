// HUD: modern bold GTA-style overlay — district + mission panel, money, wanted
// stars, speed, context prompts, live minimap canvas (player, mission blip, police,
// traffic), and the start / briefing / complete / failed screens.
import { ROAD_CENTERS, ROAD_W, SEA_X, clamp } from './util.js';

const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const FONT_HEAVY = "'Arial Black', 'Segoe UI', Arial, sans-serif";

export class HUD {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
    <div id="hud-top-left">
      <div id="district">SOLMARA BAY</div>
      <div id="mission-box">
        <div id="mission-title">SOLMARA HEAT</div>
        <div id="mission-text">Tekan ENTER untuk misi pertama</div>
        <div id="mission-timer"></div>
      </div>
      <div id="toast"></div>
    </div>
    <div id="hud-top-right">
      <div id="money">$0</div>
      <div id="wanted"></div>
      <div id="clock">16:35</div>
    </div>
    <div id="crosshair"></div>
    <div id="prompt"></div>
    <div id="hud-bottom-left">
      <div id="vehicle-name"></div>
      <div id="speed">0 <span>km/h</span></div>
    </div>
    <canvas id="minimap" width="220" height="220"></canvas>
    <div id="overlay">
      <div id="overlay-card">
        <div id="overlay-kicker"></div>
        <div id="overlay-title">SOLMARA HEAT</div>
        <div id="overlay-body"></div>
        <div id="overlay-buttons"></div>
        <div id="overlay-controls"></div>
      </div>
    </div>`;
    document.body.appendChild(root);
    this.el = {
      money: root.querySelector('#money'),
      wanted: root.querySelector('#wanted'),
      clock: root.querySelector('#clock'),
      missionTitle: root.querySelector('#mission-title'),
      missionText: root.querySelector('#mission-text'),
      missionTimer: root.querySelector('#mission-timer'),
      toast: root.querySelector('#toast'),
      prompt: root.querySelector('#prompt'),
      vehicleName: root.querySelector('#vehicle-name'),
      speed: root.querySelector('#speed'),
      crosshair: root.querySelector('#crosshair'),
      overlay: root.querySelector('#overlay'),
      overlayKicker: root.querySelector('#overlay-kicker'),
      overlayTitle: root.querySelector('#overlay-title'),
      overlayBody: root.querySelector('#overlay-body'),
      overlayButtons: root.querySelector('#overlay-buttons'),
      overlayControls: root.querySelector('#overlay-controls'),
      minimap: root.querySelector('#minimap'),
    };
    this.minimapCtx = this.el.minimap.getContext('2d');
    this._toastTimer = null;
    this._lastWanted = -1;
  }

  toast(msg, ms = 2600) {
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms);
  }

  setPrompt(text) {
    this.el.prompt.textContent = text || '';
    this.el.prompt.style.display = text ? 'block' : 'none';
  }

  setCrosshair(on) { this.el.crosshair.style.display = on ? 'block' : 'none'; }

  showOverlay({ kicker = '', title, body = '', buttons = [], controls = '' }) {
    this.el.overlayKicker.textContent = kicker;
    this.el.overlayTitle.textContent = title;
    this.el.overlayBody.innerHTML = body;
    this.el.overlayControls.innerHTML = controls;
    this.el.overlayButtons.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.className = 'hud-btn' + (b.primary ? ' primary' : '');
      btn.addEventListener('click', b.onClick);
      this.el.overlayButtons.appendChild(btn);
    }
    this.el.overlay.style.display = 'flex';
  }
  hideOverlay() { this.el.overlay.style.display = 'none'; }
  get overlayVisible() { return this.el.overlay.style.display === 'flex'; }

  showStart(hasSave) {
    this.showOverlay({
      kicker: 'SOLMARA BAY · OPEN WORLD',
      title: 'SOLMARA HEAT',
      body: `<p>Dario Voss, sopir lepas. Madame Luma punya kerjaan untukmu — antar paket,
        curi mobil pesanan, dan kabur dari polisi Solmara. Kota ini milikmu: jalan kaki,
        curi mobil apa saja, dan jangan sampai ketangkap.</p>`,
      buttons: [
        { label: hasSave ? '▶ LANJUTKAN' : '▶ MULAI', primary: true, onClick: () => this.game.startGame(false) },
        ...(hasSave ? [{ label: '↻ MULAI BARU', onClick: () => this.game.startGame(true) }] : []),
      ],
      controls: `<b>KONTROL</b> — WASD jalan / nyetir · Shift lari · E masuk / keluar mobil ·
        Mouse klik tembak · Space rem tangan · Drag mouse putar kamera · Roda mouse zoom ·
        M misi berikutnya · Enter terima misi · P jeda`,
    });
  }

  showBriefing(def) {
    this.showOverlay({
      kicker: 'MISI BARU — MADAME LUMA',
      title: def.title,
      body: `<p>${def.brief}</p><p class="reward">Hadiah: $${def.reward} · Batas waktu: ${def.timer} detik</p>`,
      buttons: [{ label: '▶ TERIMA MISI', primary: true, onClick: () => this.game.acceptMission() }],
      controls: 'Tekan ENTER untuk menerima',
    });
  }

  showBriefingFree(job) {
    this.showOverlay({
      kicker: 'KERJA LEPAS — FREE ROAM',
      title: 'Antar Paket',
      body: `<p>Madame Luma butuh kurir lagi. Ambil paketnya, antar ke tujuan sebelum waktu habis.</p><p class="reward">Hadiah: $${job.reward} · Batas waktu: ${job.timer || 120} detik</p>`,
      buttons: [{ label: '▶ TERIMA', primary: true, onClick: () => this.game.acceptMission() }],
      controls: 'Tekan ENTER untuk menerima',
    });
  }

  showComplete(reward, title) {
    this.showOverlay({
      kicker: 'MISI SELESAI',
      title: 'KERJA BAGUS, DARIO',
      body: `<p>${title} — selesai.</p><p class="reward big">+$${reward}</p>`,
      buttons: [
        { label: '▶ MISI BERIKUTNYA', primary: true, onClick: () => this.game.nextMission() },
        { label: 'JELAJAH BEBAS', onClick: () => this.game.freeRoam() },
      ],
      controls: 'Uangmu tersimpan otomatis',
    });
  }

  showFailed(reason) {
    this.showOverlay({
      kicker: 'MISI GAGAL',
      title: 'GAGAL',
      body: `<p>${reason}. Madame Luma tidak suka menunggu — coba lagi.</p>`,
      buttons: [{ label: '↻ COBA LAGI', primary: true, onClick: () => this.game.retryMission() }],
      controls: '',
    });
  }

  showBusted() {
    this.showOverlay({
      kicker: 'SOLMARA PD',
      title: 'KETANGKAP!',
      body: `<p>Polisi menangkapmu. Denda $50 — Madame Luma yang menebusmu.</p>`,
      buttons: [{ label: '▶ BEBAS LAGI', primary: true, onClick: () => this.game.afterBusted() }],
      controls: '',
    });
  }

  showPaused() {
    this.showOverlay({
      kicker: 'JEDA',
      title: 'SOLMARA HEAT',
      body: '<p>Game dijeda.</p>',
      buttons: [{ label: '▶ LANJUT', primary: true, onClick: () => this.game.togglePause() }],
      controls: 'P untuk jeda / lanjut',
    });
  }

  /** Per-frame HUD refresh. */
  update(dt, state) {
    const g = this.game;
    this.el.money.textContent = '$' + g.money.toLocaleString('en-US');
    if (state.wanted !== this._lastWanted) {
      this._lastWanted = state.wanted;
      let stars = '';
      for (let i = 0; i < 3; i++) stars += `<span class="star${i < state.wanted ? ' on' : ''}">★</span>`;
      this.el.wanted.innerHTML = stars;
    }
    // clock: golden hour, advances slowly
    const mins = 16 * 60 + 35 + Math.floor(g.elapsed * 0.5);
    this.el.clock.textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    // mission panel
    const m = g.missions;
    if (m.state === 'active' || m.state === 'briefing') {
      this.el.missionTitle.textContent = m.currentTitle;
      this.el.missionText.textContent = m.objectiveText();
      this.el.missionTimer.textContent = m.state === 'active' ? `⏱ ${Math.max(0, Math.ceil(m.timer))} detik` : '';
      this.el.missionTimer.style.color = m.timer < 20 ? '#ff5f6d' : '#ffd23c';
    } else if (m.state === 'complete') {
      this.el.missionTitle.textContent = 'MISI SELESAI';
      this.el.missionText.textContent = 'Pilih misi berikutnya atau jelajah bebas.';
      this.el.missionTimer.textContent = '';
    } else {
      this.el.missionTitle.textContent = 'SOLMARA BAY';
      this.el.missionText.textContent = 'Tekan M untuk misi berikutnya';
      this.el.missionTimer.textContent = '';
    }
    // speed + vehicle
    const inCar = !!g.player.inVehicle;
    if (inCar) {
      const v = g.player.inVehicle;
      this.el.vehicleName.textContent = v.spec.name + (v.stolen ? ' · curian' : '');
      this.el.speed.innerHTML = `${Math.round(Math.abs(v.speed) * 3.6)} <span>km/h</span>`;
    } else {
      this.el.vehicleName.textContent = 'Jalan kaki';
      this.el.speed.innerHTML = `${Math.round(g.player.speed * 3.6)} <span>km/h</span>`;
    }
    this._drawMinimap(state);
  }

  _drawMinimap(state) {
    const ctx = this.minimapCtx;
    const S = 220, EXT = 132;
    const toMap = (x, z) => [((x + EXT) / (EXT * 2)) * S, ((z + EXT) / (EXT * 2)) * S];
    ctx.clearRect(0, 0, S, S);
    // sea
    ctx.fillStyle = '#2fa8a0';
    ctx.fillRect(0, 0, ((SEA_X + EXT) / (EXT * 2)) * S, S);
    // land
    ctx.fillStyle = '#3d4149';
    ctx.fillRect(((SEA_X + EXT) / (EXT * 2)) * S, 0, S, S);
    // blocks
    ctx.fillStyle = '#6b6257';
    for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 4; bz++) {
      const s = { lo: ROAD_CENTERS[bx] + ROAD_W / 2, hi: ROAD_CENTERS[bx + 1] - ROAD_W / 2 };
      const t = { lo: ROAD_CENTERS[bz] + ROAD_W / 2, hi: ROAD_CENTERS[bz + 1] - ROAD_W / 2 };
      const [x1, y1] = toMap(s.lo, t.lo), [x2, y2] = toMap(s.hi, t.hi);
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
    // plaza + lighthouse
    const [px, py] = toMap(state.plaza.x, state.plaza.z);
    ctx.fillStyle = '#ffd23c'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    const [lx, ly] = toMap(state.lighthouse.x, state.lighthouse.z);
    ctx.fillStyle = '#ff5f6d'; ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();
    // traffic dots
    ctx.fillStyle = '#c8c2b4';
    for (const v of state.trafficCars) {
      const [x, y] = toMap(v.x, v.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // mission blip (pulsing)
    if (state.missionTarget) {
      const [x, y] = toMap(state.missionTarget.x, state.missionTarget.z);
      const r = 6 + Math.sin(performance.now() * 0.006) * 2;
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1c1c22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    }
    // police blips
    ctx.fillStyle = '#3a7bff';
    for (const c of state.policeCars) {
      const [x, y] = toMap(c.x, c.z);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke();
    }
    // player arrow
    const [ux, uy] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(ux, uy);
    ctx.rotate(Math.atan2(-Math.sin(state.playerHeading), Math.cos(state.playerHeading)) + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1c1c22'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // north + frame
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
  }
}
