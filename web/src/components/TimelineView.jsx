export default function TimelineView({ timeline, view, setView }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Timeline</h2>
        <select value={view} onChange={(e) => setView(e.target.value)} className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm">
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </div>
      {timeline.length === 0 ? <p className="text-sm text-slate-400">No scheduled tasks in this window.</p> : null}
      {timeline.map((group) => (
        <div key={group.label} className="mb-2 rounded-md border border-slate-700 p-2">
          <h3 className="text-sm font-medium text-indigo-300">{group.label}</h3>
          {group.items.map((item) => (
            <div key={item.id} className="border-t border-slate-700 py-1 text-sm first:border-t-0">
              {item.title} ({item.state}) - p{item.priority}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
