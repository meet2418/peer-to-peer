import { useEffect, useState } from "react";
import api from "../services/api";
import { useTeacherClassrooms } from "../context/TeacherClassroomContext";

export default function PerformancePage() {
  const { selectedClassroomId } = useTeacherClassrooms() || {};
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStats = async () => {
      setError("");
      try {
        const params = selectedClassroomId ? { classroom_id: selectedClassroomId } : {};
        const { data } = await api.get("/analytics/performance", { params });
        setStats(data);
      } catch {
        setError("Failed to load performance data");
      }
    };
    loadStats();
  }, [selectedClassroomId]);

  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>;
  if (!stats) return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.45),_transparent_36%),linear-gradient(135deg,#0f172a,#1e3a8a_62%,#0f766e)] p-8 text-white shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-100/80">Teacher Insights</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight">Performance analytics for your active classrooms.</h1>
            <p className="mt-4 max-w-2xl text-sm text-cyan-50/90">
              Use these signals to identify who needs support, how class scoring is trending, and whether grading velocity is healthy.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/20 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Quick Snapshot</p>
            <div className="mt-4 space-y-3 text-sm">
              <p className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">Students tracked: <span className="font-black">{stats.total_students}</span></p>
              <p className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">Average score: <span className="font-black">{stats.average_score}</span></p>
              <p className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">Assignments graded: <span className="font-black">{stats.graded_assignments}</span></p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white/95 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Total Students</div>
          <div className="mt-3 text-3xl font-black text-slate-900">{stats.total_students}</div>
          <div className="mt-1 text-sm text-slate-500">Active learners in your analytics scope.</div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white/95 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Average Score</div>
          <div className="mt-3 text-3xl font-black text-cyan-700">{stats.average_score}</div>
          <div className="mt-1 text-sm text-slate-500">Current class scoring trend.</div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white/95 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Assignments Graded</div>
          <div className="mt-3 text-3xl font-black text-violet-700">{stats.graded_assignments}</div>
          <div className="mt-1 text-sm text-slate-500">Completed grading actions to date.</div>
        </div>
      </section>
    </div>
  );
}
