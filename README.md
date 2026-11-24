# Mathfolio

Sổ bài tập toán cá nhân. Nhập công thức, viết lời giải, đính kèm ảnh và đồng bộ bài riêng tư theo tài khoản bằng Firestore + Cloud Storage; IndexedDB giữ cache offline trên thiết bị.

Bản demo công khai: [fbailogic26vrt-3019.web.app](https://fbailogic26vrt-3019.web.app/). Bản online chỉ dùng Firebase project quota `fbailogic26vrt-3019`; người dùng có thể đăng nhập bằng Google hoặc tạo tài khoản bằng email bất kỳ. Cloud AI định tuyến OCR/chat/hint đầu sang Gemini Flash Lite để tiết kiệm quota, còn lời giải đầy đủ và suy luận hình học dùng Gemini 4 Hydrogen. Ảnh Illustration nhận file đến 10 MB và tự thu nhỏ/nén trên thiết bị trước khi lưu hoặc gửi AI.

Repo chính: [nguynphuc-git/Mathfolio](https://github.com/nguynphuc-git/Mathfolio), nhánh **main**.

[Kế hoạch quay demo 3 phút (HTML tương tác)](https://mathfolio-pm.web.app/) mở trực tiếp trong trình duyệt; các link test case trong từng bước dẫn tới file mẫu để tải hoặc sao chép. Bản nguồn ở [scripts/demo-plan.html](scripts/demo-plan.html).

## Kịch bản quay demo 3 phút cho đội sản xuất

**Dùng bản HTML tương tác khi quay:** [mở kế hoạch](https://mathfolio-pm.web.app/). Phần này là checklist ngay trong repo; trang HTML có lời thuyết trình **tiếng Anh**, shot list tách riêng cho người quay, và đáp án đối chiếu. Quay thao tác thô đầy đủ, rồi dựng theo mốc 03:00; không cố hoàn thành mọi thao tác trong đúng 3 phút lúc ghi màn hình.

### Chuẩn bị trước khi bấm Record

1. Mở [Mathfolio bản live](https://mathfolio-mp.web.app/) trên Chrome desktop ở 1920×1080. Giữ cố định zoom và kích thước cửa sổ. Tạo hai Chrome profile A/B, đăng nhập **cùng một tài khoản Firebase**, bật Cloud Sync ở cả hai; kiểm tra A/B đều có mạng và pending bằng 0.
2. Tải [bộ đề đại số 6 trang, 18 câu](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/algebra-workbook-6-pages.pdf). Mở sẵn [đề log tham số để dán](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/algebra-parameter-challenge.txt), [notes mẫu](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/solution-notes.txt) và [đáp án 18 câu](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/algebra-workbook-answer-key.txt) ở tab riêng. Chưa mở [đề hình học cho Draw](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/geometry-drawing.txt) cho đến cảnh 7.
3. Chạy thử trước một lần: PDF mở đủ 6 trang, chọn được câu 01, Local AI hiện trạng thái thật trên máy, Cloud AI hiện bước đồng ý và còn quota, Save/Sync hoạt động. Chuẩn bị tài khoản và dữ liệu thử, không để email, token hoặc DevTools lộ trong bản dựng.

| Cảnh dựng | Thao tác cần quay theo thứ tự | Bằng chứng giữ lại khi dựng |
| --- | --- | --- |
| **1 · 00:00–00:12** | Quay toàn cảnh Workspace 2 giây; rê qua Problem, Illustrations, AI, Notes; dừng ở vùng nhập đề. | Tên Mathfolio và bốn vùng làm việc. |
| **2 · 00:12–00:32** | Dán [đề log tham số](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/algebra-parameter-challenge.txt), cho thấy Math/Text và bàn phím toán. Chọn **Add content → Read PDF**, tải [PDF 6 trang](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/algebra-workbook-6-pages.pdf), lướt 1 → 3 → 6, trở về trang 1, chọn câu 01, sửa OCR nếu cần rồi **Use this problem**. | Bộ đếm 1/6, 3/6, 6/6 và màn review có đề đúng trước khi phân tích. |
| **3 · 00:32–01:10** | Trên cùng đề đại số, quay A dùng **Local AI → Confirm & analyze → Knowledge → Hint 1**. Quay B dùng **Cloud AI**, giữ bước đồng ý, rồi Knowledge và Hint 1–3. Chụp hai kết quả thật để dựng hai cột. | Tên tuyến AI, bước đồng ý, câu trả lời thật. Nếu Local không hỗ trợ, quay đúng thông báo đó; không ghép kết quả máy khác. |
| **4 · 01:10–01:32** | Trên B, hỏi chat “Why is a positive discriminant not sufficient? Check the logarithm domain.” Dán [notes mẫu](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/solution-notes.txt), sửa một dòng, đánh dấu Completed. | Chat kiểm tra miền xác định, notes do người học sửa, trạng thái Completed. |
| **5 · 01:32–01:57** | Lưu bài “Algebra · parameter logs”, gán hai thư mục màu. Vào Library, tìm “Algebra”, lọc Completed, mở preview, sửa notes và Save changes. | Bài tìm được trong thư viện; mở lại vẫn còn notes mới. |
| **6 · 01:57–02:22** | A chờ pending=0. B cùng UID bấm Sync now và mở bài. Trên B bật DevTools Network → Offline, sửa notes, **Save**, quay pending > 0; bật Online, Sync now đến pending=0. A Sync now và mở phiên bản mới. | Cùng bài xuất hiện ở A/B; pending tăng rồi về 0. Chỉ cắt thời gian chờ, không dựng giả trạng thái sync. |
| **7 · 02:22–02:42** | Tạo **bài mới**, dán [đề hình học riêng](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/geometry-drawing.txt). Draw illustration → Coordinate plane; dựng A/B/C/D, M, I; thử Undo/Redo; Add to illustrations. | Nhãn “Separate drawing exercise”, hình hoàn chỉnh và tỷ số $AD^2/IM^2=10$. Không dùng hình này làm kết quả AI đại số. |
| **8 · 02:42–03:00** | Mở rồi thoát Solo; đổi theme và cỡ chữ trong Appearance; mở Study options và đổi một tùy chọn; cuộn How to use; kết ở tên Mathfolio và URL. | Mỗi tính năng phụ hiện rõ 2–3 giây, màn kết sạch khoảng 3 giây. |

**Đối chiếu toán trước khi dựng:** với câu log, điều kiện là $a>1$, $1<x<a$; số nghiệm đổi tại $a=1+2\sqrt2$, và hai nghiệm cách nhau 1 khi $a=4$. Đáp án này dùng để kiểm tra AI, không thay thế phản hồi AI thật bằng chữ dựng. Bài hình học có lời giải riêng trong [đề Draw](https://raw.githubusercontent.com/nguynphuc-git/Mathfolio/main/scripts/demo-cases/geometry-drawing.txt).

**Bàn giao dựng:** đặt tên take `01-opening` đến `08-extras`; gửi thêm hai ảnh Local/Cloud và một ảnh pending offline. Giữ lời thuyết trình tiếng Anh và timecode trong [kế hoạch HTML](https://mathfolio-pm.web.app/), chỉ rút ngắn lúc tải/chờ. Nếu một thao tác không chạy đúng, quay trạng thái thật rồi sửa lời dẫn cho khớp; không trình bày tính năng chưa kiểm chứng như đã thành công.

Khung vẽ Illustration có chế độ nền trắng hoặc tọa độ. Ở chế độ tọa độ, nhập nhiều phương trình tự do, bất phương trình, biến có thanh trượt và dãy giá trị; kéo nền để dịch khung nhìn, giữ Shift để chọn nhiều hình. Solo mode cho tự vẽ hoặc tải ảnh lên; ảnh thêm tại đây mặc định không dùng cho AI. Công cụ Perp. segment hạ đoạn vuông góc từ một điểm xuống đường gốc; nếu điểm ở trên đường, chọn thêm đầu còn lại để định chiều và độ dài. Parallelogram nhận ba đỉnh liên tiếp và dựng đỉnh thứ tư theo chúng. Khi vẽ, đưa con trỏ gần điểm hoặc đường để bắt điểm dùng chung; Intersection dùng được với cả nét vẽ tay.

## Chạy thử trên máy của đồng đội

1. Cài [Node.js 24 LTS](https://nodejs.org/). Lần chạy đầu cần Internet để tải các gói.
2. Trong GitHub Desktop, clone [Mathfolio](https://github.com/nguynphuc-git/Mathfolio), rồi chọn **Current branch → main**. Nếu đã clone repo này, chọn **Fetch origin → Pull origin**. Cũng có thể tải [ZIP của Mathfolio](https://github.com/nguynphuc-git/Mathfolio/archive/refs/heads/main.zip) và giải nén.
3. Mở **Start-Mathfolio.cmd** trên Windows hoặc **Start-Mathfolio.command** trên macOS. Trên Linux, từ thư mục dự án chạy `npm run local`. Nếu macOS yêu cầu xác nhận cho tệp đã tải về, mở từ Finder theo hướng dẫn của hệ thống. Có thể chạy `npm run local` trên cả ba hệ điều hành.
4. Trình duyệt sẽ mở [Mathfolio trên máy này](http://localhost:5173). Nhập email thử và mật khẩu từ 6 ký tự, chọn **Create account**. Lần sau dùng **Sign in** trong cùng trình duyệt. Mỗi máy có tài khoản emulator riêng.

Trình khởi động cài dependency từ lockfile, khởi động Auth Emulator cho project demo và mở Vite. Sổ bài tập lưu bằng IndexedDB nên chế độ này chỉ cần Auth Emulator. Không cần Java, tài khoản Firebase, file môi trường hay quota để chạy luồng cơ bản. Khi dừng, nhấn **Ctrl+C một lần** và chờ xuất dữ liệu trước khi đóng cửa sổ. Dữ liệu Auth ở `.mathfolio-auth/`. Lần đầu, nếu có bản xuất emulator ở `.emulator-data/`, trình khởi động sẽ nhập lại tài khoản. Giữ cùng origin, trình duyệt và UID để đọc lại sổ.

## Thử một bài trong hai phút

- Nhập đề và viết vào **Your working notes**. Chọn **Save exercise**, đặt tên, chọn các thư mục tùy ý rồi chọn **Save & sync**. Mọi bài đã lưu đều có trong **My exercises** và đồng bộ riêng theo tài khoản qua Firestore; ảnh nằm trong Cloud Storage. Các thư mục cùng tham chiếu một bài. Cache trên thiết bị giữ luồng dùng offline.
- Mở **Exercise library → My exercises → Open exercise** để xem bài, sửa ghi chú, thêm/xóa ảnh bài giải, đổi tên ảnh và chọn thêm thư mục. Nhấn **Save changes** để lưu các thay đổi. **Open in workspace** mở bản nháp để tiếp tục làm. Tải lại trang rồi mở thư viện để kiểm tra dữ liệu.
- Thử `2x+3=7` và chọn **Confirm & analyze** để xem thẻ công thức cục bộ. Các bài ngoài phạm vi công thức, hint và chat dùng Firebase AI Logic. Gemini cần project thật, App Check và thiết bị tương thích cho chế độ on-device.
- Chọn **Add content → Read image**: **Read printed text** là nút chính màu xanh, dùng OCR chữ in ngay trên thiết bị. **Read with AI** ở bên phải cho chọn **Local AI / Cloud AI**; Cloud hỏi đồng ý riêng cho ảnh nguồn và có thể bật quyền cho phiên này ngay trong cửa sổ. Bấm ảnh để zoom, sửa chữ/công thức trực tiếp trong **Review your problem**, dùng bàn phím toán hoặc **Restore extracted text** để khôi phục bản nhận diện gần nhất. Kiểm tra công thức trước khi dùng đề.
- Bản đang làm được tự lưu riêng; tải lại trang rồi chọn **Resume draft** để tiếp tục. **Save exercise** mới cập nhật bài gốc trong thư viện.
- **Chat** và **Your working notes** dùng ngay từ đầu, không cần chạy kiến thức hoặc hint. Có thể hỏi trong chat khi chưa nhập đề; Cloud AI vẫn cần sự đồng ý của bạn.
- Trong thư viện, chọn **Mark completed / Mark in progress** ngay trên thẻ bài. Trạng thái được lưu cho cùng bài ở mọi thư mục và đồng bộ với ô đánh dấu trong Workspace; ghi chú đang viết dở được giữ nguyên.
- Đề, ghi chú và chat có nút **Math / Text**; nhấn **Alt một lần** (**Option / ⌥** trên Mac) trong ô đang viết để chuyển nhanh. Space tạo khoảng cách trong Math mà vẫn giữ chế độ Math. Nhận diện tự động khi gõ đã tắt. Một bàn phím nổi dùng chung sẽ nhập vào ô bạn đang chọn, có thể kéo thả và giữ mở khi bấm ra ngoài.
- Có thể dán đoạn chữ kèm công thức trực tiếp trong **Math**, giữ xuống dòng và công thức từ nguồn có chú thích LaTeX (ví dụ KaTeX). **Text** giữ nguyên chữ, chỉ định dạng toán khi có dấu phân cách LaTeX hoặc nguồn có công thức cấu trúc. Sau khi dán, chế độ gõ vẫn theo lựa chọn của bạn; kiểm tra lại công thức nếu nguồn sao chép chỉ có văn bản phẳng.
- Hàng đầu gồm đề (2/3) và **Illustrations** (1/3); hàng tiếp là kiến thức/hint; hàng cuối là chat/notes. Chọn **Use this illustration for AI** ở những ảnh cần cho bài toán.
- Hint 2/3 gợi ý **Use Cloud AI** khi có mạng và hỏi đồng ý trước khi chạy.
- Hint bao quát từng bài/ý; chọn **Reset hints** để tạo lại các tầng cũ. Bàn phím thông dụng có **xₙ**, Calculus & series có **⋃ / ⋂**.
- Chọn màu pastel khi tạo thư mục, hoặc mở **Color** trên ô thư mục để đổi màu. Header có nền riêng và tương thích với Appearance sáng/tối.
- Appearance và Study options tự đóng khi bấm ra ngoài; các lựa chọn có menu riêng với dấu tick. Dark mode áp dụng cho cả đề, ghi chú, chat và bàn phím toán. Trang đăng nhập có ký hiệu toán chuyển động nhẹ, tôn trọng cài đặt giảm chuyển động.
- Nhấn ảnh đề/bài làm trong Workspace hoặc thư viện để xem lớn, zoom và kéo ảnh; nhấn Escape để quay lại.
- **Draw illustration** trong Illustrations mở bảng vẽ 2D trên thiết bị: điểm, trung điểm, đoạn/đường/tia/vectơ, đường tròn, song song/vuông góc, giao điểm, đa giác/chữ nhật, đo góc, chữ và bút vẽ. Ban đầu chọn **Blank canvas** hoặc **Coordinate plane**. Chế độ tọa độ có nhập điểm bằng số, lưới và ô phương trình dùng bàn phím chỉ nhập toán. Kéo điểm/hình để chỉnh, giữ **Shift** và nhấp hoặc kéo vùng để chọn nhiều hình; xóa, di chuyển và đổi nét đồng loạt. Các nút **Solid / Dashed / Delete** nằm ở trên phải. Mặt vẽ nằm trọn trong cửa sổ; **Add to illustrations** chèn chính khung đang thấy thành PNG, sau đó Save exercise. Nút Create diagram đã được bỏ.
- **Draw for chat** vẽ ảnh cho tin nhắn kế tiếp; ảnh chỉ gửi khi nhấn Send, được lưu cùng tin nhắn và xem lại trong thư viện. **Draw in notes** lưu ảnh như ảnh bài làm, kể cả trong phần sửa ghi chú ở thư viện; ảnh ghi chú không gửi cho AI. AI được yêu cầu giải thích cách dựng và mục đích của hình phụ khi lời giải cần thêm hình.
- Chat có sẵn hàng ký hiệu thông dụng. **More symbols / Math symbols** bật hoặc tắt bảng mở rộng; vẫn có thể đóng bằng nút X.
- **Illustrations** chỉ giữ ảnh minh họa để xem và đưa vào ngữ cảnh AI; không còn nút đọc chữ dưới mỗi ảnh. Để đọc đề từ ảnh, dùng **Add content → Read image**. Trong PDF, chọn trang ở **PDF page**, chọn nhiều câu qua các trang rồi sửa công thức trực tiếp trong từng ô **Extracted question**. Ảnh **Source page** bấm để zoom; phần nguồn và các ô sửa dùng chung thanh cuộn ngoài. **Use N questions** nhập các câu đã chọn thành một đề nhiều bài (tối đa 6.000 ký tự).
- Xem [các tính năng Mathfolio](NOTEBOOK.md).

## Xuất bản sau khi hết tài khoản quota

Dùng project cá nhân `mathfolio-192d6`: xem [hướng dẫn sao lưu, chuyển sổ và deploy](PERMANENT_HOSTING.md). `npm run build:personal` tạo bản build riêng cho project cá nhân; chỉ đăng lại giao diện không chuyển dữ liệu Auth/Cloud sync từ project cũ. **Account → Notebook backup** xuất/nhập bài tập và ảnh mà không cần Cloud Storage.

## Môi trường Firebase khi được cấp quota

| Nhu cầu | Cấu hình |
| --- | --- |
| Sổ bài tập local | Trình khởi động bật `VITE_USE_EMULATORS=true` và dùng Firestore/Storage Emulator cho lần chạy. |
| Thử AI khi vẫn dùng tài khoản emulator | Sao chép `.env.example` thành `.env.local`. Điền cấu hình Web, khóa site reCAPTCHA Enterprise và model được cấp. Bật AI Logic và đăng ký App Check cho web app trong cùng project. Chỉ dùng debug token trong development. |
| Thử Auth của project thật | Bật Email/Password trong Authentication. Dùng cấu hình Web của project, `VITE_USE_EMULATORS=false` và chạy `npm run dev` để dùng các giá trị trong file. |
| Build cho bản online sau sprint hoặc khi được cấp quyền | Cấu hình biến `VITE_FIREBASE_*`, `VITE_RECAPTCHA_SITE_KEY`, `VITE_CLOUD_MODEL` ở môi trường build theo `.env.example`. Đặt `VITE_USE_EMULATORS=false` và `VITE_APPCHECK_DEBUG=false`. Đăng ký domain thật cho Auth và reCAPTCHA. Chạy test và build lại sau mỗi lần đổi cấu hình. Firebase Hosting dùng thư mục `dist/` theo `firebase.json`. |

Các biến `VITE_*` xuất hiện trong trình duyệt. Chỉ điền cấu hình Firebase Web và khóa site công khai. Service account, khóa riêng, Gemini server key và App Check debug token phải nằm ngoài mã nguồn và ngoài `VITE_*`. Xem [cấu hình Web Firebase](https://firebase.google.com/docs/projects/api-keys) và [App Check cho Web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

Auth Emulator và Firebase thật có bộ tài khoản riêng. Sổ phân vùng theo project và UID trên thiết bị, nên đổi sang project của ban tổ chức sẽ mở một sổ riêng. Khi hết sprint, xác nhận thời điểm thu hồi quota và quyền với ban tổ chức trước khi tiếp tục dùng AI.

Project quota duy nhất của bản demo là `fbailogic26vrt-3019`. Không commit `.env.local`, service account, App Check debug token hoặc mã đăng nhập Firebase CLI. Khi quota hết hạn, thay cấu hình môi trường build bằng project tiếp theo rồi build/deploy lại; không nhúng khóa máy chủ vào mã trình duyệt.

## Kiểm tra kỹ thuật

```sh
npm ci
npm test
npm run build
```

Nếu đang dùng thử qua trình khởi động, dừng phiên local trước khi chạy lại `npm ci`. Nếu đã mở phiên khác trên cổng 9099 hoặc 5173, dừng phiên cũ rồi mở lại. Muốn chạy thêm Firestore và Storage để phát triển các module cũ, xem [hướng dẫn Emulator đầy đủ](NOTEBOOK.md#chạy).
