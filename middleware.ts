export function middleware(req: Request) {
  const auth = req.headers.get("authorization");
  const want = "Basic " + btoa(process.env.BASIC_AUTH!);
  if (auth !== want)
    return new Response("Auth required", {
      status: 401, headers: { "WWW-Authenticate": 'Basic realm="rfp"' },
    });
}
export const config = { matcher: "/((?!_next/static|favicon).*)" };