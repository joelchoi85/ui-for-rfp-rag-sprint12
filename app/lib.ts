/**
 * 백엔드(FastAPI)와 말을 섞는 곳. 이 파일 말고는 fetch 를 쓰지 않는다.
 *
 * 스펙 원본은 http://localhost:8010/docs 다.
 */

/** 항상 같은 오리진. 진짜 백엔드 주소는 next.config.ts 의 rewrite 가 서버 쪽에서만 안다. */
export const API = "/api";

/** `POST /search` 의 한 건. `청크수` 는 백엔드가 한글 키로 주는 그대로다. */
export type Notice = {
  doc_id: string;
  /** 공고 차수. `doc_id` 의 `-N` 이다. 규칙 밖 이름이면 null. */
  차수: number | null;
  /**
   * 같은 공고번호의 doc_id 전부, 차수 오름차순.
   *
   * **본문이 같은 옛 차수는 백엔드가 이미 뺐다.** 그래서 이게 둘 이상이면
   * 그 공고는 차수마다 내용이 실제로 다르다는 뜻이고, 질문할 때 전부 넘겨야
   * "1차와 뭐가 달라졌나" 를 답할 수 있다.
   */
  siblings?: string[];
  /**
   * 이 공고에서 **빠진 문서**가 있을 때 그 이유. 발주기관이 첨부를 잘못 올렸다가
   * 차수를 올리며 교체한 경우다. 컨설턴트가 옛 문서를 이미 받아 갔을 수 있으니
   * 조용히 사라지면 안 된다 — "어제 본 그 내용이 왜 없지" 가 된다.
   */
  교체안내?: string[];
  title: string;
  agency: string;
  budget: number | null;
  bid_close_at: string | null;
  summary: string | null;
  score: number;
  청크수: number;
  /** 요약이 비었을 때 대신 보여줄 원문 첫 대목. 요약은 나라장터 API 에 없다. */
  excerpt: string;
};

/** `POST /ask` 응답의 출처 한 건. 답변 속 `[n]` 이 여기 `n` 에 붙는다. */
export type Source = {
  n: number;
  doc_id: string;
  /** 근거가 몇 차 공고에서 왔는지. 프롬프트 머리에 들어간 값과 같다. */
  차수: number | null;
  title: string;
  agency: string;
  chunk_id: string;
  /** 근거로 쓴 원문 발췌. 이게 이 제품의 핵심이라 화면에서 빠지면 안 된다. */
  excerpt: string;
  /** 발췌 전체. 팝업에서 끝까지 읽는다. */
  text?: string;
};

/**
 * 질문·답변과 겹치는 자리를 표시한다.
 *
 * **어디가 근거인지 우리는 모른다.** 모델이 어느 문장을 보고 답했는지는 알
 * 수 없다. 그러니 아는 것만 말한다 — 질문에 있던 낱말과 답변에 나온 숫자가
 * 원문 어디에 있는지. 그것만으로도 눈이 갈 자리가 정해진다.
 *
 * @param text 원문
 * @param terms 찾을 말들 (질문 낱말 · 답변 속 숫자)
 * @returns `{part, hit}` 조각들. `hit` 이면 표시한다
 */
export function marked(
  text: string,
  terms: string[],
): { part: string; hit: boolean }[] {
  const words = [
    ...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2)),
  ]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return [{ part: text, hit: false }];
  return text
    .split(new RegExp(`(${words.join("|")})`, "gi"))
    .filter(Boolean)
    .map((part) => ({
      part,
      hit: words.some((w) => new RegExp(`^${w}$`, "i").test(part)),
    }));
}

/** 질문의 낱말 + 답변 속 숫자. 팝업에서 표시할 것들. */
export function evidenceTerms(
  question: string,
  answer: string | null,
): string[] {
  const words = question.split(/[\s,·]+/).filter((w) => w.length >= 2);
  const numbers = (answer ?? "").match(/[\d][\d,]*(?:\.\d+)?%?/g) ?? [];
  return [...words, ...numbers];
}

/** `POST /ask` 응답. `ok: false` 여도 HTTP 200 으로 온다. */
export type Answer = {
  ok: boolean;
  answer: string | null;
  error: string | null;
  model: string | null;
  latency_sec: number | null;
  /** 검색에 쓴 초. **생성과 나눠서 본다** — 합계만 알면 어디를 줄일지 모른다. */
  search_sec?: number;
  total_sec?: number;
  usage: { input_tokens: number; output_tokens: number } | null;
  sources: Source[];
};

/**
 * `GET /models` 의 한 건.
 *
 * `ready` 가 false 면 **고르는 순간 첫 답변이 1~2분 걸린다.** GPU 한 장에 생성
 * 모델을 하나만 올릴 수 있어서, 다른 모델을 고르면 VM 이 컨테이너를 갈아끼운다.
 * 화면에서 이걸 숨기면 사용자는 고장 난 줄 안다.
 */
export type Model = {
  key: string;
  name: string;
  provider: string;
  ready: boolean;
  /** 문항 하나당 대략의 달러. **VM 모델(sglang)은 0 이다** — 우리 GPU 를 쓴다.
   *  값은 VM 의 `config/model_config.py` 에서 온다. 화면에 다시 적지 않는다. */
  usd_per_call: number;
  /** OpenAI 모델의 reasoning_effort. **키가 달라도 model 이 같을 수 있어서**
   *  (mini 와 mini-fast 는 둘 다 gpt-5-mini) 이게 없으면 드롭다운에 같은
   *  이름이 두 줄 뜬다. VM 모델(sglang)은 null. */
  effort?: string | null;
};

/** `kakaocorp/kanana-1.5-8b-instruct-2505` → `kanana-1.5-8b-instruct-2505` */
export function modelLabel(name: string): string {
  return name.split("/").pop() ?? name;
}

const MODEL = "bidmate:model";

/**
 * 고른 모델을 화면 사이로 넘긴다. 공고를 넘기는 `pick()` 과 같은 방식이다.
 *
 * ponytail: sessionStorage. URL 쿼리로 하면 딥링크가 되지만 두 페이지가 전부
 * 클라이언트 컴포넌트라 `useSearchParams` + Suspense 경계를 새로 쳐야 한다.
 * 공고도 이미 같은 방식으로 넘기고 있어서 맞췄다.
 */
export function pickModel(key: string) {
  try {
    sessionStorage.setItem(MODEL, key);
  } catch {
    // 사파리 프라이빗 모드 등. 모델 기억 하나 때문에 화면이 죽으면 안 된다.
  }
}

/**
 * 공고 한 건을 서버에서. `picked()` 가 비었을 때 쓴다.
 *
 * 목록을 거치지 않고 들어오는 길이 셋이나 된다 — 새로고침, 주소 직접 입력,
 * 답변의 출처 누르기. 세션에만 기대면 그때 제목도 요약도 빈다.
 */
export async function fetchNotice(docId: string): Promise<Notice | null> {
  try {
    const res = await fetch(API + `/notice/${encodeURIComponent(docId)}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/* ─── 최근 검색어 ──────────────────────────────────────────────────────── */

const RECENT = "bidmate:recent";
const RECENT_MAX = 30; // 보여주는 건 10개. 지우면 그 앞엣것이 드러나야 하므로 더 갖고 있는다

/** 최근 검색어. 최신이 앞. */
export function recent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? "[]");
  } catch {
    return [];
  }
}

/** 하나 기억한다. 같은 말은 위로 올린다. */
export function remember(query: string) {
  const text = query.trim();
  if (!text) return;
  try {
    const kept = [text, ...recent().filter((q) => q !== text)].slice(
      0,
      RECENT_MAX,
    );
    localStorage.setItem(RECENT, JSON.stringify(kept));
  } catch {
    // 사파리 프라이빗 모드 등. 검색 기록 하나 때문에 화면이 죽으면 안 된다.
  }
}

/** 하나만 지운다. `null` 이면 전부. */
export function forget(query: string | null): string[] {
  try {
    const kept = query === null ? [] : recent().filter((q) => q !== query);
    localStorage.setItem(RECENT, JSON.stringify(kept));
    return kept;
  } catch {
    return [];
  }
}

/* ─── 마지막 검색 결과 ──────────────────────────────────────────────────── */

const LAST = "bidmate:last";

/**
 * 방금 본 목록을 담아 둔다. 공고 화면에서 **뒤로 오면 그대로 있어야 한다.**
 *
 * 홈은 클라이언트 상태라 되돌아오면 리마운트되어 다 날아간다. 사용자가 지우기
 * 전까지는 남기는 게 맞다 — 열 건을 훑다가 하나 눌러 보고 돌아오는 게 이 화면의
 * 기본 동작이다.
 */
export function keepLast(state: {
  query: string;
  notices: Notice[];
  elapsed: number;
}) {
  try {
    sessionStorage.setItem(LAST, JSON.stringify(state));
  } catch {
    // 못 담아도 검색은 된다
  }
}

export function lastSearch(): {
  query: string;
  notices: Notice[];
  elapsed: number;
} | null {
  try {
    return JSON.parse(sessionStorage.getItem(LAST) ?? "null");
  } catch {
    return null;
  }
}

export function clearLast() {
  try {
    sessionStorage.removeItem(LAST);
  } catch {
    // 무시
  }
}

/** `pickModel()` 로 넘겨둔 키. 없으면 null. */
export function pickedModel(): string | null {
  try {
    return sessionStorage.getItem(MODEL);
  } catch {
    return null;
  }
}

/**
 * JSON POST 한 번.
 *
 * 네트워크·서버 오류는 던지고, `ok: false` 는 그대로 돌려준다.
 * 둘은 화면에서 다르게 보여야 해서 여기서 합치지 않는다.
 */
export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // **서버가 말한 이유를 버리지 않는다.** 예전엔 `400 Bad Request` 만 띄웠다.
    // 평가 세트 업로드가 거절되는 이유는 서버만 아는데(정답 문서가 코퍼스에
    // 없다 등), 그걸 안 보여주면 화면에서는 손쓸 방법이 없다.
    let why = "";
    try {
      const { detail } = await res.json();
      why = typeof detail === "string" ? detail : (detail?.message ?? "");
      if (detail?.unknown_count) {
        why += ` (못 찾은 문서 ${detail.unknown_count}건: ${(
          detail.unknown ?? []
        )
          .slice(0, 2)
          .join(", ")}…)`;
      }
    } catch {
      // 본문이 JSON 이 아니면 상태 줄만 쓴다
    }
    throw new Error(why || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * `POST /ask/stream` 을 읽어 글자가 오는 대로 넘긴다.
 *
 * **SSE 가 아니라 NDJSON 이다.** `EventSource` 는 GET 만 되는데 이 요청은 본문이
 * 필요해서 POST 다. 어차피 `fetch` 로 읽으니 `data:` 틀이 하는 일이 없다.
 *
 * 반환값은 `post<Answer>("/ask", …)` 와 같은 모양이다. 그래서 부르는 쪽은
 * 콜백만 하나 더 넘기면 되고, 스트리밍이 막혀 서버가 한 번에 보내도 코드가
 * 그대로 돈다 — 그때는 `onDelta` 가 딱 한 번 불린다.
 *
 * @param body /ask 와 같은 요청 본문.
 * @param onDelta 새 글자 조각. 이어 붙이는 건 부르는 쪽이 한다.
 * @param onMeta 검색이 끝난 시점. 답이 나오기 전에 출처를 먼저 그릴 수 있다.
 * @param signal 끊을 신호. `abort()` 하면 `AbortError` 를 던지므로 부르는
 *   쪽에서 `isAbort()` 로 걸러 오류로 안 띄운다.
 */
export async function askStream(
  body: unknown,
  onDelta: (text: string) => void,
  onMeta?: (meta: { search_sec: number; sources: Source[] }) => void,
  signal?: AbortSignal,
): Promise<Answer> {
  const res = await fetch(API + "/ask/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let why = "";
    try {
      const { detail } = await res.json();
      why = typeof detail === "string" ? detail : "";
    } catch {
      // 본문이 JSON 이 아니면 상태 줄만 쓴다
    }
    throw new Error(why || `${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  const out: Answer = {
    ok: true,
    answer: "",
    error: null,
    model: null,
    latency_sec: null,
    usage: null,
    sources: [],
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // `fetch` 의 signal 은 응답이 시작되면 본문까지 끊어 주지만, 브라우저마다
    // 시점이 다르다. 여기서도 한 번 본다 — 안 그러면 취소 후에도 글자가 붙는다.
    if (signal?.aborted) {
      await reader.cancel();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    // 마지막 조각은 줄이 덜 왔을 수 있다. 남겨 뒀다가 다음에 이어 붙인다.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        continue; // 깨진 줄 하나 때문에 답 전체를 버리지 않는다
      }
      if (event.type === "meta") {
        out.search_sec = event.search_sec as number;
        out.sources = (event.sources as Source[]) ?? [];
        onMeta?.({ search_sec: out.search_sec, sources: out.sources });
      } else if (event.type === "delta") {
        answer += event.text as string;
        onDelta(answer);
      } else if (event.type === "done") {
        out.model = (event.model as string) ?? null;
        out.usage = (event.usage as Answer["usage"]) ?? null;
        out.latency_sec = (event.latency_sec as number) ?? null;
        out.total_sec = event.total_sec as number;
      } else if (event.type === "error") {
        out.ok = false;
        out.error = String(event.error);
      }
    }
  }

  out.answer = answer;
  return out;
}

/** `GET /logs` 의 한 건. */
export type LogFile = {
  name: string;
  exists: boolean;
  bytes: number;
  at: string | null;
};

export type LogTail = {
  name: string;
  at?: string;
  bytes?: number;
  lines: string[];
  note?: string;
};

/**
 * VM 의 운영 로그를 본다. **ssh 를 안 쓰는 사람이 크론을 확인할 유일한 창구다.**
 *
 * 경로가 아니라 이름을 넘긴다. 서버가 표에서 찾는다 — 경로를 받으면
 * `../../.env` 를 막는 코드를 우리가 짜야 하고, 그건 늘 한 군데가 빈다.
 */
export async function logFiles(): Promise<LogFile[]> {
  const res = await fetch(API + "/logs");
  return res.ok ? res.json() : [];
}

export async function logTail(name: string, lines = 200): Promise<LogTail> {
  const res = await fetch(API + `/logs/${name}?lines=${lines}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** 사용자가 끊은 것인가. 취소를 빨간 오류로 띄우면 고장 난 줄 안다. */
export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/** 드롭다운에 채울 모델 목록. 실패하면 빈 배열 — 모델 선택 하나 때문에 화면이 죽지 않는다. */
export async function models(): Promise<Model[]> {
  try {
    const res = await fetch(API + "/models");
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

/** 1억 2,300만원. 자릿수가 세로로 맞아야 금액 비교가 눈에 들어온다. */
export function won(amount: number | null): string {
  if (!amount) return "금액 미상";
  const eok = Math.floor(amount / 1e8);
  const man = Math.floor((amount % 1e8) / 1e4);
  return (
    (eok ? `${eok}억 ` : "") + (man ? `${man.toLocaleString()}만` : "") + "원"
  );
}

/**
 * 마감까지 남은 날. 지났으면 음수, 못 읽으면 null.
 *
 * 백엔드는 `"2024-12-23 10:00:00"` 로 준다 — ISO 가 아니라서 Safari 가 못 읽는다.
 * 공백을 T 로 바꿔서 넘긴다.
 */
export function dday(closeAt: string | null): number | null {
  if (!closeAt) return null;
  const at = new Date(closeAt.replace(" ", "T")).getTime();
  return Number.isNaN(at) ? null : Math.ceil((at - Date.now()) / 86_400_000);
}

/** "2024-12-23 10:00:00" → "2024-12-23" */
export function day(closeAt: string | null): string {
  return closeAt ? closeAt.slice(0, 10) : "마감일 미상";
}

const PICKED = "bidmate:picked";

/**
 * 목록에서 고른 공고를 다음 화면으로 넘긴다.
 *
 * 백엔드에 `GET /notices/{id}` 가 없어서 공고 하나만 다시 못 가져온다.
 * ponytail: sessionStorage 로 넘긴다. 링크를 직접 열면 제목이 비는데,
 * 단건 조회 엔드포인트가 생기면 그때 갈아끼운다.
 */
export function pick(notice: Notice) {
  sessionStorage.setItem(PICKED, JSON.stringify(notice));
}

/** `pick()` 으로 넘겨둔 공고. 새 탭으로 직접 열었으면 null. */
export function picked(docId: string): Notice | null {
  try {
    const raw = sessionStorage.getItem(PICKED);
    const notice: Notice = raw ? JSON.parse(raw) : null;
    return notice?.doc_id === docId ? notice : null;
  } catch {
    return null;
  }
}

/* ─── 평가 (E2E) ────────────────────────────────────────────────────────── */

/** `GET /evalsets` 의 한 건. 비용은 시작 전에 보여 준다. */
export type EvalSet = { name: string; count: number };

/** 한 지표 묶음. 유형(배점·요구사항·의역·전체) → 지표 이름 → 값. */
export type Metrics = Record<string, Record<string, number>>;

/**
 * `GET /eval/{id}`. **상태가 VM 의 파일에 있다.**
 *
 * 화면을 떠났다 돌아와도, 새로고침해도, VM 이 재시작돼도 이 한 번의 호출로
 * 지금 상태를 안다. Vercel 쪽에는 아무 상태도 두지 않는다 — 거기는 프록시다.
 */
export type EvalJob = {
  id: string;
  status: "running" | "done" | "failed" | "interrupted" | "cancelled";
  step: string;
  done: number;
  total: number;
  started_at: number;
  finished_at: number | null;
  options: {
    evalset: string;
    model: string;
    judge: boolean;
    judge_model: string;
    limit: number | null;
    generation: boolean;
    /** false 면 공고를 안 알려주고 검색부터 — 전 구간 E2E */
    scoped?: boolean;
  };
  /** VM 의 `outputs/eval_results/` 에 남는 산출물. 시작할 때부터 정해진다. */
  files: { contexts: string; answers: string; metrics: string };
  log: string[];
  metrics: Record<string, Metrics> | null;
  error: string | null;
};

/** 목록에는 로그가 없다. */
export type EvalRow = Omit<EvalJob, "log">;

export async function evalSets(): Promise<EvalSet[]> {
  const res = await fetch(API + "/evalsets");
  return res.ok ? res.json() : [];
}

/**
 * 평가 세트를 올린다. `.json`(배열) · `.jsonl` 둘 다 된다.
 *
 * 파일을 **브라우저가 읽어 문자열로** 보낸다. multipart 를 쓰면 VM 에
 * `python-multipart` 를 새로 깔아야 하는데, 세트는 커야 수백 KB 라 그럴 값이 없다.
 *
 * 올린 세트는 **채점이 끝나면 VM 이 지운다.** `data/` 에 쌓이면 안 된다.
 */
export async function uploadEvalSet(file: File): Promise<{
  evalset: string;
  count: number;
  /** 정답 문서가 코퍼스에 있는 문항 수. 0 이면 서버가 아예 안 받는다. */
  matched: number;
  /** doc_id 가 파일명이라 공고번호로 바꿔 준 문항 수. */
  converted: number;
  unknown_count: number;
  unknown: string[];
}> {
  return post("/eval/upload", { name: file.name, content: await file.text() });
}

export async function evalRuns(): Promise<EvalRow[]> {
  const res = await fetch(API + "/eval");
  return res.ok ? res.json() : [];
}

/**
 * 돌던 평가를 멈춘다. 160문항 채점은 몇십 분이라 되돌릴 방법이 있어야 한다.
 *
 * `stopped: false` 는 오류가 아니다 — 화면이 마지막으로 본 뒤에 끝났다는 뜻이다.
 */
export async function cancelEval(id: string): Promise<{ stopped: boolean }> {
  return post(`/eval/${id}/cancel`, {});
}

export async function evalJob(id: string): Promise<EvalJob> {
  const res = await fetch(API + `/eval/${id}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** 지표 이름 순서. 화면마다 순서가 달라지면 비교가 안 된다. */
export const METRIC_ORDER = [
  "인용표시율",
  "인용정확도",
  "숫자근거율",
  "충실성",
  "물러섬",
];

/** `2026-09-03 16:04` — 언제 돌린 건지 목록에서 바로 읽혀야 한다. */
export function when(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** 초를 `3분 12초` 로. 오래 걸리는 작업이라 초만 쓰면 안 읽힌다. */
export function lapse(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}분 ${s}초` : `${s}초`;
}
