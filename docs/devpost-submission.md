# Mathfolio — Devpost submission

Copy each numbered section into its matching Devpost field. Verify the hosted build and AI quota before submitting.

## 1. About the project

### Inspiration

The most valuable part of solving a math problem is often invisible in the final answer: the diagram that made an idea click, a first attempt that failed, a hint used at the right moment, and the correction written afterward. Those pieces usually end up scattered across paper, screenshots, PDFs, and chat. **Mathfolio** grew from a question: what if an AI math assistant helped preserve the learner's reasoning instead of replacing it?

### What it does

Mathfolio is a personal math workspace and exercise library. A learner can type a question with a math keyboard, paste text or LaTeX, import an image, or select a question from a multi-page PDF. Imported text is reviewed and editable before it becomes the problem: one misread exponent can change the entire task.

The workspace connects four activities that usually live in separate apps:

1. **Understand:** ask for prerequisite concepts and reveal hints in stages, from a starting point to a worked solution. Follow up in chat and attach a sketch when words are not enough.
2. **Explore:** construct geometry or graph equations, adjust parameters, and choose which illustrations are shared as AI context.
3. **Work independently:** write notes, attach a solution image, and use Solo mode to focus on the problem and personal work.
4. **Return later:** save the exercise with its notes and illustrations, organize it in colored folders, search and filter the library, and optionally sync saved work across devices. Appearance settings, study options, and a built-in guide make the workspace easier to adapt and learn.

Our demo starts with an algebra challenge involving a real parameter:

$$
\log_2(x-1)+\log_2(a-x)=1.
$$

The learner must state the domain $1<x<a$, classify when there are zero, one, or two real solutions, and find the parameter for which the two roots differ by exactly $1$ ($a=4$, giving $x=2,3$). This question comes from a six-page, eighteen-problem algebra workbook that also tests radicals, extraneous roots, rational inequalities, and parameter cases. We compare a local route with a Gemini cloud route on **this same statement**, ask why a positive discriminant is not enough, and save the learner's corrected reasoning. A **separate geometry exercise** then demonstrates the drawing tools; it is not part of the Local/Cloud algebra comparison. The demo shows each AI route's limits rather than treating either as an answer authority.

### How we built it

We built the frontend with **React, TypeScript, and Vite**. **MathLive** handles editable math input, **KaTeX** renders notation, **PDF.js** handles PDF pages, and **Tesseract.js** supports browser OCR. The app includes drawing and graphing tools and stores a working copy in IndexedDB so learners can keep working during a network interruption.

**Firebase AI Logic** is the AI bridge. In [`src/ai.ts`](https://github.com/nguynphuc-git/Mathfolio/blob/main/src/ai.ts), Mathfolio creates Gemini models through `firebase/ai`, uses configurable fast and deep routes for transcription, knowledge, hints, and chat, and requests on-device inference where the browser supports it. Cloud AI is an explicit choice with a consent step; only selected problem context is sent for that request. **Firebase App Check** protects the cloud app path. **Firebase Authentication, Cloud Firestore, and Cloud Storage** support optional private synchronization of saved exercises and images, while Firebase Hosting serves the live app. Cloud Sync and Cloud AI are independent choices.

### Challenges and what we learned

- **A mathematically plausible answer can still be wrong.** OCR can flatten an exponent, and AI can overlook a hypothesis. We learned to show the source, permit correction, and make each route's result inspectable.
- **Local and cloud have different failure modes.** On-device inference depends on browser and hardware support; cloud inference depends on consent, connectivity, and quota. We built visible choices and status messages around those constraints.
- **Offline work needs a safe return path.** A browser draft is not the same as a saved exercise. We kept drafts local, queued saved changes while offline, and designed conflict copies so an update from a second device does not silently erase work.
- **Control matters in a learning tool.** Gradual hints, Solo mode, notes, and selective illustration sharing give the learner room to solve the problem instead of merely requesting an answer.

The result is a study companion that carries the journey from source question to verified personal notes. Our next priority is to make uncertainty clearer on parameterized algebra and difficult diagrams alike.

## 2. Built with

Suggested tags (20; maximum 25):

`Firebase AI Logic`, `Gemini`, `Firebase`, `Firebase Authentication`, `Cloud Firestore`, `Cloud Storage for Firebase`, `Firebase App Check`, `Firebase Hosting`, `React`, `TypeScript`, `Vite`, `MathLive`, `KaTeX`, `PDF.js`, `Tesseract.js`, `IndexedDB`, `Progressive Web App`, `SVG`, `LaTeX`, `JavaScript`

## 3. “Try it out” links

- **Live app:** https://mathfolio-mp.web.app/
- **Public source and setup:** https://github.com/nguynphuc-git/Mathfolio
- **README / local run:** https://github.com/nguynphuc-git/Mathfolio/blob/main/README.md

Add the finished video URL only after upload and verification.

## 4. Explain how the project meets the main technology requirement

**Required technology: Firebase AI Logic / Gemini.** Mathfolio uses the real Firebase AI Logic JavaScript SDK in its main learning flow. [`src/ai.ts`](https://github.com/nguynphuc-git/Mathfolio/blob/main/src/ai.ts) imports `getAI`, `GoogleAIBackend`, `getGenerativeModel`, `InferenceMode`, and `Schema` from `firebase/ai`. It initializes the Google AI backend, instantiates Gemini models, and sends requests for problem transcription, prerequisite knowledge, hints, and follow-up chat. Fast and deep model choices are configurable by task; responses derive from the current problem and selected context rather than a list of hard-coded answers. [`src/firebase.ts`](https://github.com/nguynphuc-git/Mathfolio/blob/main/src/firebase.ts) initializes Firebase and App Check for the cloud path.

The learner selects Cloud AI and sees a permission step before sending the problem or chosen illustration. Local inference is available where Chrome supports it, so judges can compare the two routes on the same difficult case. Authentication, Firestore, Storage, and Hosting serve the separate notebook and deployment workflows; Gemini through Firebase AI Logic is the core use of the required technology.

## 5. Testing instructions or credentials judges need

**No shared credentials are needed.** Use desktop Chrome, open the [hosted app](https://mathfolio-mp.web.app/), and register with an email you control (password at least six characters), or use Google sign-in if offered. Use a fresh test account.

1. In Workspace, import the [six-page algebra workbook](https://github.com/nguynphuc-git/Mathfolio/blob/main/scripts/demo-cases/algebra-workbook-6-pages.pdf), select problem 01 on page 1, and review the extracted text. It asks: “For real parameter $a$, classify the number of real solutions of $\log_2(x-1)+\log_2(a-x)=1$. State the domain, give exact solutions in each parameter range, and find $a$ when the two roots differ by $1$.” Choose Local AI for Knowledge and the first hint. Local availability varies by Chrome device.
2. On the **same algebra statement**, choose Cloud AI, read the consent prompt, then request Knowledge and staged hints. Gemini needs internet and remaining project quota. Compare both responses against $1<x<a$ and the threshold $a=1+2\sqrt 2$: below it there are no solutions, at it one, and above it two. The root gap is $\sqrt{(a-1)^2-8}$, so a gap of $1$ requires $a=4$, with roots $2$ and $3$. A positive discriminant alone does not establish the logarithm domain.
3. Ask in chat why the domain matters, record your own solution in Notes, and explore the three hint levels and Solo mode. Save the **algebra** exercise; use Library to search, filter by completion status, inspect its preview, and edit notes. For import testing, move between pages 1, 3, and 6 of the workbook; try problem 04 on page 2 to check radical and fraction extraction. Review and correct the extracted text before using a question. The [answer key](https://github.com/nguynphuc-git/Mathfolio/blob/main/scripts/demo-cases/algebra-workbook-answer-key.txt) covers all eighteen questions.
4. To test Cloud Sync, open another Chrome profile with the **same account**. Enable **Account → Enable cloud sync** in both, save the algebra exercise in the first, wait for pending changes to reach zero, then use **Sync now** in the second. Edit and save there, then sync the first. Workspace drafts stay local until saved. Optionally test DevTools Network → Offline, save a change, reconnect, and Sync now.
5. Create a **new, separate geometry exercise** to test Draw. In Coordinate plane, place $A=(0,0)$, $B=(0,1)$, $C=(2,1)$, $D=(1,0)$; join the trapezoid, mark the midpoint $M$ of $CD$, and locate $I=AC\cap BM$. Find $AD^2/IM^2$; the exact result is $10$. Save the illustration. This solvable drawing problem is separate from the AI comparison. Open Appearance to change theme/text size, Study options to adjust a learning preference, and How to use for the in-app walkthrough.

For local setup, follow the [README](https://github.com/nguynphuc-git/Mathfolio/blob/main/README.md). The local launcher can use Firebase emulators, separate from the hosted account; it does not automatically include live Cloud AI or Cloud Sync.

## 6. Working demo URL

https://mathfolio-mp.web.app/

## 7. Open-source license URL

https://github.com/nguynphuc-git/Mathfolio/blob/main/LICENSE

The public repository contains the full MIT license in its root `LICENSE` file. Verify GitHub displays the license in the repository About area before submission.
