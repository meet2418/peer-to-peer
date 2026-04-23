import { createContext, useContext, useEffect, useMemo, useState } from "react";

import api from "../services/api";

const TeacherClassroomContext = createContext(null);

export function TeacherClassroomProvider({ children }) {
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshClassrooms = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/classrooms");
      setClassrooms(data);
      setSelectedClassroomId((prev) => {
        if (!data.length) return "";
        if (prev && data.some((item) => String(item.id) === String(prev))) return prev;
        return String(data[0].id);
      });
    } catch {
      setClassrooms([]);
      setSelectedClassroomId("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshClassrooms();
  }, []);

  const value = useMemo(
    () => ({
      classrooms,
      selectedClassroomId,
      setSelectedClassroomId,
      refreshClassrooms,
      loading,
    }),
    [classrooms, selectedClassroomId, loading]
  );

  return <TeacherClassroomContext.Provider value={value}>{children}</TeacherClassroomContext.Provider>;
}

export function useTeacherClassrooms() {
  return useContext(TeacherClassroomContext);
}
