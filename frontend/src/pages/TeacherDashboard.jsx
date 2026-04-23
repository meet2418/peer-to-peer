import { useEffect, useMemo, useState } from "react";

import StatCard from "../components/StatCard";
import { useTeacherClassrooms } from "../context/TeacherClassroomContext";
import api, { resolveApiBaseUrl } from "../services/api";

function PreviewPane({ preview }) {
  if (!preview) return null;
  if (preview.kind === "pdf" && preview.url) {
    return <iframe src={`${resolveApiBaseUrl()}${preview.url}`} title="pdf-preview" className="h-80 w-full rounded-2xl border border-slate-200 bg-white" />;
  }
  if (preview.kind === "image" && preview.url) {
    return <img src={`${resolveApiBaseUrl()}${preview.url}`} alt="preview" className="max-h-80 w-full rounded-2xl border border-slate-200 object-contain" />;
  }
  if (preview.kind === "document" && preview.url) {
    return (
      <div className="space-y-2">
        <iframe src={`${resolveApiBaseUrl()}${preview.url}`} title="doc-preview" className="h-80 w-full rounded-2xl border border-slate-200 bg-white" />
        <a
          href={`${resolveApiBaseUrl()}${preview.url}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs font-bold text-violet-700 hover:text-violet-800"
        >
          Open document in new tab
        </a>
      </div>
    );
  }
  if (preview.kind === "text") {
    return <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-xs text-slate-100">{preview.text}</pre>;
  }
  return <p className="text-xs text-slate-500">{preview.text || "Preview unavailable."}</p>;
}

function Panel({ title, subtitle, children, action }) {
  return (
    <section className="rounded-[28px] border border-slate-200/70 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
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
    violet: "bg-violet-100 text-violet-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export default function TeacherDashboard() {
  const { classrooms = [], selectedClassroomId = "", setSelectedClassroomId, refreshClassrooms } = useTeacherClassrooms() || {};
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [people, setPeople] = useState(null);
  const [historyMap, setHistoryMap] = useState({});
  const [activeHistoryKey, setActiveHistoryKey] = useState(null);
  const [overrideMap, setOverrideMap] = useState({});
  const [previewMap, setPreviewMap] = useState({});
  const [createClassroomForm, setCreateClassroomForm] = useState({ name: "", subject: "" });
  const [assignmentForm, setAssignmentForm] = useState({ classroom_id: "", title: "", description: "", topic: "", deadline: "" });
  const [performanceSummary, setPerformanceSummary] = useState({ total_students: 0, average_score: 0, graded_assignments: 0 });
  const [peerHighlights, setPeerHighlights] = useState({
    reviews_given: 0,
    reviews_received: 0,
    average_received_rating: 0,
    class_average_peer_rating: 0,
    recent_feedback: [],
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = assignments.filter((assignment) => new Date(assignment.deadline) > now).length;
    const reviewed = submissions.filter((submission) => submission.teacher_score !== null && submission.teacher_score !== undefined).length;
    return {
      totalClassrooms: classrooms.length,
      totalAssignments: assignments.length,
      upcoming,
      reviewed,
    };
  }, [classrooms, assignments, submissions]);

  const selectedClassroom = useMemo(
    () => classrooms.find((classroom) => String(classroom.id) === String(selectedClassroomId)) || null,
    [classrooms, selectedClassroomId]
  );

  const loadAssignments = async (classroomId) => {
    const params = classroomId ? { classroom_id: classroomId } : {};
    const { data } = await api.get("/assignments", { params });
    setAssignments(data);
  };

  const loadPeople = async (classroomId) => {
    if (!classroomId) return;
    const { data } = await api.get(`/classrooms/${classroomId}/people`);
    setPeople(data);
  };

  const loadSubmissions = async (assignment) => {
    setSelectedAssignment(assignment);
    const { data } = await api.get(`/submissions/assignment/${assignment.id}`);
    setSubmissions(data);
  };

  const loadPerformanceSummary = async () => {
    try {
      const params = selectedClassroomId ? { classroom_id: selectedClassroomId } : {};
      const { data } = await api.get("/analytics/performance", { params });
      setPerformanceSummary(data);
    } catch {
      setPerformanceSummary({ total_students: 0, average_score: 0, graded_assignments: 0 });
    }
  };

  const loadPeerHighlights = async () => {
    if (!selectedClassroomId) return;
    try {
      const { data } = await api.get("/analytics/peer-highlights", { params: { classroom_id: selectedClassroomId } });
      setPeerHighlights(data);
    } catch {
      setPeerHighlights({
        reviews_given: 0,
        reviews_received: 0,
        average_received_rating: 0,
        class_average_peer_rating: 0,
        recent_feedback: [],
      });
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        await refreshClassrooms?.();
        await loadPerformanceSummary();
      } catch {
        setError("Failed to load teacher portal");
      }
    };
    boot();
  }, []);

  useEffect(() => {
    loadPerformanceSummary();
    loadPeerHighlights();
  }, [selectedClassroomId]);

  useEffect(() => {
    if (!selectedClassroomId) return;
    setAssignmentForm((prev) => ({ ...prev, classroom_id: String(selectedClassroomId) }));
  }, [selectedClassroomId]);

  useEffect(() => {
    const run = async () => {
      if (!selectedClassroomId) return;
      try {
        await loadAssignments(selectedClassroomId);
        await loadPeople(selectedClassroomId);
        setSelectedAssignment(null);
        setSubmissions([]);
      } catch {
        setError("Failed to load classroom data");
      }
    };
    run();
  }, [selectedClassroomId]);

  const createClassroom = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api.post("/classrooms", createClassroomForm);
      setCreateClassroomForm({ name: "", subject: "" });
      setNotice("Classroom created.");
      await refreshClassrooms?.();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create classroom");
    }
  };

  const createAssignment = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api.post("/assignments", {
        ...assignmentForm,
        classroom_id: Number(assignmentForm.classroom_id),
      });
      setNotice("Assignment published.");
      setAssignmentForm((prev) => ({ ...prev, title: "", description: "", topic: "", deadline: "" }));
      await loadAssignments(selectedClassroomId);
      await loadPerformanceSummary();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create assignment");
    }
  };

  const loadStudentHistory = async (assignmentId, studentId) => {
    const key = `${assignmentId}:${studentId}`;
    setActiveHistoryKey((prev) => (prev === key ? null : key));
    if (historyMap[key]) return;
    try {
      const { data } = await api.get(`/submissions/assignment/${assignmentId}/student/${studentId}/history`);
      setHistoryMap((prev) => ({ ...prev, [key]: data }));
    } catch {
      setError("Could not load attempt history");
    }
  };

  const overrideScore = async (submissionId) => {
    const payload = overrideMap[submissionId];
    if (payload?.teacher_score === undefined || payload?.teacher_score === "" || !payload?.teacher_feedback?.trim()) return;
    try {
      await api.patch(`/submissions/${submissionId}/override`, {
        teacher_score: Number(payload.teacher_score),
        teacher_feedback: payload.teacher_feedback.trim(),
      });
      setNotice("Teacher review saved.");
      if (selectedAssignment) await loadSubmissions(selectedAssignment);
      await loadPerformanceSummary();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save override");
    }
  };

  const loadPreview = async (submissionId) => {
    if (previewMap[submissionId]) return;
    try {
      const { data } = await api.get(`/submissions/${submissionId}/preview`);
      setPreviewMap((prev) => ({ ...prev, [submissionId]: data }));
    } catch {
      setPreviewMap((prev) => ({ ...prev, [submissionId]: { kind: "unsupported", text: "Preview unavailable." } }));
    }
  };

  return (
    <div className="space-y-6">
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(196,181,253,0.42),_transparent_35%),linear-gradient(135deg,#111827,#312e81_62%,#5b21b6)] p-8 text-white shadow-[0_28px_70px_rgba(17,24,39,0.24)]">
        <div className="grid gap-8 lg:grid-cols-[1.7fr_0.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-violet-100/80">Teacher Command Center</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-tight">A cleaner teacher workspace for classroom tasks, publishing, and peer-powered review signals.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-violet-50/90">
              Focus on one classroom from the sidebar, publish faster, and review student work with strong visibility.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Pill tone="violet">{classrooms.length} classrooms</Pill>
              <Pill tone="emerald">{stats.reviewed} reviewed</Pill>
              <Pill tone="amber">{stats.upcoming} upcoming</Pill>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-100/70">Active Classroom</p>
            {selectedClassroom ? (
              <div className="mt-4 space-y-3">
                <h2 className="text-2xl font-black">{selectedClassroom.name}</h2>
                <p className="text-sm text-violet-50/90">{selectedClassroom.subject}</p>
                <p className="text-sm text-violet-50/90">Join code: {selectedClassroom.join_code}</p>
                <p className="text-xs text-violet-100/70">Assignments published: {assignments.length}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-violet-50/90">Create your first classroom to begin.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <StatCard label="Classrooms" value={stats.totalClassrooms} accent="brand" />
        <StatCard label="Assignments" value={stats.totalAssignments} accent="slate" />
        <StatCard label="Upcoming" value={stats.upcoming} accent="orange" />
        <StatCard label="Reviewed" value={stats.reviewed} accent="brand" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel title="Publish Assignment" subtitle="Create polished work with clear descriptions, topics, and deadlines.">
            <form onSubmit={createAssignment} className="grid gap-3 lg:grid-cols-2">
              <select
                value={assignmentForm.classroom_id}
                onChange={(e) => {
                  setAssignmentForm((prev) => ({ ...prev, classroom_id: e.target.value }));
                  setSelectedClassroomId(e.target.value);
                }}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                required
              >
                <option value="">Select classroom</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name} ({classroom.subject})
                  </option>
                ))}
              </select>
              <input
                value={assignmentForm.topic}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, topic: e.target.value }))}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                placeholder="Topic"
                required
              />
              <input
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, title: e.target.value }))}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 lg:col-span-2"
                placeholder="Assignment title"
                required
              />
              <textarea
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, description: e.target.value }))}
                className="h-28 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 lg:col-span-2"
                placeholder="What should students deliver?"
                required
              />
              <input
                type="datetime-local"
                value={assignmentForm.deadline}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, deadline: e.target.value }))}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 lg:col-span-2"
                required
              />
              <button className="rounded-2xl bg-violet-700 px-4 py-3 text-sm font-bold text-white lg:col-span-2">Publish assignment</button>
            </form>
          </Panel>

          <Panel
            title="Assignment Review"
            subtitle={selectedClassroom ? `${selectedClassroom.name} assignments and the linked submission queue.` : "Select a classroom first."}
            action={selectedAssignment ? <Pill tone="violet">Reviewing: {selectedAssignment.title}</Pill> : null}
          >
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-black text-slate-950">{assignment.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{assignment.topic}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{assignment.description}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                      <p className="font-bold text-slate-900">Deadline</p>
                      <p className="mt-2 text-slate-700">{formatDate(assignment.deadline)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => loadSubmissions(assignment)} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">
                      Open submissions
                    </button>
                    <Pill tone="amber">{new Date(assignment.deadline) > new Date() ? "Upcoming" : "Closed"}</Pill>
                  </div>
                </div>
              ))}
              {assignments.length === 0 && <p className="text-sm text-slate-500">No assignments in this classroom yet.</p>}
            </div>
          </Panel>

          <Panel title="Submission Queue" subtitle={selectedAssignment ? `Latest submissions for ${selectedAssignment.title}.` : "Choose an assignment to inspect submissions."}>
            {!selectedAssignment ? (
              <p className="text-sm text-slate-500">Open an assignment above and the review queue will appear here.</p>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission) => (
                  <article key={submission.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black text-slate-950">{submission.student_name}</p>
                          <Pill tone="slate">Attempt #{submission.attempt_number}</Pill>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(submission.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Pill tone="violet">Peer avg {submission.peer_rating_avg ?? "-"}</Pill>
                        <Pill tone="amber">{submission.peer_rating_count} peer notes</Pill>
                      </div>
                    </div>

                    {submission.text_content && <p className="mt-4 text-sm leading-6 text-slate-700">{submission.text_content}</p>}
                    {submission.file_url && (
                      <button onClick={() => loadPreview(submission.id)} className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">
                        Preview file
                      </button>
                    )}
                    <div className="mt-3">
                      <PreviewPane preview={previewMap[submission.id]} />
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4 text-sm">
                        <p className="font-bold text-slate-900">AI review</p>
                        <p className="mt-2 text-slate-700">Score: {submission.ai_score ?? "-"}</p>
                        <p className="mt-2 leading-6 text-slate-700">{submission.ai_feedback || "No AI feedback."}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 text-sm">
                        <p className="font-bold text-slate-900">Final review</p>
                        <p className="mt-2 text-slate-700">Score: {submission.final_score ?? "-"}</p>
                        <p className="mt-2 leading-6 text-slate-700">{submission.final_feedback || "No final feedback yet."}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[22px] border border-violet-200 bg-violet-50 p-4">
                      <p className="text-sm font-bold text-violet-900">Teacher override</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_auto]">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={overrideMap[submission.id]?.teacher_score || ""}
                          onChange={(e) => setOverrideMap((prev) => ({ ...prev, [submission.id]: { ...(prev[submission.id] || {}), teacher_score: e.target.value } }))}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                          placeholder="Score"
                        />
                        <input
                          value={overrideMap[submission.id]?.teacher_feedback || ""}
                          onChange={(e) => setOverrideMap((prev) => ({ ...prev, [submission.id]: { ...(prev[submission.id] || {}), teacher_feedback: e.target.value } }))}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                          placeholder="Feedback"
                        />
                        <button onClick={() => overrideScore(submission.id)} className="rounded-2xl bg-violet-700 px-5 py-3 text-sm font-bold text-white">
                          Save review
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900">Anonymous peer feedback</p>
                        <button onClick={() => loadStudentHistory(selectedAssignment.id, submission.student_id)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">
                          {activeHistoryKey === `${selectedAssignment.id}:${submission.student_id}` ? "Hide history" : "Attempt history"}
                        </button>
                      </div>
                      <div className="mt-3 space-y-3">
                        {submission.peer_reviews.map((review) => (
                          <div key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-bold text-slate-900">{review.reviewer_label}</p>
                              <Pill tone="amber">{review.rating} / 5</Pill>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{review.feedback || "No written feedback."}</p>
                          </div>
                        ))}
                        {submission.peer_reviews.length === 0 && <p className="text-sm text-slate-500">No anonymous peer feedback yet.</p>}
                      </div>
                    </div>

                    {activeHistoryKey === `${selectedAssignment.id}:${submission.student_id}` && (
                      <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-sm font-bold text-slate-900">Attempt history</p>
                        <div className="mt-3 space-y-3">
                          {(historyMap[`${selectedAssignment.id}:${submission.student_id}`] || []).map((historyItem) => (
                            <div key={historyItem.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                              <p className="font-bold text-slate-900">Attempt #{historyItem.attempt_number}</p>
                              <p className="mt-1 text-slate-600">Final score: {historyItem.final_score ?? "-"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
                {submissions.length === 0 && <p className="text-sm text-slate-500">No submissions yet for this assignment.</p>}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Create Classroom" subtitle="Create new classroom space without leaving dashboard.">
            <form onSubmit={createClassroom} className="space-y-3">
              <input
                value={createClassroomForm.name}
                onChange={(e) => setCreateClassroomForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                placeholder="Classroom name"
                required
              />
              <input
                value={createClassroomForm.subject}
                onChange={(e) => setCreateClassroomForm((prev) => ({ ...prev, subject: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                placeholder="Subject"
                required
              />
              <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
                Create classroom
              </button>
            </form>
          </Panel>

          <Panel title="Current Classroom" subtitle="Everything on this page follows sidebar-selected classroom.">
            {selectedClassroom ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                  <p className="font-black text-slate-900">{selectedClassroom.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedClassroom.subject}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Join code: {selectedClassroom.join_code}</p>
                </div>
                <p className="text-sm text-slate-600">Use the left sidebar to switch classrooms quickly.</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select or create a classroom to continue.</p>
            )}
          </Panel>

          <Panel title="Performance Snapshot" subtitle="Overall classroom performance available directly on home.">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Students tracked</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{performanceSummary.total_students}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Average score</p>
                <p className="mt-2 text-2xl font-black text-cyan-700">{performanceSummary.average_score}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Graded tasks</p>
                <p className="mt-2 text-2xl font-black text-violet-700">{performanceSummary.graded_assignments}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Peer-to-Peer Highlights" subtitle="Anonymous peer review activity in this classroom.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Peer reviews count</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{peerHighlights.reviews_received}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Class peer average</p>
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
              {peerHighlights.recent_feedback.length === 0 && <p className="text-sm text-slate-500">Peer activity will appear when students start reviewing.</p>}
            </div>
          </Panel>

          <Panel title="People" subtitle={selectedClassroom ? `Roster for ${selectedClassroom.name}.` : "Select a classroom to see the roster."}>
            {!selectedClassroom ? (
              <p className="text-sm text-slate-500">No classroom selected.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Teacher</p>
                  <p className="mt-2 font-black text-slate-950">{people?.teacher?.name || selectedClassroom.teacher_name}</p>
                  <p className="mt-1 text-sm text-slate-600">{people?.teacher?.email || ""}</p>
                </div>
                <div className="space-y-3">
                  {(people?.students || []).map((student) => (
                    <div key={student.user_id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="font-bold text-slate-900">{student.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{student.email}</p>
                      {student.joined_at && <p className="mt-2 text-xs text-slate-500">Joined {formatDate(student.joined_at)}</p>}
                    </div>
                  ))}
                  {(!people?.students || people.students.length === 0) && <p className="text-sm text-slate-500">No students enrolled yet.</p>}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}
