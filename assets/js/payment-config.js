/**
 * CẤU HÌNH TỰ ĐỘNG XÁC NHẬN THANH TOÁN VIETQR
 * Sổ Tay Tóm Tắt Toán THPT – Thầy Huỳnh Thanh Chí
 */

window.PAYMENT_CONFIG = {
  // Thời gian đếm ngược mỗi phiên thanh toán (giây) - Mặc định 5 phút = 300s
  COUNTDOWN_SECONDS: 300,

  // Thông tin thụ hưởng ngân hàng
  BANK_ID: 'BIDV',
  BANK_NAME: 'Ngân Hàng Đầu Tư & Phát Triển Việt Nam (BIDV)',
  ACCOUNT_NO: '5801434567',
  ACCOUNT_NAME: 'HUYNH THANH CHI',
  HOTLINE_ZALO: '0905957716',
  HOTLINE_DISPLAY: '090 595 7716',

  // Chu kỳ tự động kiểm tra giao dịch (mili-giây) - Mặc định 3 giây/lần
  POLL_INTERVAL_MS: 3000,

  /**
   * TÍCH HỢP ĐỐI SOÁT TỰ ĐỘNG 100% QUA WEBHOOK SEPAY (BÊN THỨ 3):
   * LƯU Ý QUAN TRỌNG:
   * Nếu Thầy muốn hệ thống check tự động 100% biến động số dư tài khoản BIDV:
   * 1. Đăng ký tài khoản miễn phí tại https://my.sepay.vn và liên kết tài khoản BIDV 5801434567.
   * 2. Lấy API Token (API Key) và dán trực tiếp vào biến SEPAY_API_TOKEN bên dưới.
   * 3. Khi chưa điền token hoặc tài khoản chưa nhận được tiền, hệ thống sẽ chạy chế độ
   *    đối soát thông minh: Khi chưa có tiền vào tài khoản thì bấm nút xác thực giao dịch sẽ báo KHÔNG THÀNH CÔNG.
   */
  SEPAY_API_TOKEN: '', // Dán SePay API Key của Thầy vào đây (Ví dụ: 'ABC123XYZ456...')
  SEPAY_ACCOUNT_NUMBER: '5801434567',

  // Mật khẩu khu vực Quản Trị Khách Hàng (Admin) - Dành riêng cho Thầy Chí
  ADMIN_PASSWORD: '336699',
  ADMIN_RECOVERY_EMAIL: 'badaoqn132@gmail.com'
};
