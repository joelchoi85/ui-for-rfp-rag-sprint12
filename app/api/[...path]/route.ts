/**
 * VM 으로 넘기는 프록시. **토큰을 여기서 붙인다.**
 *
 * 예전에는 `next.config.ts` 의 rewrite 가 이 일을 했다. rewrite 는 요청을 그대로
 * 넘기기만 해서 헤더를 붙일 자리가 없다. 브라우저가 토큰을 들고 다니게 하면
 * 번들에 박혀 공개되므로(그러면 토큰이 아니다), 서버에서 도는 이 파일이 붙인다.
 *
 * `RFP_API`, `RFP_TOKEN` 둘 다 `NEXT_PUBLIC_` 이 아니다. 클라이언트로 안 간다.
 *
 * 라우트 핸들러는 rewrite 보다 먼저 잡힌다(rewrites 는 파일 라우트 뒤에 본다).
 * 그래도 헷갈리지 않게 `next.config.ts` 에서 그 규칙을 지웠다.
 */

// `/ask/stream` 이 흘러가려면 요청마다 새로 돌아야 한다.
export const dynamic = "force-dynamic";

const BACKEND = process.env.RFP_API ?? "http://localhost:8010";
const TOKEN = process.env.RFP_TOKEN ?? "";

async function proxy(request: Request, path: string[]) {
  const url = new URL(request.url);
  const target = `${BACKEND}/${path.join("/")}${url.search}`;

  const headers = new Headers();
  const type = request.headers.get("content-type");
  if (type) headers.set("content-type", type);
  if (TOKEN) headers.set("x-api-token", TOKEN);

  const res = await fetch(target, {
    method: request.method,
    headers,
    // GET/HEAD 에 body 를 달면 fetch 가 던진다.
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text(),
    // 평가 목록·상태는 매번 지금 값이어야 한다. 캐시가 끼면 진행률이 멈춰 보인다.
    cache: "no-store",
  });

  // 본문을 그대로 흘린다. `/file/{doc_id}` 가 hwp 바이너리를 준다 — 텍스트로
  // 읽으면 깨진다.
  const out = new Headers();
  for (const key of ["content-type", "content-disposition", "content-length"]) {
    const value = res.headers.get(key);
    if (value) out.set(key, value);
  }
  return new Response(res.body, { status: res.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}

export async function POST(request: Request, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
