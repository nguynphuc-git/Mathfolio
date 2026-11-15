## Khởi động nhanh và lưu bài đang làm

Mở trình khởi động cho hệ điều hành của bạn theo [README](README.md#chạy-thử-trên-máy-của-đồng-đội). Bạn có thể lưu đề, ghi chú và ảnh vào thư viện trước khi chọn **Confirm & analyze**, kể cả khi chưa có quota. Mở lại bằng **Open in workspace** để tiếp tục hoặc phân tích sau.

## Stable scrolling, Cloud AI controls and improved input

- Scroll containers reserve a constant thin scrollbar gutter before overflow and on hover/focus; removed the CSS switch between native standard/WebKit widths. The document also reserves its scrollbar gutter to reduce shifts when opening dialogs. The thumb can appear without taking width away from the text. Visual acceptance is still needed in Chrome at different zoom levels.
- A Cloud AI On/Off switch sits below Save exercise. Analysis and every hint use the on-device model by default; local prompts are kept compact. Cloud analysis and hints 2/3 are used only while the user has explicitly enabled Cloud AI. Selecting Cloud chat or enabling the switch asks for consent when permission is off; denial/Escape/backdrop cancellation sends nothing. Turning permission off selects Local chat. Offline cloud generation stays unavailable, and signing out resets consent. Enabling the switch by itself does not call AI.
- Chat uses two side-by-side Local AI / Cloud AI buttons with the selected route emphasized. Selecting Local chat does not revoke permission for cloud hints; the top switch controls that permission.
- Powers from the toolbar and the physical ^ key use MathLive's native superscript navigation, so fenced groups stay intact; a selected expression becomes the entire power base. Smart fences remain enabled. Variable exponents remain open for multiple characters, with arrow keys used to leave them.
- Paste handling recognizes common inline equations, ASCII fractions, Unicode squared/cubed notation and prose. Explicit $...$, $$...$$, \\(...\\), \\[...\\] or application/x-latex data preserve LaTeX; MathLive's structured clipboard format is delegated to its native handler. Prose is escaped into text spans. This is conservative local parsing, not a universal semantic classifier: inspect ambiguous or unusual notation after pasting. Oversized paste is rejected without truncating the current expression.
- Notes in workspace and library preview have a toggleable math-symbol keyboard (², ⁿ, √, ∫, ∑, fractions, inequalities, Greek letters). It inserts ordinary Unicode symbols/templates at the caret and preserves selected text for powers/roots/fractions. Notes remain multiline plain text; no stored-data migration or hidden LaTeX markup is introduced.
- Added simulated DOM interaction coverage for consent/cancellation/offline behavior, route/switch synchronization, notes keyboard persistence, and editor clipboard/keyboard events. Actual MathLive layout/caret behavior and hover geometry still need testing on supported Chrome hardware.

## Saved-page preview and stopping AI

- **Open exercise** now opens a scrollable saved-page dialog in the library, showing the problem, essentials, opened hints, notes, attached images and conversation without running AI. Only notes can be edited here. **Save notes** updates the notes of the existing saved page; unsaved note changes are protected when closing the dialog with Close, Escape or the backdrop.
- **Open in workspace** opens an independent draft with the same exercise ID. Workspace edits do not affect the saved page until **Save exercise**, which updates the existing page directly. **Rename / move** opens the name/folder dialog; new exercises still ask for their initial name/folder. Leaving an unsaved workspace draft requires confirmation.
- Every notebook AI task has **Stop AI**, available during preparation and streaming, including after navigating to another tab. Stopping clears only the active request's partial text, restores the prior page state and retains the chat question. No partial result is saved or allowed to overwrite a later task. Existing knowledge, hints, chat, notes and dirty status are kept. Account changes/unmount also cancel active requests.
- Cancellation uses AbortSignal for cloud HTTP requests and native Chrome local session/prompt options. An abort-aware wait releases the UI even if a provider is slow to acknowledge cancellation. Cloud cancellation is client-side: a server request already being processed may still count toward usage. Physical Gemini Nano cancellation still needs acceptance testing on a supported Chrome device.
- Added happy-dom as a development dependency for interaction tests of preview-only note editing, workspace save isolation, and cancellation of knowledge, all hint levels and chat. These simulated DOM tests do not verify visual layout or MathLive caret behavior.

## Mathfolio: folder controls and compact hints

The displayed product name and browser title are now Mathfolio. Existing Firebase project names, app IDs and IndexedDB keys are intentionally retained so existing accounts and saved pages remain accessible.

- Fixed the MathLive root formula wrapper: its library default `width: min-content` was making words occupy separate lines. The root now uses the available width, with normal wrapping and a bounded vertical viewport; fraction/root internals keep their layout.
- Hint card height follows the problem card. Hint content scrolls inside it; generated levels have Show/Hide controls that never regenerate AI and do not change which levels have been unlocked. These display choices reset when opening another exercise.
- Library has New folder (custom name), duplicate-name validation and Delete folder actions. Deleting a custom folder requires confirmation and moves saved exercises into My exercises, preserving all page content/attachments. The default recovery folder cannot be deleted. Folder changes use the same account-scoped local storage, and only succeed in the UI after storage completes.

## Refinement: formulas, editing and overflow

- Edit/discard/delete/sign-out confirmations are styled in-app alert dialogs with focus trapping, Escape cancellation and an inert background. No native window.confirm remains in the notebook.
- Problem text is smaller, wraps at the top-level rendered expression, and scrolls vertically in a 220px viewport. MathLive 0.111.4 is pinned; wrapping overrides are scoped to its top-level shadow DOM so fraction/root internals keep their math layout. Visual and caret behavior still need acceptance testing in Chrome.
- Thin rounded scrollbars for problem, knowledge and chat appear on hover or keyboard focus without changing the available width; touch devices keep them available.
- Local reference cards explicitly identify their source; no language-model call is claimed for these cards. Existing saved content remains intact until refreshed.

## Update: visual math input and English interface

The problem box now uses MathLive: symbols render while typing. The x² key inserts a superscript at the cursor without duplicating x. Typing uses automatic math/text recognition in a single field; there are no mode buttons. LaTeX remains the storage/AI representation; the editor displays typeset math. Fonts are bundled locally for offline use.

There is no subject selector or subject assumption in notebook AI prompts. Knowledge generation receives only the current problem and uses English. Recognized single-variable linear/quadratic equations get verified local formula cards with conditions and no numeric solution, labeled local reference rather than AI. Other analysis and all hint levels use the on-device model by default, with compact prompts to reduce device input limits; enable **Cloud AI** to use Firebase AI for analysis and hints 2/3. Conditional reference cues cover derivatives, integrals, logarithms, trigonometry, right triangles, probability, sequences and matrices; this is not an exhaustive mathematics engine. Previous knowledge/chat is excluded from re-analysis to avoid repeating an unrelated course overview. Existing saved answers are preserved; choose **Refresh knowledge** to regenerate in English.

Enter a problem by typing or pasting LaTeX into the math editor, or import a PDF. Selectable text is extracted directly; pages without text are rendered and OCR'd locally with Vietnamese and English models. The PDF, OCR worker, models and WASM engine stay on this device and are never uploaded. The first run downloads these local app assets as part of the application; the PWA precaches them for offline use. OCR is limited to 30 pages / 150,000 extracted characters; numbered questions are offered individually, or the page text when numbering is not detected. Review and correct OCR output before inserting it because mathematical notation can be misrecognized. The problem editor limit remains 6,000 characters.

On desktop/tablet the knowledge panel follows the problem panel height using ResizeObserver, and its contents scroll internally. On phones it has a bounded 400px height. The rest of the notebook remains in normal page flow.

# Sổ bài tập StudyLens — bản đầu

Nhánh này chuyển giao diện sang sổ bài tập theo bản phác thảo. React/Vite, Firebase Auth, cấu hình emulator và dịch vụ AI hiện tại vẫn được dùng; không thay .env.local hay triển khai Firebase rules.

## Chạy

- Node.js 24 LTS; npm ci; giữ cấu hình Firebase Web/App Check hiện có trong .env.local.
- Nếu dùng emulator: VITE_USE_EMULATORS=true; Java 21 và Firebase CLI.
- Cửa sổ 1 (lần đầu):

```sh
firebase emulators:start --only auth,firestore,storage --project demo-studylens-local --export-on-exit=.emulator-data
```

- Sau khi đã thoát bằng Ctrl+C và có thư mục .emulator-data, những lần sau:

```sh
firebase emulators:start --only auth,firestore,storage --project demo-studylens-local --import=.emulator-data --export-on-exit=.emulator-data
```

Trên Windows dùng `firebase.cmd` nếu PowerShell chặn firebase.ps1. Giữ dữ liệu Auth emulator qua các phiên để UID tài khoản không thay đổi. Tạo lại cùng email với UID mới sẽ mở một cuốn sổ local khác. Không commit .emulator-data hoặc token.

- Cửa sổ 2: npm run dev (Windows: npm.cmd run dev). Đăng nhập/đăng ký bằng Auth hiện tại. Gemini vẫn kết nối project thật qua getCloudFirebaseApp; emulator không mô phỏng Gemini.

## Luồng dùng thử

1. Nhập đề, chọn môn, chèn ký hiệu tại con trỏ; xem trước công thức.
2. Đính kèm ảnh đề nếu muốn (chỉ xem/lưu, không OCR và không gửi ảnh tới AI).
3. Xác nhận đề & phân tích: gửi text cho local AI để nhận kiến thức cần biết. Người dùng chịu trách nhiệm kiểm tra đề. Bản đầu chưa tự chuẩn hóa đề bằng AI.
4. Mở hint 1 local. Chỉ sau khi có hint trước mới mở được tầng tiếp theo. Hint 2 (phương pháp) và hint 3 (lời giải) dùng cloud, cần bật đồng ý và có mạng. Chưa mở thì không gọi AI hay tạo trước nội dung.
5. Chat chọn local hoặc cloud; cloud cần đồng ý. Khi offline tự chọn local. Prompt dùng đề, kiến thức, hint đã mở và tối đa 6 tin nhắn gần nhất (mỗi tin tối đa 1.500 ký tự). Cả lịch sử vẫn được lưu trong sổ.
6. Viết ghi chú/bài làm, đính kèm ảnh giải (PNG/JPG/WebP, tối đa 3 MB/ảnh, tổng 4 ảnh/bài).
7. Lưu bài: đặt tên, chọn/tạo thư mục, đánh dấu đang làm/đã hoàn thành. Chỉ thông báo đã lưu sau khi IndexedDB ghi thành công.
8. Mở Thư viện → thư mục → Mở bài. Đề, kiến thức, hint đã mở, ảnh, ghi chú và chat được phục hồi; không tạo lại AI. Có thể sửa ghi chú, lưu đè cùng bài, hoặc xóa.
9. Sửa đề đã xác nhận sẽ yêu cầu bỏ kiến thức/hint/chat cũ để tránh trộn bài; giữ ghi chú và ảnh.

## Lưu trữ và giới hạn

- Notebook mới lưu IndexedDB, khóa bởi Firebase project ID + UID. Không hiển thị sổ người khác khi đổi tài khoản. Đăng xuất xóa trạng thái trên giao diện nhưng giữ sổ trên thiết bị.
- Luôn cần đăng nhập trước khi dùng sổ; đăng ký/đăng nhập mới cần Auth/emulator. Có mạng không tự gửi bài lên cloud. Đồng bộ Firestore/Storage chưa có trong bản này.
- Dữ liệu chỉ có trên trình duyệt/profile này; xóa dữ liệu trình duyệt có thể mất sổ. Giữ cùng Auth UID và emulator export để mở lại.
- Kho ghi chú legacy trước đây không bị xóa, chưa được chuyển vào notebook mới. Các module reader/upload legacy vẫn giữ trong source, nhưng không nằm trên giao diện sổ.
- Prompt ngắn và streaming vẫn dùng, không đảm bảo độ đúng hoặc hỗ trợ tiếng Việt của local trên mọi thiết bị. Quick/Hint legacy vẫn tồn tại cho code cũ.
- Bản này chưa OCR, chưa AI chuẩn hóa đề, chưa đồng bộ cloud, chưa giải quyết xung đột sync và chưa triển khai production.

## Kiểm tra

```sh
npm test
npm run build
```

Tự nghiệm thu với emulator: hai tài khoản A/B (không thấy sổ nhau); lưu rồi F5; sửa lại cùng bài không nhân đôi; tất cả 3 hint; tắt cloud consent; chat offline sau khi model sẵn sàng; sai password; lỗi IndexedDB; giữ ảnh/LaTeX khi mở lại; restart emulator với import/export.
