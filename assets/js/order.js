/**
 * ORDER FORM & VIETQR PAYMENT ENGINE VỚI ĐẾM NGƯỢC 5 PHÚT VÀ TỰ ĐỘNG XÁC NHẬN GIAO DỊCH
 * Sổ Tay Tóm Tắt Toán THPT – Thầy Huỳnh Thanh Chí
 */

(function () {
  'use strict';

  // Config reference
  const CONFIG = window.PAYMENT_CONFIG || {
    COUNTDOWN_SECONDS: 300,
    BANK_ID: 'OCB',
    BANK_NAME: 'Ngân Hàng Phương Đông (OCB)',
    ACCOUNT_NO: '0169100000679007',
    ACCOUNT_NAME: 'HUYNH THANH CHI',
    HOTLINE_ZALO: '0905957716',
    HOTLINE_DISPLAY: '090 595 7716',
    POLL_INTERVAL_MS: 3000,
    SEPAY_API_TOKEN: '',
    SEPAY_ACCOUNT_NUMBER: '0169100000679007'
  };

  // Packages: Áp dụng hiệu ứng chim mồi & Săn sale (49k - 39k - 29k, giảm > 50%)
  const PACKAGES = {
    combo: {
      id: 'combo',
      name: 'COMBO Toàn Diện (Sách Giấy In + Bản PDF VIP + Video)',
      price: 49000,
      oldPrice: 100000,
      shipping: 0,
      isDigital: false,
      isPhysical: true
    },
    print: {
      id: 'print',
      name: 'Sổ Tay In Giấy Màu A5 Cao Cấp (Bản Cầm Tay)',
      price: 39000,
      oldPrice: 70000,
      shipping: 20000,
      isDigital: false,
      isPhysical: true
    },
    ebook: {
      id: 'ebook',
      name: 'Bản Ebook PDF Full HD Bản Quyền (Tra cứu tiện lợi)',
      price: 29000,
      oldPrice: 50000,
      shipping: 0,
      isDigital: true,
      isPhysical: false
    }
  };

  // State
  let selectedPackage = 'combo';
  let quantity = 1;
  let activeQrTab = 'vietqr'; // 'vietqr' or 'ocb_card'
  let currentOrderId = generateOrderId();
  let isPaymentCompleted = false;

  // Timer State (5 phút = 300s)
  let remainingSeconds = CONFIG.COUNTDOWN_SECONDS;
  let timerInterval = null;
  let pollInterval = null;
  let pollCounter = 0;

  function generateOrderId() {
    return 'PTC' + Math.floor(100000 + Math.random() * 900000);
  }

  // DOM Elements
  const packageItems = document.querySelectorAll('.package-item');
  const qtyMinusBtn = document.getElementById('qty-minus-btn');
  const qtyPlusBtn = document.getElementById('qty-plus-btn');
  const qtyValEl = document.getElementById('qty-val');

  const nameInput = document.getElementById('order-name');
  const phoneInput = document.getElementById('order-phone');
  const emailInput = document.getElementById('order-email');
  const provinceInput = document.getElementById('order-province');
  const districtInput = document.getElementById('order-district');
  const wardInput = document.getElementById('order-ward');
  const streetInput = document.getElementById('order-street');
  const noteInput = document.getElementById('order-note');

  const sumPkgNameEl = document.getElementById('summary-pkg-name');
  const sumSubtotalEl = document.getElementById('summary-subtotal');
  const sumShippingEl = document.getElementById('summary-shipping');
  const sumTotalEl = document.getElementById('summary-total');

  const payBankNameEl = document.getElementById('pay-bank-name');
  const payAccountNoEl = document.getElementById('pay-account-no');
  const payAccountNameEl = document.getElementById('pay-account-name');
  const payAmountEl = document.getElementById('pay-amount');
  const payMemoEl = document.getElementById('pay-memo');

  const qrImageEl = document.getElementById('qr-main-image');
  const qrTabAutoBtn = document.getElementById('qr-tab-auto');
  const qrTabCardBtn = document.getElementById('qr-tab-card');

  // Countdown & Auto-check Elements
  const timerCountdownEl = document.getElementById('timer-countdown-display');
  const timerProgressFillEl = document.getElementById('timer-progress-fill');
  const timerStatusDotEl = document.getElementById('timer-status-dot');
  const timerStatusTextEl = document.getElementById('timer-status-text');
  const qrExpiredOverlay = document.getElementById('qr-expired-overlay');
  const qrCheckingOverlay = document.getElementById('qr-checking-overlay');
  const btnRenewQr = document.getElementById('btn-renew-qr');
  const autoCheckTextEl = document.getElementById('auto-check-text');
  const confirmPaymentBtn = document.getElementById('btn-confirm-payment');

  const toastEl = document.getElementById('toast-notification');
  const modalBackdrop = document.getElementById('order-modal-backdrop');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Format VND
  function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  }

  function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase().trim();
  }

  // Calculate order totals
  function calculateTotal() {
    const pkg = PACKAGES[selectedPackage];
    const subtotal = pkg.price * quantity;
    const shipping = pkg.shipping || 0;
    const total = subtotal + shipping;

    const phone = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
    // Format memo: PTCXXXXXX <SDT> (ngắn gọn, chính xác để ngân hàng không cắt)
    const memo = `${currentOrderId} ${phone || '0905957716'}`.trim();

    return { pkg, subtotal, shipping, total, memo };
  }

  // Update Summary Table & Payment Card
  function updateOrderDisplay() {
    if (isPaymentCompleted) return;

    const { pkg, subtotal, shipping, total, memo } = calculateTotal();

    if (sumPkgNameEl) sumPkgNameEl.textContent = `${pkg.name} (x${quantity})`;
    if (sumSubtotalEl) sumSubtotalEl.textContent = formatMoney(subtotal);
    if (sumShippingEl) {
      sumShippingEl.textContent = shipping === 0 ? 'Miễn phí (0 đ)' : formatMoney(shipping);
      sumShippingEl.style.color = shipping === 0 ? 'var(--green)' : 'var(--text)';
    }
    if (sumTotalEl) sumTotalEl.textContent = formatMoney(total);

    // Bank Detail Labels
    if (payBankNameEl) payBankNameEl.textContent = CONFIG.BANK_NAME;
    if (payAccountNoEl) payAccountNoEl.textContent = CONFIG.ACCOUNT_NO;
    if (payAccountNameEl) payAccountNameEl.textContent = CONFIG.ACCOUNT_NAME;
    if (payAmountEl) payAmountEl.textContent = formatMoney(total);
    if (payMemoEl) payMemoEl.textContent = memo;

    // Update Mobile Price Bar
    const mobilePriceEl = document.getElementById('mobile-bar-total');
    if (mobilePriceEl) mobilePriceEl.textContent = formatMoney(total);

    // Update QR Code Image
    updateQrImage(total, memo);
  }

  // Generate / Switch QR code
  function updateQrImage(total, memo) {
    if (!qrImageEl) return;
    if (activeQrTab === 'vietqr') {
      const encodedMemo = encodeURIComponent(memo);
      const qrUrl = `https://img.vietqr.io/image/${CONFIG.BANK_ID}-${CONFIG.ACCOUNT_NO}-compact2.png?amount=${total}&addInfo=${encodedMemo}&accountName=${encodeURIComponent(CONFIG.ACCOUNT_NAME)}`;
      qrImageEl.src = qrUrl;
      qrImageEl.alt = `VietQR Chuyển khoản OCB ${formatMoney(total)}`;
    } else {
      qrImageEl.src = 'assets/images/qr-card.png';
      qrImageEl.alt = 'Mã QR Thẻ Ngân hàng OCB Huỳnh Thanh Chí';
    }
  }

  // ==========================================================================
  // COUNTDOWN TIMER (5 PHÚT = 300s)
  // ==========================================================================
  function startCountdownTimer() {
    clearInterval(timerInterval);
    remainingSeconds = CONFIG.COUNTDOWN_SECONDS;
    updateTimerUI();

    timerInterval = setInterval(() => {
      if (isPaymentCompleted) {
        clearInterval(timerInterval);
        return;
      }

      remainingSeconds--;
      updateTimerUI();

      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        handleTimerExpired();
      }
    }, 1000);
  }

  function updateTimerUI() {
    if (!timerCountdownEl) return;
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    timerCountdownEl.textContent = str;

    const percent = Math.max(0, (remainingSeconds / CONFIG.COUNTDOWN_SECONDS) * 100);
    if (timerProgressFillEl) {
      timerProgressFillEl.style.width = `${percent}%`;
    }

    // Warning state when < 60s
    if (remainingSeconds <= 60 && remainingSeconds > 0) {
      timerCountdownEl.classList.add('warning');
      if (timerProgressFillEl) timerProgressFillEl.classList.add('warning');
      if (timerStatusDotEl) timerStatusDotEl.classList.add('warning');
      if (timerStatusTextEl) timerStatusTextEl.textContent = 'Sắp hết hạn thanh toán:';
    } else if (remainingSeconds > 60) {
      timerCountdownEl.classList.remove('warning');
      if (timerProgressFillEl) timerProgressFillEl.classList.remove('warning');
      if (timerStatusDotEl) {
        timerStatusDotEl.classList.remove('warning');
        timerStatusDotEl.classList.remove('expired');
      }
      if (timerStatusTextEl) timerStatusTextEl.textContent = 'Thời gian quét mã còn lại:';
    }
  }

  function handleTimerExpired() {
    if (timerStatusDotEl) {
      timerStatusDotEl.classList.remove('warning');
      timerStatusDotEl.classList.add('expired');
    }
    if (timerStatusTextEl) timerStatusTextEl.textContent = 'Phiên thanh toán đã hết hạn';
    if (qrExpiredOverlay) qrExpiredOverlay.classList.add('show');
    if (autoCheckTextEl) autoCheckTextEl.textContent = 'Mã QR đã hết hiệu lực. Bấm Tạo lại mã để tiếp tục.';
  }

  function renewQrSession() {
    currentOrderId = generateOrderId();
    if (qrExpiredOverlay) qrExpiredOverlay.classList.remove('show');
    updateOrderDisplay();
    startCountdownTimer();
    startAutoCheckPolling();
    showToast('Đã tạo mã QR mới có hiệu lực trong 5 phút!');
  }

  // ==========================================================================
  // AUTO-CHECK TRANSACTION ENGINE (TỰ ĐỘNG QUÉT & KIỂM TRA GIAO DỊCH)
  // ==========================================================================
  function startAutoCheckPolling() {
    clearInterval(pollInterval);
    pollCounter = 0;

    pollInterval = setInterval(async () => {
      if (isPaymentCompleted || remainingSeconds <= 0) {
        clearInterval(pollInterval);
        return;
      }

      pollCounter++;
      if (autoCheckTextEl) {
        autoCheckTextEl.textContent = 'Hệ thống đang tự động liên kết Webhook đối soát OCB...';
      }

      // If user provided SePay API Token, check real bank balance
      if (CONFIG.SEPAY_API_TOKEN) {
        try {
          const { total, memo } = calculateTotal();
          const res = await fetch(`https://my.sepay.vn/userapi/transactions/list?account_number=${CONFIG.SEPAY_ACCOUNT_NUMBER}&limit=10`, {
            headers: {
              'Authorization': `Apikey ${CONFIG.SEPAY_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          if (res.ok) {
            const data = await res.json();
            const list = data.messages || data.transactions || [];
            const found = list.find(tx => {
              const amountMatch = Math.abs(Number(tx.amount_in) - total) < 1;
              const contentMatch = tx.transaction_content && (tx.transaction_content.includes(currentOrderId) || (memo && tx.transaction_content.includes(memo.split(' ')[0])));
              return amountMatch && contentMatch;
            });
            if (found) {
              saveCurrentOrder('PAID');
              onPaymentSuccess();
            }
          }
        } catch (e) {
          // silent fallback
        }
      }
    }, CONFIG.POLL_INTERVAL_MS);
  }

  // Web Audio Bell Chime (Ting ting!)
  function playSuccessTingTing() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();

      function playTone(freq, startTime, duration) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      }

      const now = ctx.currentTime;
      playTone(1046.5, now, 0.4);       // C6
      playTone(1318.5, now + 0.15, 0.6); // E6
      playTone(2093.0, now + 0.30, 0.8); // C7
    } catch (e) {}
  }

  // Confetti Particle Explosion
  function launchConfetti() {
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#650f12', '#2e7d4f', '#d97706', '#1f5fbf', '#e53935', '#fbf7ef'];
    const particles = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width * 0.5,
        y: canvas.height * 0.4,
        w: Math.random() * 8 + 6,
        h: Math.random() * 12 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.7) * 16,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        opacity: 1
      });
    }

    let frame = 0;
    function anim() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // gravity
        p.vx *= 0.98;
        p.rot += p.vRot;
        if (frame > 40) p.opacity -= 0.015;

        if (p.opacity > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rot * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });
      frame++;
      if (alive) {
        requestAnimationFrame(anim);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    anim();
  }

  // PAYMENT SUCCESSFUL HANDLER
  function onPaymentSuccess() {
    if (isPaymentCompleted) return;
    isPaymentCompleted = true;

    clearInterval(timerInterval);
    clearInterval(pollInterval);

    // Audio & Confetti
    playSuccessTingTing();
    launchConfetti();

    const { pkg, total, memo } = calculateTotal();
    const addr = getCombinedAddress();
    const orderData = {
      orderId: currentOrderId,
      name: nameInput ? nameInput.value.trim() : 'Khách hàng',
      phone: phoneInput ? phoneInput.value.trim() : '0905957716',
      email: emailInput ? emailInput.value.trim() : '',
      address: addr.full,
      pkgName: pkg.name,
      quantity,
      total,
      memo,
      status: 'PAID',
      paidAt: new Date().toISOString()
    };

    saveCurrentOrder('PAID');

    // Transform payment card into Order Completed View
    const paymentCard = document.querySelector('.payment-card');
    if (paymentCard) {
      paymentCard.innerHTML = `
        <div class="order-success-screen">
          <div class="success-check-badge">
            <svg style="width:32px;height:32px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h3 class="success-title">Thanh Toán Thành Công!</h3>
          <p class="success-sub">Giao dịch đã được hệ thống xác nhận tự động qua Ngân hàng OCB.</p>

          <div style="background:#fff; border-radius:12px; padding:16px; margin-bottom:18px; border:1px solid #bbf7d0; text-align:left; font-size:13.5px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <span style="color:#666;">Mã đơn hàng:</span>
              <b style="color:var(--ink); font-size:15px;">#${orderData.orderId}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <span style="color:#666;">Khách hàng:</span>
              <b>${orderData.name}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <span style="color:#666;">Số điện thoại:</span>
              <b>${orderData.phone}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <span style="color:#666;">Gói sản phẩm:</span>
              <span style="font-weight:600; text-align:right;">${orderData.pkgName}</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px dashed #bbf7d0; padding-top:8px; margin-top:8px; font-size:15px;">
              <span style="font-weight:700; color:#166534;">Số tiền đã thanh toán:</span>
              <b style="color:var(--ink); font-family:var(--serif); font-size:17px;">${formatMoney(orderData.total)}</b>
            </div>
          </div>

          <!-- Instant Unlock Download VIP -->
          <div style="margin-bottom: 16px;">
            <a href="assets/pdf/so-tay-toan-thpt.pdf" download="So-Tay-Tom-Tat-Toan-THPT-VIP-Ban-Quyen.pdf" class="download-vip-btn" style="width: 100%; justify-content: center;">
              <svg class="ui-ico" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Tải Ngay Sổ Tay Toán THPT (Bản VIP)</span>
            </a>
            <div style="font-size:12.5px; color:#15803d; line-height:1.4;">
              ${pkg.isPhysical ? '<svg class="ui-ico" style="width:13px;height:13px;vertical-align:-2px;color:#15803d;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Bản sách in giấy màu cao cấp của bạn sẽ được Thầy Huỳnh Thanh Chí đóng gói và gửi chuyển phát nhanh sớm nhất!' : '<svg class="ui-ico" style="width:13px;height:13px;vertical-align:-2px;color:#15803d;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Bạn có thể bấm nút trên để tải trực tiếp file PDF bản quyền về điện thoại hoặc máy tính!'}
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            <a href="https://zalo.me/${CONFIG.HOTLINE_ZALO}?text=${encodeURIComponent(`Chào Thầy Huỳnh Thanh Chí, em đã thanh toán thành công đơn hàng #${orderData.orderId} (${formatMoney(orderData.total)}). Thầy kiểm tra giúp em nhé!`)}" target="_blank" rel="noopener" class="btn btn-zalo btn-sm" style="width:100%;">
              <svg class="ui-ico" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              <span>Nhắn Zalo Thầy Huỳnh Thanh Chí (${CONFIG.HOTLINE_DISPLAY || '090 595 7716'})</span>
            </a>
          </div>
        </div>
      `;
    }

    showToast('Thanh toán thành công! Đơn hàng đã hoàn tất.');
  }

  // Toast
  let toastTimer = null;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.querySelector('.toast-text').textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2800);
  }

  // Copy helper
  function copyText(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg || `Đã sao chép: ${text}`);
    }).catch(() => {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast(successMsg || `Đã sao chép: ${text}`);
    });
  }

  // Validate Form
  // Helper: Lấy địa chỉ chuẩn địa chính Việt Nam
  function getCombinedAddress() {
    const province = provinceInput ? provinceInput.value.trim() : '';
    const district = districtInput ? districtInput.value.trim() : '';
    const ward = wardInput ? wardInput.value.trim() : '';
    const street = streetInput ? streetInput.value.trim() : '';
    const full = [street, ward, district, province].filter(Boolean).join(', ');
    return { province, district, ward, street, full };
  }

  // Validate Order Form
  function validateOrderForm() {
    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, '') : '';
    const email = emailInput ? emailInput.value.trim() : '';

    if (!name) {
      showToast('Vui lòng nhập Họ và tên của bạn!');
      if (nameInput) nameInput.focus();
      return false;
    }

    if (!phone || phone.length < 10) {
      showToast('Vui lòng nhập Số điện thoại hợp lệ (10 chữ số)!');
      if (phoneInput) phoneInput.focus();
      return false;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Vui lòng nhập Email hợp lệ để nhận biên lai & tài liệu!');
      if (emailInput) emailInput.focus();
      return false;
    }

    const pkg = PACKAGES[selectedPackage];
    if (pkg.isPhysical) {
      const addr = getCombinedAddress();
      if (!addr.province) {
        showToast('Vui lòng chọn Tỉnh / Thành phố nhận sách!');
        if (provinceInput) provinceInput.focus();
        return false;
      }
      if (!addr.district) {
        showToast('Vui lòng nhập Quận / Huyện / Thị xã nhận sách!');
        if (districtInput) districtInput.focus();
        return false;
      }
      if (!addr.ward) {
        showToast('Vui lòng nhập Phường / Xã / Thị trấn nhận sách!');
        if (wardInput) wardInput.focus();
        return false;
      }
      if (!addr.street) {
        showToast('Vui lòng nhập Số nhà, tên đường hoặc thôn xóm!');
        if (streetInput) streetInput.focus();
        return false;
      }
    }

    // Tự động lưu thông tin khách hàng vào cơ sở dữ liệu nội bộ
    saveCurrentOrder('PENDING');

    return true;
  }

  // Lưu thông tin khách hàng vào cơ sở dữ liệu admin
  function saveCurrentOrder(status = 'PENDING') {
    const { pkg, total, memo } = calculateTotal();
    const addr = getCombinedAddress();
    const orderData = {
      id: currentOrderId,
      createdAt: new Date().toLocaleString('vi-VN'),
      name: nameInput ? nameInput.value.trim() : 'Khách vãng lai',
      phone: phoneInput ? phoneInput.value.trim() : '',
      email: emailInput ? emailInput.value.trim() : '',
      province: addr.province,
      district: addr.district,
      ward: addr.ward,
      street: addr.street,
      fullAddress: addr.full || 'Bản đọc trực tuyến',
      pkgId: selectedPackage,
      pkgName: pkg.name,
      quantity,
      total,
      totalFormatted: formatMoney(total),
      memo,
      note: noteInput ? noteInput.value.trim() : '',
      status: status === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán',
      timestamp: Date.now()
    };

    try {
      const orders = JSON.parse(localStorage.getItem('stc_admin_orders_db') || '[]');
      const idx = orders.findIndex(o => o.id === orderData.id);
      if (idx >= 0) {
        orders[idx] = Object.assign(orders[idx], orderData);
      } else {
        orders.unshift(orderData);
      }
      localStorage.setItem('stc_admin_orders_db', JSON.stringify(orders.slice(0, 500)));
    } catch (e) {}

    return orderData;
  }

  // Báo không thành công khi chưa có tiền vào tài khoản
  function showPaymentFailedNotice() {
    showToast('Chưa ghi nhận tiền vào tài khoản OCB!');

    let noticeEl = document.getElementById('payment-fail-alert');
    if (!noticeEl) {
      noticeEl = document.createElement('div');
      noticeEl.id = 'payment-fail-alert';
      noticeEl.className = 'payment-fail-box';
      const actionsEl = document.querySelector('.payment-actions');
      if (actionsEl) actionsEl.parentNode.insertBefore(noticeEl, actionsEl);
    }
    noticeEl.innerHTML = `
      <div style="display:flex; align-items:flex-start; gap:10px;">
        <svg class="ui-ico" style="width:20px;height:20px;color:#dc2626;flex-shrink:0;margin-top:2px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <div>
          <div style="font-weight:700; color:#b91c1c; font-size:13.5px; margin-bottom:3px;">Chưa Ghi Nhận Tiền Vào Tài Khoản OCB</div>
          <div style="font-size:12.5px; color:#4b5563; line-height:1.45;">
            Hệ thống ngân hàng chưa nhận được giao dịch khớp với mã đơn <b>#${currentOrderId}</b>. Nếu bạn vừa chuyển tiền, vui lòng đợi 15 &ndash; 30 giây rồi bấm kiểm tra lại, hoặc bấm gửi biên lai qua Zalo Thầy Chí (${CONFIG.HOTLINE_DISPLAY || '090 595 7716'}).
          </div>
        </div>
      </div>
    `;
    noticeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Manual Check Button Trigger
  async function handleManualCheckPayment() {
    if (!validateOrderForm()) return;

    const prevAlert = document.getElementById('payment-fail-alert');
    if (prevAlert) prevAlert.remove();

    if (qrCheckingOverlay) qrCheckingOverlay.classList.add('show');

    // Nếu đã cấu hình SePay API Token, kiểm tra tài khoản thực tế
    if (CONFIG.SEPAY_API_TOKEN) {
      try {
        const { total, memo } = calculateTotal();
        const res = await fetch(`https://my.sepay.vn/userapi/transactions/list?account_number=${CONFIG.SEPAY_ACCOUNT_NUMBER}&limit=20`, {
          headers: {
            'Authorization': `Apikey ${CONFIG.SEPAY_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        if (res.ok) {
          const data = await res.json();
          const list = data.messages || data.transactions || [];
          const found = list.find(tx => {
            const amountMatch = Math.abs(Number(tx.amount_in) - total) < 1;
            const contentMatch = tx.transaction_content && (tx.transaction_content.includes(currentOrderId) || (memo && tx.transaction_content.includes(memo.split(' ')[0])));
            return amountMatch && contentMatch;
          });
          if (found) {
            if (qrCheckingOverlay) qrCheckingOverlay.classList.remove('show');
            saveCurrentOrder('PAID');
            onPaymentSuccess();
            return;
          }
        }
      } catch (e) {
        console.error('SePay API error:', e);
      }
    }

    // Khi chưa có tiền vào tài khoản: Báo không thành công
    setTimeout(() => {
      if (qrCheckingOverlay) qrCheckingOverlay.classList.remove('show');
      showPaymentFailedNotice();
    }, 1400);
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Package card selection
    packageItems.forEach(item => {
      item.addEventListener('click', () => {
        packageItems.forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedPackage = item.dataset.package;
        updateOrderDisplay();
      });
    });

    // Quantity buttons
    if (qtyMinusBtn) {
      qtyMinusBtn.addEventListener('click', () => {
        if (quantity > 1) {
          quantity--;
          if (qtyValEl) qtyValEl.textContent = quantity;
          updateOrderDisplay();
        }
      });
    }

    if (qtyPlusBtn) {
      qtyPlusBtn.addEventListener('click', () => {
        if (quantity < 50) {
          quantity++;
          if (qtyValEl) qtyValEl.textContent = quantity;
          updateOrderDisplay();
        }
      });
    }

    // Input listeners for dynamic QR updates
    [nameInput, phoneInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => {
          updateOrderDisplay();
        });
      }
    });

    // QR Tabs
    if (qrTabAutoBtn) {
      qrTabAutoBtn.addEventListener('click', () => {
        activeQrTab = 'vietqr';
        qrTabAutoBtn.classList.add('active');
        if (qrTabCardBtn) qrTabCardBtn.classList.remove('active');
        const { total, memo } = calculateTotal();
        updateQrImage(total, memo);
      });
    }

    if (qrTabCardBtn) {
      qrTabCardBtn.addEventListener('click', () => {
        activeQrTab = 'ocb_card';
        qrTabCardBtn.classList.add('active');
        if (qrTabAutoBtn) qrTabAutoBtn.classList.remove('active');
        const { total, memo } = calculateTotal();
        updateQrImage(total, memo);
      });
    }

    // Renew QR Button
    if (btnRenewQr) {
      btnRenewQr.addEventListener('click', renewQrSession);
    }

    // Copy mini buttons
    document.querySelectorAll('[data-copy-target]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.dataset.copyTarget;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          const text = targetEl.textContent.trim().replace(/\sđ$/, '');
          copyText(text, `Đã sao chép: ${text}`);
        }
      });
    });

    // Download QR Code image
    const downloadQrBtn = document.getElementById('btn-download-qr');
    if (downloadQrBtn) {
      downloadQrBtn.addEventListener('click', () => {
        if (!qrImageEl) return;
        const link = document.createElement('a');
        link.href = qrImageEl.src;
        link.download = `VietQR-OCB-HuynhThanhChi.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Đang tải mã QR chuyển khoản...');
      });
    }

    // Check payment trigger
    if (confirmPaymentBtn) {
      confirmPaymentBtn.addEventListener('click', handleManualCheckPayment);
    }

    // Modal Close
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => {
        if (modalBackdrop) modalBackdrop.classList.remove('open');
      });
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
          modalBackdrop.classList.remove('open');
        }
      });
    }

    // Mobile Bottom Bar Actions
    const mobileBuyBtn = document.getElementById('mobile-buy-btn');
    if (mobileBuyBtn) {
      mobileBuyBtn.addEventListener('click', () => {
        const checkoutSec = document.getElementById('dat-mua');
        if (checkoutSec) checkoutSec.scrollIntoView({ behavior: 'smooth' });
      });
    }
    const mobilePreviewBtn = document.getElementById('mobile-preview-btn');
    if (mobilePreviewBtn) {
      mobilePreviewBtn.addEventListener('click', () => {
        const viewerSec = document.getElementById('xem-thu');
        if (viewerSec) viewerSec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Mobile nav hamburger
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileNavPanel = document.getElementById('mobile-nav-panel');
    if (mobileMenuBtn && mobileNavPanel) {
      mobileMenuBtn.addEventListener('click', () => {
        mobileNavPanel.classList.toggle('open');
      });
      mobileNavPanel.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          mobileNavPanel.classList.remove('open');
        });
      });
    }
  }

  // Social Proof Live Counter
  function setupSocialProof() {
    const counterEl = document.getElementById('registered-counter');
    if (!counterEl) return;
    let baseCount = 138;
    setInterval(() => {
      if (baseCount < 147 && Math.random() > 0.45) {
        baseCount += 1;
        counterEl.textContent = baseCount;
        const fillEl = document.querySelector('.proof-bar-fill');
        if (fillEl) {
          const pct = Math.round((baseCount / 150) * 100);
          fillEl.style.width = pct + '%';
        }
      }
    }, 40000);
  }

  // ==========================================================================
  // ADMIN ORDER MANAGEMENT & CSV/EXCEL EXPORT (DÀNH RIÊNG CHO THẦY HUỲNH THANH CHÍ)
  // ==========================================================================
  function setupAdminPortal() {
    const openAdminBtn = document.getElementById('open-admin-btn');
    const adminBackdrop = document.getElementById('admin-modal-backdrop');
    const adminCloseBtn = document.getElementById('admin-close-btn');
    const adminPasswordInput = document.getElementById('admin-password-input');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminGateBox = document.getElementById('admin-gate-box');
    const adminDashboardBox = document.getElementById('admin-dashboard-box');
    const adminSearchInput = document.getElementById('admin-search-input');
    const adminExportCsvBtn = document.getElementById('admin-export-csv-btn');
    const adminExportJsonBtn = document.getElementById('admin-export-json-btn');
    const adminRefreshBtn = document.getElementById('admin-refresh-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');

    let isAdminLoggedIn = false;

    function openAdminModal() {
      if (!adminBackdrop) return;
      adminBackdrop.classList.add('open');
      if (isAdminLoggedIn) {
        showDashboard();
      } else {
        showGate();
      }
    }

    function closeAdminModal() {
      if (!adminBackdrop) return;
      adminBackdrop.classList.remove('open');
    }

    function showGate() {
      if (adminGateBox) adminGateBox.style.display = 'grid';
      if (adminDashboardBox) adminDashboardBox.style.display = 'none';
      if (adminPasswordInput) {
        adminPasswordInput.value = '';
        setTimeout(() => adminPasswordInput.focus(), 100);
      }
    }

    function showDashboard() {
      if (adminGateBox) adminGateBox.style.display = 'none';
      if (adminDashboardBox) adminDashboardBox.style.display = 'block';
      renderAdminOrders();
    }

    function handleLogin() {
      const pwd = adminPasswordInput ? adminPasswordInput.value.trim() : '';
      const correctPwd = CONFIG.ADMIN_PASSWORD || 'thanhchi113';
      if (pwd === correctPwd) {
        isAdminLoggedIn = true;
        showToast('Đăng nhập Quản trị viên thành công!');
        showDashboard();
      } else {
        showToast('Mật khẩu quản trị không đúng!');
        if (adminPasswordInput) adminPasswordInput.select();
      }
    }

    function handleLogout() {
      isAdminLoggedIn = false;
      showGate();
      showToast('Đã đăng xuất quyền Admin.');
    }

    function getOrders() {
      try {
        return JSON.parse(localStorage.getItem('stc_admin_orders_db') || '[]');
      } catch (e) {
        return [];
      }
    }

    function renderAdminOrders(searchTerm = '') {
      const orders = getOrders();
      const tbody = document.getElementById('admin-table-body');
      const emptyNotice = document.getElementById('admin-empty-notice');
      const totalOrdersEl = document.getElementById('admin-stat-total-orders');
      const paidOrdersEl = document.getElementById('admin-stat-paid-orders');
      const revenueEl = document.getElementById('admin-stat-revenue');

      let paidCount = 0;
      let totalRevenue = 0;

      orders.forEach(o => {
        if (o.status === 'Đã thanh toán') {
          paidCount++;
          totalRevenue += Number(o.total || 0);
        }
      });

      if (totalOrdersEl) totalOrdersEl.textContent = orders.length;
      if (paidOrdersEl) paidOrdersEl.textContent = paidCount;
      if (revenueEl) revenueEl.textContent = formatMoney(totalRevenue);

      if (!tbody) return;

      const q = searchTerm.toLowerCase().trim();
      const filtered = orders.filter(o => {
        if (!q) return true;
        return (o.id && o.id.toLowerCase().includes(q)) ||
               (o.name && o.name.toLowerCase().includes(q)) ||
               (o.phone && o.phone.includes(q)) ||
               (o.email && o.email.toLowerCase().includes(q)) ||
               (o.province && o.province.toLowerCase().includes(q));
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyNotice) emptyNotice.style.display = 'block';
        return;
      }

      if (emptyNotice) emptyNotice.style.display = 'none';
      tbody.innerHTML = filtered.map(o => `
        <tr>
          <td><b style="color:var(--ink); font-family:monospace;">#${o.id}</b></td>
          <td style="color:#666; font-size:12px;">${o.createdAt || ''}</td>
          <td><b>${o.name || '---'}</b></td>
          <td><a href="tel:${o.phone}" style="color:var(--blue); font-weight:600;">${o.phone || '---'}</a></td>
          <td style="font-size:12px;">${o.email || '---'}</td>
          <td style="max-width:220px; white-space:normal; font-size:12px;" title="${o.fullAddress || ''}">${o.fullAddress || '---'}</td>
          <td style="font-size:12px; font-weight:600;">${o.pkgName || ''}</td>
          <td><b style="color:var(--ink);">${formatMoney(o.total || 0)}</b></td>
          <td><code style="background:#f1f5f9; padding:2px 5px; border-radius:3px;">${o.memo || ''}</code></td>
          <td>
            <span class="${o.status === 'Đã thanh toán' ? 'badge-status-paid' : 'badge-status-pending'}">
              ${o.status || 'Chờ thanh toán'}
            </span>
          </td>
        </tr>
      `).join('');
    }

    function exportToCsv() {
      const orders = getOrders();
      if (orders.length === 0) {
        showToast('Chưa có đơn hàng nào để xuất file!');
        return;
      }

      const headers = [
        'Mã Đơn Hàng',
        'Thời Gian Đặt',
        'Họ Và Tên',
        'Số Điện Thoại',
        'Email',
        'Tỉnh / Thành Phố',
        'Quận / Huyện',
        'Phường / Xã',
        'Số Nhà Đường',
        'Địa Chỉ Đầy Đủ',
        'Gói Sản Phẩm',
        'Số Lượng',
        'Số Tiền (VND)',
        'Nội Dung Chuyển Khoản',
        'Ghi Chú',
        'Trạng Thái'
      ];

      function escapeCsv(val) {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }

      const rows = orders.map(o => [
        escapeCsv(o.id),
        escapeCsv(o.createdAt),
        escapeCsv(o.name),
        escapeCsv(`'${o.phone}`),
        escapeCsv(o.email),
        escapeCsv(o.province),
        escapeCsv(o.district),
        escapeCsv(o.ward),
        escapeCsv(o.street),
        escapeCsv(o.fullAddress),
        escapeCsv(o.pkgName),
        escapeCsv(o.quantity),
        escapeCsv(o.total),
        escapeCsv(o.memo),
        escapeCsv(o.note),
        escapeCsv(o.status)
      ].join(','));

      const csvContent = '\uFEFF' + headers.join(',') + '\r\n' + rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `Danh-Sach-Khach-Hang-Thay-Chi-${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Đã tải xuống file Excel (.csv)!');
    }

    function exportToJson() {
      const orders = getOrders();
      const jsonContent = JSON.stringify(orders, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Backup-Don-Hang-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Đã tải xuống file sao lưu JSON!');
    }

    if (openAdminBtn) openAdminBtn.addEventListener('click', (e) => { e.preventDefault(); openAdminModal(); });
    if (adminCloseBtn) adminCloseBtn.addEventListener('click', closeAdminModal);
    if (adminLoginBtn) adminLoginBtn.addEventListener('click', handleLogin);
    if (adminPasswordInput) {
      adminPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    }
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', handleLogout);
    if (adminExportCsvBtn) adminExportCsvBtn.addEventListener('click', exportToCsv);
    if (adminExportJsonBtn) adminExportJsonBtn.addEventListener('click', exportToJson);
    if (adminRefreshBtn) adminRefreshBtn.addEventListener('click', () => {
      renderAdminOrders(adminSearchInput ? adminSearchInput.value : '');
      showToast('Đã làm mới danh sách.');
    });
    if (adminSearchInput) {
      adminSearchInput.addEventListener('input', (e) => renderAdminOrders(e.target.value));
    }

    // Secret shortcut: Ctrl + Shift + A
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        openAdminModal();
      }
    });

    if (adminBackdrop) {
      adminBackdrop.addEventListener('click', (e) => {
        if (e.target === adminBackdrop) closeAdminModal();
      });
    }
  }

  // Init
  function init() {
    setupEventListeners();
    updateOrderDisplay();
    startCountdownTimer();
    startAutoCheckPolling();
    setupSocialProof();
    setupAdminPortal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
