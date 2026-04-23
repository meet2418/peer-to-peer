import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", form);
      onLogin(data);
      navigate(`/${data.role}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto grid max-w-5xl items-start gap-8 py-2 md:items-stretch md:grid-cols-2">
      <div className="relative overflow-hidden rounded-3xl border border-cyan-200/50 bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-500 p-8 text-white shadow-soft">
        <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-200/30 blur-2xl" />
        <p className="inline-flex rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white/90">
          Classroom workspace
        </p>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight">Teach smarter, evaluate faster.</h1>
        <p className="mt-5 text-base text-white/90">
          ClassroomAI helps teachers launch assignments and gives students instant AI-backed feedback with fair anonymous peer visibility.
        </p>
        <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">Create and publish assignments</div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">Track student progress clearly</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/80 bg-white/95 p-8 shadow-soft md:self-center">
        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-500">Login to continue to your classroom.</p>

        {error && <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

        <div className="mt-5 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            autoComplete="email"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-70"
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <p className="mt-4 text-sm text-slate-600">
          New here?{" "}
          <Link to="/register" className="font-bold text-brand-700 hover:text-brand-800">
            Create account
          </Link>
        </p>
      </form>
    </section>
  );
}
