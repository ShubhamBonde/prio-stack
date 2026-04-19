import { useEffect, useState } from "react";
import ItemForm from "./ItemForm";
import MarkdownPreview from "./MarkdownPreview";

export default function StackView({ items, onComplete, onDelete, onUpdate, onLoadChildren }) {
  const [expandedParent, setExpandedParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (!expandedParent) return;
    onLoadChildren(expandedParent).then(setChildren);
  }, [expandedParent, onLoadChildren]);

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-sm">
      <h2 className="mb-3 text-xl font-semibold">Priority Stack</h2>
      {items.length === 0 ? <p className="text-slate-300">No tasks yet.</p> : null}
      {items.map((item) => (
        <div key={item.id} className="mb-3 rounded-md border border-slate-700 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm sm:text-base">
              <strong>{item.title}</strong> - p{item.priority} - {item.state}
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border border-slate-600 px-2 py-1 text-xs" onClick={() => setExpandedParent(item.id)}>
                Children
              </button>
              <button className="rounded-md border border-slate-600 px-2 py-1 text-xs" onClick={() => setEditingId(item.id)}>
                Edit
              </button>
              <button
                className="rounded-md border border-rose-700 px-2 py-1 text-xs"
                onClick={() => {
                  const ok = window.confirm(`Delete "${item.title}"? This action cannot be undone.`);
                  if (!ok) return;
                  onDelete(item.id);
                }}
              >
                Delete
              </button>
              <button className="rounded-md border border-emerald-600 px-2 py-1 text-xs" disabled={item.state === "done"} onClick={() => onComplete(item.id)}>
                Complete
              </button>
            </div>
          </div>
          {!!item.description && (
            <div className="mt-2 rounded bg-slate-800 p-2">
              <MarkdownPreview text={item.description} />
            </div>
          )}
          {!!item.notes && (
            <div className="mt-2 rounded bg-slate-800 p-2">
              <MarkdownPreview text={item.notes} />
            </div>
          )}
          {editingId === item.id ? (
            <div className="mt-2">
              <ItemForm
                items={items.filter((candidate) => candidate.id !== item.id)}
                initialValue={{ ...item, due_at: item.due_at ? item.due_at.slice(0, 16) : "" }}
                submitLabel="Update"
                onSubmit={async (payload) => {
                  await onUpdate(item.id, payload);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : null}
        </div>
      ))}
      {expandedParent ? (
        <div className="mt-2 rounded-md border border-slate-700 bg-slate-950 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">Child Tasks</h3>
            <button className="rounded-md border border-slate-700 px-2 py-1 text-xs" onClick={() => setExpandedParent(null)}>
              Close
            </button>
          </div>
          {children.length === 0 ? <p className="text-sm text-slate-400">No child tasks.</p> : null}
          {children.map((child) => (
            <div key={child.id} className="border-t border-slate-700 py-2 text-sm first:border-t-0">
              {child.title} - p{child.priority} - {child.due_at || "no due"}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
