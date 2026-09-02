# NLP of Legend — RFP 웹 UI

나라장터 입찰공고(RFP)를 자연어로 찾고, 고른 공고에 대해 질문하는 화면.
검색·생성은 별도 repo(`rfp-rag-system`)의 파이썬 서비스가 하고, 여기는 화면만 한다.

```
Next.js (여기, :3000)  ──HTTP/JSON──▶  FastAPI (rfp-rag-system, :8088)
                                          └─ TEI 임베더/리랭커, FAISS, LLM
```

## 백엔드부터 띄운다

이 화면만 있으면 아무것도 안 나온다. 백엔드가 먼저다.

```bash
cd ../rfp-rag-system
uvicorn src.api:app --reload --port 8088
open http://localhost:8088/docs      # 스펙은 여기가 원본이다
```

백엔드 담당에게 받아야 하는 것 — `.env`, TEI 도커, FAISS 인덱스.
원본 RFP 는 NDA 라 repo 에 없다. **clone 만으로는 안 돌아간다.**

## 이 프로젝트

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

```
RFP_API=http://localhost:8088
```

`RFP_API` 는 **서버 쪽 변수다.** 브라우저는 언제나 같은 오리진의 `/api` 만 부르고,
`next.config.ts` 의 rewrite 가 그걸 백엔드로 넘긴다. 그래서 백엔드 주소가 클라이언트
번들에 안 박히고 CORS 설정도 필요 없다.

## Vercel 에 올릴 때

환경변수는 `RFP_API` 하나다. `NEXT_PUBLIC_` 접두사를 붙이지 말 것 —
붙이면 VM 주소가 공개 번들에 들어간다. rewrite 는 빌드 시점에 굳으므로
값을 바꾸면 재배포해야 한다.

```
RFP_API=http://<VM-외부IP>:8088
```

백엔드 쪽에서 해야 하는 것:

- `uvicorn src.api:app --host 0.0.0.0 --port 8088` — 루프백만 듣고 있으면 못 닿는다.
  `--reload` 는 뺀다. SSH 가 끊겨도 살아 있게 tmux 나 systemd 로 띄운다.
- GCP 방화벽에 TCP 8088 인그레스 허용.
- `UI_ORIGINS` 는 **안 건드려도 된다.** 프록시라 브라우저가 백엔드를 직접 안 부른다.

**8088 을 열면 RFP 코퍼스가 인터넷에 공개된다.** 원본은 NDA 다. Vercel 의
Deployment Protection 을 켜면 프록시도 그 뒤에 있으니 같이 막힌다.

## API

`http://localhost:8088/docs` 가 항상 맞다. 아래는 요약이다.

### `POST /search` — 공고 찾기 (1단계)

```json
{ "query": "클라우드 전환 사업", "top_n": 10, "min_budget": 300000000 }
```

사람이 목록에서 고르는 화면이다. **1위 정확도보다 목록 안에 있는지가 중요해서**
리랭커를 뺐다(Top10 0.839, 질문당 0.7초). 정렬 순서를 너무 믿게 만들지 말 것.

### `POST /ask` — 질문 (2단계)

```json
{ "question": "이 사업의 배정예산은?", "doc_ids": ["20240330003-0"], "model": "mini" }
```

`doc_ids` 를 주면 그 공고 안에서만 찾는다. 1단계에서 고른 결과를 그대로 넘긴다.

응답에 `sources` 가 같이 온다.

```json
{ "ok": true, "answer": "…[1]", "sources": [
  { "n": 1, "doc_id": "20240330003-0", "title": "…", "agency": "…" }] }
```

**답변의 `[1] [2]` 를 `sources[n]` 에 연결해 보여줄 것.** 입찰 담당자는 근거 없는
답을 안 믿는다. 이게 이 제품의 핵심이고 화면에서 빠지면 안 된다.

`ok: false` 면 `error` 가 온다. 예외를 안 던지므로 상태코드만 보면 안 된다.

### `GET /models`

드롭다운 채우는 용도. `[{ "key": "mini", "name": "gpt-5-mini" }]`

## 디자인

`design/` 에 토큰과 화면 스펙이 있다. `design/preview.html` 은 백엔드 없이 열리는 목업이다.

- `design/tokens.css` — 색·간격·글자 크기의 단일 원본. `app/globals.css` 가 이걸 가져다 쓴다
- `design/components.md`, `design/layout.md` — 컴포넌트 상태표, 화면 구조와 그렇게 정한 이유

컴포넌트 CSS 에 hex 를 쓰지 않는다. `var()` 로만 참조한다.

## 화면 둘

```
/            공고 검색 → 목록 → 고르기
/notice/[id] 그 공고에 대한 질의응답 + 출처
```

그 이상은 아직 없다. 인증도 업로드도 대화 저장도 안 만들었다 —
고객사가 둘 이상이 되면 그때 인증부터.

## 정해 둔 것

- **통신은 JSON.** protobuf 를 검토했다가 뺐다. 얻는 건 payload 크기인데
  우리 payload 는 6,000자짜리 발췌라 gzip 이면 끝난다. 대신 빌드 스텝과
  바이너리 디버깅을 사게 된다. 타입이 필요하면 `openapi-typescript` 로
  `/openapi.json` 에서 뽑는다 — 스키마를 두 벌 관리하지 않는다.

  ```bash
  pnpm dlx openapi-typescript http://localhost:8088/openapi.json -o app/api-types.ts
  ```

- **시나리오 A/B 는 화면에 없다.** 인프라 선택(자체 GPU vs 외부 API)이지
  고객의 선택이 아니고, 외부 API 를 고르면 NDA 문서가 밖으로 나간다.
  배포 시점에 환경변수로 정한다.

- 로고·파비콘: `public/logo.png` (조직 아바타)

## 답변이 느린 이유

질문 하나에 3~5초 걸린다. 임베딩 → 후보 80개 → 리랭커가 80개 채점 → LLM 이다.
리랭커 구간이 제일 길다. **스켈레톤이나 단계 표시를 넣을 것.** 스트리밍은
아직 백엔드에 없다.
