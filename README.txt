THAI ASIA MAP V5

V5 = V4 + cấu hình Web App/PWA cho iPhone và Android.

Đã thêm:
- manifest.json
- display: standalone
- icon 180x180 cho iPhone
- icon 192x192 và 512x512 cho Android/PWA
- service worker sw.js
- meta cho iPhone Home Screen
- API không bị cache: đơn hàng/shipper vẫn lấy dữ liệu mới

CÁCH ĐƯA V5 LÊN VERCEL
1. Giải nén thaiasia-map-v5.zip.
2. Trong Vercel mở project thaiasia-map-v4 hiện tại.
3. Vào tab Deployments.
4. Tạo deployment mới bằng folder V5 nếu giao diện Vercel cho upload.
   Nếu Vercel không hiện nút upload lại vào project hiện có, cách dễ nhất cho người không dùng Git:
   - tạo Project mới từ folder V5 giống lần trước;
   - test xong có thể đổi tên/domain sau.
5. Sau khi deploy xong, trên điện thoại nên xóa icon Home Screen cũ rồi Add to Home Screen/Install lại
   để iPhone/Android nhận manifest và icon mới.

LƯU Ý
- iPhone: Safari > Share > Add to Home Screen.
- Android: Chrome > menu ⋮ > Install app hoặc Add to Home screen.
- Nếu Android vẫn chỉ hiện Add to Home screen, app vẫn dùng được; manifest V5 giúp nó chạy standalone tốt hơn.
