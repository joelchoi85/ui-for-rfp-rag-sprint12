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
    // Vercel 에서 RFP_API 를 안 넣으면 localhost 로 굳어서 **빌드는 성공하고**
    // 배포된 화면의 모든 /api 호출만 502 로 죽는다. 원인이 로그에 안 남는다.
    // 여기서 터뜨려야 그 자리에서 안다. 로컬은 .env 가 있으니 안 걸린다.
    if (process.env.VERCEL && !process.env.RFP_API) {
      throw new Error(
        "RFP_API 가 없습니다. Vercel 프로젝트 Settings → Environment Variables 에 " +
          "RFP_API=http://<VM-외부IP>:8010 을 넣으세요 (NEXT_PUBLIC_ 붙이지 말 것)."
      );
    }
    const backend = process.env.RFP_API ?? "http://localhost:8010";
    return [{ source: "/api/:path*", destination: `${backend}/:path*` }];
  },
};

export default nextConfig;
