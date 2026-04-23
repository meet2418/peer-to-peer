import { NavLink } from "react-router-dom";

import { useStudentClassrooms } from "../context/StudentClassroomContext";
import { useTeacherClassrooms } from "../context/TeacherClassroomContext";

export default function Sidebar({ role }) {
  const studentContext = useStudentClassrooms();
  const teacherContext = useTeacherClassrooms();
  const classrooms = role === "student" ? studentContext?.classrooms || [] : teacherContext?.classrooms || [];
  const selectedClassroomId = role === "student" ? studentContext?.selectedClassroomId || "" : teacherContext?.selectedClassroomId || "";
  const setSelectedClassroomId = role === "student" ? studentContext?.setSelectedClassroomId : teacherContext?.setSelectedClassroomId;

  if (role === "student" && classrooms.length === 0) {
    return null;
  }

  return (
    <aside className={`w-full border-b border-slate-200/70 bg-white/85 px-4 py-4 backdrop-blur lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5 lg:py-6 ${role === "student" ? "lg:w-[320px]" : "lg:w-[320px]"}`}>
      <div className={`hidden rounded-[28px] border p-5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.14)] lg:block ${role === "teacher" ? "border-violet-300/40 bg-[radial-gradient(circle_at_top_left,_rgba(196,181,253,0.35),_transparent_42%),linear-gradient(135deg,#312e81,_#4338ca)]" : "border-cyan-300/40 bg-[radial-gradient(circle_at_top_left,_rgba(103,232,249,0.35),_transparent_42%),linear-gradient(135deg,#0f766e,_#155e75)]"}`}>
        <p className="text-xs font-bold uppercase tracking-[0.26em] text-white/60">{role === "teacher" ? "Teacher Area" : "Student Area"}</p>
        <p className="mt-3 text-2xl font-black">{role === "teacher" ? "Control Panel" : "Learning Hub"}</p>
        <p className="mt-2 text-sm text-white/75">
          {role === "teacher" ? "Run classes, publish work, and review submissions." : "Track coursework, modules, and anonymous peer learning."}
        </p>
      </div>

      <nav className="flex gap-2 overflow-x-auto lg:mt-6 lg:flex-col lg:overflow-visible">
        <NavLink
          to={role === "teacher" ? "/teacher" : "/student"}
          className={({ isActive }) =>
            `whitespace-nowrap rounded-2xl px-4 py-3 font-semibold transition ${isActive ? "bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)]" : "text-slate-700 hover:bg-slate-100"}`
          }
        >
          {role === "teacher" ? "Teacher portal" : "Student portal"}
        </NavLink>
        <NavLink
          to={role === "teacher" ? "/teacher/modules" : "/student/modules"}
          className={({ isActive }) =>
            `whitespace-nowrap rounded-2xl px-4 py-3 font-semibold transition ${isActive ? "bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)]" : "text-slate-700 hover:bg-slate-100"}`
          }
        >
          Module library
        </NavLink>
        {role === "teacher" && (
          <NavLink
            to="/teacher/performance"
            className={({ isActive }) =>
              `whitespace-nowrap rounded-2xl px-4 py-3 font-semibold transition ${isActive ? "bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)]" : "text-slate-700 hover:bg-slate-100"}`
            }
          >
            Performance
          </NavLink>
        )}
      </nav>

      {(role === "student" || role === "teacher") && (
        <div className="mt-6">
          <div className="mb-3 px-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{role === "teacher" ? "Your Classrooms" : "My Classrooms"}</div>
          <div className="space-y-2">
            {classrooms.map((classroom) => {
              const active = String(classroom.id) === String(selectedClassroomId);
              return (
                <button
                  key={classroom.id}
                  onClick={() => setSelectedClassroomId?.(String(classroom.id))}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-cyan-300 bg-cyan-50 shadow-[0_10px_24px_rgba(8,145,178,0.12)]"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <p className="font-bold text-slate-900">{classroom.name}</p>
                  {classroom.subject && <p className="mt-1 text-sm text-slate-600">{classroom.subject}</p>}
                  {role === "teacher" && classroom.join_code && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Join: {classroom.join_code}</p>}
                </button>
              );
            })}
            {classrooms.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">No classrooms yet.</p>}
          </div>
        </div>
      )}
    </aside>
  );
}
