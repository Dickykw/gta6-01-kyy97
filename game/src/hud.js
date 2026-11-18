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
      <div id="district-sub" style="font-family:'Arial Black',Arial,sans-serif;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.85);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-top:2px;display:none"></div>
      <div id="mission-box">
        <div id="mission-title">SOLMARA HEAT</div>
        <div id="mission-text">Tekan ENTER untuk misi pertama</div>
        <div id="mission-stage"><span id="stage-label"></span><div id="stage-bar"><div id="stage-fill"></div></div></div>
        <div id="mission-next"></div>
        <div id="mission-timer"></div>
      </div>
      <div id="police-panel"></div>
      <div id="toast"></div>
    </div>
    <div id="hud-top-right">
      <div id="money">$0</div>
      <div id="wanted"></div>
      <div id="insight"></div>
      <div id="clock">16:35</div>
      <div id="rep-box"><div id="rep-line"></div><div id="rep-bar"><div id="rep-fill"></div></div></div>
      <div id="weapons"></div>
    </div>
    <div id="crosshair"></div>
    <div id="prompt"></div>
    <div id="dialog"><canvas id="dialog-portrait" width="72" height="72"></canvas><div id="dialog-text"><div id="dialog-name"></div><div id="dialog-line"></div></div></div>
    <div id="hud-bottom-left">
      <div id="vehicle-name"></div>
      <div id="speed">0 <span>km/h</span></div>
      <div id="cond-wrap"><div id="cond-label">KONDISI MOBIL</div><div id="cond-bar"><div id="cond-fill"></div></div></div>
      <div id="track"></div>
      <div id="vitals">
        <div class="vital"><span>SEHAT</span><div class="vital-bar"><div id="health-fill"></div></div><b id="health-num"></b></div>
        <div class="vital"><span>ARMOUR</span><div class="vital-bar"><div id="armour-fill"></div></div><b id="armour-num"></b></div>
      </div>
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
      district: root.querySelector('#district'),
      districtSub: root.querySelector('#district-sub'),
      money: root.querySelector('#money'),
      wanted: root.querySelector('#wanted'),
      insight: root.querySelector('#insight'),
      clock: root.querySelector('#clock'),
      missionTitle: root.querySelector('#mission-title'),
      missionText: root.querySelector('#mission-text'),
      missionTimer: root.querySelector('#mission-timer'),
      missionStage: root.querySelector('#mission-stage'),
      stageLabel: root.querySelector('#stage-label'),
      stageFill: root.querySelector('#stage-fill'),
      missionNext: root.querySelector('#mission-next'),
      policePanel: root.querySelector('#police-panel'),
      toast: root.querySelector('#toast'),
      prompt: root.querySelector('#prompt'),
      vehicleName: root.querySelector('#vehicle-name'),
      speed: root.querySelector('#speed'),
      condWrap: root.querySelector('#cond-wrap'),
      condFill: root.querySelector('#cond-fill'),
      track: root.querySelector('#track'),
      healthFill: root.querySelector('#health-fill'),
      healthNum: root.querySelector('#health-num'),
      armourFill: root.querySelector('#armour-fill'),
      armourNum: root.querySelector('#armour-num'),
      repLine: root.querySelector('#rep-line'),
      repFill: root.querySelector('#rep-fill'),
      weapons: root.querySelector('#weapons'),
      dialog: root.querySelector('#dialog'),
      dialogPortrait: root.querySelector('#dialog-portrait'),
      dialogName: root.querySelector('#dialog-name'),
      dialogLine: root.querySelector('#dialog-line'),
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
    this._dialogTimer = null;
    this._lastWanted = -1;
    this._lastAmmo = null;
    this._lastDistrict = null;
    this._lastDistrictSub = null;
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

  /** Mission dialog strip: stylized original portrait drawn on canvas (no
   *  external assets) + speaker name + one line. Auto-hides after a few
   *  seconds; never blocks input; suppressed entirely in selftest/shot mode. */
  showDialog(speaker, line) {
    if (this.game.shotMode || this.game.selftestMode) return;
    this.el.dialogName.textContent = speaker.toUpperCase();
    this.el.dialogLine.textContent = line;
    this._drawPortrait(this.el.dialogPortrait, speaker);
    this.el.dialog.style.display = 'flex';
    clearTimeout(this._dialogTimer);
    this._dialogTimer = setTimeout(() => { this.el.dialog.style.display = 'none'; }, 5200);
  }

  _drawPortrait(canvas, speaker) {
    const ctx = canvas.getContext('2d');
    const W = 72, H = 72;
    ctx.clearRect(0, 0, W, H);
    const isLuma = /luma/i.test(speaker);
    // backdrop
    ctx.fillStyle = isLuma ? '#3a1f3d' : '#1f2a3a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,210,60,0.25)';
    ctx.beginPath(); ctx.arc(36, 36, 33, 0, Math.PI * 2); ctx.fill();
    // hair: dark bob (Luma) / short crop (Dario)
    ctx.fillStyle = isLuma ? '#241428' : '#1c1410';
    ctx.beginPath();
    if (isLuma) { ctx.arc(36, 30, 24, Math.PI, 0); ctx.fill(); ctx.fillRect(12, 28, 10, 26); ctx.fillRect(50, 28, 10, 26); }
    else { ctx.arc(36, 28, 21, Math.PI, 0); ctx.fill(); }
    // face
    ctx.fillStyle = isLuma ? '#d9a184' : '#c98e6a';
    ctx.beginPath(); ctx.ellipse(36, 40, 16, 19, 0, 0, Math.PI * 2); ctx.fill();
    // eyes
    ctx.fillStyle = '#1c1c22';
    ctx.beginPath(); ctx.arc(29, 38, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(43, 38, 2.2, 0, Math.PI * 2); ctx.fill();
    // brows
    ctx.strokeStyle = isLuma ? '#241428' : '#1c1410'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(26, 33); ctx.lineTo(32, 32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, 32); ctx.lineTo(46, 33); ctx.stroke();
    // nose + lips
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(36, 40); ctx.lineTo(35, 46); ctx.stroke();
    ctx.fillStyle = isLuma ? '#a83246' : '#8a5a44';
    ctx.beginPath(); ctx.ellipse(36, 51, 5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    // Luma: gold earring + hairpin; Dario: stubble shading
    if (isLuma) {
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath(); ctx.arc(20, 52, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(52, 52, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(30, 8, 12, 3);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(36, 55, 12, 5, 0, 0, Math.PI); ctx.fill();
    }
  }

  showGameOver() {
    this.showOverlay({
      kicker: 'SOLMARA PD · DARIO TUMBANG',
      title: 'GAME OVER',
      body: `<p>Dario tumbang di jalanan Solmara. Madame Luma tidak menunggu yang lemah — bangkit dan selesaikan kerjaanmu.</p><p class="reward">Misi selesai: ${this.game.missions.completed} · Uang: $${this.game.money.toLocaleString('en-US')}</p>`,
      buttons: [{ label: '▶ BANGKIT LAGI', primary: true, onClick: () => this.game.revive() }],
      controls: 'Sehat pulih ke 100 · Armour 0 · Polisi direset',
    });
  }

  _showInfo(kind) {
    if (kind === 'controls') {
      this.showOverlay({
        kicker: 'SOLMARA HEAT',
        title: 'KONTROL',
        body: `<p style="text-align:left">WASD / panah — jalan &amp; nyetir · Shift — lari<br>
          E — masuk / keluar mobil (curi mobil parkir &amp; lalu lintas)<br>
          Mouse klik / F — tembak pistol · Space — rem tangan<br>
          Drag mouse — putar kamera · Roda mouse — zoom<br>
          M — misi berikutnya · Enter — terima misi · P — jeda</p>`,
        buttons: [{ label: '◀ KEMBALI', primary: true, onClick: () => this.showStart(!!this.game.save) }],
        controls: '',
      });
    } else {
      this.showOverlay({
        kicker: 'SOLMARA HEAT',
        title: 'KREDIT',
        body: `<p style="text-align:left">SOLMARA HEAT — open world orisinal di Solmara Bay.<br>
          Dario Voss · Madame Luma · SolCab · Torre Sol · Plaza Mar<br>
          Desain &amp; kode: Tim Solmara Heat<br>
          Musik: synth live Solmara FM — tanpa file audio luar<br>
          Dibangun dengan Three.js · Bounty make.fun gta6-01</p>`,
        buttons: [{ label: '◀ KEMBALI', primary: true, onClick: () => this.showStart(!!this.game.save) }],
        controls: '',
      });
    }
  }

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
    const s = this.game.save;
    const stats = s ? `<p class="reward">Save: ${s.completed || 0} misi selesai · $${(s.money || 0).toLocaleString('en-US')}</p>` : '';
    this.showOverlay({
      kicker: 'SOLMARA BAY · OPEN WORLD',
      title: 'SOLMARA HEAT',
      body: `<p>Dario Voss, sopir lepas. Madame Luma punya kerjaan untukmu — antar paket,
        curi mobil pesanan, dan kabur dari polisi Solmara. Kota ini milikmu: jalan kaki,
        curi mobil apa saja, dan jangan sampai ketangkap.</p>${stats}<p style="font-size:13px;color:#b8b2a4">v1.0 · Solmara Heat</p>`,
      buttons: [
        { label: hasSave ? '▶ LANJUTKAN' : '▶ MULAI', primary: true, onClick: () => this.game.startGame(false) },
        ...(hasSave ? [{ label: '↻ MULAI BARU', onClick: () => this.game.startGame(true) }] : []),
        { label: 'KONTROL', onClick: () => this._showInfo('controls') },
        { label: 'KREDIT', onClick: () => this._showInfo('credits') },
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
    const g = this.game;
    const rank = g.repRank();
    const mins = Math.floor(g.elapsed / 60), secs = Math.floor(g.elapsed % 60);
    this.showOverlay({
      kicker: 'JEDA',
      title: 'SOLMARA HEAT',
      body: `<div id="pause-tabs">
          <button data-tab="map" class="pause-tab active">MAP</button>
          <button data-tab="stats" class="pause-tab">STATS</button>
          <button data-tab="controls" class="pause-tab">KONTROL</button>
        </div>
        <div id="pause-map" class="pause-pane"><canvas id="pause-map-canvas" width="420" height="420"></canvas></div>
        <div id="pause-stats" class="pause-pane" style="display:none"><table id="pause-stats-table">
          <tr><td>Misi selesai</td><td>${g.missions.completed}</td></tr>
          <tr><td>Uang total didapat</td><td>$${g.totalEarned.toLocaleString('en-US')}</td></tr>
          <tr><td>Uang sekarang</td><td>$${g.money.toLocaleString('en-US')}</td></tr>
          <tr><td>REP</td><td>${g.repEarned} poin · Rank ${rank.level} ${rank.name}</td></tr>
          <tr><td>Mobil dicuri</td><td>${g.carsStolen}</td></tr>
          <tr><td>Kali kabur dari polisi</td><td>${g.escapes}</td></tr>
          <tr><td>Waktu bermain</td><td>${mins}:${String(secs).padStart(2, '0')}</td></tr>
          <tr><td>Sehat / Armour</td><td>${Math.round(g.health)} / ${Math.round(g.armour)}</td></tr>
        </table></div>
        <div id="pause-controls" class="pause-pane" style="display:none"><p style="text-align:left">WASD jalan / nyetir · Shift lari · E masuk / keluar mobil · Klik / F tembak · Space rem tangan · Drag mouse kamera · Roda mouse zoom · M misi · Enter terima · P jeda</p></div>`,
      buttons: [{ label: '▶ LANJUT', primary: true, onClick: () => this.game.togglePause() }],
      controls: 'P untuk jeda / lanjut',
    });
    // tab switching (buttons live inside the overlay body)
    const tabs = this.el.overlay.querySelectorAll('.pause-tab');
    const panes = { map: '#pause-map', stats: '#pause-stats', controls: '#pause-controls' };
    tabs.forEach((btn) => btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.toggle('active', b === btn));
      for (const [k, sel] of Object.entries(panes)) {
        const pane = this.el.overlay.querySelector(sel);
        if (pane) pane.style.display = k === btn.dataset.tab ? 'block' : 'none';
      }
      if (btn.dataset.tab === 'map') this._drawPauseMap();
    }));
    this._drawPauseMap();
  }

  _drawPauseMap() {
    const canvas = this.el.overlay.querySelector('#pause-map-canvas');
    if (!canvas) return;
    this._drawMinimapTo(canvas.getContext('2d'), 420, this._snapshotState(), true);
  }

  /** Same state shape main._frame passes to update(), built on demand (pause map). */
  _snapshotState() {
    const g = this.game;
    return {
      wanted: g.police.wanted,
      plaza: g.world.plaza,
      lighthouse: g.world.lighthouse,
      trafficCars: g.traffic.cars,
      missionTarget: (g.missions.state === 'active' || g.missions.state === 'briefing') ? g.missions.target : null,
      policeCars: g.police.cars,
      player: { x: g.player.x, z: g.player.z },
      playerHeading: g.player.heading,
    };
  }

  /** Per-frame HUD refresh. */
  update(dt, state) {
    const g = this.game;
    // district label (top-left): live name + sub from world.districtAt at
    // the player's position; falls back to the static SOLMARA BAY header
    // when the world agent's districtAt is not present.
    if (g.world && typeof g.world.districtAt === 'function') {
      const d = g.world.districtAt(g.player.x, g.player.z);
      if (d && d.name) {
        const name = String(d.name).toUpperCase();
        if (name !== this._lastDistrict) {
          this._lastDistrict = name;
          this.el.district.textContent = name;
        }
        const sub = d.sub ? String(d.sub) : '';
        if (sub !== this._lastDistrictSub) {
          this._lastDistrictSub = sub;
          this.el.districtSub.textContent = sub;
          this.el.districtSub.style.display = sub ? 'block' : 'none';
        }
      }
    }
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
    // mission panel: stage bar + next objective
    const m = g.missions;
    const stageInfo = this._stageInfo(m);
    if ((m.state === 'active' || m.state === 'briefing') && stageInfo) {
      this.el.missionStage.style.display = 'flex';
      this.el.stageLabel.textContent = stageInfo.label;
      this.el.stageFill.style.width = `${Math.round(stageInfo.frac * 100)}%`;
      this.el.missionNext.textContent = stageInfo.next;
      this.el.missionNext.style.display = 'block';
    } else {
      this.el.missionStage.style.display = 'none';
      this.el.missionNext.style.display = 'none';
    }
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
    // police panel (only while wanted): live units, distance, status
    if (state.wanted > 0) {
      let rows = '';
      for (const c of g.police.cars) {
        const d = Math.round(Math.hypot(c.x - g.player.x, c.z - g.player.z));
        const status = d < 25 ? 'RAMMING' : 'PATROL';
        rows += `<div class="cop-row"><span class="cop-name">${c.unitName || 'PATROL'}</span><span class="cop-dist">${d}m</span><span class="cop-status ${status === 'RAMMING' ? 'hot' : ''}">${status}</span></div>`;
      }
      if (g.police.heli) {
        const hd = Math.round(Math.hypot(g.police.heli.x - g.player.x, g.police.heli.z - g.player.z));
        rows += `<div class="cop-row"><span class="cop-name">HELI-1</span><span class="cop-dist">${hd}m</span><span class="cop-status hot">SPOTLIGHT</span></div>`;
      }
      this.el.policePanel.innerHTML = `<div class="cop-head">SOLMARA PD — ${state.wanted} ★</div>` + rows;
      this.el.policePanel.style.display = 'block';
    } else {
      this.el.policePanel.style.display = 'none';
    }
    // IN SIGHT: nearest cop inside 25 m
    this.el.insight.textContent = (state.wanted > 0 && g.policeNearest < 25) ? '● TERLIHAT' : '';
    this.el.insight.style.display = (state.wanted > 0 && g.policeNearest < 25) ? 'block' : 'none';
    // health + armour (real values from game state)
    this.el.healthFill.style.width = `${clamp(g.health, 0, 100)}%`;
    this.el.healthNum.textContent = Math.round(g.health);
    this.el.armourFill.style.width = `${clamp(g.armour, 0, 100)}%`;
    this.el.armourNum.textContent = Math.round(g.armour);
    // REP / rank
    const rank = g.repRank();
    this.el.repLine.textContent = `REP ${rank.level} · ${rank.name} · ${g.repEarned} poin`;
    this.el.repFill.style.width = rank.maxed ? '100%' : `${Math.round((rank.into / rank.need) * 100)}%`;
    // weapon slots: live ammo from combat, second slot is bare hands
    const ammoKey = `${g.combat.ammo}/${g.combat.ammoReserve}`;
    if (ammoKey !== this._lastAmmo) {
      this._lastAmmo = ammoKey;
      this.el.weapons.innerHTML = `<div class="wpn active">PISTOL · ${g.combat.ammo} / ${g.combat.ammoReserve}</div><div class="wpn">TANGAN KOSONG</div>`;
    }
    // music: the one live synth loop
    this.el.track.textContent = `♪ ${g.audio.trackName || 'Solmara FM · Golden Hour'}`;
    // speed + vehicle
    const inCar = !!g.player.inVehicle;
    if (inCar) {
      const v = g.player.inVehicle;
      this.el.vehicleName.textContent = v.spec.name + (v.stolen ? ' · curian' : '');
      this.el.speed.innerHTML = `${Math.round(Math.abs(v.speed) * 3.6)} <span>km/h</span>`;
      this.el.condWrap.style.display = 'block';
      this.el.condFill.style.width = `${Math.round(g.vehicleHealth(v))}%`;
    } else {
      this.el.vehicleName.textContent = 'Jalan kaki';
      this.el.speed.innerHTML = `${Math.round(g.player.speed * 3.6)} <span>km/h</span>`;
      this.el.condWrap.style.display = 'none';
    }
    this._drawMinimap(state);
  }

  /** Stage label / progress fraction / next objective, from live mission data. */
  _stageInfo(m) {
    if (!m.def && m.state !== 'active') return null;
    const kind = m.def ? m.def.kind : 'delivery';
    if (kind === 'chase') {
      return { label: 'STAGE 1/1 · KEJAR', frac: clamp(m.chaseHold / 5, 0, 1), next: 'BERIKUTNYA: Kurir menyerah' };
    }
    if (kind === 'escape') {
      return { label: 'STAGE 1/1 · KABUR', frac: clamp(m.escapeClear / 20, 0, 1), next: 'BERIKUTNYA: Hilang dari radar polisi' };
    }
    const total = 2;
    const idx = m.stage === 'return' ? 2 : 1;
    const dest = (m.def && m.def.dropoff) ? m.def.dropoff.label : 'Tujuan antar';
    const next = m.stage === 'return'
      ? 'BERIKUTNYA: Selesaikan misi'
      : (kind === 'steal' ? `BERIKUTNYA: Bawa ke ${dest}` : `BERIKUTNYA: Antar ke ${dest}`);
    return { label: `STAGE ${idx}/${total}`, frac: idx / total, next };
  }

  _drawMinimap(state) {
    this._drawMinimapTo(this.minimapCtx, 220, state, false);
  }

  _drawMinimapTo(ctx, S, state, labels) {
    const EXT = 132;
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
    // heli blip (orange ring) — from live police.heli, not police.cars
    const heli = this.game.police.heli;
    if (heli) {
      const [hx, hy] = toMap(heli.x, heli.z);
      ctx.strokeStyle = '#ff8c1a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ff8c1a';
      ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // district labels (pause map only)
    if (labels) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${Math.round(S / 28)}px ${FONT}`;
      ctx.textAlign = 'center';
      const [sx, sy] = toMap(-110, 0); ctx.fillText('SOLMARA BAY', sx + 14, sy);
      const [qx, qy] = toMap(state.plaza.x, state.plaza.z); ctx.fillText('PLAZA MAR', qx, qy - 12);
      const [tx, ty] = toMap(state.lighthouse.x, state.lighthouse.z); ctx.fillText('TORRE SOL', tx, ty - 12);
      const [gx, gy] = toMap(-54, 54); ctx.fillText('GARASI SOLCAB', gx, gy + 18);
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
