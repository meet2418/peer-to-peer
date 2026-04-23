import { useEffect, useMemo, useState } from "react";
import ModuleUpload from "../components/ModuleUpload";
import { useStudentClassrooms } from "../context/StudentClassroomContext";
import api, { resolveApiBaseUrl } from "../services/api";

// Helper to fetch classrooms for teacher/student
function useClassrooms() {
  const [classrooms, setClassrooms] = useState([]);
  useEffect(() => {
    api.get("/classrooms").then(({ data }) => setClassrooms(data)).catch(() => setClassrooms([]));
  }, []);
  return classrooms;
}


export default function ModulesPage({ role }) {
  const studentContext = useStudentClassrooms();
  const classrooms = useClassrooms();
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [modules, setModules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [previewMap, setPreviewMap] = useState({});
  const [activePreviewId, setActivePreviewId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isUnavailable, setIsUnavailable] = useState(false);

  const effectiveClassrooms = role === "student" ? studentContext?.classrooms || [] : classrooms;
  const effectiveSelectedClassroomId = role === "student" ? studentContext?.selectedClassroomId || "" : selectedClassroomId;

  const selectedClassroom = useMemo(
    () => effectiveClassrooms.find((classroom) => String(classroom.id) === String(effectiveSelectedClassroomId)) || null,
    [effectiveClassrooms, effectiveSelectedClassroomId]
  );

  useEffect(() => {
    if (role === "teacher" && !selectedClassroomId && classrooms.length) {
      setSelectedClassroomId(String(classrooms[0].id));
    }
  }, [role, classrooms, selectedClassroomId]);

  const loadModules = async (classroomId) => {
    setError("");
    if (!classroomId) return setModules([]);
    try {
      const { data } = await api.get(`/modules`, { params: { classroom_id: classroomId } });
      setModules(Array.isArray(data) ? data : []);
      setIsUnavailable(false);
    } catch (err) {
      setModules([]);
      setIsUnavailable(err.response?.status === 404);
      setError(err.response?.data?.detail || "Could not load modules for this classroom.");
    }
  };

  const loadAssignments = async (classroomId) => {
    if (!classroomId) return setAssignments([]);
    try {
      const { data } = await api.get("/assignments", { params: { classroom_id: classroomId } });
      setAssignments(Array.isArray(data) ? data : []);
    } catch {
      setAssignments([]);
    }
  };

  useEffect(() => {
    if (effectiveSelectedClassroomId) loadModules(effectiveSelectedClassroomId);
    else setModules([]);
  }, [effectiveSelectedClassroomId]);

  useEffect(() => {
    if (effectiveSelectedClassroomId) loadAssignments(effectiveSelectedClassroomId);
    else setAssignments([]);
  }, [effectiveSelectedClassroomId]);

  const loadPreview = async (moduleId) => {
    if (previewMap[moduleId]) {
      setActivePreviewId(moduleId);
      return;
    }
    try {
      const { data } = await api.get(`/modules/${moduleId}/preview`);
      setPreviewMap((prev) => ({ ...prev, [moduleId]: data }));
      setActivePreviewId(moduleId);
    } catch {
      setError("Could not preview this module.");
    }
  };

  const handleUpload = async (file) => {
    setError("");
    setNotice("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("classroom_id", effectiveSelectedClassroomId);
    try {
      await api.post("/modules/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setNotice("Module uploaded successfully.");
      setIsUnavailable(false);
      loadModules(effectiveSelectedClassroomId);
    } catch (err) {
      const detail = err.response?.data?.detail || "Upload failed.";
      setError(detail);
      throw err;
    }
  };

  const activePreview = activePreviewId ? previewMap[activePreviewId] : null;
  const activeModule = activePreviewId ? modules.find((item) => item.id === activePreviewId) : null;

  return (
    <div className="space-y-6">
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <section className={`overflow-hidden rounded-[32px] border border-slate-200 p-8 text-white shadow-[0_28px_70px_rgba(15,23,42,0.18)] ${role === "teacher" ? "bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.3),_transparent_32%),linear-gradient(135deg,#1f2937,#0f766e)]" : "bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.3),_transparent_32%),linear-gradient(135deg,#0f172a,#2563eb)]"}`}>
        <div className="grid gap-8 lg:grid-cols-[1.6fr_0.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-white/70">Module Library</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight">
              {role === "teacher" ? "Publish, organize, and share learning materials with more clarity." : "Browse your class modules in a cleaner, more focused study library."}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85">
              Each classroom gets its own resource space so students and teachers do not feel like they are in the same repeated page.
            </p>
          </div>
          <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">Current Classroom</p>
            {selectedClassroom ? (
              <div className="mt-4 space-y-2">
                <p className="text-2xl font-black">{selectedClassroom.name}</p>
                <p className="text-sm text-white/85">{selectedClassroom.subject}</p>
                <p className="text-xs text-white/70">{modules.length} resources visible</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/85">Select a classroom to open its library.</p>
            )}
          </div>
        </div>
      </section>

      {role === "teacher" && (
        <section className="rounded-[28px] border border-slate-200 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Context</p>
              <p className="mt-2 text-sm text-slate-600">Switch module collections by classroom.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-slate-700">Classroom</label>
              <select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-500"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.subject})</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Classroom Tasks</p>
            <p className="mt-2 text-sm text-slate-600">Assignments visible for this selected classroom only.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{assignments.length} tasks</div>
        </div>
        <div className="mt-5 space-y-3">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-bold text-slate-900">{assignment.title}</p>
              <p className="mt-1 text-sm text-slate-600">{assignment.topic}</p>
              <p className="mt-2 text-sm text-slate-700">{assignment.description}</p>
            </div>
          ))}
          {assignments.length === 0 && <p className="text-sm text-slate-500">No assignments for this classroom yet.</p>}
        </div>
      </section>

      {role === "teacher" && effectiveSelectedClassroomId && (
        <section className="rounded-[28px] border border-slate-200 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Publish Resource</p>
            <p className="mt-2 text-sm text-slate-600">Upload study notes, reference files, and teaching material for this classroom.</p>
          </div>
          <ModuleUpload onUpload={handleUpload} />
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Resource Shelf</p>
            <p className="mt-2 text-sm text-slate-600">
              {role === "teacher" ? "Your published modules and handouts for this classroom." : "Read material shared by your teacher for this classroom."}
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{modules.length} items</div>
        </div>

        {isUnavailable ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            The frontend is ready for a richer module library, but the backend `/modules` service is currently unavailable in this project. Once that endpoint is enabled, this page will automatically start showing live resources here.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((mod) => (
              <article key={mod.id} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,_#f8fafc)] p-5">
                <div className="flex h-full flex-col justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Module</p>
                    <h3 className="mt-3 text-lg font-black text-slate-950">{mod.name || mod.filename || "Module file"}</h3>
                    <p className="mt-2 text-sm text-slate-600">{selectedClassroom?.name || "Classroom resource"}</p>
                  </div>
                  {(mod.url || mod.file_url) ? (
                    <button
                      onClick={() => loadPreview(mod.id)}
                      className="inline-flex w-fit rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                    >
                      View in portal
                    </button>
                  ) : (
                    <span className="inline-flex w-fit rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500">File unavailable</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {!isUnavailable && modules.length === 0 && (
          <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No modules have been added for this classroom yet.
          </div>
        )}
      </section>

      {activePreview && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/60 p-3 sm:p-6" onClick={() => setActivePreviewId(null)}>
          <section className="w-full max-w-6xl rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.35)] sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">In-Portal Module Preview</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{activeModule?.name || "Resource preview"}</p>
              </div>
              <button onClick={() => setActivePreviewId(null)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">
                Close
              </button>
            </div>
            {activePreview.kind === "pdf" && activePreview.url && (
              <iframe src={`${resolveApiBaseUrl()}${activePreview.url}`} title="module-preview-pdf" className="h-[75vh] w-full rounded-2xl border border-slate-200 bg-white" />
            )}
            {activePreview.kind === "image" && activePreview.url && (
              <img src={`${resolveApiBaseUrl()}${activePreview.url}`} alt="module-preview" className="max-h-[75vh] w-full rounded-2xl border border-slate-200 object-contain" />
            )}
            {activePreview.kind === "document" && activePreview.url && (
              <iframe src={`${resolveApiBaseUrl()}${activePreview.url}`} title="module-preview-doc" className="h-[75vh] w-full rounded-2xl border border-slate-200 bg-white" />
            )}
            {activePreview.kind === "text" && (
              <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">{activePreview.text}</pre>
            )}
            {activePreview.kind === "unsupported" && <p className="text-sm text-slate-600">{activePreview.text || "Preview unavailable."}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
