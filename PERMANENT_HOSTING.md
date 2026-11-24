# Giữ Mathfolio sau khi project quota hết hạn

Project cá nhân: **`mathfolio-192d6`**. Địa chỉ dự kiến sau khi tạo site và deploy: **https://mathfolio-192d6.web.app/**.

`mathfolio-mp.web.app` thuộc project quota `fbailogic26vrt-3019`. Đổi biến môi trường hoặc thêm quyền tài khoản cá nhân không chuyển quyền sở hữu Hosting, Auth và dữ liệu sang project mới. Không xóa site cũ để thử lấy lại tên. Các bước dưới dùng một site mới; chỉ xác nhận hoàn tất sau khi trang mới đăng nhập và đọc được bài tập đã nhập.

## 1. Giữ bài tập trước khi project cũ bị thu hồi

Sao lưu trên từng trình duyệt/tài khoản có bài tập cần giữ. File chứa toàn bộ **bài tập đã lưu**, thư mục, ghi chú, hội thoại, ảnh minh họa và ảnh lời giải/chat. Workspace draft chưa lưu không nằm trong file. File chứa dữ liệu riêng tư; lưu trên máy và không commit lên GitHub.

Sau khi merge thay đổi backup, mở PowerShell trong thư mục dự án:

```powershell
cd "$env:USERPROFILE\Desktop\StudyLens-20261114-120957"
git pull --ff-only
$env:VITE_USE_EMULATORS="false"
$env:VITE_APPCHECK_DEBUG="false"
npm.cmd run build
```

Đây là build cho project cũ, dùng `.env.local` cũ. Nếu build thành công, deploy **chỉ Hosting** vào site cũ bằng config local đang có:

```powershell
npx.cmd --no-install firebase deploy --only hosting --config firebase.mathfolio-mp.local.json --project fbailogic26vrt-3019
```

Mở `https://mathfolio-mp.web.app/`, tải bản mới, đăng nhập tài khoản đang dùng → lưu workspace bằng **Save exercise** → **Account → Notebook backup → Export notebook**. Kiểm tra đã tải được file `mathfolio-notebook-YYYY-MM-DD.json` có dung lượng phù hợp, nhất là khi có ảnh.

Nếu chưa thấy nút: F12 → Application → Service workers → Unregister tại đúng domain rồi tải lại. **Không chọn Clear site data**, không xóa IndexedDB và không gỡ trình duyệt trước khi có file backup. Việc sync thành công trong project cũ không bảo vệ dữ liệu khi cả project bị xóa.

## 2. Chuẩn bị project cá nhân

Đăng nhập [Firebase Console](https://console.firebase.google.com/project/mathfolio-192d6/overview) bằng tài khoản Google cá nhân sở hữu project. Giữ gói **Spark** nếu cần xuất bản mà chưa bật thanh toán.

Trong **Build → Authentication → Sign-in method**, bật **Email/Password**. Tài khoản người dùng trong project cũ không tự chuyển sang project mới. Có thể tạo lại tài khoản bằng cùng email; sổ sẽ được chuyển bằng file backup, không dựa vào email hay UID cũ. Nếu dùng Google sign-in, bật provider Google và chọn email hỗ trợ.

Trong **Authentication → Settings → Authorized domains**, thêm `mathfolio-192d6.web.app` và `mathfolio-192d6.firebaseapp.com` nếu chưa có.

Chưa cần tạo Firestore hoặc Storage để dùng thư viện trên thiết bị và xuất/nhập backup. Cloud sync là phần thiết lập riêng, không tự bật khi nhập file.

## 3. Build và xuất bản lên project cá nhân

Sau khi đã xuất backup, dùng cấu hình cá nhân đã chuẩn bị trong repository:

```powershell
npm.cmd run build:personal
```

Lệnh này dùng cấu hình Web công khai tại `config/firebase.personal.json`, ép tắt emulator/debug, và không lấy site key/model của tài khoản quota từ `.env.local` hay shell. `dist/` lúc này dành cho **project cá nhân**. Không deploy thư mục này trở lại site cũ để xuất backup.

Đăng nhập CLI bằng Google cá nhân (không gửi token đăng nhập cho người khác):

```powershell
npx.cmd --no-install firebase login --reauth
npx.cmd --no-install firebase projects:list
```

Kiểm tra danh sách có `mathfolio-192d6`. Tạo site một lần:

```powershell
npx.cmd --no-install firebase hosting:sites:create mathfolio-192d6 --project mathfolio-192d6
```

Nếu báo site đã tồn tại, kiểm tra nó nằm trong đúng project:

```powershell
npx.cmd --no-install firebase hosting:sites:list --project mathfolio-192d6
```

Nếu site thuộc project khác, chọn tên chưa được dùng rồi sửa `hosting.site` trong `firebase.personal.json` và thêm domain tương ứng vào Auth/App Check. Không xóa hoặc ghi đè site không thuộc project cá nhân.

Deploy khi build và kiểm tra project đã thành công:

```powershell
npx.cmd --no-install firebase deploy --only hosting --config firebase.personal.json --project mathfolio-192d6
```

Config này chỉ chứa Hosting, không triển khai quy tắc dữ liệu hoặc bật dịch vụ tính phí. Hosting dùng gói miễn phí trong giới hạn Spark; lưu lượng không vô hạn.

## 4. Nhập và kiểm tra dữ liệu

Mở **https://mathfolio-192d6.web.app/** → tạo/đăng nhập tài khoản → **Account → Notebook backup → Import notebook** → chọn file → kiểm tra số bài/thư mục → **Import copies**.

Lần nhập tạo ID mới và ánh xạ lại các thư mục. Những bài đang có, workspace đang mở và project cũ được giữ nguyên. Nhập lại cùng file sẽ tạo thêm bản sao. Nếu sau này bật Cloud sync, các bản nhập cũng được đồng bộ theo lựa chọn đó.

Kiểm tra số bài trong **Exercise library**, mở ít nhất một bài có ghi chú và ảnh, kiểm tra đầy đủ hội thoại, thư mục và trạng thái hoàn thành. Tải lại trang, đăng nhập lại để kiểm tra thư viện còn nguyên. Giữ file backup độc lập ngay cả sau khi kiểm tra xong.

## 5. Những tính năng có thể dùng miễn phí và phần cần thiết lập riêng

| Phần | Trên project cá nhân |
| --- | --- |
| Xuất bản website | Firebase Hosting Spark, trong hạn mức của project. |
| Email/Password, thư viện lưu trên máy, backup file | Không cần Cloud Storage. |
| Local AI | Chạy trên thiết bị hỗ trợ model/trình duyệt; khả năng sẵn có phụ thuộc thiết bị. Không bảo đảm mọi điện thoại đều hỗ trợ. |
| Cloud AI | Cần bật AI Logic, chọn Gemini Developer API và model hiện có free tier cho project, cùng App Check của chính project cá nhân. Model/quota cũ không tự chuyển. |
| Cloud sync hiện tại, gồm cả ảnh | Thiết kế hiện tại lưu cả snapshot bài trong Firebase Storage, nên **cần gói Blaze và tài khoản thanh toán**, dù dữ liệu còn trong hạn mức miễn phí. Không tự bật thanh toán để xuất bản web. |

Đăng nhập và thư viện local hoạt động trước khi cấu hình AI. Cloud AI vẫn yêu cầu App Check; các backend có enforcement vẫn từ chối request thiếu token. Không dùng site key, debug token hoặc service account của project quota cho project mới.

Khi muốn bật Cloud AI, đăng ký reCAPTCHA Enterprise/App Check cho Web app `1:723903861906:web:92f9727f0326bb4327824b`, cho phép đúng domain website mới, rồi build bằng cấu hình cá nhân:

```powershell
$env:MATHFOLIO_PERSONAL_RECAPTCHA_SITE_KEY="SITE_KEY_CONG_KHAI_CUA_PROJECT_CA_NHAN"
$env:MATHFOLIO_PERSONAL_CLOUD_MODEL="MODEL_CO_FREE_TIER_TRONG_PROJECT_CA_NHAN"
npm.cmd run build:personal
```

Chỉ deploy sau khi thay hai giá trị bằng cấu hình thật. Với Cloud sync, làm theo [CLOUD_SYNC.md](CLOUD_SYNC.md) bằng project/bucket mới và quy tắc riêng tư. Hiện tại sync cả bài có hoặc không có ảnh đều sử dụng Storage; không coi việc chỉ bỏ ảnh là đủ để dùng sync này trên Spark.

Tài liệu chính thức: [Hosting](https://firebase.google.com/docs/hosting/quickstart), [gói Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [yêu cầu Blaze cho Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [chi phí AI Logic](https://firebase.google.com/docs/ai-logic/pricing).
