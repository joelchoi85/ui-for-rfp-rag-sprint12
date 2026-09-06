"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import {
  Answer,
  askStream,
  day,
  isAbort,
  dday,
  Notice,
  picked,
  fetchNotice,
  Source,
  lastSearch,
  marked,
  evidenceTerms,
  pick,
  won,
} from "../../lib";
import { isCold, ModelSelect } from "../../ModelSelect";

const SUGGESTED = [
  "배정예산은?",
  "제출 서류는?",
  "참가 자격은?",
  "평가 배점은?",
];

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
  // 지금 돌고 있는 답변 요청. 멈추기와 "새 질문이 옛 질문을 끊는다" 둘 다 쓴다.
  const abort = useRef<AbortController | null>(null);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [failure, setFailure] = useState("");
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const [openSource, setOpenSource] = useState<Source | null>(null);

  // 목록에서 넘어왔으면 공고 정보가 sessionStorage 에 있다. 직접 열었으면 없다.
  //
  // 규칙(set-state-in-effect)이 잡는 건 "효과가 만드는 연쇄 렌더"인데, 여기서는
  // 마운트 때 한 번이고 그게 **의도한 것**이다. sessionStorage 는 서버에 없으므로
  // 첫 렌더는 서버와 똑같이 null 로 그리고(그래야 하이드레이션이 안 깨진다)
  // 붙은 뒤에 채운다. useState 초기값이나 useMemo 로 옮기면 서버는 doc_id,
  // 클라이언트는 제목을 그려서 하이드레이션 불일치가 난다.
  // 세션에 있으면 그걸 쓰고(즉시), 없으면 서버에 묻는다. 목록을 안 거치고
  // 들어오는 길이 셋이다 — 새로고침, 주소 직접 입력, 답변의 출처 누르기.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const kept = picked(id);
    setNotice(kept);
    if (!kept) fetchNotice(id).then(setNotice);
  }, [id]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    abort.current?.abort();
    const control = new AbortController();
    abort.current = control;
    setAsking(true);
    try {
      const partial: Answer = {
        ok: true,
        answer: "",
        error: null,
        model: null,
        latency_sec: null,
        usage: null,
        sources: [],
      };
      setAnswer(
        await askStream(
          { question: text, doc_ids: [id], model },
          (sofar) => setAnswer({ ...partial, answer: sofar }),
          (meta) => {
            partial.search_sec = meta.search_sec;
            partial.sources = meta.sources;
            setAnswer({ ...partial });
          },
          control.signal,
        ),
      );
      // 답이 왔으면 그 모델은 지금 올라와 있다. 드롭다운의 "교체 1~2분" 을 지운다.
      setAnswered((n) => n + 1);
    } catch (e) {
      // 멈춘 건 오류가 아니다. 그때까지 온 글자를 그대로 둔다.
      if (isAbort(e)) return;
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      if (abort.current === control) setAsking(false);
    }
  }

  const left = dday(notice?.bid_close_at ?? null);
  const sources = answer?.ok ? answer.sources : [];

  return (
    <>
      <div className="topbar">
        <Link
          href="/"
          className="btn btn-ghost btn-sm"
          style={{ textDecoration: "none" }}
        >
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
                <span
                  className={`badge ${left <= 7 ? "badge-warning" : "badge-success"}`}
                >
                  D-{left}
                </span>
              ))}
          </>
        ) : (
          <span className="num">{id}</span>
        )}
        <span className="spacer" />
        {/* 답변의 근거가 된 **그** 문서다. 나라장터 링크가 아니다 — 공고가
            변경·재공고되면 그쪽 파일은 바뀐다. 없으면 404 라 링크만 둔다. */}
        <a
          className="btn btn-secondary btn-sm"
          href={`/api/file/${id}`}
          download
        >
          원문 내려받기
        </a>
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-subtle)",
          }}
        >
          대화는 저장되지 않습니다
        </span>
      </div>

      <div className="qa">
        <div className="thread">
          {!asked && (
            <div style={{ padding: "var(--space-12) 0" }}>
              <h3
                style={{
                  margin: "0 0 var(--space-2)",
                  fontSize: "var(--font-size-lg)",
                }}
              >
                이 공고에 대해 물어보세요
              </h3>
              <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
                공고문 안에서만 찾고, 근거 문단을 함께 보여줍니다.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                {SUGGESTED.map((text) => (
                  <button key={text} className="chip" onClick={() => ask(text)}>
                    {text}
                  </button>
                ))}
              </div>
              {/* **요약이 없는 공고가 더 많다.** `사업 요약` 은 나라장터 API 에
                  없는 값이라 크롤러가 못 채운다(처음 받은 100건만 사람이 넣었다).
                  그때는 원문 첫 대목이라도 보여준다 — 제목만 있고 텅 빈 화면보다
                  낫고, 없는 요약을 지어내는 것보다 정직하다. */}
              {(notice?.summary || notice?.excerpt) && (
                <details
                  style={{ marginTop: "var(--space-8)" }}
                  open={!notice.summary}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {notice.summary ? "공고 요약 보기" : "원문 첫 대목"}
                  </summary>
                  <div
                    className="excerpt"
                    style={{
                      whiteSpace: "pre-wrap",
                      marginTop: "var(--space-3)",
                    }}
                  >
                    {notice.summary || notice.excerpt}
                  </div>
                </details>
              )}
            </div>
          )}

          {asked && <h2 className="q">{asked}</h2>}

          {asking && !answer?.answer && (
            <>
              <div className="steps">
                {cold ? (
                  <div className="step step-active">
                    <span className="step-dot" />
                    모델 올리는 중
                  </div>
                ) : (
                  STEPS.map((label, i) => (
                    <div
                      key={label}
                      className={`step ${i < step ? "step-done" : i === step ? "step-active" : ""}`}
                    >
                      <span className="step-dot" />
                      {label}
                    </div>
                  ))
                )}
              </div>
              {cold && (
                // 몇 분짜리 기다림은 스켈레톤만으로 못 버틴다. 왜 오래 걸리는지 말한다.
                <p className="hint" role="status">
                  이 모델은 지금 VM 에 올라와 있지 않습니다. GPU 한 장에 생성
                  모델을 하나만 올릴 수 있어 컨테이너를 갈아끼우는 중입니다 —
                  보통 1~2분, 이 모델을 처음 쓰는 거면 더 걸립니다. 다음
                  질문부터는 바로 답합니다.
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
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => ask(asked)}
                  >
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
                  상태코드는 200 입니다. 네트워크 오류가 아니라 모델 호출이
                  실패했습니다.
                </div>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => ask(asked)}
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          )}

          {answer?.ok && sources.length === 0 && (
            <div
              className="alert alert-warn"
              style={{ marginBottom: "var(--space-4)" }}
            >
              <span aria-hidden="true">◇</span>
              <div>
                <div className="alert-title">
                  이 답변에는 근거 문단이 없습니다
                </div>
                <div className="alert-body">
                  공고문에서 관련 문단을 찾지 못했습니다. 답변을 그대로 믿지
                  마세요.
                </div>
              </div>
            </div>
          )}

          {answer?.ok && (
            <>
              <div className="answer" aria-live="polite">
                <Cited
                  text={answer.answer ?? ""}
                  sources={sources}
                  active={activeCite}
                  onActive={setActiveCite}
                />
              </div>
              {/* `model` 은 마지막 줄에서 온다 — 그전엔 아직 만드는 중이다. */}
              <div className="answer-meta num" hidden={!answer.model}>
                <span>{answer.model}</span>
                {/* **검색과 생성을 나눠 보여준다.** "5초" 만 알면 어디를
                    줄여야 할지 모른다. 거의 늘 생성 쪽이 길다. */}
                {answer.search_sec != null && (
                  <>
                    <span>·</span>
                    <span>검색 {answer.search_sec.toFixed(1)}초</span>
                  </>
                )}
                {answer.latency_sec != null && (
                  <>
                    <span>·</span>
                    <span>생성 {answer.latency_sec.toFixed(1)}초</span>
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
            {asking ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => abort.current?.abort()}
              >
                <span className="spinner" /> 멈추기
              </button>
            ) : (
              <button className="btn btn-primary" disabled={!question.trim()}>
                보내기
              </button>
            )}
          </form>
        </div>

        <aside className="rail">
          {(asking || sources.length > 0) && (
            <>
              <div className="rail-head">
                출처{" "}
                {sources.length > 0 && (
                  <span className="badge badge-info">{sources.length}건</span>
                )}
              </div>
              <div className="sources">
                {asking
                  ? [0, 1].map((i) => (
                      <div
                        key={i}
                        className="source"
                        style={{ cursor: "default" }}
                      >
                        <div
                          className="sk"
                          style={{ width: 60, height: 12, marginBottom: 8 }}
                        />
                        <div
                          className="sk"
                          style={{ width: "85%", height: 14, marginBottom: 6 }}
                        />
                        <div
                          className="sk"
                          style={{ width: "100%", height: 34 }}
                        />
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
                        onClick={() => setOpenSource(source)}
                      >
                        <span className="source-n">[{source.n}]</span>
                        <div className="source-agency">{source.agency}</div>
                        <div className="source-title">{source.title}</div>
                        <div className="source-id">{source.chunk_id}</div>
                        {/* 답변의 근거가 된 원문. 평소 2줄, 짚으면 전부 보인다.
                          제목만 보여주면 "이 답이 어디서 나왔나" 를 확인할
                          방법이 없다 — 그게 이 화면의 존재 이유다. */}
                        {source.excerpt && (
                          <div className="excerpt">{source.excerpt}</div>
                        )}
                        <span className="source-more">전체 보기 →</span>
                      </button>
                    ))}
              </div>
            </>
          )}

          {/* 직전에 본 목록. 공고를 하나 열어 보고 "다음 건" 으로 넘어가는 게
              이 화면의 기본 동작인데, 지금은 뒤로 갔다 다시 들어와야 한다. */}
          <NearbyList current={id} />
        </aside>

        <SourceDialog
          source={openSource}
          terms={evidenceTerms(asked, answer?.answer ?? null)}
          onClose={() => setOpenSource(null)}
        />
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
/** 답변의 `[n]` 을 눌러 출처로 이어 준다. 홈 화면의 "바로 답하기" 도 쓴다. */
/**
 * 직전에 검색한 목록을 옆에 둔다. 지금 보는 공고는 뺀다.
 *
 * 컨설턴트는 열 건을 훑으면서 하나씩 열어 본다. 목록으로 돌아가는 왕복이
 * 기본 동작인데 그걸 매번 뒤로가기로 하게 두면 안 된다.
 */
/**
 * 출처 하나를 끝까지 보여주는 팝업.
 *
 * 옆 목록은 좁아서 발췌가 잘린다. hover 로 조금 더 보여줘도 배점표 한 줄을
 * 확인하려면 모자란다 — 컨설턴트가 출처를 누르는 이유가 그거다.
 *
 * `<dialog>` 를 쓴다. 포커스 가두기·ESC 닫기·바깥 클릭이 브라우저에 이미 있다.
 * 직접 만들면 그 셋을 다시 짜야 하고 접근성은 대개 더 나빠진다.
 */
function SourceDialog({
  source,
  terms,
  onClose,
}: {
  source: Source | null;
  terms: string[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    if (source && !box.open) box.showModal();
    if (!source && box.open) box.close();
  }, [source]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(e) => {
        // 바깥(백드롭)을 누르면 닫는다. 안쪽은 그대로 둔다.
        if (e.target === ref.current) onClose();
      }}
    >
      {source && (
        <>
          <div className="sheet-head">
            <div>
              <span className="source-n">[{source.n}]</span> {source.title}
              <div className="source-agency">{source.agency}</div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          <div className="sheet-body">
            {marked(source.text || source.excerpt, terms).map((piece, i) =>
              piece.hit ? (
                <mark key={i}>{piece.part}</mark>
              ) : (
                <span key={i}>{piece.part}</span>
              ),
            )}
          </div>
          <div className="sheet-foot num">
            {source.chunk_id} · 표시된 부분은 질문·답변과 겹치는 자리입니다
          </div>
        </>
      )}
    </dialog>
  );
}

function NearbyList({ current }: { current: string }) {
  const [items, setItems] = useState<Notice[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setItems((lastSearch()?.notices ?? []).filter((n) => n.doc_id !== current));
  }, [current]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!items.length) return null;

  return (
    <>
      <div className="rail-head" style={{ marginTop: "var(--space-6)" }}>
        방금 찾은 공고 <span className="badge">{items.length}건</span>
      </div>
      <div className="sources">
        {items.slice(0, 12).map((notice) => (
          <Link
            key={notice.doc_id}
            href={`/notice/${encodeURIComponent(notice.doc_id)}`}
            className="source"
            onClick={() => pick(notice)}
          >
            <div className="source-agency">{notice.agency}</div>
            <div className="source-title">{notice.title || notice.doc_id}</div>
            <div className="source-id num">{won(notice.budget)}</div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function Cited({
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
            if (!n || !known.has(Number(n[1])))
              return <span key={i}>{part}</span>;
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
