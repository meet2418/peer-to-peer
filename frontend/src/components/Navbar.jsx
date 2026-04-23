import { Link, useLocation } from "react-router-dom";

export default function Navbar({ auth, onLogout }) {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 shadow-[0_8px_26px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link to={auth.token ? `/${auth.role}` : "/"} className="flex min-w-0 items-center gap-3 text-lg font-extrabold tracking-tight text-slate-900">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,_#0891b2)] text-sm font-black text-white shadow-[0_12px_30px_rgba(8,145,178,0.25)]">
            CA
          </span>
          <span className="truncate">
            Classroom<span className="text-brand-600">AI</span>
          </span>
        </Link>

        {auth.token && (
          <div className="hidden rounded-full border border-cyan-200 bg-cyan-50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-cyan-800 md:block">
            {auth.role === "teacher" ? "Teacher Classroom" : "Student Classroom"}
          </div>
        )}

        <div className="flex items-center gap-3">
          {!auth.token && (
            <>
              <Link
                to="/login"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  location.pathname === "/login" ? "bg-brand-100 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                Login
              </Link>
              <Link
                to="/register"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  location.pathname === "/register"
                    ? "bg-orange-100 text-orange-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                Register
              </Link>
            </>
          )}

          {auth.token && (
            <>
              <span className="hidden rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 sm:block">
                {auth.name} ({auth.role})
              </span>
              <button
                onClick={onLogout}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
