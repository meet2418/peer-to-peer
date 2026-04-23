import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

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
        <a href={`${resolveApiBaseUrl()}${preview.url}`} target="_blank" rel="noreferrer" className="inline-block text-xs font-bold text-cyan-700 hover:text-cyan-800">
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

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    cyan: "bg-cyan-100 text-cyan-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function toFiveScale(score) {
  if (score === null || score === undefined) return "-";
  return (Number(score) / 20).toFixed(1);
}

export default function StudentAssignmentPage() {
  const { assignmentId } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [mySubmission, setMySubmission] = useState(null);
  const [history, setHistory] = useState([]);
  const [peers, setPeers] = useState([]);
  const [peerCount, setPeerCount] = useState(0);
  const [peerStatus, setPeerStatus] = useState({ enrolled_students: 0, submitted_students: 0, peer_ready: false });
  const [draft, setDraft] = useState({ text: "", file: null });
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [previewMap, setPreviewMap] = useState({});
  const [myPeerFeedback, setMyPeerFeedback] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [peersOpen, setPeersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const beforeDeadline = useMemo(() => {
    if (!assignment?.deadline) return false;
    return new Date(assignment.deadline) > new Date();
  }, [assignment]);

  const loadAssignment = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: classrooms } = await api.get("/classrooms");
      let found = null;
      for (const classroom of classrooms) {
        const { data: items } = await api.get("/assignments", { params: { classroom_id: classroom.id } });
        found = items.find((item) => String(item.id) === String(assignmentId));
        if (found) break;
      }
      if (!found) throw new Error("not-found");
      setAssignment(found);

      const { data: mine } = await api.get("/submissions/me");
      const latest = mine
        .filter((item) => String(item.assignment_id) === String(assignmentId))
        .sort((a, b) => (b.attempt_number || 0) - (a.attempt_number || 0))[0];
      setMySubmission(latest || null);
      const { data: myPeerData } = await api.get(`/submissions/my-peer-feedback/${assignmentId}`);
      setMyPeerFeedback(myPeerData || []);
      const { data: status } = await api.get(`/submissions/assignment/${assignmentId}/peer-status`);
      setPeerStatus(status);
    } catch {
      setError("Unable to load assignment details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignment();
  }, [assignmentId]);

  const loadHistory = async () => {
    setHistoryOpen((prev) => !prev);
    if (history.length) return;
    try {
      const { data } = await api.get(`/submissions/history/${assignmentId}`);
      setHistory(data);
    } catch {
      setError("Could not load attempt history.");
    }
  };

  const loadPeerSubmissions = async () => {
    setPeersOpen((prev) => !prev);
    try {
      const { data } = await api.get(`/submissions/assignment/${assignmentId}`);
      setPeers(data);
      setPeerCount(data.length);
      const { data: status } = await api.get(`/submissions/assignment/${assignmentId}/peer-status`);
      setPeerStatus(status);
    } catch {
      setError("Could not load peer submissions.");
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

  const submitAssignment = async () => {
    setError("");
    setNotice("");
    const formData = new FormData();
    formData.append("assignment_id", assignmentId);
    if (draft.text?.trim()) formData.append("text_content", draft.text.trim());
    if (draft.file) formData.append("file", draft.file);
    try {
      const { data } = await api.post("/submissions", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setNotice(`Attempt ${data.attempt_number} submitted successfully.`);
      setDraft({ text: "", file: null });
      setHistory([]);
      await loadAssignment();
    } catch (err) {
      setError(err.response?.data?.detail || "Submission failed.");
    }
  };

  const submitPeerReview = async (submissionId) => {
    const review = reviewDrafts[submissionId] || { rating: 5, feedback: "" };
    try {
      await api.post(`/submissions/${submissionId}/peer-review`, {
        rating: Number(review.rating),
        feedback: review.feedback?.trim() || null,
      });
      setNotice("Anonymous rating saved.");
      const { data } = await api.get(`/submissions/assignment/${assignmentId}`);
      setPeers(data);
      setReviewDrafts((prev) => ({ ...prev, [submissionId]: { rating: 5, feedback: "" } }));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save rating.");
    }
  };

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Loading assignment page...</div>;

  return (
    <div className="space-y-6">
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Assignment Workspace</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">{assignment?.title || "Assignment"}</h1>
            <p className="mt-2 text-sm text-slate-600">{assignment?.topic} - Due {assignment?.deadline ? formatDate(assignment.deadline) : "-"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={beforeDeadline ? "cyan" : "amber"}>{beforeDeadline ? "Open" : "Closed"}</Pill>
            <Link to="/student" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">
              Back to dashboard
            </Link>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-700">{assignment?.description}</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Submit Work</p>
          <textarea
            value={draft.text}
            onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
            className="mt-3 h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
            placeholder="Write your answer, summary, or explanation..."
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
            onChange={(e) => setDraft((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
            className="mt-3 block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={submitAssignment}
              disabled={!beforeDeadline || (!draft.text?.trim() && !draft.file)}
              className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mySubmission ? "Resubmit assignment" : "Submit assignment"}
            </button>
            <button onClick={loadHistory} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700">
              {historyOpen ? "Hide attempts" : "My attempts"}
            </button>
            <button onClick={loadPeerSubmissions} className="rounded-full border border-cyan-300 bg-cyan-50 px-5 py-2.5 text-sm font-bold text-cyan-800">
              {peersOpen ? "Hide peer reviews" : `Anonymous peers${peerCount ? ` (${peerCount})` : ""}`}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Peer review unlocks when at least one other classmate submits this assignment.</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Submitted students: {peerStatus.submitted_students} / Enrolled students: {peerStatus.enrolled_students}
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Latest Feedback</p>
          {mySubmission ? (
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">Teacher feedback</p>
                <p className="mt-2 break-words leading-6">{mySubmission.final_feedback || "No final feedback yet."}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">AI suggestions</p>
                <p className="mt-2 break-words leading-6">{mySubmission.ai_suggestions || "No improvement notes yet."}</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Submit once to unlock score history and feedback tracking.</p>
          )}
        </div>
      </section>

      {historyOpen && (
        <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Attempt History</p>
          <div className="mt-4 space-y-3">
            {history.map((entry) => (
              <div key={entry.submission_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">Attempt #{entry.attempt_number}{entry.is_latest ? " - latest" : ""}</p>
                    <p className="text-xs text-slate-500">{formatDate(entry.submitted_at)}</p>
                  </div>
                  <Pill tone="slate">Score {entry.final_score ?? "-"}</Pill>
                </div>
                {entry.file_url && (
                  <button onClick={() => loadPreview(entry.submission_id)} className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">
                    Preview file
                  </button>
                )}
                <div className="mt-3">
                  <PreviewPane preview={previewMap[entry.submission_id]} />
                </div>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-slate-500">No attempts yet.</p>}
          </div>
        </section>
      )}

      {peersOpen && (
        <section className="rounded-[28px] border border-cyan-200 bg-cyan-50/60 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Anonymous Peer Review Space</p>
          <div className="mt-4 space-y-4">
            {peers.length === 0 && mySubmission && (
              <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-black text-slate-950">My review</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Self reflection</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{mySubmission.final_feedback || "No final feedback yet."}</p>
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Anonymous peer feedback</p>
                  {myPeerFeedback.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-bold text-slate-700">{review.rating} / 5</p>
                      <p className="mt-1 text-sm text-slate-700">{review.feedback || "No written feedback."}</p>
                    </div>
                  ))}
                  {myPeerFeedback.length === 0 && <p className="text-xs text-slate-500">No anonymous peer feedback yet.</p>}
                </div>
                <p className="mt-3 text-xs text-slate-500">Peer rating is enabled only for other students' submissions. Use this section to self-check your work.</p>
              </div>
            )}

            {peers.map((peer) => {
              const review = reviewDrafts[peer.id] || { rating: 5, feedback: "" };
              return (
                <div key={peer.id} className="rounded-[24px] border border-cyan-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-black text-slate-950">{peer.anonymous_label}</p>
                      <p className="mt-1 text-sm text-slate-600">Final score shown for learning: {peer.final_score ?? "-"}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{peer.final_feedback || "No feedback yet."}</p>
                    </div>
                    <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                      <p className="font-bold">Community rating</p>
                      <p className="mt-2">{peer.peer_rating_avg ?? "-"} / 5</p>
                      <p className="text-xs">{peer.peer_rating_count} anonymous reviews</p>
                    </div>
                  </div>

                  {peer.file_url && (
                    <button onClick={() => loadPreview(peer.id)} className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">
                      Preview peer file
                    </button>
                  )}
                  <div className="mt-3">
                    <PreviewPane preview={previewMap[peer.id]} />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_auto]">
                    <select
                      value={review.rating}
                      onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [peer.id]: { ...review, rating: e.target.value } }))}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-500"
                    >
                      <option value={5}>5 - Excellent</option>
                      <option value={4}>4 - Strong</option>
                      <option value={3}>3 - Good</option>
                      <option value={2}>2 - Needs work</option>
                      <option value={1}>1 - Very weak</option>
                    </select>
                    <input
                      value={review.feedback}
                      onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [peer.id]: { ...review, feedback: e.target.value } }))}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-500"
                      placeholder="Anonymous feedback for this classmate"
                    />
                    <button onClick={() => submitPeerReview(peer.id)} className="rounded-2xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white">
                      Save rating
                    </button>
                  </div>
                </div>
              );
            })}
            {peers.length === 0 && (
              <p className="text-sm text-slate-600">
                No other student submissions available yet. Ask classmates to submit first, then you can review anonymously.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
