import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import StatCard from "../components/StatCard";
import { useStudentClassrooms } from "../context/StudentClassroomContext";
import api from "../services/api";

function Panel({ title, subtitle, children, action }) {
  return (
    <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{title}</p>
          {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    cyan: "bg-cyan-100 text-cyan-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function AssignmentStatus({ beforeDeadline, submitted }) {
  if (!beforeDeadline) return <Pill tone="amber">Closed</Pill>;
  if (submitted) return <Pill tone="emerald">Submitted</Pill>;
  return <Pill tone="cyan">Ready</Pill>;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export default function StudentDashboard() {
  const { classrooms, selectedClassroomId, setSelectedClassroomId, refreshClassrooms, loading: classroomsLoading } = useStudentClassrooms() || {};
  const [joinCode, setJoinCode] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [peerHighlights, setPeerHighlights] = useState({
    reviews_given: 0,
    reviews_received: 0,
    average_received_rating: 0,
    class_average_peer_rating: 0,
    recent_feedback: [],
  });
  const [progress, setProgress] = useState({ total_assignments: 0, submitted_assignments: 0, pending_assignments: 0, average_score: 0 });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const mySubmissionByAssignment = useMemo(() => {
    const map = {};
    mySubmissions.forEach((item) => {
      map[item.assignment_id] = item;
    });
    return map;
  }, [mySubmissions]);

  const selectedClassroom = useMemo(
    () => classrooms.find((c) => String(c.id) === String(selectedClassroomId)) || null,
    [classrooms, selectedClassroomId]
  );

  const upcomingAssignments = useMemo(
    () => assignments.filter((assignment) => new Date(assignment.deadline) > new Date()).slice(0, 4),
    [assignments]
  );

  const loadBase = async () => {
    const params = selectedClassroomId ? { classroom_id: selectedClassroomId } : {};
    const [meRes, lbRes, progressRes] = await Promise.all([
      api.get("/submissions/me"),
      api.get("/analytics/leaderboard", { params }),
      api.get("/analytics/progress", { params }),
    ]);
    setMySubmissions(meRes.data);
    setLeaderboard(lbRes.data);
    setProgress(progressRes.data);
    if (selectedClassroomId) {
      const { data: peerData } = await api.get("/analytics/peer-highlights", { params: { classroom_id: selectedClassroomId } });
      setPeerHighlights(peerData);
    } else {
      setPeerHighlights({
        reviews_given: 0,
        reviews_received: 0,
        average_received_rating: 0,
        class_average_peer_rating: 0,
        recent_feedback: [],
      });
    }
  };

  const loadAssignments = async (classroomId) => {
    const { data } = await api.get("/assignments", { params: { classroom_id: classroomId } });
    setAssignments(data);
  };

  useEffect(() => {
    const boot = async () => {
      try {
        await loadBase();
      } catch {
        setError("Failed to load student portal");
      }
    };
    boot();
  }, [selectedClassroomId]);

  useEffect(() => {
    const run = async () => {
      if (!selectedClassroomId) {
        setAssignments([]);
        return;
      }
      try {
        await loadAssignments(selectedClassroomId);
      } catch {
        setError("Failed to load assignments");
      }
    };
    run();
  }, [selectedClassroomId]);

  const joinClassroom = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api.post("/classrooms/join", { join_code: joinCode });
      setJoinCode("");
      setNotice("Classroom joined successfully.");
      await refreshClassrooms?.();
      await loadBase();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not join classroom");
    }
  };

  return (
    <div className="space-y-6">
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(103,232,249,0.35),_transparent_35%),linear-gradient(135deg,#0f172a,#164e63_58%,#0f766e)] p-8 text-white shadow-[0_28px_70px_rgba(15,23,42,0.24)]">
        <div className="grid gap-8 lg:grid-cols-[1.7fr_0.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-100/80">Student Workspace</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-tight">A cleaner student portal for classes, submissions, peer learning, and progress.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-cyan-50/90">
              Keep coursework focused, submit faster, and review classmates anonymously without changing anyone&apos;s score.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Pill tone="cyan">{classrooms.length} classrooms</Pill>
              <Pill tone="emerald">{progress.submitted_assignments} submitted</Pill>
              <Pill tone="amber">{progress.pending_assignments} pending</Pill>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/70">Focus Classroom</p>
            {selectedClassroom ? (
              <div className="mt-4 space-y-3">
                <h2 className="text-2xl font-black">{selectedClassroom.name}</h2>
                <p className="text-sm text-cyan-50/90">{selectedClassroom.subject}</p>
                <p className="text-sm text-cyan-50/90">Teacher: {selectedClassroom.teacher_name}</p>
                <p className="text-xs text-cyan-100/70">Assignments loaded: {assignments.length}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-cyan-50/90">Join a classroom to unlock the full workspace.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <StatCard label="Total Tasks" value={progress.total_assignments} accent="slate" />
        <StatCard label="Submitted" value={progress.submitted_assignments} accent="brand" />
        <StatCard label="Pending" value={progress.pending_assignments} accent="orange" />
        <StatCard label="Average Score" value={progress.average_score} accent="brand" />
      </section>

      {!classroomsLoading && classrooms.length === 0 ? (
        <Panel title="Join Class" subtitle="Enter your classroom code to start learning.">
          <form onSubmit={joinClassroom} className="mx-auto max-w-md space-y-3">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
              placeholder="Enter classroom code"
              required
            />
            <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
              Join classroom
            </button>
          </form>
        </Panel>
      ) : (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Panel
            title="Assignments"
            subtitle={selectedClassroom ? `${selectedClassroom.name} - submit work, inspect history, and review peers anonymously.` : "Select a classroom to view assignments."}
            action={selectedClassroom ? <Pill tone="cyan">{assignments.length} loaded</Pill> : null}
          >
            <div className="space-y-5">
              {assignments.map((assignment) => {
                const mine = mySubmissionByAssignment[assignment.id];
                const beforeDeadline = new Date(assignment.deadline) > new Date();

                return (
                  <article key={assignment.id} className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,_#f8fafc)] p-5">
                    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-black tracking-tight text-slate-950">{assignment.title}</h3>
                          <AssignmentStatus beforeDeadline={beforeDeadline} submitted={Boolean(mine)} />
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{assignment.topic} - Due {formatDate(assignment.deadline)}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{assignment.description}</p>
                      </div>
                      {mine && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm lg:w-48 lg:shrink-0">
                          <p className="font-bold text-emerald-900">Latest result</p>
                          <p className="mt-2 text-emerald-800">Attempt #{mine.attempt_number}</p>
                          <p className="text-emerald-800">Final score: {mine.final_score ?? "-"}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Link
                        to={`/student/assignments/${assignment.id}`}
                        className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                      >
                        Open submission page
                      </Link>
                      {beforeDeadline ? (
                        <Pill tone="cyan">Open before deadline</Pill>
                      ) : (
                        <Pill tone="amber">Deadline passed</Pill>
                      )}
                    </div>
                  </article>
                );
              })}
              {assignments.length === 0 && <p className="text-sm text-slate-500">No assignments published in this classroom yet.</p>}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Join Another Class" subtitle="Use a teacher join code to enroll in additional classrooms.">
            <form onSubmit={joinClassroom} className="space-y-3">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
                placeholder="Enter classroom code"
                required
              />
              <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
                Join classroom
              </button>
            </form>
          </Panel>

          <Panel title="Due Soon" subtitle="Your next academic checkpoints in this classroom.">
            <div className="space-y-3">
              {upcomingAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">{assignment.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{assignment.topic}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{formatDate(assignment.deadline)}</p>
                </div>
              ))}
              {upcomingAssignments.length === 0 && <p className="text-sm text-slate-500">Nothing due soon.</p>}
            </div>
          </Panel>

          <Panel title="Leaderboard" subtitle="Anonymous class ranking based on final scores.">
            <div className="space-y-3">
              {leaderboard.map((entry) => (
                <div key={entry.rank} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-bold text-slate-900">#{entry.rank} {entry.student_alias}</p>
                    <p className="text-xs text-slate-500">{entry.submissions_count} graded submissions</p>
                  </div>
                  <p className="text-lg font-black text-cyan-700">{entry.average_score}</p>
                </div>
              ))}
              {leaderboard.length === 0 && <p className="text-sm text-slate-500">Leaderboard will appear after scoring begins.</p>}
            </div>
          </Panel>

          <Panel title="Peer-to-Peer Impact" subtitle="Anonymous review signals for this classroom.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Reviews given</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{peerHighlights.reviews_given}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Reviews on your work</p>
                <p className="mt-2 text-2xl font-black text-cyan-700">{peerHighlights.reviews_received}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Your peer avg</p>
                <p className="mt-2 text-2xl font-black text-emerald-700">{peerHighlights.average_received_rating}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Class peer avg</p>
                <p className="mt-2 text-2xl font-black text-violet-700">{peerHighlights.class_average_peer_rating}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {peerHighlights.recent_feedback.map((item, idx) => (
                <div key={`${item.created_at}-${idx}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{item.label} · {item.rating}/5</p>
                  <p className="mt-1 text-sm text-slate-700">{item.feedback || "No written feedback."}</p>
                </div>
              ))}
              {peerHighlights.recent_feedback.length === 0 && <p className="text-sm text-slate-500">Peer feedback will appear after class reviews start.</p>}
            </div>
          </Panel>
        </div>
      </section>
      )}
    </div>
  );
}
