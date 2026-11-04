/**
 * INTERACTIVE DOCUMENT VIEWER (22 Trang Sổ Tay Toán THPT)
 * Hỗ trợ cảm ứng vuốt chạm điện thoại (Swipe / Drag), Lật sách 3D (Flipbook),
 * Cuộn liên tục (Continuous Scroll), Phóng to (Zoom & Pan), Toàn màn hình & Audio lật giấy.
 */

(function () {
  'use strict';

  const TOTAL_PAGES = 22;
  const CHAPTERS = [
    { title: 'Trang Bìa', page: 1 },
    { title: 'Mục Lục', page: 2 },
    { title: '01. Mệnh đề & Tập hợp', page: 3 },
    { title: '03. Hàm số, Đồ thị & Ứng dụng', page: 6 },
    { title: '07. Mũ & Logarit', page: 9 },
    { title: '09. Nguyên hàm & Tích phân', page: 15 },
    { title: 'Bìa Sau & Tổng Kết', page: 22 }
  ];

  // State
  let currentPage = 1;
  let viewMode = 'flip'; // 'flip' or 'scroll'
  let currentZoom = 1.0;
  let isDoublePage = window.innerWidth > 820;
  let isSoundEnabled = true;

  // Pan / Drag State when zoomed
  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let panX = 0;
  let panY = 0;

  // Touch Swipe State
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDistX = 0;
  let touchDistY = 0;
  let isSwiping = false;

  // DOM Elements
  const stage = document.getElementById('viewer-stage');
  const flipContainer = document.getElementById('flipbook-container');
  const scrollContainer = document.getElementById('scroll-track-container');
  const thumbStrip = document.getElementById('viewer-thumb-strip');
  const pageSelect = document.getElementById('page-jump-select');
  const totalPagesEl = document.getElementById('total-pages-count');
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');
  const stagePrevBtn = document.getElementById('stage-prev-btn');
  const stageNextBtn = document.getElementById('stage-next-btn');
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');
  const zoomResetBtn = document.getElementById('btn-zoom-reset');
  const zoomBadge = document.getElementById('zoom-level-badge');
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  const soundToggleBtn = document.getElementById('btn-sound-toggle');
  const modeFlipBtn = document.getElementById('mode-btn-flip');
  const modeScrollBtn = document.getElementById('mode-btn-scroll');
  const chapterPillsContainer = document.getElementById('chapter-pills-bar');

  // Audio Context for soft realistic paper turn sound
  let audioCtx = null;
  function playPaperTurnSound() {
    if (!isSoundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const bufferSize = audioCtx.sampleRate * 0.12;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // pink-ish noise decay
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(350, audioCtx.currentTime + 0.12);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
    } catch (e) {
      // Audio autoplay restrictions or fallback
    }
  }

  // Helper: page image path
  function getPageSrc(pageNum) {
    return `assets/pages/page_${pageNum}.png`;
  }

  // Initialize Chapter Pills
  function initChapterPills() {
    if (!chapterPillsContainer) return;
    chapterPillsContainer.innerHTML = '';
    CHAPTERS.forEach(ch => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chapter-pill';
      btn.innerHTML = `<span>${ch.title}</span> <span class="pg">Tr. ${ch.page}</span>`;
      btn.addEventListener('click', () => {
        goToPage(ch.page);
      });
      chapterPillsContainer.appendChild(btn);
    });
  }

  // Initialize Thumbnails
  function initThumbnails() {
    if (!thumbStrip) return;
    thumbStrip.innerHTML = '';
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const item = document.createElement('div');
      item.className = 'thumb-item' + (p === currentPage ? ' active' : '');
      item.dataset.page = p;
      item.innerHTML = `
        <img src="${getPageSrc(p)}" alt="Trang ${p}" loading="lazy">
        <span class="thumb-num">${p}</span>
      `;
      item.addEventListener('click', () => goToPage(p));
      thumbStrip.appendChild(item);
    }
  }

  // Initialize Page Select options
  function initPageSelect() {
    if (!pageSelect) return;
    pageSelect.innerHTML = '';
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = `Trang ${p} / ${TOTAL_PAGES}`;
      pageSelect.appendChild(opt);
    }
    if (totalPagesEl) totalPagesEl.textContent = TOTAL_PAGES;
    pageSelect.addEventListener('change', (e) => {
      goToPage(parseInt(e.target.value, 10));
    });
  }

  // Initialize Continuous Scroll container
  function initScrollContainer() {
    if (!scrollContainer) return;
    scrollContainer.innerHTML = '';
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const div = document.createElement('div');
      div.className = 'scroll-page-item';
      div.id = `scroll-page-${p}`;
      div.innerHTML = `
        <img src="${getPageSrc(p)}" alt="Trang ${p}" loading="lazy">
        <span class="scroll-page-number">Trang ${p}</span>
      `;
      scrollContainer.appendChild(div);
    }

    // Track scroll position to update current page
    let scrollTimeout = null;
    scrollContainer.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const items = scrollContainer.querySelectorAll('.scroll-page-item');
        const containerLeft = scrollContainer.getBoundingClientRect().left;
        let closestPage = 1;
        let minDiff = Infinity;
        items.forEach((item, idx) => {
          const rect = item.getBoundingClientRect();
          const diff = Math.abs(rect.left - containerLeft);
          if (diff < minDiff) {
            minDiff = diff;
            closestPage = idx + 1;
          }
        });
        if (closestPage !== currentPage) {
          currentPage = closestPage;
          updateUIState(false);
        }
      }, 100);
    });
  }

  // Render Flipbook Content
  function renderFlipbook() {
    if (!flipContainer) return;

    isDoublePage = window.innerWidth > 820;

    let leftPageNum = null;
    let rightPageNum = null;

    if (!isDoublePage) {
      // Single Page Mode on Mobile / Small screens
      rightPageNum = currentPage;
    } else {
      // Desktop Double Page Spread:
      // Page 1 is Cover (alone on right)
      // Page 2-3, 4-5, ..., 20-21
      // Page 22 is Back Cover (alone on left)
      if (currentPage === 1) {
        leftPageNum = null;
        rightPageNum = 1;
      } else if (currentPage === TOTAL_PAGES && TOTAL_PAGES % 2 === 0) {
        leftPageNum = TOTAL_PAGES;
        rightPageNum = null;
      } else {
        if (currentPage % 2 === 0) {
          leftPageNum = currentPage;
          rightPageNum = Math.min(currentPage + 1, TOTAL_PAGES);
        } else {
          leftPageNum = currentPage - 1;
          rightPageNum = currentPage;
        }
      }
    }

    const isSingle = (leftPageNum === null || rightPageNum === null);
    const singleClass = isSingle ? ' single-page' : '';

    let html = `<div class="book-spread${singleClass}" id="book-spread-el" style="transform: scale(${currentZoom}) translate(${panX}px, ${panY}px);">`;

    if (leftPageNum !== null) {
      html += `
        <div class="book-page-wrap left-page">
          <img src="${getPageSrc(leftPageNum)}" alt="Trang ${leftPageNum}">
        </div>
      `;
    }

    if (rightPageNum !== null) {
      html += `
        <div class="book-page-wrap right-page">
          <img src="${getPageSrc(rightPageNum)}" alt="Trang ${rightPageNum}">
        </div>
      `;
    }

    html += `</div>`;
    flipContainer.innerHTML = html;
  }

  // Navigation Logic
  function goToPage(targetPage, playSound = true) {
    if (targetPage < 1) targetPage = 1;
    if (targetPage > TOTAL_PAGES) targetPage = TOTAL_PAGES;
    if (targetPage === currentPage && viewMode === 'flip') return;

    currentPage = targetPage;

    if (playSound) {
      playPaperTurnSound();
    }

    if (viewMode === 'flip') {
      renderFlipbook();
    } else {
      const targetEl = document.getElementById(`scroll-page-${currentPage}`);
      if (targetEl && scrollContainer) {
        targetEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }

    updateUIState();
  }

  function nextPage() {
    isDoublePage = window.innerWidth > 820;
    let step = (isDoublePage && viewMode === 'flip' && currentPage > 1 && currentPage < TOTAL_PAGES) ? 2 : 1;
    if (currentPage === 1 && isDoublePage && viewMode === 'flip') step = 1;
    goToPage(currentPage + step);
  }

  function prevPage() {
    isDoublePage = window.innerWidth > 820;
    let step = (isDoublePage && viewMode === 'flip' && currentPage > 2) ? 2 : 1;
    if (currentPage === 2 && isDoublePage && viewMode === 'flip') step = 1;
    goToPage(currentPage - step);
  }

  // Update Buttons, Select, Thumbnails, Chapter Pills
  function updateUIState(scrollThumb = true) {
    if (pageSelect) pageSelect.value = currentPage;

    // Prev / Next button state
    if (prevBtn) prevBtn.disabled = (currentPage <= 1);
    if (nextBtn) nextBtn.disabled = (currentPage >= TOTAL_PAGES);
    if (stagePrevBtn) stagePrevBtn.style.visibility = (currentPage <= 1 ? 'hidden' : 'visible');
    if (stageNextBtn) stageNextBtn.style.visibility = (currentPage >= TOTAL_PAGES ? 'hidden' : 'visible');

    // Update Thumbnails
    if (thumbStrip) {
      const thumbs = thumbStrip.querySelectorAll('.thumb-item');
      thumbs.forEach(t => {
        const p = parseInt(t.dataset.page, 10);
        if (p === currentPage || (isDoublePage && viewMode === 'flip' && (p === currentPage || (currentPage % 2 === 0 && p === currentPage + 1)))) {
          t.classList.add('active');
          if (scrollThumb) {
            t.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }
        } else {
          t.classList.remove('active');
        }
      });
    }

    // Update Chapter Pills
    if (chapterPillsContainer) {
      const pills = chapterPillsContainer.querySelectorAll('.chapter-pill');
      let activeIdx = 0;
      for (let i = CHAPTERS.length - 1; i >= 0; i--) {
        if (currentPage >= CHAPTERS[i].page) {
          activeIdx = i;
          break;
        }
      }
      pills.forEach((pill, idx) => {
        if (idx === activeIdx) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });
    }

    // Zoom Badge
    if (zoomBadge) {
      zoomBadge.textContent = `${Math.round(currentZoom * 100)}%`;
    }
  }

  // Zoom Handling
  function setZoom(newZoom) {
    currentZoom = Math.max(0.8, Math.min(2.5, newZoom));
    if (currentZoom === 1.0) {
      panX = 0;
      panY = 0;
    }
    const spread = document.getElementById('book-spread-el');
    if (spread) {
      spread.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
    }
    updateUIState(false);
  }

  // Switch View Mode
  function setViewMode(mode) {
    viewMode = mode;
    if (mode === 'flip') {
      if (modeFlipBtn) modeFlipBtn.classList.add('active');
      if (modeScrollBtn) modeScrollBtn.classList.remove('active');
      if (flipContainer) flipContainer.style.display = 'flex';
      if (scrollContainer) scrollContainer.classList.remove('active');
      renderFlipbook();
    } else {
      if (modeFlipBtn) modeFlipBtn.classList.remove('active');
      if (modeScrollBtn) modeScrollBtn.classList.add('active');
      if (flipContainer) flipContainer.style.display = 'none';
      if (scrollContainer) scrollContainer.classList.add('active');
      const targetEl = document.getElementById(`scroll-page-${currentPage}`);
      if (targetEl) targetEl.scrollIntoView({ inline: 'center' });
    }
    updateUIState();
  }

  // Touch Swipe & Mouse Drag Handling
  function setupGestures() {
    if (!stage) return;

    // Touch events for mobile swiping
    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchDistX = 0;
        touchDistY = 0;
        isSwiping = true;
      }
    }, { passive: true });

    stage.addEventListener('touchmove', (e) => {
      if (!isSwiping || e.touches.length !== 1) return;
      touchDistX = e.touches[0].clientX - touchStartX;
      touchDistY = e.touches[0].clientY - touchStartY;

      // If zoomed in, allow panning
      if (currentZoom > 1.0) {
        panX += touchDistX * 0.1;
        panY += touchDistY * 0.1;
        const spread = document.getElementById('book-spread-el');
        if (spread) {
          spread.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
        }
      }
    }, { passive: true });

    stage.addEventListener('touchend', () => {
      if (!isSwiping) return;
      isSwiping = false;

      // Horizontal swipe threshold: 45px
      if (currentZoom <= 1.05 && Math.abs(touchDistX) > 45 && Math.abs(touchDistX) > Math.abs(touchDistY) * 1.3) {
        if (touchDistX < 0) {
          nextPage();
        } else {
          prevPage();
        }
      }
    });

    // Mouse Panning when zoomed
    stage.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // left click only
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      if (currentZoom > 1.0) {
        panX = (e.clientX - startX);
        panY = (e.clientY - startY);
        const spread = document.getElementById('book-spread-el');
        if (spread) {
          spread.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
        }
      }
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
    });

    // Keyboard Arrow Keys
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevPage();
      }
    });
  }

  // Event Listeners for Controls
  function setupEventListeners() {
    if (prevBtn) prevBtn.addEventListener('click', prevPage);
    if (nextBtn) nextBtn.addEventListener('click', nextPage);
    if (stagePrevBtn) stagePrevBtn.addEventListener('click', prevPage);
    if (stageNextBtn) stageNextBtn.addEventListener('click', nextPage);

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => setZoom(currentZoom + 0.25));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setZoom(currentZoom - 0.25));
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => setZoom(1.0));

    if (modeFlipBtn) modeFlipBtn.addEventListener('click', () => setViewMode('flip'));
    if (modeScrollBtn) modeScrollBtn.addEventListener('click', () => setViewMode('scroll'));

    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', () => {
        isSoundEnabled = !isSoundEnabled;
        soundToggleBtn.title = isSoundEnabled ? 'Tắt âm thanh lật sách' : 'Bật âm thanh lật sách';
        soundToggleBtn.style.opacity = isSoundEnabled ? '1' : '0.5';
      });
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        const viewerCard = document.querySelector('.viewer-card');
        if (!viewerCard) return;
        if (!document.fullscreenElement) {
          viewerCard.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Responsive resize handler
    window.addEventListener('resize', () => {
      const newDouble = window.innerWidth > 820;
      if (newDouble !== isDoublePage && viewMode === 'flip') {
        isDoublePage = newDouble;
        renderFlipbook();
        updateUIState(false);
      }
    });
  }

  // Initialize Viewer
  function init() {
    initChapterPills();
    initThumbnails();
    initPageSelect();
    initScrollContainer();
    renderFlipbook();
    updateUIState();
    setupGestures();
    setupEventListeners();

    // Export global helpers for other sections to jump directly
    window.jumpToBookPage = function (pageNum) {
      goToPage(pageNum);
      const viewerSection = document.getElementById('xem-thu');
      if (viewerSection) {
        viewerSection.scrollIntoView({ behavior: 'smooth' });
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
