import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faCircleCheck, faCircleExclamation, faFolder, faBullseye, faListCheck } from "@fortawesome/free-solid-svg-icons";
import { api } from "../api";

export default function DeadlinesPage() {
  const [activeTab, setActiveTab] = useState("goals");
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchItems(tab) {
    setIsLoading(true);
    try {
      let data = [];
      if (tab === "goals") {
        data = await api.listGoals();
      } else if (tab === "projects") {
        data = await api.listAllProjects();
      } else if (tab === "tasks") {
        data = await api.listAllTasks();
      }
      
      const filtered = data.filter(i => {
        if (i.state === "done") return false;
        const d = tab === "goals" || tab === "projects" ? i.deadline_at : i.due_at;
        return Boolean(d);
      });
      
      filtered.sort((a, b) => {
        const da = new Date(tab === "goals" || tab === "projects" ? a.deadline_at : a.due_at).getTime();
        const db = new Date(tab === "goals" || tab === "projects" ? b.deadline_at : b.due_at).getTime();
        return da - db;
      });
      
      setItems(filtered);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchItems(activeTab);
  }, [activeTab]);

  function getUrgencyInfo(isoDate) {
    const d = new Date(isoDate);
    const now = new Date();
    const diffMs = d - now;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      return { class: "text-rose-400 font-bold", label: "Urgent", badgeClass: "bg-rose-900 border-rose-700 text-rose-200" };
    } else if (diffHours < 72) {
      return { class: "text-amber-400 font-bold", label: "Upcoming", badgeClass: "bg-amber-900 border-amber-700 text-amber-200" };
    } else {
      return { class: "text-blue-400 font-bold", label: "Later", badgeClass: "bg-blue-900 border-blue-700 text-blue-200" };
    }
  }

  function formatDate(isoDate) {
    const value = new Date(isoDate);
    if (Number.isNaN(value.getTime())) return "Invalid Date";
    return value.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">⏱️ Deadlines</h1>
      </div>
      
      <div className="flex justify-center mb-6">
        <div className="flex rounded-lg bg-slate-800 p-1 shadow-sm w-full max-w-md border border-slate-700">
          <button
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition flex items-center justify-center ${activeTab === 'goals' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
            onClick={() => setActiveTab('goals')}
          >
            <FontAwesomeIcon icon={faBullseye} className="mr-2" /> Goals
          </button>
          <button
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition flex items-center justify-center ${activeTab === 'projects' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
            onClick={() => setActiveTab('projects')}
          >
            <FontAwesomeIcon icon={faFolder} className="mr-2" /> Projects
          </button>
          <button
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition flex items-center justify-center ${activeTab === 'tasks' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
            onClick={() => setActiveTab('tasks')}
          >
            <FontAwesomeIcon icon={faListCheck} className="mr-2" /> Tasks
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50 shadow-xl backdrop-blur-sm">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
            <tr>
              <th scope="col" className="px-6 py-4 rounded-tl-xl font-semibold">Title</th>
              <th scope="col" className="px-6 py-4 font-semibold">Status / Priority</th>
              <th scope="col" className="px-6 py-4 font-semibold">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="3" className="px-6 py-8 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-4xl mb-3 text-slate-600" />
                    <p>No upcoming deadlines for {activeTab}.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const dateVal = activeTab === "goals" || activeTab === "projects" ? item.deadline_at : item.due_at;
                const urgency = getUrgencyInfo(dateVal);
                return (
                  <tr key={item.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {item.title}
                    </td>
                    <td className="px-6 py-4">
                      {item.state && <span className="mr-2 inline-flex items-center rounded bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-slate-600">{item.state}</span>}
                      <span className="inline-flex items-center rounded bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-slate-600">P{item.priority}</span>
                    </td>
                    <td className={`px-6 py-4 ${urgency.class}`}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <FontAwesomeIcon icon={faClock} className="mr-2 opacity-80" />
                          {formatDate(dateVal)}
                        </span>
                        <span className={`ml-3 rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${urgency.badgeClass}`}>
                          {urgency.label === "Urgent" && <FontAwesomeIcon icon={faCircleExclamation} className="mr-1" />}
                          {urgency.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
