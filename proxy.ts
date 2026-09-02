export function proxy() {
  // 되살릴 때 매개변수부터: export function proxy(req: Request)
  // const auth = req.headers.get("authorization");
  // const want = "Basic " + btoa(process.env.BASIC_AUTH!);
  // if (auth !== want)
  //   return new Response("Auth required", {
  //     status: 401, headers: { "WWW-Authenticate": 'Basic realm="rfp"' },
  //   });
}
export const config = { matcher: "/((?!_next/static|favicon).*)" };