import { useState } from "react";

export default function ModuleUpload({ onUpload }) {
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotice("");
    setError("");
    if (!file) {
      setError("Please select a file.");
      return;
    }
    try {
      await onUpload(file);
      setNotice("File uploaded successfully.");
      setFile(null);
    } catch (err) {
      setError("Upload failed.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <input
        type="file"
        onChange={handleFileChange}
        className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold"
      />
      <button type="submit" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">Upload module</button>
      {notice && <div className="md:col-span-2 text-sm font-semibold text-emerald-700">{notice}</div>}
      {error && <div className="md:col-span-2 text-sm font-semibold text-rose-700">{error}</div>}
    </form>
  );
}
