/**
 * 차수 배지. **차수가 여럿일 때만 단다.**
 *
 * 백엔드가 본문이 같은 옛 차수는 이미 뺐다(`chunking.drop_stale_revisions`).
 * 그래서 `siblings` 가 둘 이상이면 그 공고는 차수마다 내용이 실제로 다르다는
 * 뜻이고, 사용자가 어느 쪽을 보고 있는지 알아야 한다. 한 건뿐인 공고에까지
 * "0차" 를 달면 그냥 잡음이다.
 */
export function RevisionBadge({
  notice,
}: {
  notice: { 차수: number | null; siblings?: string[] };
}) {
  if (notice.차수 === null || (notice.siblings?.length ?? 0) < 2) return null;
  // 서버가 차수 오름차순으로 주지만 그 순서에 기대지 않는다.
  const orders = notice.siblings!.map((s) => Number(s.split("-").pop()));
  const isNewest = notice.차수 === Math.max(...orders);
  return (
    <span className={`badge ${isNewest ? "badge-success" : "badge-warning"}`}>
      {notice.차수}차{isNewest ? "" : " (옛)"}
    </span>
  );
}
