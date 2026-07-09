import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Save, ShieldCheck } from "lucide-react";

import { formatApiError, type ProfileUser } from "@/core/config/api";
import { useAuth } from "@/core/providers/auth-provider";
import {
  changePassword,
  profileQueries,
  updateUserProfile,
  uploadAvatar,
} from "@/features/profile/queries/queries";
import { profileKeys } from "@/features/profile/queries/keys";
import { PageHeaderV2 } from "@/shared/components/patterns/page-header-v2";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

function ProfileField({
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
      <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profileQuery = useQuery(profileQueries.me());
  const [draft, setDraft] = useState<ProfileUser | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ old: "", new1: "", new2: "" });
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const profile = draft ?? profileQuery.data ?? null;

  const saveMutation = useMutation({
    mutationFn: () =>
      updateUserProfile({
        first_name: profile!.first_name,
        last_name: profile!.last_name,
        email: profile!.email,
        phone: profile!.phone,
      }),
    onSuccess: async () => {
      setSavedAt(new Date());
      setDraft(null);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
    onError: (e) => setError(formatApiError(e, "Failed to save")),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: async () => {
      setDraft(null);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
    onError: (e) => setError(formatApiError(e, "Avatar upload failed")),
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      changePassword({
        old_password: passwords.old,
        new_password: passwords.new1,
        new_password2: passwords.new2,
      }),
    onSuccess: () => {
      setPasswordMsg("Password updated successfully.");
      setPasswords({ old: "", new1: "", new2: "" });
    },
    onError: (e) => setPasswordMsg(formatApiError(e, "Could not change password")),
  });

  const onChange = <K extends keyof ProfileUser>(key: K, value: ProfileUser[K]) => {
    const base = draft ?? profileQuery.data;
    if (!base) return;
    setDraft({ ...base, [key]: value });
  };

  if (profileQuery.isLoading || !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeaderV2
        title="Profile"
        description="Update your personal details, avatar and password."
      />

      {(error || profileQuery.error) && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          {error ?? formatApiError(profileQuery.error, "Failed to load profile")}
        </div>
      )}

      <section className="grid grid-cols-1 items-start gap-6 rounded-xl border border-border bg-card p-6 md:grid-cols-3">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-border">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl text-muted-foreground">
                {profile.first_name?.[0] ?? profile.username[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={avatarMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-4 w-4" /> Change photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) avatarMutation.mutate(file);
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {user?.role} · {profile.username}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
          <ProfileField
            label="First name"
            value={profile.first_name}
            onChange={(v) => onChange("first_name", v)}
          />
          <ProfileField
            label="Last name"
            value={profile.last_name}
            onChange={(v) => onChange("last_name", v)}
          />
          <ProfileField
            label="Email"
            type="email"
            value={profile.email}
            onChange={(v) => onChange("email", v)}
          />
          <ProfileField
            label="Phone"
            value={profile.phone}
            onChange={(v) => onChange("phone", v)}
          />
          <div className="mt-1 flex items-center justify-between sm:col-span-2">
            {savedAt ? (
              <p className="text-xs text-emerald-600">Saved {savedAt.toLocaleTimeString()}</p>
            ) : (
              <span />
            )}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <header className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Security</h2>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ProfileField
            label="Current password"
            type="password"
            value={passwords.old}
            onChange={(v) => setPasswords((p) => ({ ...p, old: v }))}
          />
          <ProfileField
            label="New password"
            type="password"
            value={passwords.new1}
            onChange={(v) => setPasswords((p) => ({ ...p, new1: v }))}
          />
          <ProfileField
            label="Confirm new password"
            type="password"
            value={passwords.new2}
            onChange={(v) => setPasswords((p) => ({ ...p, new2: v }))}
          />
        </div>
        <div className="flex items-center justify-between">
          {passwordMsg && <p className="text-xs text-muted-foreground">{passwordMsg}</p>}
          <Button
            onClick={() => passwordMutation.mutate()}
            disabled={passwordMutation.isPending}
          >
            Update password
          </Button>
        </div>
      </section>
    </div>
  );
}
