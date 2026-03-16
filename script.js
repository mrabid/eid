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
  let tplCanvas      = null;   // Offscreen canvas: template with punched hole (built once)
  let photoBitmap    = null;   // Offscreen canvas: user photo pre-cropped to 380×380
  let photoOriginal  = null;   // fallback raw image when crop fails
  let nameTimer      = null;   // Debounce timer for name field

  // Ensure a frame is always available before template asset loads
  tplCanvas = createFallbackTemplate();


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
      tplCanvas = createFallbackTemplate();
      if (photoBitmap) renderCanvas();
      else renderTemplatePreview();
    };
  }

  function createFallbackTemplate() {
    const off  = document.createElement('canvas');
    off.width  = CW;
    off.height = CH;
    const ctx  = off.getContext('2d');

    ctx.fillStyle = '#fdf8f4';
    ctx.fillRect(0, 0, CW, CH);

    // outer soft gold border and inner decorative rings
    const border = 24;
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.85)';
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, CW - border, CH - border);

    ctx.strokeStyle = 'rgba(139, 20, 34, 0.35)';
    ctx.lineWidth = 14;
    ctx.strokeRect(70, 70, CW - 140, CH - 140);

    // punched photo area
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(CIRCLE_CX, CIRCLE_CY, CIRCLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    return off;
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

    /* If there is no photo yet, show the template-only preview */
    if (!photoBitmap) renderTemplatePreview();

    /* Re-render if user uploaded a photo before the template finished loading */
    if (photoBitmap) renderCanvas();
  }
  function renderTemplatePreview() {
    if (!tplCanvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = CW;
    canvas.height = CH;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);
    ctx.drawImage(tplCanvas, 0, 0);

    canvas.hidden      = false;
    placeholder.hidden = true;
    downloadBtn.disabled = true;
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
        photoOriginal = img;
        try {
          photoBitmap = cropToBitmap(img);
        } catch (err) {
          console.warn('Crop failed; using raw image render', err);
          photoBitmap = null;
        }

        renderCanvas();
        downloadBtn.disabled = false;
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

    if (!(iw > 0 && ih > 0)) {
      throw new Error('Invalid image dimensions');
    }

    const scale = Math.max(size / iw, size / ih);
    const sw    = iw * scale;
    const sh    = ih * scale;

    const off   = document.createElement('canvas');
    off.width   = size;
    off.height  = size;
    const ctx = off.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');

    ctx.drawImage(
      img,
      -(sw - size) / 2,
      -(sh - size) / 2,
      sw, sh
    );
    return off;
  }


  /* ════════════════════════════════════════════════════════
     CANVAS RENDER
     ════════════════════════════════════════════════════════ */

  function renderCanvas() {
    if (!photoBitmap && !photoOriginal) return;

    try {
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

    const drawSource = photoBitmap || photoOriginal;
    if (photoBitmap) {
      ctx.drawImage(photoBitmap, CIRCLE_CX - CIRCLE_R, CIRCLE_CY - CIRCLE_R, CIRCLE_R * 2, CIRCLE_R * 2);
    } else {
      /* fallback: cover behavior for source image in circle */
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
    }

    /* 4. Name */
    drawName(ctx, nameInput.value);

    /* Reveal canvas */
    canvas.hidden      = false;
    placeholder.hidden = true;
    downloadBtn.disabled = false;
      console.error('Render error:', err);
      alert('Could not render your photo. Please choose another image and try again.');
    } finally {
      showLoading(false);
    }
  }


  /* ════════════════════════════════════════════════════════
     EMPLOYEE NAME
     ════════════════════════════════════════════════════════ */

  function drawName(ctx, rawName) {
    const name = (rawName || '').trim();
    if (!name) return;

    ctx.save();

    const size = 34;
    ctx.font         = `600 ${size}px 'Cinzel', Georgia, serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';

    /* Text with no background box */
    ctx.shadowColor   = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur    = 4;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = '#f2d568';
    ctx.fillText(name, NAME_X, NAME_Y);

    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = 'rgba(80, 10, 20, 0.6)';
    ctx.strokeText(name, NAME_X, NAME_Y);

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

  /* Name input triggers re-render after each change */
  nameInput.addEventListener('input', function () {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(function () {
      if (!photoBitmap) return;
      renderCanvas();
      downloadBtn.disabled = false;
    }, 200);
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

    const saveFile = function (fileUrl) {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.download = 'eid-mubarak-chuti.png';
      a.href = fileUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          alert('Download failed. Try running the app through a local server (e.g. Live Server in VS Code).');
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        saveFile(blobUrl);
        URL.revokeObjectURL(blobUrl);
      }, 'image/png');
      return;
    }

    try {
      saveFile(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error('Download error:', e);
      alert('Download failed. Try running the app through a local server (e.g. Live Server in VS Code).');
    }
  });


  /* ════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════ */
  tryLoadTemplate();

})();
