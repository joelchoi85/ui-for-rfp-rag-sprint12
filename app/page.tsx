"use client";

import Link from "next/link";
import { useState } from "react";
import { day, dday, Notice, pick, post, won } from "./lib";

const EXAMPLES = ["클라우드 전환 사업", "장애인 접근성 개선", "이러닝 시스템 운영"];

type Status = "idle" | "loading" | "done" | "error";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [agency, setAgency] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
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
          <span className="brand-mark">B</span> 입찰메이트 RFP
        </span>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="클라우드 전환 사업"
            aria-label="검색어"
          />
          <button className="btn btn-primary btn-lg" disabled={status === "loading" || !query.trim()}>
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
            <button className="btn btn-secondary btn-sm" onClick={() => search()}>
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
            <p>&quot;클라우드 전환&quot;, &quot;장애인 접근성 개선&quot; 같이 자연어로 씁니다.</p>
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
                  백엔드에 닿지 못했습니다. <code>{process.env.NEXT_PUBLIC_API}</code> 가 떠 있는지 확인하세요.
                  <br />
                  {error}
                </div>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => search()}>
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
            <button className="btn btn-secondary" onClick={() => { reset(); search(); }}>
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
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-subtle)" }}>
                관련도 순 — 1위가 정답이라는 뜻은 아닙니다
              </span>
            </div>
            <div className="cards">
              {notices.map((notice) => (
                <NoticeCard key={notice.doc_id} notice={notice} topScore={topScore} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** 공고 한 장. 카드 전체가 클릭 영역이다. */
function NoticeCard({ notice, topScore }: { notice: Notice; topScore: number }) {
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
        <b>{won(notice.budget)}</b> · {day(notice.bid_close_at)} 마감 · 발췌 {notice["청크수"]}건
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
            <span className="relevance-fill" style={{ width: `${relevance}%` }} />
          </span>
        </span>
        <span className="card-cta">질문하기 →</span>
      </div>
    </Link>
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
          <div key={i} className="card" style={{ cursor: "default", pointerEvents: "none" }}>
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
