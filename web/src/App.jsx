import { useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api, setAuthToken, subscribeApiLoading } from "./api";
import GoalPage from "./pages/GoalPage";
import HomePage from "./pages/HomePage";
import InboxPage from "./pages/InboxPage";
import LoginPage from "./pages/LoginPage";
import ProjectPage from "./pages/ProjectPage";
import DeadlinesPage from "./pages/DeadlinesPage";

export default function App() {
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    return subscribeApiLoading(setIsApiLoading);
  }, []);

  async function refreshAuthStatus() {
    try {
      const status = await api.authStatus();
      setIsConfigured(Boolean(status.configured));
      setIsAuthenticated(Boolean(status.authenticated));
      setAuthError("");
    } catch (error) {
      setAuthError("Unable to reach authentication service.");
      setIsConfigured(false);
      setIsAuthenticated(false);
    } finally {
      setIsAuthReady(true);
    }
  }

  useEffect(() => {
    refreshAuthStatus();
  }, []);

  async function handleSetup(password) {
    const response = await api.setupMasterPassword(password);
    setAuthToken(response.token);
    await refreshAuthStatus();
  }

  async function handleLogin(password) {
    const response = await api.login(password);
    setAuthToken(response.token);
    await refreshAuthStatus();
  }

  async function handleForgotPassword(newPassword) {
    const response = await api.forgotPassword(newPassword);
    setAuthToken(response.token);
    await refreshAuthStatus();
  }

  function handleLogout() {
    setAuthToken("");
    setIsAuthenticated(false);
    setNotifications([]);
  }

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    async function pollNotifications() {
      try {
        const items = await api.listPendingNotifications(true);
        if (!active || !Array.isArray(items) || items.length === 0) return;
        setNotifications((prev) => [...items.slice(-5), ...prev].slice(0, 8));
        if ("Notification" in window && Notification.permission === "granted") {
          items.forEach((item) => {
            new Notification(item.title || "PrioStack", { body: item.message || "" });
          });
        }
      } catch {
        // Keep polling even if one request fails.
      }
    }
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    pollNotifications();
    const timer = window.setInterval(pollNotifications, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);

  if (!isAuthReady) {
    return <main className="min-h-screen bg-slate-950" />;
  }

  if (!isAuthenticated) {
    return (
      <>
        {authError ? <div className="bg-rose-900 px-4 py-2 text-sm text-rose-100">{authError}</div> : null}
        <LoginPage
          configured={isConfigured}
          onSetup={handleSetup}
          onLogin={handleLogin}
          onForgotPassword={handleForgotPassword}
          isLoading={isApiLoading}
        />
      </>
    );
  }

  return (
    <BrowserRouter>
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
        <TopNav onLogout={handleLogout} />
        {notifications.length ? (
          <section className="fixed right-4 top-20 z-50 w-full max-w-sm space-y-2">
            {notifications.map((item, index) => (
              <article key={`${item.type}-${index}-${item.message}`} className="rounded-lg border border-indigo-700/80 bg-slate-900/95 p-3 shadow-lg">
                <div className="text-sm font-semibold text-indigo-300">{item.title || "Notification"}</div>
                <p className="text-xs text-slate-200">{item.message}</p>
              </article>
            ))}
          </section>
        ) : null}
        {isApiLoading ? (
          <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
            <div className="rounded-full border border-slate-600 bg-slate-900/90 p-2 shadow">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
            </div>
          </div>
        ) : null}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/deadlines" element={<DeadlinesPage />} />
          <Route path="/goals/:goalId" element={<GoalPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

function TopNav({ onLogout }) {
  const location = useLocation();
  const path = location.pathname;
  const goalMatch = path.match(/^\/goals\/([^/]+)$/);
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);

  const links = [
    { to: "/", label: "Home" },
    { to: "/inbox", label: "Inbox" },
    { to: "/deadlines", label: "Deadlines" },
  ];
  if (goalMatch) links.push({ to: `/goals/${goalMatch[1]}`, label: "Goal" });
  if (projectMatch) links.push({ to: `/projects/${projectMatch[1]}`, label: "Project" });

  return (
    <header className="mx-auto mb-6 max-w-6xl rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-lg font-semibold text-indigo-300">PrioStack</div>
          <p className="text-sm text-slate-300">You can&apos;t manage what you don&apos;t measure.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded px-3 py-1.5 text-sm transition ${
                  isActive ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          </nav>
          <button className="rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
