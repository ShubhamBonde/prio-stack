import { useState } from "react";

export default function LoginPage({ configured, onSetup, onLogin, onForgotPassword, isLoading }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password) return;
    try {
      if (!configured || forgotMode) {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        setError("");
        await (forgotMode ? onForgotPassword(password) : onSetup(password));
        setPassword("");
        setConfirmPassword("");
        return;
      }
      setError("");
      await onLogin(password);
      setPassword("");
    } catch (submitError) {
      let message = "Authentication failed.";
      if (submitError instanceof Error && submitError.message) {
        if (submitError.message.includes("Invalid password")) message = "Invalid password.";
        else if (submitError.message.includes("already configured")) message = "Master password is already configured.";
        else message = submitError.message;
      }
      setError(message);
    }
  }

  const title = !configured ? "Create Master Password" : forgotMode ? "Reset Master Password" : "Login";
  const description = !configured
    ? "Set a master password to unlock your data. This device supports one user."
    : forgotMode
      ? "Create a new master password. This signs out any previous sessions."
      : "Enter your master password to access your data.";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto mt-20 w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-indigo-300">{title}</h1>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <input
            type="password"
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2"
            placeholder="Master password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={configured && !forgotMode ? 1 : 8}
            required
          />
          {(!configured || forgotMode) && (
            <input
              type="password"
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          )}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded bg-indigo-500 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Please wait..." : !configured ? "Create Password" : forgotMode ? "Reset Password" : "Login"}
          </button>
        </form>
        {configured ? (
          <button
            type="button"
            className="mt-4 text-sm text-indigo-300 hover:text-indigo-200"
            onClick={() => {
              setForgotMode((value) => !value);
              setError("");
              setPassword("");
              setConfirmPassword("");
            }}
          >
            {forgotMode ? "Back to login" : "Forgot password?"}
          </button>
        ) : null}
      </div>
    </main>
  );
}
