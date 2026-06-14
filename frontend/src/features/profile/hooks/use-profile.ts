import { useCallback, useEffect, useState } from "react";
import { ApiError, type ProfileUser } from "../../../core/config/api";
import {
  fetchUserProfile,
  updateUserProfile,
  uploadAvatar,
} from "../api/profile-api";

/**
 * Profile feature hook: load + mutate the current user's profile and avatar
 * (Objective: profile management UI).
 */
export function useProfile() {
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await fetchUserProfile());
    } catch (e) {
      setError(e instanceof ApiError ? e.detail() : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(async (patch: Partial<ProfileUser>) => {
    const res = await updateUserProfile(patch);
    setProfile(res.user);
    return res.user;
  }, []);

  const changeAvatar = useCallback(async (file: File) => {
    const updated = await uploadAvatar(file);
    setProfile(updated);
    return updated;
  }, []);

  return { profile, loading, error, reload, save, changeAvatar };
}
