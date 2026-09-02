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
export type Model = { key: string; name: string; provider: string; ready: boolean };

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
