"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Answer, day, dday, Notice, picked, post, Source, won } from "../../lib";
import { isCold, ModelSelect } from "../../ModelSelect";

const SUGGESTED = ["배정예산은?", "제출 서류는?", "참가 자격은?", "평가 배점은?"];

// 3~5초를 스피너 하나로 버티면 고장 난 걸로 보인다. 어느 구간인지 말한다.
// 백엔드에 스트리밍이 없어서 실제 이벤트가 아니라 시간 기반 추정이다.
const STEPS = ["관련 문단 검색", "후보 다시 채점", "답변 생성"];
const STEP_AT = [600, 2600];

// 안 올라와 있는 모델을 고르면 **기다림의 종류가 다르다.** GPU 에서 컨테이너를
// 갈아끼우는 시간이라 30초일 수도 5분일 수도 있다(모델을 처음 받으면 더). 그래서
// 이 경우엔 단계를 시간으로 넘기지 않는다 — 넘기면 "답변 생성"을 띄워놓고 2분을
// 더 기다리게 만든다. 3초짜리 추정 단계표를 그대로 쓰는 게 여기선 거짓말이다.

export default function NoticePage({ params }: PageProps<"/notice/[id]">) {
  const { id } = use(params);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [model, setModel] = useState("mini");
  // 고른 모델이 VM 에 안 올라와 있으면 기다림을 다르게 설명해야 한다.
  const [cold, setCold] = useState(false);
  // 답변이 성공한 횟수. ModelSelect 가 이 값이 바뀔 때만 목록을 다시 받는다.
  const [answered, setAnswered] = useState(0);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [asking, setAsking] = useState(false);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [failure, setFailure] = useState("");
  const [activeCite, setActiveCite] = useState<number | null>(null);

  // 목록에서 넘어왔으면 공고 정보가 sessionStorage 에 있다. 직접 열었으면 없다.
  useEffect(() => setNotice(picked(id)), [id]);

  useEffect(() => {
    if (!asking || cold) return;
    const timers = STEP_AT.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [asking, cold]);

  async function ask(text = question) {
    if (!text.trim() || asking) return;
    setAsked(text);
    setQuestion("");
    setAnswer(null);
    setFailure("");
    setStep(0);
    setAsking(true);
    try {
      setAnswer(await post<Answer>("/ask", { question: text, doc_ids: [id], model }));
      // 답이 왔으면 그 모델은 지금 올라와 있다. 드롭다운의 "교체 1~2분" 을 지운다.
      setAnswered((n) => n + 1);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  }

  const left = dday(notice?.bid_close_at ?? null);
  const sources = answer?.ok ? answer.sources : [];

  return (
    <>
      <div className="topbar">
        <Link href="/" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
          ← 목록
        </Link>
        <div className="topbar-div" />
        <span className="topbar-title">{notice?.title ?? id}</span>
        <span className="spacer" />
        <ModelSelect
          value={model}
          onChange={(key, chosen) => {
            setModel(key);
            setCold(isCold(chosen));
          }}
          // 답변이 끝나면 그 모델이 올라와 있다. ready 를 다시 받아 라벨을 고친다.
          refreshKey={answered}
        />
      </div>

      <div className="band">
        {notice ? (
          <>
            <b>{notice.agency}</b>
            <span className="band-dot">·</span>
            <span className="num">
              <b>{won(notice.budget)}</b>
            </span>
            <span className="band-dot">·</span>
            <span className="num">{day(notice.bid_close_at)} 마감</span>
            {left !== null &&
              (left < 0 ? (
                <span className="badge badge-danger">마감</span>
              ) : (
                <span className={`badge ${left <= 7 ? "badge-warning" : "badge-success"}`}>D-{left}</span>
              ))}
          </>
        ) : (
          <span className="num">{id}</span>
        )}
        <span className="spacer" />
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-subtle)" }}>
          대화는 저장되지 않습니다
        </span>
      </div>

      <div className="qa">
        <div className="thread">
          {!asked && (
            <div style={{ padding: "var(--space-12) 0" }}>
              <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--font-size-lg)" }}>
                이 공고에 대해 물어보세요
              </h3>
              <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
                공고문 안에서만 찾고, 근거 문단을 함께 보여줍니다.
              </p>
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {SUGGESTED.map((text) => (
                  <button key={text} className="chip" onClick={() => ask(text)}>
                    {text}
                  </button>
                ))}
              </div>
              {notice?.summary && (
                <details style={{ marginTop: "var(--space-8)" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    공고 요약 보기
                  </summary>
                  <div className="excerpt" style={{ whiteSpace: "pre-wrap", marginTop: "var(--space-3)" }}>
                    {notice.summary}
                  </div>
                </details>
              )}
            </div>
          )}

          {asked && <h2 className="q">{asked}</h2>}

          {asking && (
            <>
              <div className="steps">
                {cold ? (
                  <div className="step step-active">
                    <span className="step-dot" />
                    모델 올리는 중
                  </div>
                ) : (
                  STEPS.map((label, i) => (
                    <div key={label} className={`step ${i < step ? "step-done" : i === step ? "step-active" : ""}`}>
                      <span className="step-dot" />
                      {label}
                    </div>
                  ))
                )}
              </div>
              {cold && (
                // 몇 분짜리 기다림은 스켈레톤만으로 못 버틴다. 왜 오래 걸리는지 말한다.
                <p className="hint" role="status">
                  이 모델은 지금 VM 에 올라와 있지 않습니다. GPU 한 장에 생성 모델을 하나만
                  올릴 수 있어 컨테이너를 갈아끼우는 중입니다 — 보통 1~2분, 이 모델을 처음
                  쓰는 거면 더 걸립니다. 다음 질문부터는 바로 답합니다.
                </p>
              )}
              <div className="answer" aria-busy="true">
                <div className="sk" style={{ height: 15, marginBottom: 10 }} />
                <div className="sk" style={{ height: 15, marginBottom: 10 }} />
                <div className="sk" style={{ height: 15, width: "62%" }} />
              </div>
            </>
          )}

          {failure && (
            <div className="alert">
              <span aria-hidden="true">⚠</span>
              <div>
                <div className="alert-title">백엔드에 닿지 못했습니다</div>
                <div className="alert-body">
                  <code>RFP_API</code> 가 가리키는 서버가 떠 있는지 확인하세요.
                  <br />
                  {failure}
                </div>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => ask(asked)}>
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          )}

          {answer && !answer.ok && (
            <div className="alert">
              <span aria-hidden="true">⚠</span>
              <div>
                <div className="alert-title">답변을 만들지 못했습니다</div>
                <div className="alert-body">
                  {answer.error}
                  <br />
                  상태코드는 200 입니다. 네트워크 오류가 아니라 모델 호출이 실패했습니다.
                </div>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => ask(asked)}>
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          )}

          {answer?.ok && sources.length === 0 && (
            <div className="alert alert-warn" style={{ marginBottom: "var(--space-4)" }}>
              <span aria-hidden="true">◇</span>
              <div>
                <div className="alert-title">이 답변에는 근거 문단이 없습니다</div>
                <div className="alert-body">공고문에서 관련 문단을 찾지 못했습니다. 답변을 그대로 믿지 마세요.</div>
              </div>
            </div>
          )}

          {answer?.ok && (
            <>
              <div className="answer" aria-live="polite">
                <Cited text={answer.answer ?? ""} sources={sources} active={activeCite} onActive={setActiveCite} />
              </div>
              <div className="answer-meta num">
                <span>{answer.model}</span>
                {answer.latency_sec != null && (
                  <>
                    <span>·</span>
                    <span>{answer.latency_sec.toFixed(1)}초</span>
                  </>
                )}
                {answer.usage && (
                  <>
                    <span>·</span>
                    <span>
                      입력 {answer.usage.input_tokens.toLocaleString()} · 출력{" "}
                      {answer.usage.output_tokens.toLocaleString()} 토큰
                    </span>
                  </>
                )}
              </div>
            </>
          )}

          <form
            className="ask"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <input
              className="input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="이 공고에 대해 물어보세요…"
              aria-label="질문"
            />
            <button className="btn btn-primary" disabled={asking || !question.trim()}>
              보내기
            </button>
          </form>
        </div>

        {(asking || sources.length > 0) && (
          <aside className="rail">
            <div className="rail-head">
              출처 {sources.length > 0 && <span className="badge badge-info">{sources.length}건</span>}
            </div>
            <div className="sources">
              {asking
                ? [0, 1].map((i) => (
                    <div key={i} className="source" style={{ cursor: "default" }}>
                      <div className="sk" style={{ width: 60, height: 12, marginBottom: 8 }} />
                      <div className="sk" style={{ width: "85%", height: 14, marginBottom: 6 }} />
                      <div className="sk" style={{ width: "100%", height: 34 }} />
                    </div>
                  ))
                : sources.map((source) => (
                    <button
                      key={source.n}
                      className="source"
                      aria-current={activeCite === source.n}
                      aria-label={`출처 ${source.n} ${source.agency}`}
                      onMouseEnter={() => setActiveCite(source.n)}
                      onMouseLeave={() => setActiveCite(null)}
                    >
                      <span className="source-n">[{source.n}]</span>
                      <div className="source-agency">{source.agency}</div>
                      <div className="source-title">{source.title}</div>
                      <div className="source-id">{source.chunk_id}</div>
                    </button>
                  ))}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

/**
 * 답변 텍스트의 `[1]` 을 출처와 이어진 버튼으로 바꾼다. 이 화면의 핵심이다.
 *
 * `sources` 에 없는 번호는 버튼으로 만들지 않는다 — 모델이 지어낸 `[9]` 를
 * 누르면 빈 곳으로 가는 게 제일 나쁘다.
 */
function Cited({
  text,
  sources,
  active,
  onActive,
}: {
  text: string;
  sources: Source[];
  active: number | null;
  onActive: (n: number | null) => void;
}) {
  const known = new Set(sources.map((s) => s.n));

  return (
    <>
      {text.split("\n\n").map((paragraph, p) => (
        <p key={p}>
          {paragraph.split(/(\[\d+\])/g).map((part, i) => {
            const n = /^\[(\d+)\]$/.exec(part);
            if (!n || !known.has(Number(n[1]))) return <span key={i}>{part}</span>;
            const cite = Number(n[1]);
            return (
              <button
                key={i}
                className="cite"
                aria-current={active === cite}
                aria-label={`출처 ${cite}`}
                onMouseEnter={() => onActive(cite)}
                onMouseLeave={() => onActive(null)}
                onClick={() => onActive(cite)}
              >
                {part}
              </button>
            );
          })}
        </p>
      ))}
    </>
  );
}
