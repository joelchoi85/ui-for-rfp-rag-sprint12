"use client";

import { useEffect, useState } from "react";
import { Model, modelLabel, models, pickedModel, pickModel } from "./lib";

/** 이 모델을 고르면 VM 이 컨테이너를 갈아끼워야 하는지. */
export function isCold(model: Model | undefined): boolean {
  return !!model && model.provider === "sglang" && !model.ready;
}

/**
 * 답변 모델 고르기. 검색 화면과 공고 화면 **같은 자리**(상단바 오른쪽)에 둔다.
 *
 * 고른 값은 sessionStorage 로 화면 사이를 넘어간다. 검색 전에 골라두면
 * 공고로 들어갔을 때 그대로 붙어 있다.
 *
 * `ready` 가 false 인 모델은 라벨에 교체 시간을 적는다. **색만으로 표시하지
 * 않는다** — 색맹 사용자에게는 아무 정보도 아니고, `<option>` 은 브라우저마다
 * 스타일이 달라 어차피 못 믿는다.
 *
 * `onChange` 는 키와 함께 그 모델 정보도 준다. 부모가 `isCold()` 로 기다림을
 * 다르게 설명할 수 있게 하려는 것이다 — 목록을 두 번 받지 않는다.
 */
export function ModelSelect({
  value,
  onChange,
  refreshKey,
}: {
  value: string;
  onChange: (key: string, model?: Model) => void;
  /** 값이 바뀌면 목록을 다시 받는다. 답변이 끝난 뒤 ready 를 갱신할 때 쓴다. */
  refreshKey?: unknown;
}) {
  const [list, setList] = useState<Model[]>([]);

  useEffect(() => {
    models().then((got) => {
      setList(got);
      const saved = pickedModel();
      const key = saved && got.some((m) => m.key === saved) ? saved : value;
      const next = got.some((m) => m.key === key) ? key : got[0]?.key;
      if (next) onChange(next, got.find((m) => m.key === next));
    });
    // value/onChange 를 넣으면 부모가 다시 그릴 때마다 목록을 다시 받는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function choose(key: string) {
    pickModel(key);
    onChange(key, list.find((m) => m.key === key));
  }

  return (
    <select
      className="select"
      style={{ height: 32, maxWidth: 260 }}
      value={value}
      onChange={(e) => choose(e.target.value)}
      aria-label="답변 모델"
    >
      {list.map((m) => (
        <option key={m.key} value={m.key}>
          {modelLabel(m.name)}
          {isCold(m) ? " · 교체 1~2분" : ""}
        </option>
      ))}
    </select>
  );
}
