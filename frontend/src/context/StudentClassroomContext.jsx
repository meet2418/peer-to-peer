import { createContext, useContext, useEffect, useMemo, useState } from "react";

import api from "../services/api";

const StudentClassroomContext = createContext(null);

export function StudentClassroomProvider({ children }) {
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

  return <StudentClassroomContext.Provider value={value}>{children}</StudentClassroomContext.Provider>;
}

export function useStudentClassrooms() {
  return useContext(StudentClassroomContext);
}
