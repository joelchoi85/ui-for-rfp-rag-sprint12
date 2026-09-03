import type { NextConfig } from "next";

// 프록시는 `app/api/[...path]/route.ts` 가 한다. rewrite 로 하면 요청을 그대로
// 넘기기만 해서 **토큰 헤더를 붙일 자리가 없다.**
//
// 여기 남은 건 배포 시점 점검 하나뿐이다. Vercel 에서 RFP_API 를 안 넣으면
// localhost 로 굳어서 **빌드는 성공하고** 배포된 화면의 모든 /api 호출만
// 죽는다. 원인이 로그에 안 남는다. 여기서 터뜨려야 그 자리에서 안다.
const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.VERCEL && !process.env.RFP_API) {
      throw new Error(
        "RFP_API 가 없습니다. Vercel 프로젝트 Settings → Environment Variables 에 " +
          "RFP_API=http://<VM-외부IP>:8010 을 넣으세요 (NEXT_PUBLIC_ 붙이지 말 것).",
      );
    }
    if (process.env.VERCEL && !process.env.RFP_TOKEN) {
      throw new Error(
        "RFP_TOKEN 이 없습니다. VM 의 .env 에 넣은 API_TOKEN 과 같은 값을 " +
          "Vercel 환경변수 RFP_TOKEN 에 넣으세요 (NEXT_PUBLIC_ 붙이지 말 것).",
      );
    }
    return [];
  },
};

export default nextConfig;
