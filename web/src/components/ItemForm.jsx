const defaultForm = {
  title: "",
  description: "",
  notes: "",
  state: "todo",
  priority: 2,
  due_at: "",
  alarm_enabled: false,
  parent_id: "",
  required_frequency: "daily",
  frequency_days: 1,
};

export default function ItemForm({ onSubmit, items, initialValue, onCancel, submitLabel = "Save" }) {
  const form = { ...defaultForm, ...(initialValue || {}) };
  return (
    <form
      className="grid gap-2 rounded-md border border-slate-700 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({
          title: String(fd.get("title") || "").trim(),
          description: String(fd.get("description") || ""),
          notes: String(fd.get("notes") || ""),
          state: String(fd.get("state") || "todo"),
          priority: Number(fd.get("priority") || 1),
          due_at: fd.get("due_at") ? new Date(String(fd.get("due_at"))).toISOString() : null,
          alarm_enabled: fd.get("alarm_enabled") === "on",
          parent_id: fd.get("parent_id") ? Number(fd.get("parent_id")) : null,
          required_frequency: String(fd.get("required_frequency") || "daily"),
          frequency_days: Number(fd.get("frequency_days") || 1),
        });
      }}
    >
      <input name="title" required defaultValue={form.title} placeholder="Title" className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2" />
      <textarea name="description" defaultValue={form.description} placeholder="Description (Markdown)" className="min-h-20 rounded-md border border-slate-600 bg-slate-800 px-3 py-2" />
      <textarea name="notes" defaultValue={form.notes} placeholder="Notes (Markdown)" className="min-h-16 rounded-md border border-slate-600 bg-slate-800 px-3 py-2" />
      <div className="grid grid-cols-2 gap-2">
        <select name="state" defaultValue={form.state} className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2">
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>
        <select name="priority" defaultValue={form.priority} className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2">
          <option value={1}>Low</option>
          <option value={2}>Medium</option>
          <option value={3}>High</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="datetime-local" name="due_at" defaultValue={form.due_at} className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2" />
        <select name="parent_id" defaultValue={form.parent_id} className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2">
          <option value="">No parent</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          name="required_frequency"
          defaultValue={form.required_frequency}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom (days)</option>
        </select>
        <input type="number" min={1} max={30} name="frequency_days" defaultValue={form.frequency_days} className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="alarm_enabled" defaultChecked={form.alarm_enabled} />
        Alarm enabled
      </label>
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-indigo-500 px-3 py-2 text-white">
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="rounded-md border border-slate-600 px-3 py-2" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
