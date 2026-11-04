/**
 * ORDER FORM & VIETQR PAYMENT ENGINE
 * Tự động tính tiền, sinh mã VietQR OCB theo thông tin đơn hàng,
 * sao chép 1-chạm, lưu đơn hàng, và kết nối Zalo xác nhận.
 */

(function () {
  'use strict';

  // Bank Info
  const BANK_CONFIG = {
    bankId: 'OCB',
    accountNo: '0169100000679007',
    accountName: 'HUYNH THANH CHI',
    bankFullName: 'Ngân Hàng Phương Đông (OCB)',
    hotlineZalo: '0905957716'
  };

  // Packages
  const PACKAGES = {
    combo: {
      id: 'combo',
      name: 'COMBO Trọn Bộ (Sách In Màu + PDF VIP + Video)',
      price: 119000,
      oldPrice: 189000,
      shipping: 0,
      isDigital: false,
      isPhysical: true
    },
    print: {
      id: 'print',
      name: 'Sổ Tay In Giấy Màu A5 Cao Cấp (Bản Cầm Tay)',
      price: 89000,
      oldPrice: 129000,
      shipping: 20000,
      isDigital: false,
      isPhysical: true
    },
    ebook: {
      id: 'ebook',
      name: 'Bản Ebook PDF Full HD Bản Quyền (Tra cứu tiện lợi)',
      price: 49000,
      oldPrice: 79000,
      shipping: 0,
      isDigital: true,
      isPhysical: false
    }
  };

  // State
  let selectedPackage = 'combo';
  let quantity = 1;
  let activeQrTab = 'vietqr'; // 'vietqr' or 'ocb_card'

  // DOM Elements
  const packageItems = document.querySelectorAll('.package-item');
  const qtyMinusBtn = document.getElementById('qty-minus-btn');
  const qtyPlusBtn = document.getElementById('qty-plus-btn');
  const qtyValEl = document.getElementById('qty-val');

  const nameInput = document.getElementById('order-name');
  const phoneInput = document.getElementById('order-phone');
  const emailInput = document.getElementById('order-email');
  const addressInput = document.getElementById('order-address');
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

  const toastEl = document.getElementById('toast-notification');
  const modalBackdrop = document.getElementById('order-modal-backdrop');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const confirmPaymentBtn = document.getElementById('btn-confirm-payment');

  // Format VND currency
  function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  }

  // Remove Vietnamese diacritics for SMS/Bank transfer memo
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
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase().trim();
  }

  // Calculate order totals
  function calculateTotal() {
    const pkg = PACKAGES[selectedPackage];
    const subtotal = pkg.price * quantity;
    // Free shipping for combo or ebooks, or orders >= 2 items
    const shipping = (pkg.shipping > 0 && quantity === 1) ? pkg.shipping : 0;
    const total = subtotal + shipping;

    const phone = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
    const cleanName = nameInput ? removeVietnameseTones(nameInput.value).split(' ').slice(-2).join(' ') : '';
    const memo = `STTOAN ${phone || '0905957716'} ${cleanName}`.trim();

    return { pkg, subtotal, shipping, total, memo };
  }

  // Update Summary Table & Payment Card
  function updateOrderDisplay() {
    const { pkg, subtotal, shipping, total, memo } = calculateTotal();

    if (sumPkgNameEl) sumPkgNameEl.textContent = `${pkg.name} (x${quantity})`;
    if (sumSubtotalEl) sumSubtotalEl.textContent = formatMoney(subtotal);
    if (sumShippingEl) {
      sumShippingEl.textContent = shipping === 0 ? 'Miễn phí (0 đ)' : formatMoney(shipping);
      sumShippingEl.style.color = shipping === 0 ? 'var(--green)' : 'var(--text)';
    }
    if (sumTotalEl) sumTotalEl.textContent = formatMoney(total);

    // Bank Detail Labels
    if (payBankNameEl) payBankNameEl.textContent = BANK_CONFIG.bankFullName;
    if (payAccountNoEl) payAccountNoEl.textContent = BANK_CONFIG.accountNo;
    if (payAccountNameEl) payAccountNameEl.textContent = BANK_CONFIG.accountName;
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
      // Dynamic VietQR with exact amount and transfer note
      const encodedMemo = encodeURIComponent(memo);
      const qrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.png?amount=${total}&addInfo=${encodedMemo}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;
      qrImageEl.src = qrUrl;
      qrImageEl.alt = `VietQR Chuyển khoản OCB ${formatMoney(total)}`;
    } else {
      // Original OCB QR Card uploaded by user
      qrImageEl.src = 'assets/images/qr-card.png';
      qrImageEl.alt = 'Mã QR Thẻ Ngân hàng OCB Huỳnh Thanh Chí';
    }
  }

  // Show Toast
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

  // Copy to clipboard helper
  function copyText(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg || `Đã sao chép: ${text}`);
    }).catch(() => {
      // Fallback
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
  function validateOrderForm() {
    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, '') : '';
    const address = addressInput ? addressInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';

    if (!name) {
      showToast('Vui lòng nhập Họ và tên của bạn!');
      nameInput.focus();
      return false;
    }

    if (!phone || phone.length < 10) {
      showToast('Vui lòng nhập Số điện thoại hợp lệ (10 chữ số)!');
      phoneInput.focus();
      return false;
    }

    const pkg = PACKAGES[selectedPackage];
    if (pkg.isPhysical && !address) {
      showToast('Vui lòng nhập Địa chỉ nhận sách để Thầy gửi ship!');
      addressInput.focus();
      return false;
    }

    if (pkg.isDigital && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Vui lòng nhập định dạng Email hợp lệ!');
      emailInput.focus();
      return false;
    }

    return true;
  }

  // Confirm payment & Show receipt modal
  function handleConfirmPayment() {
    if (!validateOrderForm()) return;

    const { pkg, total, memo } = calculateTotal();
    const orderId = 'STC-' + Math.floor(100000 + Math.random() * 900000);
    const orderData = {
      orderId,
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      email: emailInput ? emailInput.value.trim() : '',
      address: addressInput ? addressInput.value.trim() : '',
      note: noteInput ? noteInput.value.trim() : '',
      pkgName: pkg.name,
      quantity,
      total,
      memo,
      createdAt: new Date().toISOString()
    };

    // Save order history locally
    try {
      const savedOrders = JSON.parse(localStorage.getItem('stc_orders') || '[]');
      savedOrders.unshift(orderData);
      localStorage.setItem('stc_orders', JSON.stringify(savedOrders.slice(0, 10)));
    } catch (e) {}

    // Populate modal
    document.getElementById('modal-order-id').textContent = '#' + orderId;
    document.getElementById('modal-cust-name').textContent = orderData.name;
    document.getElementById('modal-cust-phone').textContent = orderData.phone;
    document.getElementById('modal-pkg-name').textContent = `${orderData.pkgName} (x${orderData.quantity})`;
    document.getElementById('modal-total-amt').textContent = formatMoney(orderData.total);
    document.getElementById('modal-memo').textContent = orderData.memo;

    // Setup Zalo Direct Message Button
    const zaloMsg = `Chào Thầy Huỳnh Thanh Chí, em vừa đặt mua "${orderData.pkgName}" và đã chuyển khoản thành công ${formatMoney(orderData.total)} cho đơn hàng #${orderId}. Số điện thoại của em là ${orderData.phone}. Em gửi biên lai xác nhận, Thầy kiểm tra giúp em nhé!`;
    const zaloUrl = `https://zalo.me/${BANK_CONFIG.hotlineZalo}?text=${encodeURIComponent(zaloMsg)}`;
    const modalZaloBtn = document.getElementById('modal-zalo-btn');
    if (modalZaloBtn) {
      modalZaloBtn.href = zaloUrl;
    }

    // Open modal
    if (modalBackdrop) {
      modalBackdrop.classList.add('open');
    }
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

    // Confirm Payment
    if (confirmPaymentBtn) {
      confirmPaymentBtn.addEventListener('click', handleConfirmPayment);
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

  // Init
  function init() {
    setupEventListeners();
    updateOrderDisplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
