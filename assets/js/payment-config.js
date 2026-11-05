/**
 * CẤU HÌNH TỰ ĐỘNG XÁC NHẬN THANH TOÁN VIETQR & SEPAY
 * Sổ Tay Tóm Tắt Toán THPT – Thầy Huỳnh Thanh Chí
 */

window.PAYMENT_CONFIG = {
  // Thời gian đếm ngược mỗi phiên thanh toán (giây) - Mặc định 5 phút = 300s
  COUNTDOWN_SECONDS: 300,

  // Thông tin thụ hưởng ngân hàng BIDV đã liên kết SePay
  BANK_ID: 'BIDV',
  BANK_NAME: 'Ngân Hàng Đầu Tư & Phát Triển Việt Nam (BIDV)',
  ACCOUNT_NO: '5801434567',
  SEPAY_VA_ACCOUNT: '962478SJJ2', // Mã VA SePay định danh tự động đẩy biến động vào TK gốc 5801434567
  ACCOUNT_NAME: 'HUYNH THANH CHI',
  HOTLINE_ZALO: '0905957716',
  HOTLINE_DISPLAY: '090 595 7716',

  // Chu kỳ tự động kiểm tra giao dịch (mili-giây) - Mặc định 3 giây/lần
  POLL_INTERVAL_MS: 3000,

  // Cầu nối Webhook SePay & Google Sheets (Đã bật quyền Cho phép toàn bộ truy cập - Anyone)
  GAS_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbyXFB8UgPDiZXxZtHF6bxGFWe0I3Voc1Ecke1DUi1Jp2P6LeD3Ss1etOKqbOBIctR5YTg/exec',
  GOOGLE_SHEET_ID: '1dObYu0uf1pdSvYLWDdi45zKK2n67TzfbrfkDuOlsvq0',
  ALLOW_ALL_ACCESS: true,

  // Token kích hoạt đối soát trực tiếp qua cầu nối SePay BIDV 5801434567 (hoặc API Key trực tiếp từ my.sepay.vn)
  SEPAY_API_TOKEN: 'SEPAY_GAS_BRIDGE_ACTIVE_5801434567',
  SEPAY_ACCOUNT_NUMBER: '5801434567',

  // Mật khẩu khu vực Quản Trị Khách Hàng (Admin) - Dành riêng cho Thầy Chí
  ADMIN_PASSWORD: '336699',
  ADMIN_RECOVERY_EMAIL: 'badaoqn132@gmail.com',

  // Cấu hình Supabase Cloud tự động lưu trữ & gửi PDF đóng dấu bản quyền
  SUPABASE_URL: 'https://uiyqdqucqplifcvukwul.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXFkcXVjcXBsaWZjdnVrd3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzQyNTYsImV4cCI6MjEwNDAxMDI1Nn0.QFVahkLpgPklc5rQZnskLY1W5913nZ6Vn80T_As-he0',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_eVPODZoNRLiGD8Ldl2VjAg_eC_KTKDg',
  SUPABASE_BUCKET: 'so-tay-toan-pdfs',
  SUPABASE_DEFAULT_MASTER_PATH: 'master/so-tay-toan-thpt-master.pdf',
  SUPABASE_EDGE_FN_SEND_PDF: 'https://uiyqdqucqplifcvukwul.supabase.co/functions/v1/send-order-pdf',
  SUPABASE_EDGE_FN_RECONCILE: 'https://uiyqdqucqplifcvukwul.supabase.co/functions/v1/sepay-reconcile'
};
