(function () {
  'use strict';

  /* ── DOM ── */
  const photoInput = document.getElementById('photoInput');
  const nameInput = document.getElementById('employeeName');
  const uploadZone = document.getElementById('uploadZone');
  const uploadSub = document.getElementById('uploadSub');
  const canvas = document.getElementById('previewCanvas');
  const placeholder = document.getElementById('previewPlaceholder');
  const loadingEl = document.getElementById('previewLoading');
  const downloadBtn = document.getElementById('downloadBtn');
  const templateAsset = document.getElementById('templateAsset');
  const templateWarn = document.getElementById('templateWarn');

  /* ── Canvas size ── */
  const CW = 1080, CH = 1080;

  const CIRCLE_CX = 535;
  const CIRCLE_CY = 670;
  const CIRCLE_R = 190;

  const NAME_X = 535;
  const NAME_Y = 930;

  let tplCanvas = null;
  let photoBitmap = null;
  let photoOriginal = null;
  let nameTimer = null;

  tplCanvas = createFallbackTemplate();

  /* ── TEMPLATE ── */
  function tryLoadTemplate() {
    if (templateAsset.complete && templateAsset.naturalWidth > 0) {
      buildTplCanvas(templateAsset);
      return;
    }

    templateAsset.onload = function () { buildTplCanvas(templateAsset); };
    templateAsset.onerror = function () {
      if (templateWarn) templateWarn.hidden = false;
      tplCanvas = createFallbackTemplate();
      renderCanvas();
    };
  }

  function createFallbackTemplate() {
    const off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    const ctx = off.getContext('2d');

    ctx.fillStyle = '#fdf8f4';
    ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.85)';
    ctx.lineWidth = 24;
    ctx.strokeRect(12, 12, CW - 24, CH - 24);

    ctx.strokeStyle = 'rgba(139, 20, 34, 0.35)';
    ctx.lineWidth = 14;
    ctx.strokeRect(70, 70, CW - 140, CH - 140);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(CIRCLE_CX, CIRCLE_CY, CIRCLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    return off;
  }

  function buildTplCanvas(img) {
    const off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    const ctx = off.getContext('2d');

    ctx.drawImage(img, 0, 0, CW, CH);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(CIRCLE_CX, CIRCLE_CY, CIRCLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    tplCanvas = off;
    renderCanvas();
  }

  /* ── PHOTO LOADING ── */
  function loadPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return alert('Select JPG, PNG, WEBP');
    if (file.size > 10 * 1024 * 1024) return alert('Max 10 MB');

    markUploadReady(file.name);
    showLoading(true);

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        photoOriginal = img;
        try { photoBitmap = cropToBitmap(img); } catch { photoBitmap = null; }
        renderCanvas();
        downloadBtn.disabled = false;
        showLoading(false);
      };
      img.onerror = function () { showLoading(false); alert('Cannot read image'); };
      img.src = e.target.result;
    };
    reader.onerror = function () { showLoading(false); alert('Cannot read file'); };
    reader.readAsDataURL(file);
  }

  function cropToBitmap(img) {
    const size = CIRCLE_R * 2;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(size / iw, size / ih);
    const sw = iw * scale;
    const sh = ih * scale;

    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    off.getContext('2d').drawImage(img, -(sw - size) / 2, -(sh - size) / 2, sw, sh);
    return off;
  }

  /* ── RENDER ── */
  function renderCanvas() {
    const ctx = canvas.getContext('2d');
    canvas.width = CW; canvas.height = CH;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);

    // 1️⃣ Draw template first (with hole)
    if (tplCanvas) ctx.drawImage(tplCanvas, 0, 0);

    // 2️⃣ Draw photo inside circle
    if (photoBitmap || photoOriginal) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(CIRCLE_CX, CIRCLE_CY, CIRCLE_R, 0, Math.PI * 2);
      ctx.clip();

      const drawSource = photoBitmap || photoOriginal;
      const srcW = drawSource.naturalWidth || drawSource.width;
      const srcH = drawSource.naturalHeight || drawSource.height;
      const scale = Math.max((CIRCLE_R * 2) / srcW, (CIRCLE_R * 2) / srcH);
      const dw = srcW * scale;
      const dh = srcH * scale;

      ctx.drawImage(drawSource,
        (CIRCLE_R * 2 - dw) / 2 + CIRCLE_CX - CIRCLE_R,
        (CIRCLE_R * 2 - dh) / 2 + CIRCLE_CY - CIRCLE_R,
        dw, dh
      );
      ctx.restore();
    }

    // 3️⃣ Draw name
    drawName(ctx, nameInput.value);

    canvas.hidden = false;
    placeholder.hidden = true;
    downloadBtn.disabled = !photoOriginal;
  }

  function drawName(ctx, rawName) {
    const name = (rawName || '').trim();
    if (!name) return;
    ctx.save();
    const size = 34;
    ctx.font = `600 ${size}px 'Cinzel', Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#f2d568'; ctx.fillText(name, NAME_X, NAME_Y);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(80, 10, 20, 0.6)'; ctx.strokeText(name, NAME_X, NAME_Y);
    ctx.restore();
  }

  /* ── UI HELPERS ── */
  function showLoading(on) { loadingEl.hidden = !on; if (on) { canvas.hidden = false; placeholder.hidden = true; } }
  function markUploadReady(name) {
    uploadZone.classList.add('ready');
    const mainEl = uploadZone.querySelector('.upload-main');
    if (mainEl) mainEl.innerHTML = '<strong>' + esc(name) + '</strong>';
    if (uploadSub) uploadSub.textContent = 'Photo selected · click to change';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  /* ── EVENTS ── */
  photoInput.addEventListener('change', () => loadPhoto(photoInput.files[0]));
  nameInput.addEventListener('input', () => { clearTimeout(nameTimer); nameTimer = setTimeout(renderCanvas, 200); });

  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); loadPhoto(e.dataTransfer.files[0]); });
  uploadZone.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') { e.preventDefault(); photoInput.click(); } });

  downloadBtn.addEventListener('click', () => {
    if (canvas.hidden || downloadBtn.disabled) return;
    canvas.toBlob(blob => {
      if (!blob) return alert('Download failed.');
      const a = document.createElement('a');
      a.download = 'eid-mubarak-chuti.png';
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  });

  tryLoadTemplate();
})();