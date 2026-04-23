import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-8 py-4">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.28),_transparent_35%),linear-gradient(135deg,#0f172a,#155e75_55%,#0f766e)] p-8 text-white shadow-[0_28px_70px_rgba(15,23,42,0.24)] md:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-100/80">Classroom Management + Peer-to-Peer</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight md:text-5xl">Teach, submit, review, and learn together in one interactive classroom platform.</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-cyan-50/90 md:text-base">
          Built for modern classrooms with assignment workflows, in-portal file previews, anonymous peer reviews, and classroom-focused analytics.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/register" className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-100">
            Get Started
          </Link>
          <Link to="/login" className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/20">
            Login
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Teacher Flow</p>
          <h2 className="mt-3 text-xl font-black text-slate-900">Classroom-first control</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Switch classes from sidebar, publish tasks quickly, and review submissions with anonymous peer context.</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Student Flow</p>
          <h2 className="mt-3 text-xl font-black text-slate-900">Focused by classroom</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">See only tasks and modules for selected class, submit on dedicated pages, and track fair subject-level progress.</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Peer-to-Peer</p>
          <h2 className="mt-3 text-xl font-black text-slate-900">Anonymous, meaningful reviews</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Students review classmates anonymously. Teachers and students can view peer-review impact highlights per classroom.</p>
        </article>
      </div>
    </section>
  );
}
