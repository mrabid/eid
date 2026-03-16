(function () {
  'use strict';

  /* ── DOM ── */
  const photoInput = document.getElementById('photoInput');
  const nameInput = document.getElementById('employeeName');
  const uploadZone = document.getElementById('uploadZone');
  const uploadSub = document.getElementById('uploadSub');
  const canvas = document.getElementById('previewCanvas');
  const placeholder = document.getElementById('previewPlaceholder');
  const successEl = document.getElementById('previewSuccess');
  const downloadBtn = document.getElementById('downloadBtn');
  const templateAsset = document.getElementById('templateAsset');


  /* ── Canvas size ── */
  const CW = 1080, CH = 1080;

  const CIRCLE_CX = 535;
  const CIRCLE_CY = 670;
  const CIRCLE_R = 190;

  const NAME_X = 535;
  const NAME_Y = 910;
 
  let tplCanvas = null;
  let photoBitmap = null;
  let photoOriginal = null;
  let nameTimer = null;

  /* ── TEMPLATE ── */
  function tryLoadTemplate() {
    // If there is no external template image element, always fall back.
    if (!templateAsset) {
      tplCanvas = createFallbackTemplate();
      renderCanvas();
      return;
    }

    // If the image is already loaded and valid, build from it.
    if (templateAsset.complete && templateAsset.naturalWidth > 0) {
      buildTplCanvas(templateAsset);
      return;
    }

    // Otherwise, wait for load / error.
    templateAsset.onload = function () { buildTplCanvas(templateAsset); };
    templateAsset.onerror = function () {
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

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        photoOriginal = img;
        try { photoBitmap = cropToBitmap(img); } catch { photoBitmap = null; }
        try {
          renderCanvas();
        } catch (e) {
          console.warn('renderCanvas error:', e);
        }
        downloadBtn.disabled = false;
        setTimeout(showSuccess, 3000);
      };
      img.onerror = function () { alert('Cannot read image'); };
      img.src = e.target.result;
    };
    reader.onerror = function () { alert('Cannot read file'); };
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

    // 1️⃣ Draw photo inside circle (background layer)
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
 
    // 2️⃣ Draw template on top (with circular window cut out)
    if (tplCanvas) ctx.drawImage(tplCanvas, 0, 0);

    // 3️⃣ Red circle border — drawn after template so it's always visible
    ctx.save();
    ctx.beginPath();
    ctx.arc(CIRCLE_CX, CIRCLE_CY, CIRCLE_R, 0, Math.PI * 2);
    ctx.strokeStyle = '#e30000';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    // 4️⃣ Draw name
    drawName(ctx, nameInput.value);

    canvas.hidden = false;
    placeholder.hidden = true;
    downloadBtn.disabled = !photoOriginal;
  }

  function drawName(ctx, rawName) {
    const name = (rawName || '').trim();
    if (!name) return;
    ctx.save();
    const size = 25;
    ctx.font = `600 ${size}px 'Kazi Typo Unicode', 'Cinzel', Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#e30000'; ctx.fillText(name, NAME_X, NAME_Y);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(80, 0, 0, 0.4)'; ctx.strokeText(name, NAME_X, NAME_Y);
    ctx.restore();
  }

  /* ── UI HELPERS ── */
  function showSuccess() {
    if (!successEl) return;
    successEl.hidden = false;
    setTimeout(function () {
      successEl.classList.add('fade-out');
      setTimeout(function () {
        successEl.hidden = true;
        successEl.classList.remove('fade-out');
      }, 500);
    }, 2500);
  }
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
    try {
      canvas.toBlob(blob => {
        if (!blob) return alert('Download failed. Try using a web server instead of opening the file directly.');
        const a = document.createElement('a');
        a.download = 'eid-mubarak-chuti.png';
        a.href = URL.createObjectURL(blob);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      }, 'image/png');
    } catch (e) {
      alert('Download failed: ' + (e.message || e) + '\nTip: Open the page via a web server, not directly from file://');
    }
  });

  tryLoadTemplate();

  /* ── Eid Salami Popup ── */
  (function () {
    const overlay = document.getElementById('salamiOverlay');
    const closeBtn = document.getElementById('salamiClose');
    const countEl = document.getElementById('timerCount');
    if (!overlay) return;

    let seconds = 7;
    const interval = setInterval(function () {
      seconds--;
      if (countEl) countEl.textContent = seconds;
      if (seconds <= 0) closePopup();
    }, 1000);

    function closePopup() {
      clearInterval(interval);
      overlay.classList.add('hide');
      setTimeout(function () { overlay.style.display = 'none'; }, 350);
    }

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePopup();
    });
  }());

  /* ── bKash number click-to-copy ── */
  (function () {
    var toast = document.getElementById('copyToast');
    var hideTimer;

    document.querySelectorAll('[data-copy]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var num = el.getAttribute('data-copy');
        if (!num) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(num).then(showToast).catch(fallbackCopy);
        } else {
          fallbackCopy();
        }

        function fallbackCopy() {
          var ta = document.createElement('textarea');
          ta.value = num;
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast();
        }
      });

      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });

    function showToast() {
      if (!toast) return;
      clearTimeout(hideTimer);
      toast.hidden = false;
      toast.classList.add('show');
      hideTimer = setTimeout(function () {
        toast.classList.remove('show');
        setTimeout(function () { toast.hidden = true; }, 300);
      }, 1800);
    }
  }());
})();