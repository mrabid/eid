/**
 * Eid Photo Generator
 *
 * Render pipeline (1080 × 1080 px canvas):
 *  1. White fill
 *  2. User photo pre-cropped to a 380×380 bitmap, drawn clipped to the circle
 *  3. Template overlay with a hole punched at the circle → photo shows through
 *  4. Employee name (gold pill label)
 *
 * Uses FileReader (data: URLs) for ALL image loading so the canvas is never
 * tainted — works correctly when index.html is opened directly as file://.
 */

(function () {
  'use strict';

  /* ── DOM ── */
  const photoInput         = document.getElementById('photoInput');
  const nameInput          = document.getElementById('employeeName');
  const uploadZone         = document.getElementById('uploadZone');
  const uploadSub          = document.getElementById('uploadSub');
  const canvas             = document.getElementById('previewCanvas');
  const placeholder        = document.getElementById('previewPlaceholder');
  const loadingEl          = document.getElementById('previewLoading');
  const downloadBtn        = document.getElementById('downloadBtn');
  const templateAsset      = document.getElementById('templateAsset');
  const templateWarn       = document.getElementById('templateWarn');

  /* ── Canvas size ── */
  const CW = 1080, CH = 1080;

  /* ── Circle crop in new templete.png (1080 × 1080)
        Adjust CIRCLE_CX / CIRCLE_CY / CIRCLE_R if circle looks misaligned. ── */
  const CIRCLE_CX = 535;
  const CIRCLE_CY = 670;
  const CIRCLE_R  = 190;

  /* Name position — below circle, inside the arch */
  const NAME_X = 535;
  const NAME_Y = 930;

  /* ── State ── */
  let tplCanvas   = null;   // Offscreen canvas: template with punched hole (built once)
  let photoBitmap = null;   // Offscreen canvas: user photo pre-cropped to 380×380
  let nameTimer   = null;   // Debounce timer for name field


  /* ════════════════════════════════════════════════════════
     TEMPLATE
     ════════════════════════════════════════════════════════ */

  function tryLoadTemplate() {
    /* The <img> is already in the DOM; if it loaded, use it immediately */
    if (templateAsset.complete && templateAsset.naturalWidth > 0) {
      buildTplCanvas(templateAsset);
      return;
    }
    templateAsset.onload  = () => buildTplCanvas(templateAsset);
    templateAsset.onerror = () => {
      /* Non-fatal — photo still generates, just without the frame */
      if (templateWarn) templateWarn.hidden = false;
    };
  }

  function buildTplCanvas(img) {
    const off  = document.createElement('canvas');
    off.width  = CW;
    off.height = CH;
    const ctx  = off.getContext('2d');

    ctx.drawImage(img, 0, 0, CW, CH);

    /* Punch transparent hole where the user photo should appear */
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(CIRCLE_CX, CIRCLE_CY, CIRCLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    tplCanvas = off;

    /* Re-render if user uploaded a photo before the template finished loading */
    if (photoBitmap) renderCanvas();
  }


  /* ════════════════════════════════════════════════════════
     PHOTO LOADING  (FileReader → data: URL — no taint risk)
     ════════════════════════════════════════════════════════ */

  function loadPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a JPG, PNG, or WEBP image.');
      return;
    }
    // Match UI copy: 10 MB max
    if (file.size > 10 * 1024 * 1024) {
      alert('Image is too large (max 10 MB). Please choose a smaller file.');
      return;
    }

    markUploadReady(file.name);
    showLoading(true);

    const reader = new FileReader();

    reader.onload = function (e) {
      const img   = new Image();
      img.onload  = function () {
        try {
          photoBitmap = cropToBitmap(img);
          renderCanvas();
        } catch (err) {
          showLoading(false);
          console.error('Image processing error:', err);
          alert('Could not process this image. Please try another file.');
        }
      };
      img.onerror = function () {
        showLoading(false);
        alert('Could not read this image. Please try another file.');
      };
      img.src = e.target.result;   // always a data: URL — safe on canvas
    };

    reader.onerror = function () {
      showLoading(false);
      alert('Could not read the file. Please try again.');
    };

    reader.readAsDataURL(file);
  }

  /**
   * Shrink the photo so it covers a CIRCLE_R*2 square, centred-cropped.
   * Result is a tiny 380×380 offscreen canvas — subsequent draws are < 1 ms.
   */
  function cropToBitmap(img) {
    const size  = CIRCLE_R * 2;             // 380 px
    const iw    = img.naturalWidth  || img.width;
    const ih    = img.naturalHeight || img.height;
    const scale = Math.max(size / iw, size / ih);
    const sw    = Math.round(iw * scale);
    const sh    = Math.round(ih * scale);

    const off   = document.createElement('canvas');
    off.width   = size;
    off.height  = size;
    off.getContext('2d').drawImage(
      img,
      -Math.round((sw - size) / 2),
      -Math.round((sh - size) / 2),
      sw, sh
    );
    return off;
  }


  /* ════════════════════════════════════════════════════════
     CANVAS RENDER
     ════════════════════════════════════════════════════════ */

  function renderCanvas() {
    if (!photoBitmap) return;

    const ctx = canvas.getContext('2d');

    /* Reset canvas size (also clears it) */
    canvas.width  = CW;
    canvas.height = CH;

    /* 1. White background */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);

    /* 2. Photo clipped to the circle */
    ctx.save();
    ctx.beginPath();
    ctx.arc(CIRCLE_CX, CIRCLE_CY, CIRCLE_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(photoBitmap, CIRCLE_CX - CIRCLE_R, CIRCLE_CY - CIRCLE_R);
    ctx.restore();

    /* 3. Template with punched hole (null-safe — frame is optional) */
    if (tplCanvas) ctx.drawImage(tplCanvas, 0, 0);

    /* 4. Name */
    drawName(ctx, nameInput.value);

    /* Reveal canvas */
    canvas.hidden      = false;
    placeholder.hidden = true;
    downloadBtn.disabled = false;

    showLoading(false);

    /* Pulse download button once to draw attention */
    downloadBtn.classList.remove('pulse');
    void downloadBtn.offsetWidth;
    downloadBtn.classList.add('pulse');
  }


  /* ════════════════════════════════════════════════════════
     EMPLOYEE NAME
     ════════════════════════════════════════════════════════ */

  function drawName(ctx, rawName) {
    const name = (rawName || '').trim();
    if (!name) return;

    ctx.save();

    const size = 50;
    ctx.font         = `600 ${size}px 'Cinzel', Georgia, serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';

    const tw = ctx.measureText(name).width;
    const px = 30, py = 12;

    /* Pill backdrop */
    ctx.fillStyle = 'rgba(80, 10, 20, 0.62)';
    pill(ctx, NAME_X - tw / 2 - px, NAME_Y - size - py + 4, tw + px * 2, size + py * 2, 10);
    ctx.fill();

    /* Gold stroke + fill */
    ctx.shadowColor   = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetY = 2;
    ctx.lineWidth     = 2;
    ctx.strokeStyle   = 'rgba(80,10,20,0.7)';
    ctx.strokeText(name, NAME_X, NAME_Y);
    ctx.fillStyle = '#f2d568';
    ctx.fillText(name, NAME_X, NAME_Y);

    ctx.restore();
  }

  function pill(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }


  /* ════════════════════════════════════════════════════════
     UI HELPERS
     ════════════════════════════════════════════════════════ */

  function showLoading(on) {
    loadingEl.hidden = !on;
    if (on) {
      canvas.hidden      = false;
      placeholder.hidden = true;
    }
  }

  function markUploadReady(name) {
    uploadZone.classList.add('ready');
    const mainEl = uploadZone.querySelector('.upload-main');
    if (mainEl) mainEl.innerHTML = '<strong>' + esc(name) + '</strong>';
    if (uploadSub) uploadSub.textContent = 'Photo selected · click to change';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }


  /* ════════════════════════════════════════════════════════
     EVENTS
     ════════════════════════════════════════════════════════ */

  /* Photo file input */
  photoInput.addEventListener('change', function () {
    loadPhoto(this.files[0]);
  });

  /* Name — debounced 200 ms so we don't render on every keystroke */
  nameInput.addEventListener('input', function () {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(renderCanvas, 200);
  });

  /* Drag-and-drop onto upload zone */
  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    this.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', function () {
    this.classList.remove('drag-over');
  });
  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    loadPhoto(e.dataTransfer.files[0]);
  });

  /* Keyboard on upload zone (Enter / Space triggers click) */
  uploadZone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      photoInput.click();
    }
  });

  /* Download */
  downloadBtn.addEventListener('click', function () {
    if (canvas.hidden || downloadBtn.disabled) return;
    try {
      const a   = document.createElement('a');
      a.download = 'eid-mubarak-chuti.png';
      a.href     = canvas.toDataURL('image/png');
      a.click();
    } catch (e) {
      alert('Download failed. Try running the app through a local server (e.g. Live Server in VS Code).');
    }
  });


  /* ════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════ */
  tryLoadTemplate();

})();
