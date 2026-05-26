import { useEffect, useRef, useState } from "react";
import { Camera, Save, ShieldCheck } from "lucide-react";

import { apiClient, type ProfileUser } from "../core/config/api";
import { useAuth } from "../core/providers/auth-provider";

export function Profile() {
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ old: "", new1: "", new2: "" });
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    apiClient
      .getProfile()
      .then(setProfile)
      .catch((e) => setError(e?.detail?.() ?? e?.message ?? "Failed to load profile"));
  }, []);

  const onChange = <K extends keyof ProfileUser>(key: K, value: ProfileUser[K]) => {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateProfile({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        phone: profile.phone,
        institution: profile.institution,
        student_id: profile.student_id,
      });
      setSavedAt(new Date());
      await refresh();
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onAvatar = async (file: File) => {
    setError(null);
    try {
      const updated = await apiClient.uploadAvatar(file);
      setProfile(updated);
      await refresh();
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Avatar upload failed");
    }
  };

  const submitPassword = async () => {
    setPasswordMsg(null);
    try {
      await apiClient.changePassword({
        old_password: passwords.old,
        new_password: passwords.new1,
        new_password2: passwords.new2,
      });
      setPasswordMsg("Password updated successfully.");
      setPasswords({ old: "", new1: "", new2: "" });
    } catch (e: any) {
      setPasswordMsg(e?.detail?.() ?? e?.message ?? "Could not change password");
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl space-y-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-1">Profile</h1>
        <p className="text-muted-foreground">
          Update your personal details, avatar and password.
        </p>

        {error && (
          <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 text-sm">
            {error}
          </div>
        )}

        <section className="bg-card border border-border rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="flex flex-col items-center text-center">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-muted ring-2 ring-border flex items-center justify-center">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl text-muted-foreground">
                  {profile.first_name?.[0] ?? profile.username[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-accent"
            >
              <Camera className="w-4 h-4" /> Change photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAvatar(f);
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {user?.role} · {profile.username}
            </p>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First name" value={profile.first_name} onChange={(v) => onChange("first_name", v)} />
            <Field label="Last name" value={profile.last_name} onChange={(v) => onChange("last_name", v)} />
            <Field label="Email" value={profile.email} type="email" onChange={(v) => onChange("email", v)} />
            <Field label="Phone" value={profile.phone} onChange={(v) => onChange("phone", v)} />
            <Field label="Institution" value={profile.institution} onChange={(v) => onChange("institution", v)} />
            <Field label="Student ID" value={profile.student_id} onChange={(v) => onChange("student_id", v)} />

            <div className="sm:col-span-2 flex items-center justify-between mt-1">
              {savedAt ? (
                <p className="text-xs text-emerald-600">
                  Saved {savedAt.toLocaleTimeString()}
                </p>
              ) : (
                <span />
              )}
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <header className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Security</h2>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field
              label="Current password"
              type="password"
              value={passwords.old}
              onChange={(v) => setPasswords((p) => ({ ...p, old: v }))}
            />
            <Field
              label="New password"
              type="password"
              value={passwords.new1}
              onChange={(v) => setPasswords((p) => ({ ...p, new1: v }))}
            />
            <Field
              label="Confirm new password"
              type="password"
              value={passwords.new2}
              onChange={(v) => setPasswords((p) => ({ ...p, new2: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            {passwordMsg && (
              <p className="text-xs text-muted-foreground">{passwordMsg}</p>
            )}
            <button
              onClick={submitPassword}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Update password
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}
