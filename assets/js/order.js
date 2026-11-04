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

  // Packages: Áp dụng hiệu ứng chim mồi & Săn sale (69k - 49k - 39k - 29k, giảm đến 65%)
  const PACKAGES = {
    combo_12: {
      id: 'combo_12',
      name: 'COMBO Bứt Phá Điểm 9+ Tốt Nghiệp Lớp 12',
      price: 69000,
      oldPrice: 199000,
      shipping: 0,
      hasPdf: true,
      isDigital: false,
      isPhysical: true
    },
    combo: {
      id: 'combo',
      name: 'COMBO Vững Vàng Điểm Cao Giữa Kì Và Cuối Kì',
      price: 49000,
      oldPrice: 100000,
      shipping: 0,
      hasPdf: true,
      isDigital: false,
      isPhysical: true
    },
    print: {
      id: 'print',
      name: 'COMBO Tra Cứu Linh Hoạt Mọi Lúc Mọi Nơi',
      price: 39000,
      oldPrice: 70000,
      shipping: 0,
      hasPdf: true,
      isDigital: false,
      isPhysical: true
    },
    book_only: {
      id: 'book_only',
      name: 'COMBO Sổ Tay Cầm Tay Nền Tảng',
      price: 29000,
      oldPrice: 50000,
      shipping: 0,
      hasPdf: false,
      isDigital: false,
      isPhysical: true
    }
  };

  // State
  let selectedPackage = 'combo_12';
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
  const emailFormGroup = document.getElementById('email-form-group');
  const provinceInput = document.getElementById('order-province');
  const districtInput = document.getElementById('order-district');
  const houseInput = document.getElementById('order-house');
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
    const fields = [nameInput, phoneInput, emailInput, provinceInput, districtInput, houseInput, streetInput, noteInput, qtyMinusBtn, qtyPlusBtn];
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

    if (emailFormGroup) {
      emailFormGroup.style.display = pkg.hasPdf ? 'block' : 'none';
    }
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

  // ==========================================================================
  // SUPABASE CLOUD STORAGE & PDF COPYRIGHT WATERMARKING ENGINE
  // ==========================================================================
  const SUPABASE_CFG = {
    url: CONFIG.SUPABASE_URL || 'https://uiyqdqucqplifcvukwul.supabase.co',
    anonKey: CONFIG.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXFkcXVjcXBsaWZjdnVrd3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzQyNTYsImV4cCI6MjEwNDAxMDI1Nn0.QFVahkLpgPklc5rQZnskLY1W5913nZ6Vn80T_As-he0',
    bucket: CONFIG.SUPABASE_BUCKET || 'so-tay-toan-pdfs',
    defaultMasterPath: CONFIG.SUPABASE_DEFAULT_MASTER_PATH || 'master/so-tay-toan-thpt-master.pdf',
    edgeFnSendPdf: CONFIG.SUPABASE_EDGE_FN_SEND_PDF || 'https://uiyqdqucqplifcvukwul.supabase.co/functions/v1/send-order-pdf'
  };

  function getSupabaseHeaders(extra = {}) {
    return Object.assign({
      'Authorization': `Bearer ${SUPABASE_CFG.anonKey}`,
      'apikey': SUPABASE_CFG.anonKey
    }, extra);
  }

  function getSupabasePublicUrl(storagePath) {
    return `${SUPABASE_CFG.url}/storage/v1/object/public/${SUPABASE_CFG.bucket}/${storagePath}`;
  }

  async function fetchActivePdfTemplatesFromSupabase() {
    try {
      const res = await fetch(`${SUPABASE_CFG.url}/rest/v1/so_tay_pdf_templates?select=*&order=updated_at.desc`, {
        headers: getSupabaseHeaders({ 'Accept': 'application/json' }),
        cache: 'no-store'
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          localStorage.setItem('stc_supabase_pdf_templates', JSON.stringify(list));
          return list;
        }
      }
    } catch (e) {}
    try {
      const cached = JSON.parse(localStorage.getItem('stc_supabase_pdf_templates') || '[]');
      if (Array.isArray(cached) && cached.length > 0) return cached;
    } catch (e) {}
    return [{
      id: 'default',
      title: 'Sổ Tay Tóm Tắt Toán THPT - Bản Đầy Đủ 16 Chuyên Đề (128 Trang)',
      package_scope: 'all',
      file_name: 'so-tay-toan-thpt-master.pdf',
      file_size: 2120187,
      page_count: 128,
      storage_path: SUPABASE_CFG.defaultMasterPath,
      public_url: getSupabasePublicUrl(SUPABASE_CFG.defaultMasterPath),
      version_note: 'Bản đầy đủ 16 chuyên đề Toán 10-11-12 (128 trang PDF) chuẩn đóng dấu bản quyền trên Supabase Cloud',
      is_default_slot_pdf: true,
      updated_at: new Date().toISOString()
    }];
  }

  async function resolvePdfTemplateForPackage(pkgId) {
    const list = await fetchActivePdfTemplatesFromSupabase();
    if (pkgId) {
      const specific = list.find(t => t.id === pkgId || t.package_scope === pkgId);
      if (specific) return specific;
    }
    return list.find(t => t.id === 'default' || t.package_scope === 'all') || list[0];
  }

  async function uploadPdfBytesToSupabase(storagePath, uint8) {
    const uploadUrl = `${SUPABASE_CFG.url}/storage/v1/object/${SUPABASE_CFG.bucket}/${storagePath}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: getSupabaseHeaders({
        'Content-Type': 'application/pdf',
        'x-upsert': 'true'
      }),
      body: new Blob([uint8], { type: 'application/pdf' })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Supabase Storage upload failed (${res.status}): ${errText}`);
    }
    return getSupabasePublicUrl(storagePath);
  }

  async function upsertOrderToSupabase(orderObj) {
    if (!orderObj || !orderObj.id) return;
    try {
      const row = {
        order_id: String(orderObj.id),
        customer_name: String(orderObj.name || 'Khách hàng'),
        customer_phone: String(orderObj.phone || ''),
        customer_email: String(orderObj.email || ''),
        full_address: String(orderObj.fullAddress || orderObj.address || ''),
        pkg_id: String(orderObj.pkgId || 'combo_12'),
        pkg_name: String(orderObj.pkgName || ''),
        quantity: Number(orderObj.quantity || 1),
        total_amount: Number(orderObj.total || 0),
        memo: String(orderObj.memo || ''),
        status: String(orderObj.status || 'Chờ thanh toán'),
        watermarked_pdf_path: String(orderObj.watermarkedPdfPath || ''),
        watermarked_pdf_url: String(orderObj.watermarkedPdfUrl || ''),
        email_sent: Boolean(orderObj.emailSent),
        email_sent_at: orderObj.emailSentAt || null,
        updated_at: new Date().toISOString()
      };
      await fetch(`${SUPABASE_CFG.url}/rest/v1/so_tay_orders?on_conflict=order_id`, {
        method: 'POST',
        headers: getSupabaseHeaders({
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        }),
        body: JSON.stringify(row)
      });
    } catch (e) {}
  }

  function containsAsciiPattern(uint8, targetStr) {
    const tLen = targetStr.length;
    if (!uint8 || uint8.length < tLen) return false;
    const limit = uint8.length - tLen;
    for (let i = 0; i <= limit; i++) {
      if (uint8[i] !== targetStr.charCodeAt(0)) continue;
      let match = true;
      for (let j = 1; j < tLen; j++) {
        if (uint8[i + j] !== targetStr.charCodeAt(j)) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
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

  function uint8ToBase64(uint8) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  async function stampAnyPdfWithPdfLib(sourceUint8, { newTop, newBot, newDiag1, newDiag2, newMeta, safeId, safeName, safePhone, safeEmail }) {
    if (!window.PDFLib || !window.PDFLib.PDFDocument) {
      return sourceUint8;
    }
    const { PDFDocument, StandardFonts, rgb, degrees } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(sourceUint8, { ignoreEncryption: true });
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    pdfDoc.setTitle(`So Tay Toan THPT - Ban Quyen #${safeId}`);
    pdfDoc.setAuthor('Thay Huynh Thanh Chi - Lop Toan Anh Chi');
    pdfDoc.setSubject(`BAN QUYEN MA DON #${safeId} | ${safeName} | ${safePhone} | ${safeEmail}`);
    pdfDoc.setKeywords([`#${safeId}`, safeName, safePhone, safeEmail, 'Lop Toan Anh Chi']);

    const pages = pdfDoc.getPages();
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      page.drawText(newTop, {
        x: 24,
        y: height - 16,
        size: 7.2,
        font: fontBold,
        color: rgb(0.55, 0.08, 0.08),
        opacity: 0.72
      });
      page.drawText(newBot, {
        x: 24,
        y: 10,
        size: 7.2,
        font: fontBold,
        color: rgb(0.55, 0.08, 0.08),
        opacity: 0.75
      });
      page.drawText(newDiag1, {
        x: Math.max(36, width * 0.14),
        y: height * 0.36,
        size: 15,
        font: fontBold,
        color: rgb(0.65, 0.1, 0.1),
        opacity: 0.13,
        rotate: degrees(34)
      });
      page.drawText(newDiag2, {
        x: Math.max(36, width * 0.16),
        y: height * 0.28,
        size: 13,
        font: fontBold,
        color: rgb(0.65, 0.1, 0.1),
        opacity: 0.13,
        rotate: degrees(34)
      });
    });

    const stampedBytes = await pdfDoc.save();
    const traceBytes = new TextEncoder().encode(`\n${newMeta}\n`);
    const merged = new Uint8Array(stampedBytes.length + traceBytes.length);
    merged.set(stampedBytes, 0);
    merged.set(traceBytes, stampedBytes.length);
    return merged;
  }

  async function buildWatermarkedPdfPayload(orderData, customOptions = {}) {
    const safeId = removeVietnameseTones(orderData.orderId || orderData.id || 'PTC000000').replace(/\s+/g, '') || 'PTC000000';
    const safeName = removeVietnameseTones(orderData.name || 'KHACH HANG').slice(0, 26) || 'KHACH HANG';
    const safePhone = String(orderData.phone || '').replace(/\D/g, '').slice(0, 12) || '0905957716';
    const safeEmail = String(orderData.email || '').replace(/[^a-zA-Z0-9@._-]/g, '').toUpperCase().slice(0, 34) || 'KHACHHANG';

    let uint8 = null;
    let activeTemplate = customOptions.template || null;

    if (customOptions.rawUint8 instanceof Uint8Array) {
      uint8 = new Uint8Array(customOptions.rawUint8);
    } else {
      if (!activeTemplate) {
        activeTemplate = await resolvePdfTemplateForPackage(orderData.pkgId);
      }
      // 1. Ưu tiên tải PDF gốc từ kho lưu trữ đám mây Supabase Storage
      if (activeTemplate && activeTemplate.public_url) {
        try {
          const sbRes = await fetch(activeTemplate.public_url + '?t=' + Date.now(), { cache: 'no-store' });
          if (sbRes.ok) {
            const ab = await sbRes.arrayBuffer();
            uint8 = new Uint8Array(ab);
          }
        } catch (e) {}
      }
      // 2. Dự phòng từ file nội bộ nếu mạng chập chờn
      if (!uint8) {
        const res = await fetch('assets/pdf/so-tay-toan-thpt.pdf?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('PDF fetch failed');
        const buf = await res.arrayBuffer();
        uint8 = new Uint8Array(buf);
      }
    }

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

    if (containsAsciiPattern(uint8, 'MA DON: #PTC000000')) {
      replaceAsciiSlotInBuffer(uint8, SLOT_TOP, newTop);
      replaceAsciiSlotInBuffer(uint8, SLOT_BOT, newBot);
      replaceAsciiSlotInBuffer(uint8, SLOT_DIAG1, newDiag1);
      replaceAsciiSlotInBuffer(uint8, SLOT_DIAG2, newDiag2);
      replaceAsciiSlotInBuffer(uint8, SLOT_META, newMeta);
    } else {
      // File PDF đầy đủ chi tiết / file thay thế do Thầy upload trong Admin -> Đóng dấu động bằng pdf-lib lên mọi trang
      uint8 = await stampAnyPdfWithPdfLib(uint8, {
        newTop, newBot, newDiag1, newDiag2, newMeta,
        safeId, safeName, safePhone, safeEmail
      });
    }

    const fileName = `So-Tay-Toan-THPT-Ban-Quyen-${safeId}.pdf`;
    const supabaseStoragePath = `orders/${fileName}`;
    let supabasePdfUrl = getSupabasePublicUrl(supabaseStoragePath);

    // Tự động lưu bản PDF đã đóng dấu bản quyền của khách hàng lên Supabase Storage
    try {
      supabasePdfUrl = await uploadPdfBytesToSupabase(supabaseStoragePath, uint8);
    } catch (e) {}

    const blob = new Blob([uint8], { type: 'application/pdf' });
    return {
      uint8,
      blob,
      fileName,
      safeId,
      supabaseStoragePath,
      supabasePdfUrl,
      templateTitle: activeTemplate ? activeTemplate.title : 'Sổ Tay Tóm Tắt Toán THPT'
    };
  }

  function triggerBlobDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function sendWatermarkedPdfToEmail(orderData, pdfPayload, opts = {}) {
    if (!orderData || !orderData.email) return false;
    const statusBox = document.getElementById('email-send-status-box');
    const baseUrl = window.location.origin + window.location.pathname;
    const oid = orderData.orderId || orderData.id || pdfPayload.safeId;
    const personalPdfUrl = `${baseUrl}?dl_pdf=1&oid=${encodeURIComponent(oid)}&name=${encodeURIComponent(orderData.name)}&phone=${encodeURIComponent(orderData.phone)}&email=${encodeURIComponent(orderData.email)}`;
    const cloudPdfUrl = pdfPayload.supabasePdfUrl || personalPdfUrl;
    const isReplacement = Boolean(opts.isReplacement);
    const versionNote = opts.versionNote || '';

    // 1. Gửi tự động qua Supabase Edge Function (send-order-pdf) kết nối trực tiếp Supabase Storage + Resend + Google Apps Script
    try {
      fetch(SUPABASE_CFG.edgeFnSendPdf, {
        method: 'POST',
        headers: getSupabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          orderId: oid,
          name: orderData.name,
          phone: orderData.phone,
          email: orderData.email,
          pkgName: orderData.pkgName || 'Sổ Tay Toán THPT',
          totalFormatted: formatMoney(orderData.total || 0),
          supabasePdfUrl: cloudPdfUrl,
          personalPdfUrl: personalPdfUrl,
          fileName: pdfPayload.fileName,
          isReplacement: isReplacement,
          versionNote: versionNote,
          gasWebappUrl: CONFIG.GAS_WEBAPP_URL || ''
        })
      }).catch(() => {});
    } catch (e) {}

    // 2. Gửi song song qua cổng Email tự động kèm link file PDF đóng dấu bản quyền trên Supabase Cloud
    try {
      fetch(`https://formsubmit.co/ajax/${orderData.email}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: isReplacement
            ? `[Lớp Toán Anh Chí] File PDF Thay Thế / Bản Đầy Đủ Chi Tiết - Mã Đơn #${oid}`
            : `[Lớp Toán Anh Chí] File PDF Bản Quyền Sổ Tay Toán THPT - Mã Đơn #${oid}`,
          _cc: 'badaoqn132@gmail.com',
          ma_don_hang: `#${oid}`,
          khach_hang: orderData.name,
          so_dien_thoai: orderData.phone,
          email_nhan_file: orderData.email,
          goi_san_pham: orderData.pkgName || 'Sổ Tay Toán THPT',
          ghi_chu_phien_ban: versionNote || 'Bản chuẩn đóng dấu bản quyền trên Supabase Cloud',
          link_tai_file_pdf_supabase_cloud: cloudPdfUrl,
          link_tai_du_phong: personalPdfUrl,
          ghi_chu_ban_quyen: `File PDF của bạn đã được đóng dấu bản quyền Mã đơn #${oid} (${orderData.name} - ${orderData.phone}) và lưu trữ trên Supabase Cloud. Bấm vào link trên để tải file bất kỳ lúc nào.`
        })
      }).catch(() => {});
    } catch (e) {}

    // Cập nhật trạng thái đã lưu PDF Supabase & gửi Email vào CSDL đơn hàng
    try {
      const orders = JSON.parse(localStorage.getItem('stc_admin_orders_db') || '[]');
      const idx = orders.findIndex(o => o.id === oid);
      if (idx >= 0) {
        orders[idx].watermarkedPdfPath = pdfPayload.supabaseStoragePath;
        orders[idx].watermarkedPdfUrl = cloudPdfUrl;
        orders[idx].emailSent = true;
        orders[idx].emailSentAt = new Date().toISOString();
        localStorage.setItem('stc_admin_orders_db', JSON.stringify(orders));
        upsertOrderToSupabase(orders[idx]);
      } else {
        upsertOrderToSupabase({
          id: oid,
          name: orderData.name,
          phone: orderData.phone,
          email: orderData.email,
          fullAddress: orderData.address || '',
          pkgId: orderData.pkgId || 'combo_12',
          pkgName: orderData.pkgName || '',
          quantity: orderData.quantity || 1,
          total: orderData.total || 0,
          memo: orderData.memo || '',
          status: 'Đã thanh toán',
          watermarkedPdfPath: pdfPayload.supabaseStoragePath,
          watermarkedPdfUrl: cloudPdfUrl,
          emailSent: true,
          emailSentAt: new Date().toISOString()
        });
      }
    } catch (e) {}

    if (statusBox) {
      statusBox.innerHTML = `
        <svg class="ui-ico" style="width:14px;height:14px;vertical-align:-2px;color:#15803d;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <b>Đã lưu trên Supabase &amp; tự động gửi Email:</b> File PDF đóng dấu bản quyền Mã đơn <b>#${oid}</b> đã được lưu trên Supabase Cloud, tự động tải xuống và gửi tới <b>${orderData.email}</b>!
      `;
    }
    return true;
  }

  async function downloadWatermarkedPdf(orderData, btnEl, opts = {}) {
    const origHtml = btnEl ? btnEl.innerHTML : '';
    const oid = orderData.orderId || orderData.id || 'PTC000000';
    try {
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = '<span>Đang đóng dấu &amp; lưu Supabase #' + oid + '...</span>';
      }

      const payload = await buildWatermarkedPdfPayload(orderData, opts);
      if (opts.skipBrowserDownload !== true) {
        triggerBlobDownload(payload.blob, payload.fileName);
      }

      if (opts.autoSendEmail && orderData.email) {
        await sendWatermarkedPdfToEmail(orderData, payload, opts);
        showToast(`Đã lưu Supabase & gửi PDF bản quyền #${payload.safeId} về ${orderData.email}!`);
      } else {
        showToast(`Đã tạo & tải PDF đóng dấu bản quyền Mã đơn #${payload.safeId}!`);
      }
      return payload;
    } catch (e) {
      showToast('Không thể tạo file PDF lúc này, vui lòng thử lại!');
      return null;
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
          <span>Tải Lại File Sách PDF (Bản Quyền #${orderData.orderId})</span>
        </button>
        <div id="email-send-status-box" style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:9px 11px; margin-bottom:8px; font-size:12px; color:#166534; line-height:1.45; text-align:left;">
          <svg class="ui-ico" style="width:13px;height:13px;vertical-align:-2px;color:#15803d;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Đang tự động tải xuống &amp; gửi file PDF đóng dấu bản quyền Mã đơn <b>#${orderData.orderId}</b> về email <b>${orderData.email}</b>...
        </div>
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
        dlPdfBtn.addEventListener('click', () => downloadWatermarkedPdf(orderData, dlPdfBtn, { autoSendEmail: false }));
      }

      const newOrderBtn = document.getElementById('btn-start-new-order');
      if (newOrderBtn) {
        newOrderBtn.addEventListener('click', startNewOrderSession);
      }

      // Khi thanh toán thành công và gói có kèm PDF + đã điền email: Tự động tải về máy & gửi file PDF đóng dấu bản quyền tới email đã điền
      if (pkg.hasPdf && orderData.email) {
        downloadWatermarkedPdf(orderData, dlPdfBtn, { autoSendEmail: true });
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
    const house = houseInput ? houseInput.value.trim() : '';
    const street = streetInput ? streetInput.value.trim() : '';
    const addrParts = [house ? `Số nhà ${house}` : '', street ? `Đường ${street}` : '', district, `${province} (Thầy giao +10.000đ)`].filter(Boolean);
    const full = addrParts.join(', ');
    return { province, district, ward: house, street, full };
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

    const pkg = PACKAGES[selectedPackage];
    if (pkg.hasPdf) {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Vui lòng nhập Email hợp lệ để nhận tự động file PDF bản quyền!');
        if (emailInput) emailInput.focus();
        return false;
      }
    }

    if (pkg.isPhysical && selectedDelivery === 'ship_qn') {
      const house = houseInput ? houseInput.value.trim() : '';
      const street = streetInput ? streetInput.value.trim() : '';
      if (!house) {
        showToast('Vui lòng nhập Số nhà để Thầy giao sách!');
        if (houseInput) houseInput.focus();
        return false;
      }
      if (!street) {
        showToast('Vui lòng nhập Tên đường để Thầy giao sách!');
        if (streetInput) streetInput.focus();
        return false;
      }
    }

    // Tự động lưu thông tin khách hàng vào cơ sở dữ liệu nội bộ
    saveCurrentOrder('PENDING');

    return true;
  }

  // Lưu thông tin khách hàng vào cơ sở dữ liệu admin & đồng bộ Supabase Cloud
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

    upsertOrderToSupabase(orderData);

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
  // ADMIN ORDER MANAGEMENT & SUPABASE PDF UPLOAD / REPLACEMENT PORTAL
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
    const adminSearchClearBtn = document.getElementById('admin-search-clear-btn');
    const adminFilterStatus = document.getElementById('admin-filter-status');
    const adminFilterPackage = document.getElementById('admin-filter-package');
    const adminSortOrders = document.getElementById('admin-sort-orders');
    const adminFilterCountBadge = document.getElementById('admin-filter-count-badge');
    const adminSelectAllOrders = document.getElementById('admin-select-all-orders');
    const adminDeleteSelectedBtn = document.getElementById('admin-delete-selected-btn');
    const adminDeleteSelectedLabel = document.getElementById('admin-delete-selected-label');
    const adminDeletePendingBtn = document.getElementById('admin-delete-pending-btn');
    const adminDeleteAllBtn = document.getElementById('admin-delete-all-btn');
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

    // Supabase PDF Upload & Replacement Controls
    const adminSyncSupabaseBtn = document.getElementById('admin-sync-supabase-btn');
    const adminActivePdfList = document.getElementById('admin-active-pdf-list');
    const adminUploadPdfFile = document.getElementById('admin-upload-pdf-file');
    const adminUploadFileMeta = document.getElementById('admin-upload-file-meta');
    const adminUploadPdfTitle = document.getElementById('admin-upload-pdf-title');
    const adminUploadPdfScope = document.getElementById('admin-upload-pdf-scope');
    const adminUploadSendMode = document.getElementById('admin-upload-send-mode');
    const adminReplaceRecipientBox = document.getElementById('admin-replace-recipient-box');
    const adminReplaceOrderSelect = document.getElementById('admin-replace-order-select');
    const adminReplaceOrderId = document.getElementById('admin-replace-order-id');
    const adminReplaceName = document.getElementById('admin-replace-name');
    const adminReplacePhone = document.getElementById('admin-replace-phone');
    const adminReplaceEmail = document.getElementById('admin-replace-email');
    const adminUploadVersionNote = document.getElementById('admin-upload-version-note');
    const adminUploadPdfSubmitBtn = document.getElementById('admin-upload-pdf-submit-btn');
    const adminUploadStatusBox = document.getElementById('admin-upload-status-box');

    let isAdminLoggedIn = false;
    let selectedUploadFileBytes = null;
    let selectedUploadPageCount = 128;
    const selectedOrderIds = new Set();

    function getAdminPassword() {
      return localStorage.getItem('stc_admin_custom_pwd') || CONFIG.ADMIN_PASSWORD || '336699';
    }

    function formatBytes(bytes) {
      const b = Number(bytes || 0);
      if (b < 1024) return b + ' B';
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
      return (b / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function getScopeLabel(scope) {
      if (scope === 'combo_12') return 'COMBO Bứt Phá Điểm 9+ Tốt Nghiệp Lớp 12 (69.000 đ)';
      if (scope === 'combo') return 'COMBO Vững Vàng Điểm Cao Giữa Kì Và Cuối Kì (49.000 đ)';
      if (scope === 'print') return 'COMBO Tra Cứu Linh Hoạt Mọi Lúc Mọi Nơi (39.000 đ)';
      return 'Mặc định cho TẤT CẢ gói có sách điện tử';
    }

    function getDeletedOrderIdsSet() {
      try {
        return new Set(JSON.parse(localStorage.getItem('stc_deleted_order_ids') || '[]'));
      } catch (e) {
        return new Set();
      }
    }

    function saveDeletedOrderIdsSet(setObj) {
      try {
        localStorage.setItem('stc_deleted_order_ids', JSON.stringify(Array.from(setObj).slice(-1000)));
      } catch (e) {}
    }

    async function deleteOrdersByIds(idsArray) {
      const targetIds = (idsArray || []).map(x => String(x || '').trim()).filter(Boolean);
      if (targetIds.length === 0) return 0;

      const idSet = new Set(targetIds);
      const deletedSet = getDeletedOrderIdsSet();
      targetIds.forEach(id => {
        deletedSet.add(id);
        selectedOrderIds.delete(id);
      });
      saveDeletedOrderIdsSet(deletedSet);

      const remaining = getOrders().filter(o => o && !idSet.has(String(o.id)));
      localStorage.setItem('stc_admin_orders_db', JSON.stringify(remaining));

      // Đồng bộ xóa trên Supabase Cloud
      try {
        const quoted = targetIds.map(id => `"${id.replace(/"/g, '')}"`).join(',');
        await fetch(`${SUPABASE_CFG.url}/rest/v1/so_tay_orders?order_id=in.(${encodeURIComponent(quoted)})`, {
          method: 'DELETE',
          headers: getSupabaseHeaders({ 'Prefer': 'return=minimal' })
        });
      } catch (e) {}

      renderAdminOrders();
      populateRecipientOrderSelect();
      return targetIds.length;
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

    async function syncOrdersFromSupabase() {
      try {
        const res = await fetch(`${SUPABASE_CFG.url}/rest/v1/so_tay_orders?select=*&order=created_at.desc&limit=300`, {
          headers: getSupabaseHeaders({ 'Accept': 'application/json' }),
          cache: 'no-store'
        });
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows)) return;

        const deletedSet = getDeletedOrderIdsSet();
        const localOrders = getOrders();
        const byId = new Map();
        localOrders.forEach(o => {
          if (o && o.id && !deletedSet.has(String(o.id))) byId.set(o.id, o);
        });

        rows.forEach(r => {
          if (!r || !r.order_id || deletedSet.has(String(r.order_id))) return;
          const existing = byId.get(r.order_id) || {};
          byId.set(r.order_id, Object.assign({
            id: r.order_id,
            createdAt: r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : (existing.createdAt || ''),
            name: r.customer_name || existing.name || 'Khách hàng',
            phone: r.customer_phone || existing.phone || '',
            email: r.customer_email || existing.email || '',
            fullAddress: r.full_address || existing.fullAddress || '',
            pkgId: r.pkg_id || existing.pkgId || 'combo_12',
            pkgName: r.pkg_name || existing.pkgName || '',
            quantity: r.quantity || existing.quantity || 1,
            total: Number(r.total_amount || existing.total || 0),
            memo: r.memo || existing.memo || '',
            status: r.status || existing.status || 'Chờ thanh toán',
            watermarkedPdfPath: r.watermarked_pdf_path || existing.watermarkedPdfPath || '',
            watermarkedPdfUrl: r.watermarked_pdf_url || existing.watermarkedPdfUrl || '',
            emailSent: Boolean(r.email_sent || existing.emailSent),
            timestamp: r.created_at ? new Date(r.created_at).getTime() : (existing.timestamp || Date.now())
          }, existing, {
            watermarkedPdfUrl: r.watermarked_pdf_url || existing.watermarkedPdfUrl || '',
            emailSent: Boolean(r.email_sent || existing.emailSent)
          }));
        });

        const merged = Array.from(byId.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        localStorage.setItem('stc_admin_orders_db', JSON.stringify(merged.slice(0, 500)));
      } catch (e) {}
    }

    async function renderSupabasePdfTemplates() {
      if (!adminActivePdfList) return;
      const templates = await fetchActivePdfTemplatesFromSupabase();
      adminActivePdfList.innerHTML = templates.map(t => `
        <div class="admin-pdf-tpl-card">
          <div style="min-width:220px; flex:1;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:4px;">
              <span class="admin-pdf-scope-badge">
                ${getScopeLabel(t.package_scope)}
              </span>
              <b style="color:var(--text); font-size:13px;">${t.title || t.file_name}</b>
            </div>
            <div style="color:var(--text-3); font-size:11.5px;">
              File trên Supabase: <code>${t.storage_path}</code> &bull; Dung lượng: <b>${formatBytes(t.file_size)}</b> &bull; Số trang: <b>${t.page_count || 128} trang</b>
              ${t.version_note ? ` &bull; Ghi chú: <i>${t.version_note}</i>` : ''}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <a href="${t.public_url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="height:30px; padding:0 10px; font-size:11.5px;">
              <span>Xem File Gốc (Supabase)</span>
            </a>
            <button type="button" class="btn btn-green btn-sm" data-test-template-id="${t.id}" style="height:30px; padding:0 10px; font-size:11.5px;">
              <span>Tải Thử Bản Đóng Dấu</span>
            </button>
          </div>
        </div>
      `).join('');

      adminActivePdfList.querySelectorAll('[data-test-template-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tplId = btn.getAttribute('data-test-template-id');
          const tpl = templates.find(x => x.id === tplId) || templates[0];
          await downloadWatermarkedPdf({
            orderId: 'PTC999999',
            name: 'THAY HUYNH THANH CHI',
            phone: '0905957716',
            email: 'badaoqn132@gmail.com',
            pkgId: tpl.package_scope === 'all' ? 'combo_12' : tpl.package_scope,
            pkgName: tpl.title
          }, btn, { autoSendEmail: false, template: tpl });
        });
      });
    }

    function populateRecipientOrderSelect() {
      if (!adminReplaceOrderSelect) return;
      const orders = getOrders();
      adminReplaceOrderSelect.innerHTML = '<option value="">-- Chọn nhanh từ đơn đã đặt --</option>' +
        orders.slice(0, 60).map(o => `<option value="${o.id}">#${o.id} - ${o.name || 'Khách'} (${o.phone || ''} ${o.email ? '• ' + o.email : ''})</option>`).join('');
    }

    async function showDashboard() {
      if (adminGateBox) adminGateBox.style.display = 'none';
      if (adminDashboardBox) adminDashboardBox.style.display = 'block';
      if (adminSepayTokenInput) {
        adminSepayTokenInput.value = getActiveSepayToken();
      }
      renderAdminOrders();
      populateRecipientOrderSelect();
      await renderSupabasePdfTemplates();
      await syncOrdersFromSupabase();
      renderAdminOrders();
      populateRecipientOrderSelect();
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

    function updateBulkActionButtons(filteredOrders) {
      const existingIds = new Set(getOrders().map(o => String(o.id)));
      Array.from(selectedOrderIds).forEach(id => {
        if (!existingIds.has(id)) selectedOrderIds.delete(id);
      });

      const selectedCount = selectedOrderIds.size;
      if (adminDeleteSelectedBtn) {
        adminDeleteSelectedBtn.disabled = selectedCount === 0;
      }
      if (adminDeleteSelectedLabel) {
        adminDeleteSelectedLabel.textContent = `Xóa Đã Chọn (${selectedCount})`;
      }
      if (adminSelectAllOrders) {
        const visibleIds = (filteredOrders || []).map(o => String(o.id)).filter(Boolean);
        adminSelectAllOrders.checked = visibleIds.length > 0 && visibleIds.every(id => selectedOrderIds.has(id));
        adminSelectAllOrders.indeterminate = visibleIds.some(id => selectedOrderIds.has(id)) && !adminSelectAllOrders.checked;
      }
    }

    function renderAdminOrders() {
      const orders = getOrders();
      const tbody = document.getElementById('admin-table-body');
      const emptyNotice = document.getElementById('admin-empty-notice');
      const totalOrdersEl = document.getElementById('admin-stat-total-orders');
      const paidOrdersEl = document.getElementById('admin-stat-paid-orders');
      const pendingOrdersEl = document.getElementById('admin-stat-pending-orders');
      const revenueEl = document.getElementById('admin-stat-revenue');

      let paidCount = 0;
      let pendingCount = 0;
      let totalRevenue = 0;

      orders.forEach(o => {
        if (o.status === 'Đã thanh toán') {
          paidCount++;
          totalRevenue += Number(o.total || 0);
        } else {
          pendingCount++;
        }
      });

      if (totalOrdersEl) totalOrdersEl.textContent = orders.length;
      if (paidOrdersEl) paidOrdersEl.textContent = paidCount;
      if (pendingOrdersEl) pendingOrdersEl.textContent = pendingCount;
      if (revenueEl) revenueEl.textContent = formatMoney(totalRevenue);

      if (!tbody) return;

      const rawQuery = adminSearchInput ? adminSearchInput.value.trim() : '';
      if (adminSearchClearBtn) {
        adminSearchClearBtn.style.display = rawQuery ? 'inline-flex' : 'none';
      }
      const q = rawQuery.toLowerCase();
      const qNoTone = removeVietnameseTones(rawQuery).toLowerCase();
      const statusFilter = adminFilterStatus ? adminFilterStatus.value : 'all';
      const pkgFilter = adminFilterPackage ? adminFilterPackage.value : 'all';
      const sortMode = adminSortOrders ? adminSortOrders.value : 'newest';

      const filtered = orders.filter(o => {
        if (statusFilter === 'paid' && o.status !== 'Đã thanh toán') return false;
        if (statusFilter === 'pending' && o.status === 'Đã thanh toán') return false;
        if (pkgFilter !== 'all' && o.pkgId !== pkgFilter) return false;
        if (!q) return true;

        const haystack = [
          o.id,
          o.name,
          o.phone,
          o.email,
          o.fullAddress,
          o.pkgName,
          o.memo,
          o.status
        ].filter(Boolean).join(' ');
        const hayLower = haystack.toLowerCase();
        const hayNoTone = removeVietnameseTones(haystack).toLowerCase();
        return hayLower.includes(q) || hayNoTone.includes(qNoTone);
      });

      filtered.sort((a, b) => {
        if (sortMode === 'oldest') return (a.timestamp || 0) - (b.timestamp || 0);
        if (sortMode === 'amount_desc') return Number(b.total || 0) - Number(a.total || 0);
        if (sortMode === 'name_asc') return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
        return (b.timestamp || 0) - (a.timestamp || 0);
      });

      updateBulkActionButtons(filtered);

      if (adminFilterCountBadge) {
        adminFilterCountBadge.textContent = `Hiển thị: ${filtered.length} / ${orders.length} đơn${selectedOrderIds.size > 0 ? ` • Đã chọn ${selectedOrderIds.size}` : ''}`;
      }

      if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyNotice) emptyNotice.style.display = 'block';
        return;
      }

      if (emptyNotice) emptyNotice.style.display = 'none';
      tbody.innerHTML = filtered.map(o => {
        const oid = String(o.id || '');
        const isChecked = selectedOrderIds.has(oid);
        const isBookOnly = o.pkgId === 'book_only';
        const sbPdfLink = o.watermarkedPdfUrl || getSupabasePublicUrl(`orders/So-Tay-Toan-THPT-Ban-Quyen-${oid}.pdf`);
        return `
        <tr class="${isChecked ? 'row-selected' : ''}">
          <td class="col-check-cell">
            <input type="checkbox" class="admin-row-check" data-check-order="${oid}" ${isChecked ? 'checked' : ''} aria-label="Chọn đơn #${oid}" />
          </td>
          <td>
            <div class="admin-order-id">#${oid}</div>
            <div class="admin-order-time">${o.createdAt || '---'}</div>
          </td>
          <td>
            <div class="admin-customer-name">${o.name || '---'}</div>
            ${o.quantity && o.quantity > 1 ? `<div class="admin-order-time">SL: ${o.quantity} cuốn</div>` : ''}
          </td>
          <td>
            <div><a href="tel:${o.phone || ''}" class="admin-contact-phone">${o.phone || '---'}</a></div>
            <div class="admin-contact-email" title="${o.email || ''}">${o.email || '<span style="color:var(--text-4);">Không có email</span>'}</div>
          </td>
          <td>
            <div class="admin-address-text" title="${o.fullAddress || ''}">${o.fullAddress || '---'}</div>
          </td>
          <td>
            <div class="admin-pkg-title">${o.pkgName || '---'}</div>
          </td>
          <td>
            <div class="admin-amount-val">${formatMoney(o.total || 0)}</div>
            <span class="admin-memo-code">${o.memo || `PTC${oid}`}</span>
          </td>
          <td>
            <span class="${o.status === 'Đã thanh toán' ? 'badge-status-paid' : 'badge-status-pending'}">
              ${o.status || 'Chờ thanh toán'}
            </span>
          </td>
          <td>
            <div class="admin-row-actions">
              ${isBookOnly ? '<span style="color:var(--text-3);font-size:11px;font-weight:600;">Chỉ Sách In</span>' : `
                <button type="button" class="btn btn-ghost btn-sm" data-admin-dl-pdf="${oid}" title="Tải file PDF đóng dấu của đơn #${oid}">
                  <span>Tải PDF</span>
                </button>
                <button type="button" class="btn btn-green btn-sm" data-admin-send-pdf="${oid}" title="Gửi hoặc gửi lại PDF qua Email">
                  <span>${o.emailSent ? 'Gửi Lại Mail' : 'Gửi Mail'}</span>
                </button>
              `}
              <button type="button" class="btn btn-danger-outline btn-sm" data-admin-del-order="${oid}" title="Xóa đơn hàng #${oid}">
                <svg class="ui-ico" style="width:12px;height:12px;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
                <span>Xóa</span>
              </button>
              ${(!isBookOnly && o.watermarkedPdfUrl) ? `<a href="${sbPdfLink}" target="_blank" rel="noopener" style="font-size:10.5px; color:var(--green); font-weight:700; text-decoration:underline;">File Cloud</a>` : ''}
            </div>
          </td>
        </tr>
      `}).join('');

      tbody.querySelectorAll('[data-check-order]').forEach(chk => {
        chk.addEventListener('change', () => {
          const oid = chk.getAttribute('data-check-order');
          if (!oid) return;
          if (chk.checked) {
            selectedOrderIds.add(oid);
          } else {
            selectedOrderIds.delete(oid);
          }
          const tr = chk.closest('tr');
          if (tr) tr.classList.toggle('row-selected', chk.checked);
          updateBulkActionButtons(filtered);
          if (adminFilterCountBadge) {
            adminFilterCountBadge.textContent = `Hiển thị: ${filtered.length} / ${orders.length} đơn${selectedOrderIds.size > 0 ? ` • Đã chọn ${selectedOrderIds.size}` : ''}`;
          }
        });
      });

      tbody.querySelectorAll('[data-admin-del-order]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const oid = btn.getAttribute('data-admin-del-order');
          const ord = orders.find(x => String(x.id) === String(oid));
          if (!oid) return;
          const ok = window.confirm(`Xác nhận xóa đơn hàng #${oid}${ord && ord.name ? ` của khách "${ord.name}"` : ''}?`);
          if (!ok) return;
          await deleteOrdersByIds([oid]);
          showToast(`Đã xóa đơn hàng #${oid} thành công.`);
        });
      });

      tbody.querySelectorAll('[data-admin-dl-pdf]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const oid = btn.getAttribute('data-admin-dl-pdf');
          const ord = orders.find(x => String(x.id) === String(oid));
          if (!ord) return;
          await downloadWatermarkedPdf({
            orderId: ord.id,
            name: ord.name,
            phone: ord.phone,
            email: ord.email,
            pkgId: ord.pkgId,
            pkgName: ord.pkgName,
            total: ord.total
          }, btn, { autoSendEmail: false });
          renderAdminOrders();
        });
      });

      tbody.querySelectorAll('[data-admin-send-pdf]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const oid = btn.getAttribute('data-admin-send-pdf');
          const ord = orders.find(x => String(x.id) === String(oid));
          if (!ord) return;
          let targetEmail = ord.email;
          if (!targetEmail) {
            const prompted = window.prompt(`Nhập địa chỉ Email của khách hàng ${ord.name} (#${ord.id}) để nhận file PDF bản quyền:`, '');
            if (!prompted || !prompted.trim()) return;
            targetEmail = prompted.trim();
            ord.email = targetEmail;
            localStorage.setItem('stc_admin_orders_db', JSON.stringify(orders));
          }
          await downloadWatermarkedPdf({
            orderId: ord.id,
            name: ord.name,
            phone: ord.phone,
            email: targetEmail,
            pkgId: ord.pkgId,
            pkgName: ord.pkgName,
            total: ord.total
          }, btn, {
            autoSendEmail: true,
            skipBrowserDownload: true,
            isReplacement: true,
            versionNote: adminUploadVersionNote && adminUploadVersionNote.value.trim()
              ? adminUploadVersionNote.value.trim()
              : 'Bản cập nhật đầy đủ chi tiết từ kho lưu trữ Supabase của Lớp Toán Anh Chí'
          });
          renderAdminOrders();
        });
      });
    }

    // Xử lý chọn file PDF trong Admin -> Tự động đọc dung lượng & đếm số trang
    if (adminUploadPdfFile) {
      adminUploadPdfFile.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) {
          selectedUploadFileBytes = null;
          if (adminUploadFileMeta) adminUploadFileMeta.style.display = 'none';
          return;
        }
        try {
          const ab = await file.arrayBuffer();
          selectedUploadFileBytes = new Uint8Array(ab);
          selectedUploadPageCount = 128;
          if (window.PDFLib && window.PDFLib.PDFDocument) {
            try {
              const doc = await window.PDFLib.PDFDocument.load(selectedUploadFileBytes, { ignoreEncryption: true });
              selectedUploadPageCount = doc.getPageCount();
            } catch (err) {}
          }
          if (adminUploadPdfTitle && (!adminUploadPdfTitle.value.trim() || adminUploadPdfTitle.value.includes('Sổ Tay Tóm Tắt Toán THPT'))) {
            const cleanBase = file.name.replace(/\.pdf$/i, '');
            adminUploadPdfTitle.value = `Sổ Tay Toán THPT - ${cleanBase} (${selectedUploadPageCount} Trang)`;
          }
          if (adminUploadFileMeta) {
            adminUploadFileMeta.style.display = 'block';
            adminUploadFileMeta.textContent = `Đã chọn: ${file.name} (${formatBytes(file.size)} • ${selectedUploadPageCount} trang) — Sẵn sàng tải lên Supabase & đóng dấu tự động`;
          }
        } catch (err) {
          showToast('Không thể đọc file PDF vừa chọn!');
        }
      });
    }

    if (adminUploadSendMode) {
      adminUploadSendMode.addEventListener('change', () => {
        if (!adminReplaceRecipientBox) return;
        adminReplaceRecipientBox.style.display = adminUploadSendMode.value === 'send_specific' ? 'block' : 'none';
      });
    }

    if (adminReplaceOrderSelect) {
      adminReplaceOrderSelect.addEventListener('change', () => {
        const oid = adminReplaceOrderSelect.value;
        if (!oid) return;
        const ord = getOrders().find(x => x.id === oid);
        if (!ord) return;
        if (adminReplaceOrderId) adminReplaceOrderId.value = ord.id || '';
        if (adminReplaceName) adminReplaceName.value = ord.name || '';
        if (adminReplacePhone) adminReplacePhone.value = ord.phone || '';
        if (adminReplaceEmail) adminReplaceEmail.value = ord.email || '';
      });
    }

    if (adminSyncSupabaseBtn) {
      adminSyncSupabaseBtn.addEventListener('click', async () => {
        adminSyncSupabaseBtn.disabled = true;
        await renderSupabasePdfTemplates();
        await syncOrdersFromSupabase();
        renderAdminOrders();
        populateRecipientOrderSelect();
        adminSyncSupabaseBtn.disabled = false;
        showToast('Đã đồng bộ dữ liệu PDF & Đơn hàng từ Supabase Cloud!');
      });
    }

    // Xử lý bấm nút Upload File PDF Đầy Đủ Chi Tiết / Gửi File Thay Thế Lên Supabase
    if (adminUploadPdfSubmitBtn) {
      adminUploadPdfSubmitBtn.addEventListener('click', async () => {
        const file = adminUploadPdfFile && adminUploadPdfFile.files ? adminUploadPdfFile.files[0] : null;
        if (!file || !selectedUploadFileBytes) {
          showToast('Thầy vui lòng chọn file PDF (.pdf) từ máy tính trước khi bấm Upload!');
          if (adminUploadPdfFile) adminUploadPdfFile.focus();
          return;
        }

        const scope = adminUploadPdfScope ? adminUploadPdfScope.value : 'all';
        const sendMode = adminUploadSendMode ? adminUploadSendMode.value : 'new_only';
        const title = (adminUploadPdfTitle && adminUploadPdfTitle.value.trim()) || file.name;
        const versionNote = (adminUploadVersionNote && adminUploadVersionNote.value.trim()) || `Bản cập nhật đầy đủ chi tiết (${selectedUploadPageCount} trang)`;

        if (sendMode === 'send_specific') {
          const targetMail = adminReplaceEmail ? adminReplaceEmail.value.trim() : '';
          if (!targetMail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetMail)) {
            showToast('Vui lòng chọn đơn hàng hoặc nhập Email hợp lệ của khách nhận file thay thế!');
            if (adminReplaceEmail) adminReplaceEmail.focus();
            return;
          }
        }

        const origBtnHtml = adminUploadPdfSubmitBtn.innerHTML;
        adminUploadPdfSubmitBtn.disabled = true;
        adminUploadPdfSubmitBtn.innerHTML = '<span>Đang tải file PDF lên Supabase Cloud...</span>';

        if (adminUploadStatusBox) {
          adminUploadStatusBox.style.display = 'block';
          adminUploadStatusBox.style.background = '#eff6ff';
          adminUploadStatusBox.style.border = '1px solid #bfdbfe';
          adminUploadStatusBox.style.color = '#1e40af';
          adminUploadStatusBox.innerHTML = `Đang tải <b>${file.name}</b> (${formatBytes(file.size)} &bull; ${selectedUploadPageCount} trang) lên kho lưu trữ <b>Supabase Storage (${SUPABASE_CFG.bucket})</b>...`;
        }

        try {
          const safeFileName = removeVietnameseTones(file.name)
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .toLowerCase();
          const targetStoragePath = scope === 'all'
            ? SUPABASE_CFG.defaultMasterPath
            : `master/so-tay-toan-${scope}-${safeFileName.endsWith('.pdf') ? safeFileName : safeFileName + '.pdf'}`;

          const publicUrl = await uploadPdfBytesToSupabase(targetStoragePath, selectedUploadFileBytes);

          // Lưu cấu hình file chuẩn vào bảng public.so_tay_pdf_templates trên Supabase
          const templateId = scope === 'all' ? 'default' : scope;
          const hasAsciiSlots = containsAsciiPattern(selectedUploadFileBytes, 'MA DON: #PTC000000');
          const tplRecord = {
            id: templateId,
            title: title,
            package_scope: scope,
            file_name: file.name,
            file_size: file.size,
            page_count: selectedUploadPageCount,
            storage_path: targetStoragePath,
            public_url: publicUrl,
            version_note: versionNote,
            is_default_slot_pdf: hasAsciiSlots,
            updated_at: new Date().toISOString()
          };

          await fetch(`${SUPABASE_CFG.url}/rest/v1/so_tay_pdf_templates?on_conflict=id`, {
            method: 'POST',
            headers: getSupabaseHeaders({
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates,return=minimal'
            }),
            body: JSON.stringify(tplRecord)
          });

          let sentCount = 0;
          let lastWatermarkedUrl = publicUrl;

          if (sendMode === 'send_specific') {
            const recipientOrder = {
              orderId: (adminReplaceOrderId && adminReplaceOrderId.value.trim()) || 'PTC888888',
              name: (adminReplaceName && adminReplaceName.value.trim()) || 'Khách hàng',
              phone: (adminReplacePhone && adminReplacePhone.value.trim()) || '0905957716',
              email: adminReplaceEmail ? adminReplaceEmail.value.trim() : '',
              pkgId: scope === 'all' ? 'combo_12' : scope,
              pkgName: title,
              total: 69000
            };
            const payload = await buildWatermarkedPdfPayload(recipientOrder, {
              rawUint8: selectedUploadFileBytes,
              template: tplRecord
            });
            lastWatermarkedUrl = payload.supabasePdfUrl;
            await sendWatermarkedPdfToEmail(recipientOrder, payload, {
              isReplacement: true,
              versionNote: versionNote
            });
            sentCount = 1;
          } else if (sendMode === 'send_all_paid') {
            const allOrders = getOrders().filter(o => o.email && o.pkgId !== 'book_only');
            for (const ord of allOrders) {
              const payload = await buildWatermarkedPdfPayload({
                orderId: ord.id,
                name: ord.name,
                phone: ord.phone,
                email: ord.email,
                pkgId: ord.pkgId,
                pkgName: ord.pkgName
              }, {
                rawUint8: selectedUploadFileBytes,
                template: tplRecord
              });
              lastWatermarkedUrl = payload.supabasePdfUrl;
              await sendWatermarkedPdfToEmail(ord, payload, {
                isReplacement: true,
                versionNote: versionNote
              });
              sentCount++;
            }
          }

          await renderSupabasePdfTemplates();
          renderAdminOrders();

          if (adminUploadStatusBox) {
            adminUploadStatusBox.style.background = '#f0fdf4';
            adminUploadStatusBox.style.border = '1px solid #86efac';
            adminUploadStatusBox.style.color = '#166534';
            adminUploadStatusBox.innerHTML = `
              <svg class="ui-ico" style="width:14px;height:14px;vertical-align:-2px;color:#15803d;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <b>Đã lưu lên Supabase Cloud thành công!</b> File <b>${file.name}</b> (${selectedUploadPageCount} trang) đã được kích hoạt tự động cho <b>${getScopeLabel(scope)}</b>.
              ${sentCount > 0 ? `<br>&bull; Đã tự động đóng dấu bản quyền riêng &amp; gửi file thay thế qua Email cho <b>${sentCount} khách hàng</b> (<a href="${lastWatermarkedUrl}" target="_blank" rel="noopener" style="color:#15803d;font-weight:700;text-decoration:underline;">Xem file đã đóng dấu trên Supabase</a>).` : `<br>&bull; Từ bây giờ mọi khách hàng đặt mua sẽ tự động nhận bản PDF này (đã đóng dấu mã đơn riêng).`}
            `;
          }
          showToast('Đã upload file PDF lên Supabase & kích hoạt tự động thành công!');
        } catch (err) {
          if (adminUploadStatusBox) {
            adminUploadStatusBox.style.background = '#fef2f2';
            adminUploadStatusBox.style.border = '1px solid #fecaca';
            adminUploadStatusBox.style.color = '#991b1b';
            adminUploadStatusBox.textContent = 'Lỗi khi tải file lên Supabase: ' + (err.message || err);
          }
          showToast('Có lỗi khi tải file lên Supabase!');
        } finally {
          adminUploadPdfSubmitBtn.disabled = false;
          adminUploadPdfSubmitBtn.innerHTML = origBtnHtml;
        }
      });
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
    if (adminRefreshBtn) adminRefreshBtn.addEventListener('click', async () => {
      await syncOrdersFromSupabase();
      renderAdminOrders();
      showToast('Đã đồng bộ & làm mới danh sách đơn hàng.');
    });
    if (adminSearchInput) {
      adminSearchInput.addEventListener('input', () => renderAdminOrders());
    }
    if (adminSearchClearBtn) {
      adminSearchClearBtn.addEventListener('click', () => {
        if (adminSearchInput) adminSearchInput.value = '';
        renderAdminOrders();
        if (adminSearchInput) adminSearchInput.focus();
      });
    }
    if (adminFilterStatus) {
      adminFilterStatus.addEventListener('change', () => renderAdminOrders());
    }
    if (adminFilterPackage) {
      adminFilterPackage.addEventListener('change', () => renderAdminOrders());
    }
    if (adminSortOrders) {
      adminSortOrders.addEventListener('change', () => renderAdminOrders());
    }
    if (adminSelectAllOrders) {
      adminSelectAllOrders.addEventListener('change', () => {
        const checkboxes = document.querySelectorAll('#admin-table-body [data-check-order]');
        checkboxes.forEach(chk => {
          const oid = chk.getAttribute('data-check-order');
          if (!oid) return;
          if (adminSelectAllOrders.checked) {
            selectedOrderIds.add(oid);
          } else {
            selectedOrderIds.delete(oid);
          }
        });
        renderAdminOrders();
      });
    }
    if (adminDeleteSelectedBtn) {
      adminDeleteSelectedBtn.addEventListener('click', async () => {
        const ids = Array.from(selectedOrderIds);
        if (ids.length === 0) return;
        const ok = window.confirm(`Xác nhận xóa ${ids.length} đơn hàng đã chọn khỏi danh sách quản trị?`);
        if (!ok) return;
        const count = await deleteOrdersByIds(ids);
        showToast(`Đã xóa ${count} đơn hàng đã chọn.`);
      });
    }
    if (adminDeletePendingBtn) {
      adminDeletePendingBtn.addEventListener('click', async () => {
        const pendingIds = getOrders().filter(o => o && o.status !== 'Đã thanh toán').map(o => String(o.id));
        if (pendingIds.length === 0) {
          showToast('Không có đơn hàng Chờ thanh toán nào để xóa.');
          return;
        }
        const ok = window.confirm(`Xác nhận xóa toàn bộ ${pendingIds.length} đơn hàng đang ở trạng thái "Chờ thanh toán"?`);
        if (!ok) return;
        const count = await deleteOrdersByIds(pendingIds);
        showToast(`Đã dọn sạch ${count} đơn hàng chờ thanh toán.`);
      });
    }
    if (adminDeleteAllBtn) {
      adminDeleteAllBtn.addEventListener('click', async () => {
        const allIds = getOrders().map(o => String(o.id));
        if (allIds.length === 0) {
          showToast('Danh sách đơn hàng đang trống.');
          return;
        }
        const ok = window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA TẤT CẢ ${allIds.length} đơn hàng khỏi hệ thống?`);
        if (!ok) return;
        const count = await deleteOrdersByIds(allIds);
        showToast(`Đã xóa toàn bộ ${count} đơn hàng.`);
      });
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

  // Tự động kích hoạt tải file PDF đóng dấu bản quyền khi người mua mở link từ Email (?dl_pdf=1&oid=...)
  function checkEmailDirectDownloadLink() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('dl_pdf') === '1' && params.get('oid')) {
        const directOrder = {
          orderId: params.get('oid') || 'PTC000000',
          name: params.get('name') || 'KHACH HANG',
          phone: params.get('phone') || '0905957716',
          email: params.get('email') || ''
        };
        setTimeout(() => {
          downloadWatermarkedPdf(directOrder, null, { autoSendEmail: false });
        }, 500);
      }
    } catch (e) {}
  }

  // Init
  function init() {
    setupEventListeners();
    updateOrderDisplay();
    setupSocialProof();
    setupAdminPortal();
    checkEmailDirectDownloadLink();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
