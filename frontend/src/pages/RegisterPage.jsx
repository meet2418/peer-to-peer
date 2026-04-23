import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";

export default function RegisterPage({ onLogin }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api.post("/auth/register", form);
      const { data } = await api.post("/auth/login", { email: form.email, password: form.password });
      onLogin(data);
      setSuccess("Account created successfully. Redirecting...");
      navigate(`/${data.role}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-soft">
      <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_right,_rgba(103,232,249,0.26),_transparent_48%),linear-gradient(180deg,#f8fbff,_#ffffff)] px-8 py-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">Join classroomAI</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Create your account</h1>
        <p className="mt-2 text-sm text-slate-500">Pick your role and start collaborating.</p>
      </div>

      <div className="px-8 py-6">
        {error && <div className="mt-1 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
        {success && <div className="mt-1 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            type="text"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            autoComplete="name"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-500"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            autoComplete="email"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-500"
            required
            minLength={6}
          />

          <select
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-500"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:opacity-90 disabled:opacity-70"
          >
            {loading ? "Creating..." : "Register"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-brand-700 hover:text-brand-800">
            Login
          </Link>
        </p>
      </div>
    </section>
  );
}
