export default function DashboardSummary({ summary, view, setView }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <select value={view} onChange={(e) => setView(e.target.value)} className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm">
          <option value="all">All time</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-3 text-sm sm:text-base">
        <div className="rounded-md bg-slate-800 px-3 py-2">Total: {summary.total_items}</div>
        <div className="rounded-md bg-slate-800 px-3 py-2">Done: {summary.done_items}</div>
        <div className="rounded-md bg-slate-800 px-3 py-2">Completion: {(summary.completion_rate * 100).toFixed(0)}%</div>
        <div className="rounded-md bg-slate-800 px-3 py-2">Points: {summary.point_balance}</div>
        <div className="rounded-md bg-slate-800 px-3 py-2">Streaks: {summary.active_streaks}</div>
      </div>
    </section>
  );
}
