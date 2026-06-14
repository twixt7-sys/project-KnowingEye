import { useCallback, useEffect, useState } from "react";
import { ApiError, type Exam } from "../../../core/config/api";
import { fetchExams } from "../api/exam-api";

interface UseExamsParams {
  status?: string;
  search?: string;
}

export function useExams(params?: UseExamsParams) {
  const [items, setItems] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchExams(params));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail() : "Failed to load exams");
    } finally {
      setLoading(false);
    }
  }, [params?.status, params?.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, loading, error, reload };
}
