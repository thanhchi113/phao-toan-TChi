/**
 * ORDER FORM & VIETQR PAYMENT ENGINE VỚI ĐẾM NGƯỢC 5 PHÚT VÀ TỰ ĐỘNG XÁC NHẬN GIAO DỊCH
 * Sổ Tay Tóm Tắt Toán THPT – Thầy Huỳnh Thanh Chí
 */

(function () {
  'use strict';

  // Config reference
  const CONFIG = window.PAYMENT_CONFIG || {
    COUNTDOWN_SECONDS: 300,
    BANK_ID: 'BIDV',
    BANK_NAME: 'Ngân Hàng Đầu Tư & Phát Triển Việt Nam (BIDV)',
    ACCOUNT_NO: '5801434567',
    SEPAY_VA_ACCOUNT: '962478SJJ2',
    ACCOUNT_NAME: 'HUYNH THANH CHI',
    HOTLINE_ZALO: '0905957716',
    HOTLINE_DISPLAY: '090 595 7716',
    POLL_INTERVAL_MS: 3000,
    GAS_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbyXFB8UgPDiZXxZtHF6bxGFWe0I3Voc1Ecke1DUi1Jp2P6LeD3Ss1etOKqbOBIctR5YTg/exec',
    GOOGLE_SHEET_ID: '1dObYu0uf1pdSvYLWDdi45zKK2n67TzfbrfkDuOlsvq0',
    ALLOW_ALL_ACCESS: true,
    SEPAY_API_TOKEN: 'SEPAY_GAS_BRIDGE_ACTIVE_5801434567',
    SEPAY_ACCOUNT_NUMBER: '5801434567'
  };

  function getEffectiveQrAccountNo() {
    return (CONFIG.SEPAY_VA_ACCOUNT || CONFIG.ACCOUNT_NO || '962478SJJ2').trim();
  }

  function formatDisplayBankAccWithVa() {
    const raw = (CONFIG.ACCOUNT_NO || '5801434567').trim();
    const va = getEffectiveQrAccountNo();
    return va !== raw ? `${va} (TK gốc: ${raw})` : raw;
  }

  // Packages: Áp dụng hiệu ứng chim mồi & Săn sale (49k - 39k - 29k, giảm > 50%)
  const PACKAGES = {
    combo: {
      id: 'combo',
      name: 'COMBO: Sách, Ebook PDF, Đề GK, CK 10-11-12',
      price: 49000,
      oldPrice: 100000,
      shipping: 0,
      hasPdf: true,
      isDigital: false,
      isPhysical: true
    },
    print: {
      id: 'print',
      name: 'COMBO: Sách, Ebook PDF',
      price: 39000,
      oldPrice: 70000,
      shipping: 0,
      hasPdf: true,
      isDigital: false,
      isPhysical: true
    },
    book_only: {
      id: 'book_only',
      name: 'COMBO Chỉ Sách (Sách Giấy In Màu A5)',
      price: 29000,
      oldPrice: 50000,
      shipping: 0,
      hasPdf: false,
      isDigital: false,
      isPhysical: true
    }
  };

  // State
  let selectedPackage = 'combo';
  let selectedDelivery = 'pickup'; // 'pickup' (Ghé 84/11 Đô Đốc Bảo: 0đ) | 'ship_qn' (Giao tại Quy Nhơn: 10.000đ)
  let quantity = 1;
  let activeQrTab = 'vietqr';
  let currentOrderId = generateOrderId();
  let isPaymentCompleted = false;
  let isQrGenerated = false;
  let lockedOrderData = null;

  // Timer State (5 phút = 300s)
  let remainingSeconds = CONFIG.COUNTDOWN_SECONDS;
  let timerInterval = null;
  let pollInterval = null;
  let pollCounter = 0;

  function generateOrderId() {
    return 'PTC' + Math.floor(100000 + Math.random() * 900000);
  }

  // DOM Elements
  const formCardEl = document.querySelector('.form-card');
  const addressFieldsCard = document.getElementById('address-fields-card');
  const deliveryItems = document.querySelectorAll('.qn-delivery-item');
  const qnPickupBox = document.getElementById('qn-pickup-box');
  const qnShipFields = document.getElementById('qn-ship-fields');
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

  const createQrActionWrap = document.getElementById('create-qr-action-wrap');
  const btnCreateQr = document.getElementById('btn-create-qr');
  const btnCreateQrRight = document.getElementById('btn-create-qr-right');
  const formLockedBanner = document.getElementById('form-locked-banner');
  const btnUnlockOrderForm = document.getElementById('btn-unlock-order-form');

  const qrGatePlaceholder = document.getElementById('qr-gate-placeholder');
  const qrGateAmountEl = document.getElementById('qr-gate-amount');
  const qrActiveSession = document.getElementById('qr-active-session');
  const qrSuccessSession = document.getElementById('qr-success-session');

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

  // Calculate order totals (Trả về dữ liệu đã khóa cứng nếu đang trong phiên quét QR)
  function calculateTotal() {
    if (isQrGenerated && lockedOrderData) {
      return lockedOrderData;
    }

    const pkg = PACKAGES[selectedPackage];
    const subtotal = pkg.price * quantity;
    const shipping = pkg.isPhysical ? (selectedDelivery === 'ship_qn' ? 10000 : 0) : 0;
    const total = subtotal + shipping;

    const phone = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
    // Format memo: PTCXXXXXX <SDT> (ngắn gọn, chính xác để ngân hàng không cắt)
    const memo = `${currentOrderId} ${phone || '0905957716'}`.trim();

    return { pkg, subtotal, shipping, total, memo };
  }

  function setOrderFormLocked(locked) {
    if (formCardEl) {
      formCardEl.classList.toggle('is-locked-order', locked);
    }
    const fields = [nameInput, phoneInput, emailInput, provinceInput, districtInput, wardInput, streetInput, noteInput, qtyMinusBtn, qtyPlusBtn];
    fields.forEach(el => {
      if (el) el.disabled = locked;
    });
    if (createQrActionWrap) createQrActionWrap.style.display = locked ? 'none' : 'block';
    if (formLockedBanner) formLockedBanner.style.display = locked ? 'flex' : 'none';
  }

  function handleCreateLockedQr() {
    if (!validateOrderForm()) return;

    const prevAlert = document.getElementById('payment-fail-alert');
    if (prevAlert) prevAlert.remove();

    isQrGenerated = false;
    lockedOrderData = null;
    currentOrderId = generateOrderId();
    lockedOrderData = calculateTotal();
    isQrGenerated = true;

    setOrderFormLocked(true);

    if (qrGatePlaceholder) qrGatePlaceholder.style.display = 'none';
    if (qrActiveSession) qrActiveSession.style.display = 'block';
    if (qrExpiredOverlay) qrExpiredOverlay.classList.remove('show');

    updateOrderDisplay();
    saveCurrentOrder('PENDING');
    startCountdownTimer();
    startAutoCheckPolling();

    const paySection = document.getElementById('thanh-toan');
    if (paySection) paySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Đã khóa Số tiền & Nội dung giao dịch và tạo mã QR!');
  }

  function unlockOrderFormToEdit() {
    if (isPaymentCompleted) {
      startNewOrderSession();
      return;
    }
    isQrGenerated = false;
    lockedOrderData = null;
    clearInterval(timerInterval);
    clearInterval(pollInterval);

    if (qrImageEl) qrImageEl.src = '';
    if (qrActiveSession) qrActiveSession.style.display = 'none';
    if (qrSuccessSession) qrSuccessSession.style.display = 'none';
    if (qrGatePlaceholder) qrGatePlaceholder.style.display = 'block';

    setOrderFormLocked(false);
    updateOrderDisplay();

    const formSection = document.getElementById('dat-mua');
    if (formSection) formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Đã mở khóa thông tin. Điền xong hãy bấm Tạo Mã QR Chuyển Tiền.');
  }

  function startNewOrderSession() {
    clearInterval(timerInterval);
    clearInterval(pollInterval);
    isPaymentCompleted = false;
    isQrGenerated = false;
    lockedOrderData = null;
    currentOrderId = generateOrderId();
    quantity = 1;
    if (qtyValEl) qtyValEl.textContent = '1';

    if (qrImageEl) qrImageEl.src = '';
    if (qrSuccessSession) {
      qrSuccessSession.style.display = 'none';
      qrSuccessSession.innerHTML = '';
    }
    if (qrActiveSession) qrActiveSession.style.display = 'none';
    if (qrGatePlaceholder) qrGatePlaceholder.style.display = 'block';
    if (btnUnlockOrderForm) btnUnlockOrderForm.innerHTML = '<span>Sửa thông tin</span>';

    setOrderFormLocked(false);
    updateOrderDisplay();

    const formSection = document.getElementById('dat-mua');
    if (formSection) formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Đã tạo đơn hàng mới! Vui lòng chọn gói sách và xác nhận thông tin.');
  }

  // Update Summary Table & Payment Card
  function updateOrderDisplay() {
    if (isPaymentCompleted) return;

    const { pkg, subtotal, shipping, total, memo } = calculateTotal();

    if (addressFieldsCard) {
      addressFieldsCard.style.display = pkg.isPhysical ? 'block' : 'none';
    }
    if (qnPickupBox) {
      qnPickupBox.style.display = selectedDelivery === 'pickup' ? 'flex' : 'none';
    }
    if (qnShipFields) {
      qnShipFields.style.display = selectedDelivery === 'ship_qn' ? 'block' : 'none';
    }

    if (sumPkgNameEl) sumPkgNameEl.textContent = `${pkg.name} (x${quantity})`;
    if (sumSubtotalEl) sumSubtotalEl.textContent = formatMoney(subtotal);
    if (sumShippingEl) {
      if (!pkg.isPhysical) {
        sumShippingEl.textContent = 'Nhận trực tuyến (0 đ)';
        sumShippingEl.style.color = 'var(--green)';
      } else if (selectedDelivery === 'pickup') {
        sumShippingEl.textContent = 'Ghé 84/11 Đô Đốc Bảo (0 đ)';
        sumShippingEl.style.color = 'var(--green)';
      } else {
        sumShippingEl.textContent = '10.000 đ (Giao tại Quy Nhơn)';
        sumShippingEl.style.color = 'var(--text)';
      }
    }
    if (sumTotalEl) sumTotalEl.textContent = formatMoney(total);
    if (qrGateAmountEl) qrGateAmountEl.textContent = formatMoney(total);

    // Update Mobile Price Bar
    const mobilePriceEl = document.getElementById('mobile-bar-total');
    if (mobilePriceEl) mobilePriceEl.textContent = formatMoney(total);

    // Chỉ hiển thị & tạo mã QR khi khách đã điền xong thông tin và bấm Tạo Mã QR
    if (!isQrGenerated) return;

    // Bank Detail Labels (Locked Amount & Memo)
    if (payBankNameEl) payBankNameEl.textContent = CONFIG.BANK_NAME;
    if (payAccountNoEl) {
      payAccountNoEl.textContent = formatDisplayBankAccWithVa();
      payAccountNoEl.dataset.copyRaw = getEffectiveQrAccountNo();
    }
    if (payAccountNameEl) payAccountNameEl.textContent = CONFIG.ACCOUNT_NAME;
    if (payAmountEl) payAmountEl.textContent = formatMoney(total);
    if (payMemoEl) payMemoEl.textContent = memo;

    // Update QR Code Image
    updateQrImage(total, memo);
  }

  // Generate / Switch QR code (QR Động EMVCo 010212 khóa cứng Số tiền & Nội dung qua VA SePay 962478SJJ2 -> 5801434567)
  function updateQrImage(total, memo) {
    if (!qrImageEl || !isQrGenerated) return;
    const encodedMemo = encodeURIComponent(memo);
    const qrAcc = getEffectiveQrAccountNo();
    const qrUrl = `https://img.vietqr.io/image/${CONFIG.BANK_ID}-${qrAcc}-compact2.png?amount=${total}&addInfo=${encodedMemo}&accountName=${encodeURIComponent(CONFIG.ACCOUNT_NAME)}`;
    qrImageEl.src = qrUrl;
    qrImageEl.alt = `VietQR Chuyển khoản ${CONFIG.BANK_ID} ${formatMoney(total)}`;
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
    if (!validateOrderForm()) return;
    isQrGenerated = false;
    lockedOrderData = null;
    currentOrderId = generateOrderId();
    lockedOrderData = calculateTotal();
    isQrGenerated = true;
    if (qrExpiredOverlay) qrExpiredOverlay.classList.remove('show');
    updateOrderDisplay();
    startCountdownTimer();
    startAutoCheckPolling();
    showToast('Đã tạo mã QR mới có hiệu lực trong 5 phút!');
  }

  // ==========================================================================
  // AUTO-CHECK TRANSACTION ENGINE (ĐỐI SOÁT TỰ ĐỘNG SEPAY & BIDV 5801434567)
  // ==========================================================================
  function getActiveSepayToken() {
    return (localStorage.getItem('stc_sepay_api_token') || CONFIG.SEPAY_API_TOKEN || '').trim();
  }

  function matchTransferContent(contentStr, orderId, memo) {
    if (!contentStr) return false;
    const normContent = removeVietnameseTones(String(contentStr)).replace(/\s+/g, ' ');
    const normOrderId = String(orderId || '').toUpperCase().trim();
    if (normOrderId && normContent.includes(normOrderId)) return true;
    const firstToken = memo ? String(memo).split(' ')[0].toUpperCase().trim() : '';
    if (firstToken && firstToken.length >= 6 && normContent.includes(firstToken)) return true;
    return false;
  }

  async function verifySepayTransactionLive() {
    const { total, memo } = calculateTotal();
    const token = getActiveSepayToken();

    // 1. Đối soát trực tiếp qua Cầu nối Google Apps Script & Sheet SePay_GiaoDich (Đã bật Cho phép toàn bộ truy cập)
    if (CONFIG.GAS_WEBAPP_URL) {
      try {
        const gasRes = await fetch(`${CONFIG.GAS_WEBAPP_URL}?action=getAll&forceSepay=1&t=${Date.now()}`, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store'
        });
        if (gasRes.ok) {
          const json = await gasRes.json();
          const serverData = (json && json.data) ? json.data : json;
          if (serverData && typeof serverData === 'object') {
            // a) Kiểm tra trên bảng tích hợp SePay_GiaoDich
            if (Array.isArray(serverData.rawClassSheets)) {
              for (const sheet of serverData.rawClassSheets) {
                const rows = Array.isArray(sheet && sheet.values) ? sheet.values : [];
                if (rows.length < 2) continue;
                const headers = rows[0].map(h => removeVietnameseTones(String(h || '')).toLowerCase().replace(/[^a-z0-9]/g, ''));
                const contentIdx = headers.findIndex(h => ['content', 'noidung', 'noidungthanhtoan', 'noidungchuyenkhoan', 'description', 'mota'].includes(h));
                const codeIdx = headers.findIndex(h => ['code', 'codett', 'codethanhtoan', 'macode'].includes(h));
                const amtIdx = headers.findIndex(h => ['transferamount', 'sotien', 'amount', 'tienvao', 'amountin'].includes(h));
                const typeIdx = headers.findIndex(h => ['transfertype', 'loai', 'loaigiaodich'].includes(h));

                if (contentIdx !== -1 && amtIdx !== -1) {
                  for (let i = rows.length - 1; i >= 1; i--) {
                    const r = rows[i];
                    if (!Array.isArray(r)) continue;
                    const typeStr = typeIdx !== -1 ? removeVietnameseTones(String(r[typeIdx] || '')) : 'TIEN VAO';
                    if (/RA|OUT|CHI/i.test(typeStr)) continue;
                    const rawAmt = Number(String(r[amtIdx] || '0').replace(/[^\d.-]/g, '')) || 0;
                    const rawContent = `${codeIdx !== -1 ? (r[codeIdx] || '') : ''} ${r[contentIdx] || ''}`.trim();
                    if (rawAmt >= total && matchTransferContent(rawContent, currentOrderId, memo)) {
                      return true;
                    }
                  }
                }
              }
            }

            // b) Kiểm tra trong danh sách transactions đồng bộ từ Webhook SePay
            if (Array.isArray(serverData.transactions)) {
              const hitTx = serverData.transactions.find(tx => {
                if (!tx) return false;
                const amt = Number(String(tx.amount || tx.amount_in || '0').replace(/[^\d.-]/g, '')) || 0;
                const desc = `${tx.description || ''} ${tx.transaction_content || ''}`;
                return amt >= total && matchTransferContent(desc, currentOrderId, memo);
              });
              if (hitTx) return true;
            }

            // c) Kiểm tra thông báo biến động mới nhất lastBankAlertJson
            if (serverData.settings && serverData.settings.lastBankAlertJson) {
              try {
                const alertObj = JSON.parse(serverData.settings.lastBankAlertJson);
                if (alertObj && Number(alertObj.amount || 0) >= total && matchTransferContent(alertObj.content || '', currentOrderId, memo)) {
                  return true;
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        // Tiếp tục dự phòng qua API trực tiếp nếu có
      }
    }

    // 2. Đối soát trực tiếp qua User API my.sepay.vn nếu có API Token riêng
    if (token && token !== 'SEPAY_GAS_BRIDGE_ACTIVE_5801434567') {
      try {
        const res = await fetch(`https://my.sepay.vn/userapi/transactions/list?account_number=${CONFIG.SEPAY_ACCOUNT_NUMBER}&limit=20`, {
          headers: {
            'Authorization': `Apikey ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (res.ok) {
          const data = await res.json();
          const list = data.messages || data.transactions || [];
          const found = list.find(tx => {
            const amountMatch = Number(tx.amount_in || 0) >= total;
            return amountMatch && matchTransferContent(tx.transaction_content || '', currentOrderId, memo);
          });
          if (found) return true;
        }
      } catch (e) {}
    }

    return false;
  }

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
        autoCheckTextEl.textContent = 'Đã kết nối SePay • Tự động đối soát BIDV 5801434567 (24/7)...';
      }

      const isPaid = await verifySepayTransactionLive();
      if (isPaid && !isPaymentCompleted) {
        saveCurrentOrder('PAID');
        onPaymentSuccess();
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

  // Đóng dấu bản quyền thông tin Mã đơn & Người mua trực tiếp lên từng trang file PDF
  function replaceAsciiSlotInBuffer(uint8, targetStr, replacementStr) {
    const clean = String(replacementStr || '')
      .replace(/[()\\]/g, ' ')
      .replace(/[^\x20-\x7E]/g, ' ')
      .slice(0, targetStr.length)
      .padEnd(targetStr.length, ' ');

    const tLen = targetStr.length;
    const tBytes = new Uint8Array(tLen);
    const rBytes = new Uint8Array(tLen);
    for (let i = 0; i < tLen; i++) {
      tBytes[i] = targetStr.charCodeAt(i);
      rBytes[i] = clean.charCodeAt(i);
    }

    const limit = uint8.length - tLen;
    for (let i = 0; i <= limit; i++) {
      if (uint8[i] !== tBytes[0]) continue;
      let match = true;
      for (let j = 1; j < tLen; j++) {
        if (uint8[i + j] !== tBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let j = 0; j < tLen; j++) {
          uint8[i + j] = rBytes[j];
        }
      }
    }
  }

  async function downloadWatermarkedPdf(orderData, btnEl) {
    const origHtml = btnEl ? btnEl.innerHTML : '';
    try {
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = '<span>Đang đóng dấu bản quyền Mã đơn #' + orderData.orderId + '...</span>';
      }

      const res = await fetch('assets/pdf/so-tay-toan-thpt.pdf?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('PDF fetch failed');
      const buf = await res.arrayBuffer();
      const uint8 = new Uint8Array(buf);

      const safeId = removeVietnameseTones(orderData.orderId || 'PTC000000').replace(/\s+/g, '') || 'PTC000000';
      const safeName = removeVietnameseTones(orderData.name || 'KHACH HANG').slice(0, 26) || 'KHACH HANG';
      const safePhone = String(orderData.phone || '').replace(/\D/g, '').slice(0, 12) || '0905957716';
      const safeEmail = String(orderData.email || '').replace(/[^a-zA-Z0-9@._-]/g, '').toUpperCase().slice(0, 34) || 'KHACHHANG';

      const SLOT_TOP   = 'BAN QUYEN LOP TOAN ANH CHI | MA DON: #PTC000000 | NGHIEM CAM SAO CHEP & CHIA SE FILE PDF'.padEnd(90, ' ');
      const SLOT_BOT   = 'BAN QUYEN RIENG: #PTC000000 | KHACH HANG: NGUYEN VAN A | SDT: 0905957716 | LOP TOAN ANH CHI'.padEnd(96, ' ');
      const SLOT_DIAG1 = 'BAN QUYEN LOP TOAN ANH CHI - MA DON: #PTC000000'.padEnd(68, ' ');
      const SLOT_DIAG2 = 'NGUOI MUA: NGUYEN VAN A - SDT: 0905957716 - CAM CHIA SE'.padEnd(68, ' ');
      const SLOT_META  = '%WM_TRACE:ID=#PTC000000|NAME=NGUYEN VAN A|PHONE=0905957716|EMAIL=LOPTOANANHCHI@GMAIL.COM'.padEnd(120, ' ');

      const newTop   = `BAN QUYEN LOP TOAN ANH CHI | MA DON: #${safeId} | NGHIEM CAM SAO CHEP & CHIA SE FILE PDF`;
      const newBot   = `BAN QUYEN RIENG: #${safeId} | KHACH HANG: ${safeName} | SDT: ${safePhone} | LOP TOAN ANH CHI`;
      const newDiag1 = `BAN QUYEN LOP TOAN ANH CHI - MA DON: #${safeId}`;
      const newDiag2 = `NGUOI MUA: ${safeName} - SDT: ${safePhone} - CAM CHIA SE`;
      const newMeta  = `%WM_TRACE:ID=#${safeId}|NAME=${safeName}|PHONE=${safePhone}|EMAIL=${safeEmail}`;

      replaceAsciiSlotInBuffer(uint8, SLOT_TOP, newTop);
      replaceAsciiSlotInBuffer(uint8, SLOT_BOT, newBot);
      replaceAsciiSlotInBuffer(uint8, SLOT_DIAG1, newDiag1);
      replaceAsciiSlotInBuffer(uint8, SLOT_DIAG2, newDiag2);
      replaceAsciiSlotInBuffer(uint8, SLOT_META, newMeta);

      const blob = new Blob([uint8], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `So-Tay-Toan-THPT-Ban-Quyen-${safeId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      showToast(`Đã tải PDF đóng dấu bản quyền Mã đơn #${safeId}!`);
    } catch (e) {
      showToast('Không thể tạo file PDF lúc này, vui lòng thử lại!');
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = origHtml;
      }
    }
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
      pkgId: pkg.id,
      pkgName: pkg.name,
      hasPdf: Boolean(pkg.hasPdf),
      quantity,
      total,
      memo,
      status: 'PAID',
      paidAt: new Date().toISOString()
    };

    saveCurrentOrder('PAID');

    if (btnUnlockOrderForm) {
      btnUnlockOrderForm.innerHTML = '<span>Tạo đơn mới</span>';
    }

    const deliveryMsg = selectedDelivery === 'pickup'
      ? '<svg class="ui-ico" style="width:14px;height:14px;vertical-align:-2px;color:#15803d;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Mời bạn ghé nhận sách in trực tiếp tại địa chỉ của Thầy Chí: <b>84/11 Đô Đốc Bảo, TP. Quy Nhơn</b>!'
      : '<svg class="ui-ico" style="width:14px;height:14px;vertical-align:-2px;color:#15803d;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Bản sách in giấy màu cao cấp của bạn sẽ được Thầy Huỳnh Thanh Chí trực tiếp giao tận nơi tại Quy Nhơn!';

    const pdfDownloadSectionHtml = pkg.hasPdf ? `
      <div style="margin-bottom: 16px;">
        <button type="button" id="btn-download-watermarked-pdf" class="download-vip-btn" style="width: 100%; justify-content: center; border: none; cursor: pointer;">
          <svg class="ui-ico" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>Tải File Sách PDF (Bản Quyền #${orderData.orderId})</span>
        </button>
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:9px 11px; margin-bottom:10px; font-size:12px; color:#991b1b; line-height:1.45; text-align:left;">
          <svg class="ui-ico" style="width:13px;height:13px;vertical-align:-2px;color:#dc2626;" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          <b>Bảo vệ bản quyền PDF:</b> File PDF đính kèm đã được đóng dấu mã đơn <b>#${orderData.orderId}</b> (${orderData.name} &bull; ${orderData.phone}) trên từng trang để xác thực chủ sở hữu và phát hiện nguồn chia sẻ trái phép.
        </div>
        <div style="font-size:12.5px; color:#15803d; line-height:1.45;">
          ${deliveryMsg}
        </div>
      </div>
    ` : `
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px 14px; margin-bottom:16px; font-size:13px; color:#15803d; line-height:1.5; text-align:left;">
        ${deliveryMsg}
        <div style="margin-top:6px; font-size:12px; color:#4b5563;">
          (Gói <b>COMBO Chỉ Sách</b> chỉ bao gồm sách giấy in màu A5, không đính kèm file Ebook PDF tải xuống).
        </div>
      </div>
    `;

    // Show Order Completed View inside #qr-success-session
    if (qrGatePlaceholder) qrGatePlaceholder.style.display = 'none';
    if (qrActiveSession) qrActiveSession.style.display = 'none';
    if (qrSuccessSession) {
      qrSuccessSession.style.display = 'block';
      qrSuccessSession.innerHTML = `
        <div class="order-success-screen">
          <div class="success-check-badge">
            <svg style="width:32px;height:32px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h3 class="success-title">Thanh Toán Thành Công!</h3>
          <p class="success-sub">Giao dịch đã được hệ thống xác nhận tự động qua Ngân hàng BIDV.</p>

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
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; gap:10px;">
              <span style="color:#666; flex-shrink:0;">Gói sản phẩm:</span>
              <span style="font-weight:600; text-align:right;">${orderData.pkgName}</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px dashed #bbf7d0; padding-top:8px; margin-top:8px; font-size:15px;">
              <span style="font-weight:700; color:#166534;">Số tiền đã thanh toán:</span>
              <b style="color:var(--ink); font-family:var(--serif); font-size:17px;">${formatMoney(orderData.total)}</b>
            </div>
          </div>

          ${pdfDownloadSectionHtml}

          <div style="display:flex; flex-direction:column; gap:10px;">
            <a href="https://zalo.me/${CONFIG.HOTLINE_ZALO}?text=${encodeURIComponent(`Chào Thầy Huỳnh Thanh Chí, em đã thanh toán thành công đơn hàng #${orderData.orderId} (${orderData.pkgName} - ${formatMoney(orderData.total)}). Thầy kiểm tra giúp em nhé!`)}" target="_blank" rel="noopener" class="btn btn-zalo btn-sm" style="width:100%; justify-content:center;">
              <svg class="ui-ico" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              <span>Nhắn Zalo Thầy Huỳnh Thanh Chí (${CONFIG.HOTLINE_DISPLAY || '090 595 7716'})</span>
            </a>

            <button type="button" id="btn-start-new-order" class="btn btn-primary btn-lg" style="width:100%; justify-content:center;">
              <svg class="ui-ico" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Tạo &amp; Mua Đơn Hàng Mới</span>
            </button>
          </div>
        </div>
      `;

      const dlPdfBtn = document.getElementById('btn-download-watermarked-pdf');
      if (dlPdfBtn) {
        dlPdfBtn.addEventListener('click', () => downloadWatermarkedPdf(orderData, dlPdfBtn));
      }

      const newOrderBtn = document.getElementById('btn-start-new-order');
      if (newOrderBtn) {
        newOrderBtn.addEventListener('click', startNewOrderSession);
      }
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
  // Helper: Lấy địa chỉ nhận sách tại TP. Quy Nhơn
  function getCombinedAddress() {
    const pkg = PACKAGES[selectedPackage];
    if (!pkg.isPhysical) {
      return {
        province: 'Bình Định',
        district: 'TP. Quy Nhơn',
        ward: 'Trực tuyến',
        street: 'Nhận qua Zalo & Email',
        full: 'Bản đọc trực tuyến (Zalo & Email)'
      };
    }

    if (selectedDelivery === 'pickup') {
      return {
        province: 'Bình Định',
        district: 'TP. Quy Nhơn',
        ward: 'Đô Đốc Bảo',
        street: '84/11 Đô Đốc Bảo',
        full: 'Ghé nhận trực tiếp tại 84/11 Đô Đốc Bảo, TP. Quy Nhơn'
      };
    }

    const province = 'Bình Định';
    const district = 'TP. Quy Nhơn';
    const ward = wardInput ? wardInput.value.trim() : '';
    const street = streetInput ? streetInput.value.trim() : '';
    const full = [street, ward, district, `${province} (Thầy giao +10.000đ)`].filter(Boolean).join(', ');
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
    if (pkg.isPhysical && selectedDelivery === 'ship_qn') {
      const addr = getCombinedAddress();
      if (!addr.ward) {
        showToast('Vui lòng chọn Phường / Xã tại TP. Quy Nhơn để Thầy giao sách!');
        if (wardInput) wardInput.focus();
        return false;
      }
      if (!addr.street) {
        showToast('Vui lòng nhập Số nhà, tên đường hoặc hẻm tại Quy Nhơn!');
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
    showToast('Chưa ghi nhận tiền vào tài khoản BIDV!');

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
          <div style="font-weight:700; color:#b91c1c; font-size:13.5px; margin-bottom:3px;">Chưa Ghi Nhận Tiền Vào Tài Khoản BIDV</div>
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

    const isPaid = await verifySepayTransactionLive();
    if (isPaid) {
      if (qrCheckingOverlay) qrCheckingOverlay.classList.remove('show');
      saveCurrentOrder('PAID');
      onPaymentSuccess();
      return;
    }

    // Khi chưa có tiền vào tài khoản: Báo không thành công
    setTimeout(() => {
      if (qrCheckingOverlay) qrCheckingOverlay.classList.remove('show');
      showPaymentFailedNotice();
    }, 900);
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Package card selection
    packageItems.forEach(item => {
      item.addEventListener('click', () => {
        if (isQrGenerated) return;
        packageItems.forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedPackage = item.dataset.package;
        updateOrderDisplay();
      });
    });

    // Quy Nhon delivery / pickup selection
    deliveryItems.forEach(item => {
      item.addEventListener('click', () => {
        if (isQrGenerated) return;
        deliveryItems.forEach(i => {
          i.classList.remove('selected');
          i.setAttribute('aria-checked', 'false');
        });
        item.classList.add('selected');
        item.setAttribute('aria-checked', 'true');
        selectedDelivery = item.dataset.delivery || 'pickup';
        updateOrderDisplay();
      });
    });

    // Quantity buttons
    if (qtyMinusBtn) {
      qtyMinusBtn.addEventListener('click', () => {
        if (isQrGenerated) return;
        if (quantity > 1) {
          quantity--;
          if (qtyValEl) qtyValEl.textContent = quantity;
          updateOrderDisplay();
        }
      });
    }

    if (qtyPlusBtn) {
      qtyPlusBtn.addEventListener('click', () => {
        if (isQrGenerated) return;
        if (quantity < 50) {
          quantity++;
          if (qtyValEl) qtyValEl.textContent = quantity;
          updateOrderDisplay();
        }
      });
    }

    // Input listeners for summary updates before QR is locked
    [nameInput, phoneInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => {
          if (isQrGenerated) return;
          updateOrderDisplay();
        });
      }
    });

    // Create Locked QR Buttons (Chỉ cho phép tạo QR sau khi điền xong thông tin)
    if (btnCreateQr) {
      btnCreateQr.addEventListener('click', handleCreateLockedQr);
    }
    if (btnCreateQrRight) {
      btnCreateQrRight.addEventListener('click', handleCreateLockedQr);
    }
    if (btnUnlockOrderForm) {
      btnUnlockOrderForm.addEventListener('click', unlockOrderFormToEdit);
    }

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
        activeQrTab = 'card';
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
          const text = targetEl.dataset.copyRaw || targetEl.textContent.trim().replace(/\sđ$/, '');
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
        link.download = `VietQR-BIDV-HuynhThanhChi.png`;
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
    const adminForgotToggle = document.getElementById('admin-forgot-toggle');
    const adminResetCard = document.getElementById('admin-reset-card');
    const btnRequestResetOtp = document.getElementById('btn-request-reset-otp');
    const resetStage1 = document.getElementById('reset-stage-1');
    const resetStage2 = document.getElementById('reset-stage-2');
    const resetOtpCode = document.getElementById('reset-otp-code');
    const resetNewPassword = document.getElementById('reset-new-password');
    const btnSubmitNewPassword = document.getElementById('btn-submit-new-password');
    const adminSepayTokenInput = document.getElementById('admin-sepay-token-input');
    const adminSaveSepayBtn = document.getElementById('admin-save-sepay-btn');

    let isAdminLoggedIn = false;

    function getAdminPassword() {
      return localStorage.getItem('stc_admin_custom_pwd') || CONFIG.ADMIN_PASSWORD || '336699';
    }

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
      if (adminSepayTokenInput) {
        adminSepayTokenInput.value = getActiveSepayToken();
      }
      renderAdminOrders();
    }

    function handleLogin() {
      const pwd = adminPasswordInput ? adminPasswordInput.value.trim() : '';
      const correctPwd = getAdminPassword();
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
    if (adminSaveSepayBtn) {
      adminSaveSepayBtn.addEventListener('click', () => {
        const val = adminSepayTokenInput ? adminSepayTokenInput.value.trim() : '';
        const finalToken = val || 'SEPAY_GAS_BRIDGE_ACTIVE_5801434567';
        localStorage.setItem('stc_sepay_api_token', finalToken);
        CONFIG.SEPAY_API_TOKEN = finalToken;
        if (adminSepayTokenInput) adminSepayTokenInput.value = finalToken;
        showToast('Đã lưu Token đối soát SePay & kích hoạt toàn quyền truy cập!');
      });
    }

    // Toggle khung cấp quyền đổi mật khẩu qua email
    if (adminForgotToggle) {
      adminForgotToggle.addEventListener('click', () => {
        if (!adminResetCard) return;
        const isHidden = adminResetCard.style.display === 'none';
        adminResetCard.style.display = isHidden ? 'block' : 'none';
        if (isHidden && resetOtpCode) {
          setTimeout(() => resetOtpCode.focus(), 150);
        }
      });
    }

    // Gửi mã xác thực OTP về email badaoqn132@gmail.com
    if (btnRequestResetOtp) {
      btnRequestResetOtp.addEventListener('click', async () => {
        btnRequestResetOtp.disabled = true;
        btnRequestResetOtp.innerHTML = '<span>Đang gửi mã về email...</span>';

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expire = Date.now() + 15 * 60 * 1000; // 15 phút
        sessionStorage.setItem('stc_admin_reset_token', JSON.stringify({ otp, expire }));

        const targetEmail = CONFIG.ADMIN_RECOVERY_EMAIL || 'badaoqn132@gmail.com';

        // 1. Gửi trực tiếp qua Google Apps Script MailApp (badaoqn132@gmail.com)
        if (CONFIG.GAS_WEBAPP_URL) {
          try {
            fetch(CONFIG.GAS_WEBAPP_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                action: 'sendResetEmail',
                otp: otp,
                resetUrl: window.location.href
              })
            }).catch(() => {});
          } catch (e) {}
        }

        // 2. Dự phòng qua webhook FormSubmit đến badaoqn132@gmail.com
        try {
          fetch(`https://formsubmit.co/ajax/${targetEmail}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              _subject: `[Sổ Tay Toán - Thầy Huỳnh Thanh Chí] Mã OTP Cấp Quyền Đổi Mật Khẩu Admin: ${otp}`,
              email_admin: targetEmail,
              ma_xac_thuc_otp: otp,
              noi_dung: `Chào Thầy Huỳnh Thanh Chí,\n\nHệ thống vừa ghi nhận yêu cầu cấp quyền đổi mật khẩu quản trị Sổ Tay Toán.\n\nMã xác thực OTP của Thầy là: ${otp}\n\nMã có giá trị trong 15 phút. Nếu Thầy không yêu cầu, vui lòng bỏ qua thư này.`,
              thoi_gian: new Date().toLocaleString('vi-VN')
            })
          }).catch(() => {});
        } catch (err) {}

        setTimeout(() => {
          btnRequestResetOtp.disabled = false;
          btnRequestResetOtp.innerHTML = '<span>Đã Gửi Mã &bull; Bấm Để Gửi Lại</span>';
          if (resetStage2) resetStage2.style.display = 'block';
          if (resetOtpCode) resetOtpCode.focus();
          showToast(`Đã gửi quyền và mã OTP về ${targetEmail}!`);
        }, 600);
      });
    }

    // Xác thực OTP và cập nhật mật khẩu mới
    if (btnSubmitNewPassword) {
      btnSubmitNewPassword.addEventListener('click', () => {
        const inputOtp = resetOtpCode ? resetOtpCode.value.trim() : '';
        const newPwd = resetNewPassword ? resetNewPassword.value.trim() : '';

        let tokenData = null;
        try {
          tokenData = JSON.parse(sessionStorage.getItem('stc_admin_reset_token') || 'null');
        } catch (e) {}

        if (!tokenData || tokenData.otp !== inputOtp) {
          showToast('Mã OTP không chính xác!');
          if (resetOtpCode) resetOtpCode.focus();
          return;
        }

        if (Date.now() > tokenData.expire) {
          showToast('Mã OTP đã hết hạn! Vui lòng bấm gửi lại mã.');
          return;
        }

        if (!newPwd || newPwd.length < 6) {
          showToast('Mật khẩu mới phải có tối thiểu 6 ký tự!');
          if (resetNewPassword) resetNewPassword.focus();
          return;
        }

        localStorage.setItem('stc_admin_custom_pwd', newPwd);
        sessionStorage.removeItem('stc_admin_reset_token');

        if (adminResetCard) adminResetCard.style.display = 'none';
        if (resetStage2) resetStage2.style.display = 'none';
        if (resetOtpCode) resetOtpCode.value = '';
        if (resetNewPassword) resetNewPassword.value = '';

        showToast('Đã đổi mật khẩu Admin thành công! Vui lòng đăng nhập.');
        if (adminPasswordInput) {
          adminPasswordInput.value = newPwd;
          adminPasswordInput.focus();
        }
      });
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
    setupSocialProof();
    setupAdminPortal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
