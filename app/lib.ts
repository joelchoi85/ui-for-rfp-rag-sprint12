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
  title: string;
  agency: string;
  budget: number | null;
  bid_close_at: string | null;
  summary: string | null;
  score: number;
  청크수: number;
  excerpt: string;
};

/** `POST /ask` 응답의 출처 한 건. 답변 속 `[n]` 이 여기 `n` 에 붙는다. */
export type Source = {
  n: number;
  doc_id: string;
  title: string;
  agency: string;
  chunk_id: string;
  /** 근거로 쓴 원문 발췌. 이게 이 제품의 핵심이라 화면에서 빠지면 안 된다. */
  excerpt: string;
};

/** `POST /ask` 응답. `ok: false` 여도 HTTP 200 으로 온다. */
export type Answer = {
  ok: boolean;
  answer: string | null;
  error: string | null;
  model: string | null;
  latency_sec: number | null;
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
  status: "running" | "done" | "failed" | "interrupted";
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
