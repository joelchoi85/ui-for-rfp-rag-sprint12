"use client";

import Link from "next/link";
import { useState } from "react";
import { Answer, day, dday, Notice, pick, post, Source, won } from "./lib";
import { Cited } from "./notice/[id]/page";
import { ModelSelect } from "./ModelSelect";
import Image from "next/image";

const EXAMPLES = [
  "클라우드 전환 사업",
  "장애인 접근성 개선",
  "이러닝 시스템 운영",
];

type Status = "idle" | "loading" | "done" | "error";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [agency, setAgency] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  // 검색에는 안 쓴다. 공고 화면으로 넘겨주려고 여기서 고르게 하는 것뿐이다.
  const [model, setModel] = useState("mini");
  // **바로 답하기.** 공고를 안 고르고 전체에서 찾아 답한다.
  // 검색은 늘 먼저 돌고(0.7초·무료), 답변은 누를 때만 만든다 — LLM 호출이라
  // 매 검색마다 자동으로 돌리면 느리고 돈이 든다.
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asking, setAsking] = useState(false);
  const [activeCite, setActiveCite] = useState<number | null>(null);

  async function search(text = query) {
    if (!text.trim()) return;
    setQuery(text);
    setStatus("loading");
    const startedAt = Date.now();
    try {
      const found = await post<Notice[]>("/search", {
        query: text,
        top_n: 10,
        // 억 단위로 받아서 원으로 바꾼다. 담당자는 "3억"이라고 말하지 300000000 이라고 말하지 않는다.
        min_budget: minBudget ? Number(minBudget) * 1e8 : null,
        agency: agency || null,
      });
      setNotices(found);
      setElapsed((Date.now() - startedAt) / 1000);
      setStatus("done");
      setAnswer(null); // 질문이 바뀌었으니 옛 답을 남기지 않는다
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function ask() {
    setAsking(true);
    try {
      setAnswer(await post<Answer>("/ask", { question: query, model }));
    } catch (e) {
      setAnswer({
        ok: false,
        answer: null,
        error: e instanceof Error ? e.message : String(e),
        model: null,
        latency_sec: null,
        usage: null,
        sources: [],
      });
    } finally {
      setAsking(false);
    }
  }

  function reset() {
    setMinBudget("");
    setAgency("");
  }

  // 관련도는 이 목록 안에서만 뜻이 있다. 절대 점수는 보여주지 않는다.
  const topScore = Math.max(...notices.map((n) => n.score), 0.0001);

  return (
    <>
      <div className="topbar">
        <span className="brand">
          {/* 상단바 높이가 56px 이라 60px 로고는 넘친다. 옆에 이름이 붙어 있으니 alt 는 빈 값. */}
          <Image
            className="brand-mark"
            src="/logo.png"
            alt=""
            width={22}
            height={22}
          />
          NLP of Legend
        </span>
        <span className="spacer" />
        {/* 공고 화면과 같은 자리에 둔다. 자리가 옮겨 다니면 매번 다시 찾아야 한다. */}
        <ModelSelect value={model} onChange={setModel} />
      </div>

      <div className="hero">
        <h1>어떤 사업을 찾으세요?</h1>
        <p>나라장터 공고를 자연어로 찾습니다</p>

        <form
          className="searchbar"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="클라우드 전환 사업"
            aria-label="검색어"
          />
          <button
            className="btn btn-primary btn-lg"
            disabled={status === "loading" || !query.trim()}
          >
            {status === "loading" ? <span className="spinner" /> : null} 찾기
          </button>
        </form>

        <div className="examples">
          {EXAMPLES.map((text) => (
            <button key={text} className="chip" onClick={() => search(text)}>
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="results">
        {status !== "idle" && (
          <div className="filterbar">
            <input
              className="input"
              style={{ width: 150 }}
              inputMode="numeric"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value.replace(/\D/g, ""))}
              placeholder="예산 최소 (억)"
              aria-label="최소 예산, 억원 단위"
            />
            <input
              className="input"
              style={{ width: 180 }}
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              placeholder="발주기관"
              aria-label="발주기관"
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => search()}
            >
              적용
            </button>
            <span className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={reset}>
              필터 초기화
            </button>
          </div>
        )}

        {status === "idle" && (
          <div className="empty">
            <div className="empty-icon">⌕</div>
            <h3>찾고 싶은 사업을 적어보세요</h3>
            <p>
              &quot;클라우드 전환&quot;, &quot;장애인 접근성 개선&quot; 같이
              자연어로 씁니다.
            </p>
          </div>
        )}

        {status === "loading" && <Skeletons />}

        {status === "error" && (
          <div style={{ paddingTop: "var(--space-6)" }}>
            <div className="alert">
              <span aria-hidden="true">⚠</span>
              <div>
                <div className="alert-title">검색에 실패했습니다</div>
                <div className="alert-body">
                  백엔드에 닿지 못했습니다. <code>RFP_API</code> 가 가리키는
                  서버가 떠 있는지 확인하세요.
                  <br />
                  {error}
                </div>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => search()}
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === "done" && notices.length === 0 && (
          <div className="empty">
            <div className="empty-icon">⌀</div>
            <h3>조건에 맞는 공고가 없습니다</h3>
            <p>예산 하한을 내리거나 발주기관 조건을 지워보세요.</p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                reset();
                search();
              }}
            >
              필터 초기화
            </button>
          </div>
        )}

        {status === "done" && notices.length > 0 && (
          <>
            <div className="result-meta">
              <span className="num">
                공고 {notices.length}건 · {elapsed.toFixed(1)}초
              </span>
              <span
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-subtle)",
                }}
              >
                관련도 순 — 1위가 정답이라는 뜻은 아닙니다
              </span>
            </div>
            {/* 목록 위에 한 줄. **모드를 미리 고르게 하지 않는다** — 사용자는
                목록을 보고 나서야 "그냥 답 줘" 로 바뀐다. 페이지를 나누면
                그때 다시 치거나 뒤로 가야 한다. */}
            <AskBar
              query={query}
              answer={answer}
              asking={asking}
              onAsk={ask}
              active={activeCite}
              onActive={setActiveCite}
            />

            <div className="cards">
              {notices.map((notice) => (
                <NoticeCard
                  key={notice.doc_id}
                  notice={notice}
                  topScore={topScore}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** 공고 한 장. 카드 전체가 클릭 영역이다. */
function NoticeCard({
  notice,
  topScore,
}: {
  notice: Notice;
  topScore: number;
}) {
  const left = dday(notice.bid_close_at);
  const relevance = Math.max(Math.round((notice.score / topScore) * 100), 8);

  return (
    <Link
      href={`/notice/${notice.doc_id}`}
      className="card"
      style={{ textDecoration: "none", color: "inherit" }}
      onClick={() => pick(notice)}
    >
      <div className="card-row">
        <span className="card-agency">{notice.agency}</span>
        <span className="card-badges">
          <DdayBadge left={left} />
        </span>
      </div>

      <h3 className="card-title">{notice.title}</h3>

      <div className="card-meta num">
        <b>{won(notice.budget)}</b> · {day(notice.bid_close_at)} 마감 · 발췌{" "}
        {notice["청크수"]}건
      </div>

      <div className="card-excerpt">{notice.excerpt}</div>

      <div className="card-foot">
        <span
          className="relevance"
          role="meter"
          aria-label="관련도"
          aria-valuenow={relevance}
          title="이 목록 안에서의 상대적 관련도입니다. 순위가 정답 순서는 아닙니다."
        >
          <span>관련도</span>
          <span className="relevance-track">
            <span
              className="relevance-fill"
              style={{ width: `${relevance}%` }}
            />
          </span>
        </span>
        <span className="card-cta">질문하기 →</span>
      </div>
    </Link>
  );
}

/**
 * 목록 위의 "바로 답하기".
 *
 * 공고를 고르지 않고 전체에서 찾아 답한다 — 화면 두 개를 거치는 흐름의
 * 지름길이다. 답이 나오면 `[n]` 이 어느 공고인지 밑에 붙는다.
 *
 * **자동으로 돌리지 않는다.** 검색은 0.7초에 공짜지만 답변은 LLM 이라
 * 3~10초에 돈이 든다. 매번 자동이면 목록만 훑고 싶은 사람이 매번 그 값을 낸다.
 */
function AskBar({
  query,
  answer,
  asking,
  onAsk,
  active,
  onActive,
}: {
  query: string;
  answer: Answer | null;
  asking: boolean;
  onAsk: () => void;
  active: number | null;
  onActive: (n: number | null) => void;
}) {
  return (
    <div className="askbar">
      {!answer && (
        <div className="askbar-head">
          <span>
            「{query}」 — 공고를 안 고르고 바로 답을 받을 수도 있습니다
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onAsk}
            disabled={asking}
          >
            {asking && <span className="spinner" />} 바로 답하기
          </button>
        </div>
      )}

      {asking && !answer && (
        <div className="answer" aria-busy="true">
          <div className="sk" style={{ height: 15, marginBottom: 10 }} />
          <div className="sk" style={{ height: 15, width: "62%" }} />
        </div>
      )}

      {answer && !answer.ok && (
        <div className="alert">
          <div className="alert-body">
            {answer.error ?? "답을 만들지 못했습니다"}
          </div>
        </div>
      )}

      {answer?.ok && (
        <>
          <div className="answer" aria-live="polite">
            <Cited
              text={answer.answer ?? ""}
              sources={answer.sources}
              active={active}
              onActive={onActive}
            />
          </div>
          <div className="askbar-sources">
            {answer.sources.map((source: Source) => (
              <span
                key={source.n}
                className="chip"
                aria-current={active === source.n}
                onMouseEnter={() => onActive(source.n)}
                onMouseLeave={() => onActive(null)}
              >
                [{source.n}] {source.title || source.doc_id}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** D-12 / D-5(임박) / 마감. 마감 지난 공고도 목록에 남긴다 — 참고용으로 본다. */
function DdayBadge({ left }: { left: number | null }) {
  if (left === null) return null;
  if (left < 0) return <span className="badge badge-danger">마감</span>;
  if (left <= 7) return <span className="badge badge-warning">D-{left}</span>;
  return <span className="badge badge-success">D-{left}</span>;
}

function Skeletons() {
  return (
    <>
      <div className="result-meta">
        <div className="sk" style={{ width: 120, height: 14 }} />
      </div>
      <div className="cards" aria-busy="true">
        {[70, 60, 78, 64, 72].map((width, i) => (
          <div
            key={i}
            className="card"
            style={{ cursor: "default", pointerEvents: "none" }}
          >
            <div className="sk" style={{ width: 90, height: 13 }} />
            <div className="sk" style={{ width: `${width}%`, height: 20 }} />
            <div className="sk" style={{ width: "45%", height: 13 }} />
            <div className="sk" style={{ width: "85%", height: 13 }} />
          </div>
        ))}
      </div>
    </>
  );
}
