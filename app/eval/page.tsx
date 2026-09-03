"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  EvalRow,
  EvalSet,
  Model,
  evalRuns,
  evalSets,
  lapse,
  modelLabel,
  models,
  post,
  uploadEvalSet,
  when,
} from "../lib";

/**
 * E2E 평가를 돌리는 화면.
 *
 * 한 바퀴가 몇 분에서 십수 분이다. 그래서 **여기서 기다리게 하지 않는다** —
 * 시작하면 작업 화면으로 넘기고, 그 주소가 곧 영수증이다. 나중에 아무 때나
 * 다시 들어오면 된다.
 */
export default function EvalPage() {
  const [sets, setSets] = useState<EvalSet[]>([]);
  // **오른쪽 위 모델 고르개와 같은 출처다.** `GET /models` 하나만 본다.
  const [choices, setChoices] = useState<Model[]>([]);
  const [runs, setRuns] = useState<EvalRow[]>([]);
  const [evalset, setEvalset] = useState("");
  const [model, setModel] = useState("mini");
  const [judge, setJudge] = useState(true);
  const [judgeModel, setJudgeModel] = useState("nano");
  const [limit, setLimit] = useState("");
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    evalSets().then((got) => {
      setSets(got);
      if (got.length) setEvalset(got[0].name);
    });
    evalRuns().then(setRuns);
    models().then(setChoices);
  }, []);

  const chosen = sets.find((s) => s.name === evalset);
  const count = Math.min(
    Number(limit) || Number.MAX_SAFE_INTEGER,
    chosen?.count ?? 0,
  );
  // 단가를 여기 적지 않는다. VM 의 `usd_per_call` 을 그대로 쓴다 —
  // VM 모델(sglang)을 고르면 0 이 나오는 게 맞다. 우리 GPU 를 쓰니까.
  const per = (key: string) =>
    choices.find((m) => m.key === key)?.usd_per_call ?? 0;
  const cost = (count * (per(model) + (judge ? per(judgeModel) : 0))).toFixed(
    2,
  );

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const got = await uploadEvalSet(file);
      // 목록 맨 앞에 꽂고 바로 고른다. 올린 다음 또 골라야 하면 한 번 더 헷갈린다.
      setSets((prev) => [{ name: got.evalset, count: got.count }, ...prev]);
      setEvalset(got.evalset);
      // **정답 문서가 몇 건이나 코퍼스에 있는지 여기서 말해 준다.**
      // 안 말하면 5분 뒤 0점을 보고 성능이 나쁜 줄 안다.
      setNote(
        [
          `${got.matched}/${got.count}문항의 정답 문서를 코퍼스에서 찾았습니다`,
          got.converted
            ? `파일명 ${got.converted}건을 공고번호로 바꿨습니다`
            : "",
          got.unknown_count
            ? `못 찾은 문서 ${got.unknown_count}건 (${got.unknown.slice(0, 2).join(", ")}…) — 그 문항은 발췌가 빕니다`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function start() {
    setStarting(true);
    setError("");
    try {
      const { job_id } = await post<{ job_id: string }>("/eval", {
        evalset,
        model,
        judge,
        judge_model: judgeModel,
        limit: limit ? Number(limit) : null,
      });
      router.push(`/eval/${job_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  }

  function options(list: Model[]) {
    return list.map((m) => (
      <option key={m.key} value={m.key}>
        {modelLabel(m.name)}
        {m.usd_per_call ? ` · $${m.usd_per_call}/문항` : " · 무료 (VM)"}
        {m.ready ? "" : " · 올리는 데 1~2분"}
      </option>
    ));
  }

  return (
    <>
      <div className="topbar">
        <Link className="brand" href="/">
          NLP of Legend
        </Link>
        <span className="topbar-div" />
        <span className="topbar-title">E2E 평가</span>
      </div>

      <main className="eval">
        <h1>평가 한 바퀴</h1>
        <p>
          발췌를 뽑고 → 답변을 만들고 → 채점합니다. 문항 수에 따라 몇 분에서
          십수 분 걸립니다. 시작하면 이 창을 닫아도 됩니다.
        </p>

        <div className="form">
          <label>
            평가 세트
            <select
              value={evalset}
              onChange={(e) => setEvalset(e.target.value)}
            >
              {sets.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} · {s.count}문항
                </option>
              ))}
            </select>
          </label>

          <label>
            평가 세트 올리기 (.json / .jsonl)
            <input
              className="input"
              type="file"
              accept=".json,.jsonl,application/json"
              disabled={uploading}
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <span style={{ fontSize: "var(--font-size-xs)" }}>
              {uploading
                ? "올리는 중…"
                : note || "올린 세트는 채점이 끝나면 서버에서 지웁니다."}
            </span>
          </label>

          <label>
            답변 모델
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {options(choices)}
            </select>
          </label>

          <label>
            문항 제한 (비우면 전체)
            <input
              className="input"
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))}
              placeholder={String(chosen?.count ?? "")}
            />
          </label>

          <label className="row">
            <input
              type="checkbox"
              checked={judge}
              onChange={(e) => setJudge(e.target.checked)}
            />
            충실성까지 잰다 (문항 수만큼 호출이 더 든다)
          </label>

          {judge && (
            <label>
              채점 모델
              <select
                value={judgeModel}
                onChange={(e) => setJudgeModel(e.target.value)}
              >
                {options(choices)}
              </select>
            </label>
          )}

          {/* 팀 예산이 $20 다. 누르기 전에 아는 것과 누르고 나서 아는 것은 다르다. */}
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)" }}>
            예상 비용 <strong className="num">약 ${cost}</strong>
            {chosen && ` · ${Math.min(count, chosen.count)}문항`}
          </p>

          <button
            className="btn btn-primary"
            onClick={start}
            disabled={starting || !evalset}
          >
            {starting && <span className="spinner" />} 평가 시작
          </button>

          {error && (
            <div className="alert">
              <div>
                <div className="alert-title">시작하지 못했습니다</div>
                <div className="alert-body">{error}</div>
              </div>
            </div>
          )}
        </div>

        <h2>지난 실행</h2>
        {runs.length === 0 ? (
          <div className="empty">
            <p>아직 돌린 적이 없습니다.</p>
          </div>
        ) : (
          <ul className="runs">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/eval/${r.id}`}>
                  <Status status={r.status} />
                  <span className="num">{when(r.started_at)}</span>
                  <span>
                    {r.options.evalset} · {r.options.model}
                    {r.options.judge ? ` / ${r.options.judge_model}` : ""}
                    {r.options.limit ? ` · ${r.options.limit}문항` : ""}
                  </span>
                  <span className="spacer" />
                  {/* 열기 전에 어느 파일을 본 실행인지 알아야 한다 */}
                  <span className="run-id">{r.files?.answers}</span>
                  {r.finished_at && (
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {lapse(r.finished_at - r.started_at)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

/** 상태 뱃지. 기존 `.badge-*` 를 쓴다 — 색을 새로 만들면 다른 화면과 안 맞는다. */
export function Status({ status }: { status: EvalRow["status"] }) {
  const tone =
    status === "done"
      ? "badge-success"
      : status === "running"
        ? "badge-info"
        : "badge-danger";
  const label = {
    done: "완료",
    running: "도는 중",
    failed: "실패",
    interrupted: "중단",
  }[status];
  return <span className={`badge ${tone}`}>{label}</span>;
}
