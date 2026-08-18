import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Save, ShieldCheck } from "@/shared/icons";

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
      <span className="mb-1.5 block font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
        eyebrow="Account"
        title="Profile"
        description="Update your personal details, avatar and password."
      />

      {(error || profileQuery.error) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error ?? formatApiError(profileQuery.error, "Failed to load profile")}
        </div>
      )}

      <section className="surface-panel grid grid-cols-1 items-start gap-6 overflow-hidden md:grid-cols-3">
        {/* Identity card */}
        <div className="relative flex h-full flex-col items-center justify-center border-b border-border/70 bg-muted/25 p-6 text-center md:border-b-0 md:border-r">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(color-mix(in srgb, var(--primary) 10%, transparent) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
            aria-hidden
          />
          <div className="relative">
            <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-gold/50 bg-card shadow-[0_0_0_5px_var(--card),0_0_0_6px_var(--border)]">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif text-4xl font-semibold text-primary">
                  {(profile.first_name?.[0] ?? profile.username[0] ?? "?").toUpperCase()}
                </span>
              )}
            </div>
            <p className="mt-4 font-serif text-lg font-semibold leading-tight tracking-tight">
              {[profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
                profile.username}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-primary">
              {user?.role} · {profile.username}
            </p>
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={avatarMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" /> Change photo
              </Button>
            </div>
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
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 md:col-span-2">
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
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-status-safe">
                Saved {savedAt.toLocaleTimeString()}
              </p>
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

      <section className="surface-panel space-y-4 p-6">
        <header>
          <p className="kicker">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Security
          </p>
          <h2 className="mt-1.5 font-serif text-lg font-semibold tracking-tight">
            Change password
          </h2>
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
