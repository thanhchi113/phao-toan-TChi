/**
 * CẤU HÌNH TỰ ĐỘNG XÁC NHẬN THANH TOÁN VIETQR
 * Sổ Tay Tóm Tắt Toán THPT – Thầy Huỳnh Thanh Chí
 */

window.PAYMENT_CONFIG = {
  // Thời gian đếm ngược mỗi phiên thanh toán (giây) - Mặc định 5 phút = 300s
  COUNTDOWN_SECONDS: 300,

  // Thông tin thụ hưởng ngân hàng
  BANK_ID: 'OCB',
  BANK_NAME: 'Ngân Hàng Phương Đông (OCB)',
  ACCOUNT_NO: '0169100000679007',
  ACCOUNT_NAME: 'HUYNH THANH CHI',
  HOTLINE_ZALO: '0905957716',
  HOTLINE_DISPLAY: '090 595 7716',

  // Chu kỳ tự động kiểm tra giao dịch (mili-giây) - Mặc định 3 giây/lần
  POLL_INTERVAL_MS: 3000,

  /**
   * TÍCH HỢP TỰ ĐỘNG BÁO BIẾN ĐỘNG SỐ DƯ (Tùy chọn):
   * Nếu Thầy sử dụng dịch vụ SePay (miễn phí kết nối OCB tại https://sepay.vn):
   * Chỉ cần điền API Token của SePay vào biến bên dưới.
   * Hệ thống sẽ tự động gọi API SePay kiểm tra tiền vào tài khoản OCB theo thời gian thực!
   */
  SEPAY_API_TOKEN: '', // Ví dụ: 'SEPAY_API_KEY_CUA_THAY'
  SEPAY_ACCOUNT_NUMBER: '0169100000679007'
};
