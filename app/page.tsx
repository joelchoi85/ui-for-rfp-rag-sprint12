"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Answer,
  clearLast,
  day,
  dday,
  forget,
  keepLast,
  lastSearch,
  Notice,
  pick,
  post,
  recent,
  remember,
  Source,
  won,
} from "./lib";
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
  const [history, setHistory] = useState<string[]>([]);
  const [openHistory, setOpenHistory] = useState(false);
  // 흘러가는 초. 스켈레톤만 있으면 몇 초든 멈춘 것처럼 느껴진다.
  const [waited, setWaited] = useState(0);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!asking) return;
    setWaited(0);
    const at = Date.now();
    const timer = setInterval(
      () => setWaited(Math.round((Date.now() - at) / 1000)),
      500,
    );
    return () => clearInterval(timer);
  }, [asking]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 공고 화면에서 뒤로 오면 리마운트된다. **사용자가 지우기 전까지는 남긴다** —
  // 열 건을 훑다 하나 눌러 보고 돌아오는 게 이 화면의 기본 동작이다.
  //
  // 이펙트에서 setState 를 네 번 부르면 그만큼 다시 그린다. 한 번에 담는다.
  // 초기값으로는 못 읽는다 — 서버에서 먼저 그리는데 sessionStorage 가 없다.
  //
  // 규칙(set-state-in-effect)은 공고 화면과 같은 이유로 끈다 — 마운트 때 한 번이고
  // sessionStorage 는 서버에 없어서 초기값으로는 못 읽는다. 초기값으로 옮기면
  // 서버는 빈 화면, 클라이언트는 목록을 그려 하이드레이션이 깨진다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHistory(recent());
    const last = lastSearch();
    if (!last?.notices?.length) return;
    setQuery(last.query);
    setNotices(last.notices);
    setElapsed(last.elapsed);
    setStatus("done");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * 검색한다. `andAsk` 면 답변까지 이어서 만든다.
   *
   * 버튼을 둘로 둔 이유: "바로 답하기" 를 누른 사람은 목록을 보려고 누른 게
   * 아니다. 검색을 먼저 누르게 하면 두 번 누른다.
   */
  async function search(text = query, andAsk = false) {
    if (!text.trim()) return;
    // **나란히 보낸다.** 이어서 부르면 `/ask` 가 검색을 처음부터 다시 돌아
    // 1.5초쯤을 그냥 버린다(둘 다 같은 retrieve 를 탄다). FastAPI 가 동기
    // 엔드포인트를 스레드풀에서 돌리므로 두 요청이 겹쳐 돈다.
    if (andAsk) ask(text);
    setQuery(text);
    setOpenHistory(false);
    remember(text);
    setHistory(recent());
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
      const took = (Date.now() - startedAt) / 1000;
      setNotices(found);
      setElapsed(took);
      setStatus("done");
      setAnswer(null); // 질문이 바뀌었으니 옛 답을 남기지 않는다
      keepLast({ query: text, notices: found, elapsed: took });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function ask(text = query) {
    setAsking(true);
    try {
      setAnswer(await post<Answer>("/ask", { question: text, model }));
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

  /** 화면을 처음 상태로. **사용자가 누를 때만 지운다.** */
  function clearAll() {
    setQuery("");
    setNotices([]);
    setAnswer(null);
    setStatus("idle");
    clearLast();
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
            onFocus={() => setOpenHistory(true)}
            /* 목록 안의 버튼을 누를 틈을 준다. 바로 닫으면 삭제가 안 눌린다. */
            onBlur={() => setTimeout(() => setOpenHistory(false), 150)}
            placeholder="클라우드 전환 사업"
            aria-label="검색어"
            autoComplete="off"
          />
          <button
            className="btn btn-primary btn-lg"
            disabled={status === "loading" || !query.trim()}
          >
            {status === "loading" && !asking ? (
              <span className="spinner" />
            ) : null}{" "}
            찾기
          </button>
          {/* 목록을 보려고 누른 게 아닌 사람은 여기를 누른다. 두 번 안 누르게. */}
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            disabled={status === "loading" || asking || !query.trim()}
            onClick={() => search(query, true)}
          >
            {asking ? <span className="spinner" /> : null} 바로 답하기
          </button>

          {openHistory && history.length > 0 && (
            <RecentList
              items={history}
              onPick={(text) => search(text)}
              onForget={(text) => setHistory(forget(text))}
              onForgetAll={() => setHistory(forget(null))}
            />
          )}
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

        {/* 답변은 검색과 **나란히** 돈다. 그러니 대기 표시도 따로 떠야 한다.
            목록이 다 온 뒤에 나타나면, 누른 직후 1~2초는 아무 표시가 없다가
            갑자기 뜬다 — 그게 "무엇을 기다리는지 모르겠다" 로 보인다. */}
        {asking && !answer && (
          <div className="askbar">
            <div className="askbar-head" aria-live="polite">
              <span className="spinner" />
              <span>답을 만드는 중… {waited}초</span>
            </div>
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
              <button className="btn btn-ghost btn-sm" onClick={clearAll}>
                초기화
              </button>
            </div>
            {/* 목록 위에 한 줄. **모드를 미리 고르게 하지 않는다** — 사용자는
                목록을 보고 나서야 "그냥 답 줘" 로 바뀐다. 페이지를 나누면
                그때 다시 치거나 뒤로 가야 한다. */}
            <AskBar
              query={query}
              answer={answer}
              asking={asking}
              onAsk={() => ask()}
              active={activeCite}
              onActive={setActiveCite}
              notices={notices}
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
 * 최근 검색어 드롭다운. 보여주는 건 10개.
 *
 * `<datalist>` 를 안 쓴 이유는 **하나씩 지울 수가 없어서** 다. 지우면 그 앞에
 * 밀려 있던 검색어가 드러나야 하므로 30개까지 들고 있다가 열 개만 보여 준다.
 *
 * `onMouseDown` 으로 받는다. `onClick` 은 입력의 blur 뒤에 와서, 목록이 닫힌
 * 다음이라 눌리지 않는다.
 */
function RecentList({
  items,
  onPick,
  onForget,
  onForgetAll,
}: {
  items: string[];
  onPick: (text: string) => void;
  onForget: (text: string) => void;
  onForgetAll: () => void;
}) {
  return (
    <ul className="recent" role="listbox" aria-label="최근 검색어">
      {items.slice(0, 10).map((text) => (
        <li key={text}>
          <button
            type="button"
            className="recent-pick"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(text);
            }}
          >
            {text}
          </button>
          <button
            type="button"
            className="recent-x"
            aria-label={`${text} 지우기`}
            onMouseDown={(e) => {
              e.preventDefault();
              onForget(text);
            }}
          >
            ×
          </button>
        </li>
      ))}
      <li className="recent-foot">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onForgetAll();
          }}
        >
          전체 삭제
        </button>
      </li>
    </ul>
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
  notices,
}: {
  query: string;
  answer: Answer | null;
  asking: boolean;
  onAsk: () => void;
  active: number | null;
  onActive: (n: number | null) => void;
  notices: Notice[];
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
          {/* 검색과 생성을 나눠 보여준다. 거의 늘 생성 쪽이 길다. */}
          <div className="answer-meta num">
            <span>{answer.model}</span>
            {answer.search_sec != null && (
              <span>· 검색 {answer.search_sec.toFixed(1)}초</span>
            )}
            {answer.latency_sec != null && (
              <span>· 생성 {answer.latency_sec.toFixed(1)}초</span>
            )}
          </div>
          {/* **누르면 그 공고로 간다.** 하이라이팅만 되고 아무 일도 안 일어나면
              "왜 눌리지" 가 된다. 사용자가 출처를 누르는 이유는 그 공고를 더
              보려는 것이다. 목록에 있는 건이면 값을 세션에 넘겨 화면이 즉시
              차게 하고, 없으면 공고 화면이 서버에 물어본다. */}
          <div className="askbar-sources">
            {answer.sources.map((source: Source) => (
              <Link
                key={source.n}
                href={`/notice/${encodeURIComponent(source.doc_id)}`}
                className="chip"
                aria-current={active === source.n}
                onMouseEnter={() => onActive(source.n)}
                onMouseLeave={() => onActive(null)}
                onClick={() => {
                  const found = notices.find((n) => n.doc_id === source.doc_id);
                  if (found) pick(found);
                }}
              >
                [{source.n}] {source.title || source.doc_id} →
              </Link>
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
