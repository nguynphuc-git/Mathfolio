## Mathfolio exercise notebook

Xem [NOTEBOOK.md](NOTEBOOK.md) để chạy, dùng thử và xem giới hạn bản đầu.

# Mathfolio
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


## Local development with Firebase emulators

### Requirements

- Node.js 24 LTS and npm.
- Java JDK 21.
- Chrome Desktop 139+ and a supported device for on-device AI.

### First-time setup

Clone this repository, open its directory, then run:

```sh
npm ci
cp .env.example .env.local
```

Set VITE_USE_EMULATORS=true in .env.local.

Authentication, Firestore and Storage run locally under the demo project.
Firebase AI Logic uses a separate real Firebase project.

For AI features, fill in the Firebase Web app configuration and public
reCAPTCHA Enterprise site key in .env.local. Enable Firebase AI Logic
with the Gemini Developer API in that same project. Select a cloud
model available to the project and its quota.

Set VITE_APPCHECK_DEBUG=true for development. Each browser must create
its own debug token and register it under App Check in the AI project.

### Run the backend in Terminal 1

```sh
npx firebase-tools@15.36.0 emulators:start --only auth,firestore,storage --project demo-studylens-local --export-on-exit=../studylens-emulator-data
```

Once a saved export exists, add --import=../studylens-emulator-data
when starting the emulators again. The emulator UI is at
http://127.0.0.1:4000.

### Run the website in Terminal 2

```sh
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://localhost:5173 in Chrome. Register a test account through
the website. A fresh emulator starts with its own accounts and files.

Quick and Hint use on-device inference. Deep and Quiz use cloud
inference after cloud processing is allowed in the interface.
Check the inference source shown with each response.

For Chrome model setup, follow:
https://firebase.google.com/docs/ai-logic/hybrid/web/get-started

### Verification

```sh
npm test
npm run build
```

The emulator and App Check debug switches are development-only.
Use the Vite dev server for this local setup.

Keep .env.local, debug tokens, and emulator data private.
