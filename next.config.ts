import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 브라우저는 항상 같은 오리진(/api)만 부르고, 여기서 백엔드로 넘긴다.
  //
  // Vercel 은 HTTPS 인데 백엔드는 http://<VM>:8010 이다. 브라우저가 HTTPS 페이지에서
  // HTTP 로 fetch 하면 혼합 콘텐츠로 차단된다 — CORS 를 열어도 안 된다.
  // 프록시를 끼우면 브라우저는 HTTPS 만 상대하고, CORS 도 필요 없어지고,
  // 백엔드 주소가 클라이언트 번들에 안 박힌다.
  //
  // RFP_API 는 빌드 시점에 굳는다. 값을 바꾸면 재배포해야 한다.
  async rewrites() {
    const backend = process.env.RFP_API ?? "http://localhost:8010";
    return [{ source: "/api/:path*", destination: `${backend}/:path*` }];
  },
};

export default nextConfig;
