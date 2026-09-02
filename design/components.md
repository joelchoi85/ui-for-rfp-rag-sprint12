# 컴포넌트 스펙

각 컴포넌트의 상태별 값. 표의 칸은 전부 `tokens.css` 의 변수 이름이다.
새 값이 필요하면 여기 hex 를 적지 말고 토큰을 먼저 늘린다.

상태 우선순위 (여러 개가 겹칠 때): `disabled` > `loading` > `active` > `focus` > `hover` > `default`

전환은 전부 이 한 줄로 통일한다.

```css
transition: background-color var(--duration-fast) var(--easing-standard),
            border-color     var(--duration-fast) var(--easing-standard),
            color            var(--duration-fast) var(--easing-standard),
            box-shadow       var(--duration-normal) var(--easing-out);
```

포커스 링도 하나뿐이다. 컴포넌트마다 다르게 그리지 않는다.

```css
:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

---

## Button

변형 셋. 한 화면에 primary 는 하나만 둔다.

### primary

| 속성 | default | hover | active | focus | disabled |
|---|---|---|---|---|---|
| background | `--button-primary-bg` | `--button-primary-bg-hover` | `--button-primary-bg-active` | default 와 동일 | `--button-disabled-bg` |
| color | `--button-primary-fg` | ← | ← | ← | `--button-disabled-fg` |
| border | none | none | none | none | none |
| shadow | `--shadow-xs` | `--shadow-sm` | `--shadow-none` | `--shadow-xs` | none |
| cursor | pointer | pointer | pointer | pointer | not-allowed |

### secondary

| 속성 | default | hover | active | disabled |
|---|---|---|---|---|
| background | `--button-secondary-bg` | `--button-secondary-bg-hover` | `--color-slate-200` | `--button-disabled-bg` |
| color | `--button-secondary-fg` | ← | ← | `--button-disabled-fg` |
| border | 1px `--button-secondary-border` | 1px `--color-slate-400` | 1px `--color-slate-400` | 1px `--color-border` |

### ghost

| 속성 | default | hover | active |
|---|---|---|---|
| background | transparent | `--button-ghost-bg-hover` | `--color-slate-200` |
| color | `--button-ghost-fg` | `--color-text` | `--color-text` |
| border | none | none | none |

### 크기

| 크기 | height | padding-x | font-size | 쓰는 곳 |
|---|---|---|---|---|
| sm | `--button-height-sm` (32) | `--space-3` | `--font-size-sm` | 카드 안, 필터 초기화 |
| md | `--button-height-md` (38) | `--button-padding-x` | `--font-size-md` | 기본 |
| lg | `--button-height-lg` (44) | `--space-5` | `--font-size-base` | 검색창 안의 [찾기] |

### loading

내용을 스피너로 갈지 말고 **글자를 남기고** 앞에 12px 스피너를 붙인다.
버튼 폭이 흔들리면 손이 미끄러진다. `aria-busy="true"`, `disabled`.

---

## Input / Select

| 속성 | default | hover | focus | error | disabled |
|---|---|---|---|---|---|
| background | `--input-bg` | ← | ← | ← | `--color-surface-sunken` |
| color | `--input-fg` | ← | ← | ← | `--color-text-subtle` |
| border | 1px `--input-border` | 1px `--input-border-hover` | 1px `--input-border-focus` | 1px `--color-danger` | 1px `--color-border` |
| ring | — | — | focus-visible 링 | — | — |
| placeholder | `--input-placeholder` | ← | ← | ← | ← |

- 높이 `--input-height`(38), 모서리 `--input-radius`.
- 오류 문구는 입력 아래 `--font-size-sm` / `--color-danger`, `aria-describedby` 로 연결.
- 숫자 입력(예산)은 `font-variant-numeric: tabular-nums`.

---

## SearchBar

홈의 주인공이다. 일반 input 과 다른 컴포넌트로 취급한다.

| 속성 | default | hover | focus |
|---|---|---|---|
| height | `--searchbar-height` (56) | ← | ← |
| background | `--searchbar-bg` | ← | ← |
| border | 1px `--searchbar-border` | 1px `--color-border-strong` | 1px `--color-primary` |
| shadow | `--searchbar-shadow` | `--shadow-md` | `--searchbar-shadow-focus` |
| radius | `--searchbar-radius` (16) | ← | ← |
| font-size | `--searchbar-font-size` (17) | ← | ← |

구성: `[🔍 아이콘 20px] [ input flex:1 ] [ Button lg primary ]`
좌측 아이콘은 `--color-text-subtle`, 포커스되면 `--color-primary`.
Enter 로 제출. 검색 중에는 버튼만 loading 이고 input 은 잠그지 않는다(질의 수정 가능).

---

## NoticeCard

목록의 한 장. 클릭 영역은 카드 전체다.

| 속성 | default | hover | focus-visible | 마감됨 |
|---|---|---|---|---|
| background | `--card-bg` | `--card-bg-hover` | ← | ← |
| border | 1px `--card-border` | 1px `--card-border-hover` | 1px `--color-primary` | 1px `--color-border-subtle` |
| shadow | `--card-shadow` | `--card-shadow-hover` | `--card-shadow-hover` | none |
| transform | none | `translateY(-1px)` | none | none |
| opacity | 1 | 1 | 1 | 0.6 |

### 내부 구조

```
row 1  기관명 (13px, muted)              ·  [D-12] [진행중]     ← 우측 정렬
row 2  공고명 (17px/600, line-clamp 2, --line-height-snug)
row 3  예산 · 마감일 · 발췌 n건 (13px, muted, tabular-nums)
row 4  발췌 1줄 (13px, muted, line-clamp 1, 질의어 <mark>)
row 5  관련도 막대                        ·  질문하기 →
```

간격은 `--card-gap`(12px), 안쪽 여백 `--card-padding`(20px).

---

## Badge

| 종류 | background | color | 쓰는 곳 |
|---|---|---|---|
| neutral | `--color-surface-sunken` | `--color-text-muted` | 계약방식, 분류 |
| success | `--color-success-subtle` | `--color-success` | 진행중 |
| warning | `--color-warning-subtle` | `--color-warning` | D-7 이하 |
| danger | `--color-danger-subtle` | `--color-danger` | 마감 |
| info | `--color-info-subtle` | `--color-info` | 발췌 n건 |

높이 `--badge-height`(22), 모서리 `--badge-radius`, 글자 `--badge-font-size`/`--badge-font-weight`.
**뱃지는 클릭 대상이 아니다.** 누를 수 있으면 FilterChip 을 쓴다.

---

## FilterChip

| 속성 | default | hover | selected | disabled |
|---|---|---|---|---|
| background | `--chip-bg` | `--chip-bg-hover` | `--chip-bg-selected` | `--chip-bg` |
| color | `--chip-fg` | `--color-text` | `--chip-fg-selected` | `--color-text-subtle` |
| border | 1px `--chip-border` | 1px `--color-border-strong` | 1px `--chip-border-selected` | 1px `--color-border-subtle` |

선택되면 우측에 `×` 가 붙는다. 칩 본체 클릭 = 편집, `×` 클릭 = 해제. 두 영역을 분리한다.

---

## RelevanceBar

순위 번호를 대신하는 것. 숫자를 절대 옆에 쓰지 않는다.

```
track  width --relevance-width(56) / height --relevance-height(4) / --relevance-track
fill   width = score 정규화 % / --relevance-fill / --relevance-radius
```

- 정규화는 **결과 집합 안에서** 한다(1위를 100%로). 절대 점수는 뜻이 없다.
- `role="meter"`, `aria-label="관련도"`, `title="이 목록 안에서의 상대적 관련도입니다. 순위가 정답 순서는 아닙니다."`
- 하한 8% — 0 이면 막대가 사라져서 고장 나 보인다.
- track 은 `display: inline-block`, fill 은 `display: block`. 인라인 `<span>` 은 width/height 를 무시해서 채움이 안 보인다 — 프리뷰에서 실제로 걸렸다.

---

## CitationPill

답변 안의 `[1]`. 이 제품에서 제일 중요한 작은 것.

| 속성 | default | hover | active(선택됨) | 매칭 없음 |
|---|---|---|---|---|
| background | `--cite-pill-bg` | `--cite-pill-bg-hover` | `--color-cite` | — |
| color | `--cite-pill-fg` | ← | `--color-white` | `--color-text-muted` |
| border | 1px `--cite-pill-border` | ← | 1px `--color-cite` | none |
| radius | `--cite-pill-radius` | ← | ← | — |
| 렌더 | `<button>` | ← | ← | **그냥 텍스트** |

- 글자 `--cite-pill-font-size`, 좌우 `--cite-pill-padding-x`, 위아래 여백 0 —
  본문 행간을 밀면 안 된다. `vertical-align: baseline`.
- `sources` 에 없는 번호는 pill 로 만들지 않는다. 빈 곳으로 데려가는 게 최악이다.

---

## SourceCard

우측 출처 패널의 항목.

| 속성 | default | hover | active(연결된 pill 이 켜짐) |
|---|---|---|---|
| background | `--source-bg` | `--color-surface-hover` | `--source-bg-active` |
| border | 1px `--source-border` | 1px `--color-border-strong` | 1px `--source-border-active` |
| 좌측 마커 | 3px transparent | 3px `--color-border-strong` | 3px `--source-marker` |

### 내부 구조

```
[1]  기관명 (12px muted)
     공고명 (13px/600, clamp 2)
     chunk_id (11px mono, --color-text-subtle)
     ┌ 발췌 ────────────────────────┐   ← 접힌 상태에선 2줄
     │ …배정예산 금 420,000,000원…  │      --excerpt-* 토큰
     └──────────────────────────────┘
```

발췌 블록은 좌측 3px `--excerpt-border-left`, 배경 `--excerpt-bg`.
**우리가 쓴 글이 아니라 원문이라는 걸 시각적으로 분리해야 한다.**

---

## ProgressSteps

| 상태 | 점 | 라벨 | 연결선 |
|---|---|---|---|
| pending | `--step-dot-idle` | `--color-text-subtle` | `--step-line` |
| active | `--step-dot-active` + 펄스 | `--color-text` / 500 | `--step-line` |
| done | `--step-dot-done` + 체크 | `--color-text-muted` | `--color-success` |

점 크기 `--step-dot-size`(8), 글자 `--step-font-size`.
펄스는 `prefers-reduced-motion` 에서 꺼진다(`--duration-*` 이 1ms 가 된다).
단계 컨테이너는 `aria-live="off"` — 매 단계를 읽어주면 시끄럽다.

---

## Skeleton

```css
background: linear-gradient(90deg,
  var(--skeleton-bg) 25%, var(--skeleton-highlight) 50%, var(--skeleton-bg) 75%);
background-size: 200% 100%;
animation: shimmer var(--skeleton-duration) linear infinite;
```

- 모서리 `--skeleton-radius`. 글줄 스켈레톤은 높이를 실제 `line-height` 에 맞춘다 —
  로딩이 끝날 때 레이아웃이 튀면 안 된다.
- 마지막 줄은 폭을 60~70% 로 줄인다(문단처럼 보이게).
- `aria-hidden="true"`, 컨테이너에 `aria-busy="true"`.

---

## EmptyState

| 요소 | 값 |
|---|---|
| padding | `--empty-padding` (64px) |
| 아이콘 | `--empty-icon-size`, `--empty-fg` |
| 제목 | `--font-size-lg` / `--font-weight-medium` / `--color-text` |
| 설명 | `--font-size-md` / `--color-text-muted` |
| 액션 | secondary Button md |

빈 화면에 "결과 없음"만 두지 않는다. **무엇을 바꾸면 되는지** 한 줄을 반드시 붙인다
(예산 하한을 내려보세요 / 기관명을 지워보세요).

---

## ModelSelect

답변 모델 고르기. **검색 화면과 공고 화면 상단바 오른쪽, 같은 자리.**
자리가 화면마다 옮겨 다니면 매번 다시 찾아야 한다.

Input/Select 스펙을 그대로 쓰고 높이만 32px(상단바 56px 안에 들어가야 한다),
`max-width: 260px`.

### 준비 상태를 라벨에 적는다

`GET /models` 가 주는 `ready` 가 false 면 그 모델은 VM 에 안 올라와 있고,
고르는 순간 첫 답변이 몇 분 걸린다.

```
gpt-5-mini                        ← openai. 항상 준비됨, 표시 없음
kanana-nano-2.1b-instruct         ← 지금 올라와 있음
kanana-1.5-8b-instruct-2505 · 교체 1~2분
```

**색 점으로 표시하지 않는다.** 색만으로 상태를 전하면 색맹 사용자에게는 아무
정보도 아니고, `<option>` 은 브라우저마다 스타일이 달라 어차피 못 믿는다.

모델 이름은 조직 접두어를 뗀다 (`kakaocorp/` → 없음). 드롭다운에서 접두어는
전부 같거나 아무 뜻이 없다.

---

## 기다림은 종류별로 다르게 설명한다

같은 스피너를 아무 데나 쓰면 안 된다. 이 화면에는 기다림이 둘이고 길이가 30배 다르다.

| | 얼마나 | 무엇을 보여주나 |
|---|---|---|
| 평소 질문 | 3~5초 | `ProgressSteps` 3단계 (시간 기반 추정) + Skeleton |
| 안 올라온 모델 | 1~2분, 처음이면 더 | 단계 **하나** (`모델 올리는 중`) + `.hint` + Skeleton |

두 번째는 **단계를 시간으로 넘기지 않는다.** 컨테이너 교체는 30초일 수도 5분일
수도 있어서, 60초에 "답변 생성" 으로 넘겨 놓으면 거기서 2분을 더 기다리게 된다.
추정 단계표가 여기선 거짓말이 된다.

### .hint

왜 오래 걸리는지 한 문단. `--color-info-subtle` 바탕에 좌측 3px `--color-info`,
`--answer-max-width` 까지. `role="status"` 라 스크린리더가 한 번 읽는다 —
단계 컨테이너(`aria-live="off"`)와 역할이 다르다.

---

## 컴포넌트를 늘릴 때

1. 시맨틱 토큰으로 해결되는지 먼저 본다. 대개 된다.
2. 안 되면 `--{component}-{property}-{state}` 로 컴포넌트 토큰을 만들고,
   값은 **반드시 시맨틱 토큰을 참조**한다. 원시값 직접 참조도 금지다.
3. 다크 모드에서 시맨틱만 바꿔도 맞는지 확인한다. 컴포넌트 층을 다크에서
   또 덮어써야 한다면 시맨틱 층 설계가 틀린 것이다.
