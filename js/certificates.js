/* Certificate viewer (PDF.js + Bootstrap modal)
   Cards stay normal links, so if anything fails the PDF opens in a new tab. */
(function () {
  'use strict';

  var WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  var modalEl = document.getElementById('certModal');
  if (!modalEl || typeof bootstrap === 'undefined') return;

  var cards = Array.prototype.slice.call(document.querySelectorAll('.cert-card'));
  var certs = cards.map(function (card) {
    return {
      url: card.getAttribute('href'),
      title: card.querySelector('.cert-title').textContent.trim(),
      issuer: card.querySelector('.cert-issuer').textContent.trim()
    };
  });

  var modal = new bootstrap.Modal(modalEl);
  var bodyEl = document.getElementById('certModalBody');
  var pagesEl = document.getElementById('certPages');
  var loadingEl = document.getElementById('certLoading');
  var errorEl = document.getElementById('certError');
  var errorLink = document.getElementById('certErrorLink');
  var titleEl = document.getElementById('certModalTitle');
  var issuerEl = document.getElementById('certModalIssuer');
  var openTabEl = document.getElementById('certOpenTab');
  var counterEl = document.getElementById('certCounter');

  var index = 0;
  var token = 0;          // cancels stale renders when navigating quickly
  var cache = {};         // url -> loaded PDF document
  var isOpen = false;
  var renderedWidth = 0;

  function pdfReady() {
    if (typeof pdfjsLib === 'undefined') return false;
    pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
    return true;
  }

  function setHeader() {
    var c = certs[index];
    titleEl.textContent = c.title;
    issuerEl.textContent = c.issuer;
    openTabEl.href = c.url;
    counterEl.textContent = (index + 1) + ' / ' + certs.length;
  }

  async function render() {
    var my = ++token;
    var c = certs[index];
    setHeader();
    pagesEl.innerHTML = '';
    errorEl.classList.add('d-none');
    loadingEl.classList.remove('d-none');
    bodyEl.scrollTop = 0;

    try {
      var pdf = cache[c.url] || (cache[c.url] = await pdfjsLib.getDocument(c.url).promise);
      if (my !== token) return;

      var width = pagesEl.clientWidth;
      renderedWidth = width;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);

      for (var n = 1; n <= pdf.numPages; n++) {
        var page = await pdf.getPage(n);
        if (my !== token) return;

        var base = page.getViewport({ scale: 1 });
        var viewport = page.getViewport({ scale: (width / base.width) * dpr });

        var canvas = document.createElement('canvas');
        canvas.className = 'cert-canvas';
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
        if (my !== token) return;

        pagesEl.appendChild(canvas);
        loadingEl.classList.add('d-none');
      }
    } catch (err) {
      if (my !== token) return;
      delete cache[c.url];
      loadingEl.classList.add('d-none');
      errorLink.href = c.url;
      errorEl.classList.remove('d-none');
    }
  }

  function go(step) {
    index = (index + step + certs.length) % certs.length;
    render();
  }

  // Card click -> open viewer (unless PDF.js is unavailable or page is opened from file://)
  cards.forEach(function (card, i) {
    card.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let modified clicks open a tab
      if (window.location.protocol === 'file:' || !pdfReady()) return;   // fallback: normal link
      e.preventDefault();
      index = i;
      setHeader();
      modal.show();
    });
  });

  document.getElementById('certPrev').addEventListener('click', function () { go(-1); });
  document.getElementById('certNext').addEventListener('click', function () { go(1); });

  modalEl.addEventListener('shown.bs.modal', function () { isOpen = true; render(); });
  modalEl.addEventListener('hidden.bs.modal', function () {
    isOpen = false;
    token++;
    pagesEl.innerHTML = '';
  });

  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  });

  // Re-render sharply if the width changes (rotate phone, resize window)
  var resizeTimer;
  window.addEventListener('resize', function () {
    if (!isOpen) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (pagesEl.clientWidth !== renderedWidth) render();
    }, 250);
  });
})();
