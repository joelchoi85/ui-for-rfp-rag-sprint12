/**
 * 백엔드(FastAPI)와 말을 섞는 곳. 이 파일 말고는 fetch 를 쓰지 않는다.
 *
 * 스펙 원본은 http://localhost:8088/docs 다.
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

export type Model = { key: string; name: string };

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
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
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
  return (eok ? `${eok}억 ` : "") + (man ? `${man.toLocaleString()}만` : "") + "원";
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
