# 디자인 시스템

`/` 와 `/notice/[id]` 두 화면을 만들기 전에 정해 둔 것들. 구현은 아직 없다.

```
design/
├─ tokens.css      런타임 원본. 색·간격·글자 크기는 전부 여기서 나온다
├─ tokens.json     Figma/툴 핸드오프용 미러 (primitive + semantic 만)
├─ layout.md       화면 구조·정보 설계·상태 매트릭스
├─ components.md   컴포넌트별 상태 표
└─ preview.html    브라우저로 바로 열어보는 목업 (백엔드 불필요)
```

## 먼저 이걸 열어라

```bash
open design/preview.html
```

서버도 백엔드도 필요 없다. `tokens.css` 를 링크하고 mock 데이터로 그린다.
상단 바에서 화면과 상태를 갈아 끼울 수 있다 — 로딩·빈 결과·오류·근거 없음까지 전부 들어 있다.
다크 토글도 거기 있다. **9/4 중간발표에서 그대로 띄우면 된다.**

인용 연결은 연출이 아니라 실제로 동작한다. 답변의 `[1]` 에 마우스를 올리면
우측 출처 카드가 켜지고, 반대로도 켜진다. 클릭하면 그 출처로 스크롤한다.

## 세 가지 결정

**출처 색을 브랜드 색과 분리했다.** 브랜드는 indigo, 출처는 sky.
"내가 누른 것"과 "근거"가 같은 파랑이면 사용자가 둘을 구별하지 못한다.
근거가 이 제품의 전부라서 색을 통째로 하나 떼어줬다.

**순위 번호를 화면에서 없앴다.** 검색은 리랭커를 뺐고 Top1 은 0.565다.
1위가 정답이라고 믿게 만들면 안 된다. 대신 눈금 없는 관련도 막대를 준다.

**상태색은 -600 이 아니라 -700 이다.** 연한 배경에 같은 계열 -600 을 얹으면 대비가 3.1~4.3:1 로
AA 아래로 떨어진다(`amber-600 / amber-50` 이 3.07:1 이었다). 다크에서는 반대로 -300 으로 올린다.
라이트·다크 12쌍을 실측했고 전부 4.5:1 을 넘는다.

**본문 기본이 15px 다.** 16px 이 아니다. 공고 목록은 한 화면에 정보가 많아야
비교가 되고, 한글은 15px 에서 충분히 읽힌다. 대신 행간을 라틴보다 넓게 잡았다
(본문 1.6, 답변 1.75). 자세한 이유는 `layout.md`.

## 3계층 구조

```
PRIMITIVE   --color-indigo-600     원시값. 거의 안 바꾼다
    ↓
SEMANTIC    --color-primary        쓰임새. 테마를 바꾸는 층이 여기다
    ↓
COMPONENT   --button-primary-bg    컴포넌트 전용
```

**컴포넌트 CSS 에 hex 를 쓰지 않는다.** 컴포넌트 토큰은 시맨틱을,
시맨틱은 원시값을 참조한다. 한 칸씩만 건너뛴다.

다크 모드가 이 구조의 값을 증명한다 — `tokens.css` 의 다크 블록은 **시맨틱만**
덮어쓴다. 컴포넌트 층은 한 줄도 안 건드린다. 다크에서 컴포넌트 토큰을 또
덮어써야 한다면 시맨틱 설계가 틀린 것이다.

## Next.js 에 붙이기

`app/globals.css` 를 이렇게 바꾼다.

```css
@import "tailwindcss";
@import "../design/tokens.css";

/* Tailwind v4 유틸리티로 노출할 것만 골라 넘긴다 */
@theme inline {
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-primary: var(--color-primary);
  --color-cite: var(--color-cite);
  --font-sans: var(--font-family-sans);
  --font-mono: var(--font-family-mono);
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
}
```

글꼴은 Pretendard 다. Geist 는 한글 자체가 없어서 시스템 폰트로 떨어진다.

```bash
pnpm add pretendard
```

```ts
// app/layout.tsx
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
```

`layout.tsx` 의 `<html lang="en">` 은 `lang="ko"` 로 고친다.
다크 모드는 `:root[data-theme]` 를 쓴다 — `prefers-color-scheme` 만으로는
사용자가 못 바꾼다.

## tokens.json 은 왜 따로 있나

`tokens.css` 가 원본이다. JSON 은 Figma 나 토큰 툴에 넘길 때 쓰는 미러라
primitive 와 semantic 만 담았다. **CSS 를 고치면 JSON 도 같이 고친다.**
동기화가 귀찮아지는 순간 JSON 을 지우는 게 맞다 — 원본이 둘이면 둘 다 틀린다.

## 규칙 다섯

1. 컴포넌트 CSS 에 hex·rgb 를 쓰지 않는다. `var()` 만 쓴다.
2. 간격은 4px 배수만. 홀수 값이 필요하면 레이아웃이 틀린 것이다.
3. `--color-text-subtle`(slate-400)은 본문에 쓰지 않는다. 대비 3.4:1 — 비활성과 장식 전용이다.
4. 채움색과 글자색을 한 토큰으로 합치지 않는다. `--color-primary` 는 버튼 배경,
   `--color-text-link` 와 `--color-primary-subtle-fg` 는 글자다. 합치면 다크에서 한쪽이 깨진다.
5. 새 색이 필요하면 원시값을 먼저 늘리고, 시맨틱 이름을 붙이고, 그다음 쓴다.
