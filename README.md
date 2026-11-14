# StudyLens hybrid starter
Mã mẫu đi kèm tài liệu `StudyLens-KeHoach-HuongDan.md`. Gồm Giải tích 1A,
Toán rời rạc 1A và thuật toán; đầu ra Markdown + LaTeX, local/cloud qua
Firebase AI Logic. Đây là starter để nhóm triển khai và kiểm định nội dung.
```sh
npm ci
cp .env.example .env.local
# Điền cấu hình Firebase Web và App Check; không nhập Gemini server key.
npm run dev
```
```sh
npm test
npm run build
npm run preview
```
- Node >=22.12, khuyến nghị Node 24 LTS; Chrome Desktop phù hợp cho local AI.
- Chỉ chạy được suy luận thật sau khi cấu hình Firebase/App Check và model.
- `VITE_APPCHECK_DEBUG=true` chỉ có tác dụng trong development; production dùng
reCAPTCHA Enterprise trên domain được đăng ký.
- Không có mock AI. Giao diện và tài liệu mẫu mở được khi chưa cấu hình project.
- Auth email và thư viện file gốc dùng Storage/Firestore; xem hướng dẫn setup/billing/rules/CORS.
- PDF được trích xuất thành văn bản tại máy, không có OCR hoặc viewer giữ bố cục.
- Ghi chú lưu ở IndexedDB; tài liệu gốc chưa được lưu lại tự động.
- `cloud-notes.optional.ts` là phần mở rộng chưa nối UI; main app không tự đồng bộ.
- UI bilingual; chất lượng tiếng Việt của mô hình local cần kiểm thử trên máy thực.
- Bài chứng minh/lời giải AI cần đối chiếu đáp án, điều kiện và đề cương môn học.
- PWA cache hoạt động trên production build, sau lần truy cập online hoàn chỉnh.
- MIT áp dụng cho mã starter; dependency và tài liệu đầu vào giữ giấy phép riêng.
