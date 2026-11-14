import type { Subject } from './types';
export const samples: Record<Subject, string> = {
calculus: String.raw`# Giải tích 1A / Calculus 1A
Xét giới hạn $\lim_{x\to 0}\frac{\sin x}{x}=1$, với góc đo bằng radian.
Đạo hàm: nếu $f(x)=x^3-3x$, thì $f'(x)=3x^2-3$.
Bài tập: tính $\int 2x\,dx$ và giải thích vai trò của hằng số $C$.
Hãy kiểm tra miền xác định trước khi biến đổi biểu thức.`,
discrete: String.raw`# Toán rời rạc 1A / Discrete Mathematics 1A
Mệnh đề $P\Rightarrow Q$ chỉ sai khi $P$ đúng và $Q$ sai.
Mệnh đề phản đảo là $\neg Q\Rightarrow\neg P$.
Quy nạp: chứng minh $1+2+\cdots+n=\frac{n(n+1)}{2}$ với $n\ge1$.
Đếm: số tập con có 2 phần tử của tập 5 phần tử là $\binom{5}{2}=10$.`,
algorithms: "# Thuật toán / Algorithms\n\nBinary search requires sorted input.\n\n```python\ndef binary_search(a, target):\n    lo, hi = 0, len(a) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if a[mid] == target:\n            return mid\n        if a[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n```\n\nExplain the loop invariant, time complexity and empty-array case."
};
