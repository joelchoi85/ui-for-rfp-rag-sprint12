"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogFile, LogTail, logFiles, logTail, when } from "../lib";

/** `/health` 에서 우리가 쓰는 칸만. 나머지는 그대로 흘려 보여 준다. */
type Health = {
  ok?: boolean;
  embedder?: string | null;
  reranker?: string | null;
  generator?: string | null;
  store?: string;
  index?: string;
  chunks?: string;
  refresh?: { at: string; ok: boolean; step: string } | null;
};

const EVERY = 10_000; // 10초. 로그는 크론이 3시간마다 쓰므로 더 자주 볼 이유가 없다

/**
 * 운영 화면. **ssh 를 안 쓰는 팀원이 "지금 잘 돌고 있나" 를 확인하는 곳.**
 *
 * 두 가지에 답한다.
 *   1. 크론이 마지막으로 언제, 어디까지 갔나  → 위쪽 카드 (`/health` 의 refresh)
 *   2. 실패했으면 왜                          → 아래 로그 (`/logs/<이름>`)
 *
 * 로그는 파일 **이름**으로만 부른다. 경로를 넘기지 않는다.
 */
export default function AdminPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [files, setFiles] = useState<LogFile[]>([]);
  const [name, setName] = useState("refresh");
  const [tail, setTail] = useState<LogTail | null>(null);
  const [error, setError] = useState("");
  const box = useRef<HTMLPreElement>(null);
  const stick = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      setHealth(res.ok ? await res.json() : null);
      setFiles(await logFiles());
      setTail(await logTail(name, 300));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [name]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    load();
    const timer = setInterval(load, EVERY);
    return () => clearInterval(timer);
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 위로 올려 옛 줄을 읽는 중이면 끌어내리지 않는다.
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [tail]);

  const refresh = health?.refresh;

  return (
    <>
      <header className="bar">
        <Link href="/" className="brand">
          입찰메이트
        </Link>
        <nav className="bar-nav">
          <Link href="/eval">평가</Link>
        </nav>
      </header>

      <main className="eval">
        <h1>운영</h1>

        {error && (
          <div className="alert">
            <div className="alert-body">{error}</div>
          </div>
        )}

        {/* 1. 크론이 도는가 — 이게 제일 자주 묻는 질문이다 */}
        <h2>마지막 갱신</h2>
        {refresh ? (
          <p>
            <span
              className={`badge ${refresh.ok ? "badge-success" : "badge-danger"}`}
            >
              {refresh.ok ? "성공" : "실패"}
            </span>{" "}
            {when(Date.parse(refresh.at) / 1000)} ·{" "}
            {refresh.at.slice(0, 19).replace("T", " ")}
            {!refresh.ok && ` · ${refresh.step} 에서 멈췄습니다`}
          </p>
        ) : (
          <p>아직 한 번도 안 돌았거나 기록이 없습니다.</p>
        )}

        {/* 2. 무엇을 보고 있는가 — 배포 사고의 절반이 여기가 어긋난 것 */}
        <h2>지금 상태</h2>
        <table className="metrics">
          <tbody>
            <tr>
              <td>임베더</td>
              <td className="run-id">{health?.embedder ?? "—"}</td>
            </tr>
            <tr>
              <td>리랭커</td>
              <td className="run-id">{health?.reranker ?? "—"}</td>
            </tr>
            <tr>
              <td>생성 모델</td>
              <td className="run-id">
                {health?.generator ?? "안 올라와 있음"}
              </td>
            </tr>
            <tr>
              <td>코퍼스</td>
              <td className="run-id">{health?.chunks ?? "—"}</td>
            </tr>
            <tr>
              <td>색인</td>
              <td className="run-id">
                {health?.index ?? "—"} ({health?.store ?? "—"})
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. 왜 실패했나 */}
        <h2>로그</h2>
        <p className="form">
          <select
            className="select"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="로그 파일"
          >
            {files.map((f) => (
              <option key={f.name} value={f.name} disabled={!f.exists}>
                {f.name}
                {f.exists ? ` · ${(f.bytes / 1024).toFixed(0)}KB` : " · 없음"}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            새로 읽기
          </button>
          {tail?.at && (
            <span className="hint">{tail.at.replace("T", " ")}</span>
          )}
        </p>

        <pre
          className="log"
          ref={box}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
        >
          {tail?.note ?? tail?.lines.join("\n") ?? "…"}
        </pre>
      </main>
    </>
  );
}
