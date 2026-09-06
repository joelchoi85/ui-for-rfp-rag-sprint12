"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import {
  cancelEval,
  EvalJob,
  METRIC_ORDER,
  evalJob,
  lapse,
  when,
} from "../../lib";
import { Status } from "../page";

const TYPES = ["전체", "배점", "요구사항", "의역"];

/**
 * 작업 하나를 지켜보는 화면.
 *
 * 2초마다 `GET /eval/{id}` 를 부른다. SSE 나 웹소켓을 안 쓰는 이유는 Vercel 의
 * rewrite 가 프록시일 뿐이라 스트리밍을 얹으려면 라우트 핸들러를 새로 짜야 하고,
 * 얻는 게 "2초 더 빠른 로그" 뿐이기 때문이다. 십수 분짜리 작업에 2초면 실시간이다.
 *
 * **끝나면 폴링을 멈춘다.** 안 멈추면 탭을 열어 둔 채 밤을 새울 때 VM 을 계속 두드린다.
 */
export default function EvalRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [job, setJob] = useState<EvalJob | null>(null);
  // 도는 동안 경과 시간을 보여주려면 시계가 필요한데, 렌더 중 `Date.now()` 는
  // 순수하지 않다(같은 상태로 두 번 그리면 값이 달라진다). 폴링할 때 같이 담는다.
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);
  const logBox = useRef<HTMLPreElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const got = await evalJob(id);
        if (!alive) return;
        setJob(got);
        setNow(Date.now() / 1000);
        if (got.status === "running") timer = setTimeout(tick, 2000);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    }
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  // 사용자가 위로 스크롤해 옛 줄을 읽는 중이면 끌어내리지 않는다.
  useEffect(() => {
    const box = logBox.current;
    if (box && stick.current) box.scrollTop = box.scrollHeight;
  }, [job?.log]);

  function onScroll() {
    const box = logBox.current;
    if (box)
      stick.current = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  }

  if (error)
    return (
      <main className="eval">
        <div className="alert">
          <div className="alert-body">{error}</div>
        </div>
      </main>
    );
  if (!job)
    return (
      <main className="eval">
        <p>불러오는 중…</p>
      </main>
    );

  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  const seconds = (job.finished_at ?? now) - job.started_at;

  return (
    <>
      <div className="topbar">
        <Link className="brand" href="/eval">
          ← 평가
        </Link>
        <span className="topbar-div" />
        <span className="topbar-title run-id">{job.id}</span>
      </div>

      <main className="eval">
        <h1>
          <Status status={job.status} /> {job.step}
        </h1>
        <p>
          {when(job.started_at)} · {job.options.evalset} · 답변{" "}
          {job.options.model}
          {job.options.judge && ` · 채점 ${job.options.judge_model}`}
          {job.options.limit ? ` · ${job.options.limit}문항` : ""} ·{" "}
          {lapse(seconds)}
        </p>

        {/* VM 어디에 뭐가 남았는지. 나중에 파일로 직접 볼 때 필요하다. */}
        <table className="metrics">
          <tbody>
            <tr>
              <td>발췌</td>
              <td className="run-id">{job.files?.contexts}</td>
            </tr>
            <tr>
              <td>답변</td>
              <td className="run-id">{job.files?.answers}</td>
            </tr>
            <tr>
              <td>지표</td>
              <td className="run-id">{job.files?.metrics}</td>
            </tr>
          </tbody>
        </table>

        {job.status === "running" && job.total > 0 && (
          <div className="progress">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
            <span className="num">
              {job.done} / {job.total}
            </span>
          </div>
        )}

        {/* 발췌는 다음 문항에서, 답변·채점은 자식 프로세스를 끊어서 멈춘다.
            그래서 누른 뒤 몇 초 있다가 상태가 바뀐다 — 그동안 다시 못 누르게 한다. */}
        {job.status === "running" && (
          <p>
            <button
              className="btn btn-secondary btn-sm"
              disabled={stopping}
              onClick={async () => {
                setStopping(true);
                try {
                  await cancelEval(id);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                  setStopping(false);
                }
              }}
            >
              {stopping && <span className="spinner" />}{" "}
              {stopping ? "멈추는 중…" : "멈추기"}
            </button>
          </p>
        )}

        {job.error && (
          <div className="alert">
            <div>
              <div className="alert-title">멈췄습니다</div>
              <div className="alert-body">{job.error}</div>
            </div>
          </div>
        )}

        {job.metrics &&
          Object.entries(job.metrics).map(([file, byType]) => {
            const cols = TYPES.filter((t) => byType[t]);
            const rows = METRIC_ORDER.filter((m) =>
              cols.some((t) => byType[t]?.[m] !== undefined),
            );
            return (
              <div key={file}>
                <h2>지표</h2>
                <table className="metrics">
                  <thead>
                    <tr>
                      <th>지표</th>
                      {cols.map((t) => (
                        <th key={t}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((metric) => (
                      <tr key={metric}>
                        <td>{metric}</td>
                        {cols.map((t) => (
                          <td key={t}>
                            {byType[t][metric] === undefined
                              ? "–"
                              : byType[t][metric].toFixed(3)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

        {job.metrics && (
          /* 9/8 에 폐기한 지표들이다. 표에 없는 이유를 화면에서 말해 준다. */
          <p style={{ fontSize: "var(--font-size-sm)" }}>
            Groundedness 는 안 잽니다 — 충실성과 사실상 같은 것을 묻는데 LLM
            호출만 두 배가 됩니다. 정답포함은 gold 가 길어 항상 0 에 가까워
            폐기했습니다.
          </p>
        )}

        <h2>로그</h2>
        <pre className="log" ref={logBox} onScroll={onScroll}>
          {job.log.join("\n")}
        </pre>
      </main>
    </>
  );
}
