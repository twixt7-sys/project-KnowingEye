import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from "@/shared/icons";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";

import { formatApiError } from "@/core/config/api";
import { brand } from "@/core/config/brand";
import { useAuth } from "@/core/providers/auth-provider";
import {
  type LoginFormValues,
  type RegisterFormValues,
  loginSchema,
  registerSchema,
} from "@/features/auth/schemas/login-schemas";
import { ProfilePhotoInput } from "@/shared/components/common/profile-photo-input";
import { DepartmentLogo, InstitutionLogo, Logo } from "@/shared/components/layout/logo";
import { Button } from "@/shared/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const from = location.state?.from?.pathname || "/";

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const isSubmitting = isLogin
    ? loginForm.formState.isSubmitting
    : registerForm.formState.isSubmitting;

  const goHome = (
    signedInRole: "ADMIN" | "GUIDANCE_STAFF" | "PROGRAM_HEAD" | "FACULTY" | "PROCTOR" | "STUDENT",
  ) => {
    if (from !== "/" && from !== "/login") {
      navigate(from, { replace: true });
    } else if (signedInRole === "STUDENT") {
      navigate("/examinee", { replace: true });
    } else {
      navigate("/examiner", { replace: true });
    }
  };

  const onLogin = async (values: LoginFormValues) => {
    setSubmitError("");
    try {
      const user = await login(values.username, values.password);
      goHome(user.role);
    } catch (err: unknown) {
      setSubmitError(formatApiError(err, "An error occurred"));
    }
  };

  const onRegister = async (values: RegisterFormValues) => {
    setSubmitError("");
    try {
      const user = await register({
        username: values.username,
        email: values.email,
        password: values.password,
        password2: values.confirmPassword,
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        avatar: profilePhoto,
      });
      goHome(user.role);
    } catch (err: unknown) {
      setSubmitError(formatApiError(err, "An error occurred"));
    }
  };

  const switchMode = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setSubmitError("");
    loginForm.reset();
    registerForm.reset();
    setProfilePhoto(null);
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel — visible on large screens only */}
      <div className="relative hidden w-[42%] max-w-xl flex-col justify-between overflow-hidden bg-[var(--lcc-green)] p-10 text-[var(--lcc-white)] lg:flex xl:p-14">
        <Logo
          className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 opacity-[0.07]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(247,245,234,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <div>
            <p className="font-serif text-lg font-semibold tracking-tight">{brand.appName}</p>
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] opacity-70">
              {brand.tagline}
            </p>
          </div>
        </div>

        <div className="relative">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] opacity-70">
            {brand.institutionName}
          </p>
          <h2 className="mt-4 max-w-sm font-serif text-3xl font-medium leading-snug tracking-tight xl:text-4xl">
            Every examination, observed with fairness.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed opacity-80">
            Secure sign-in for examiners and examinees. Sessions are proctored to protect academic
            integrity.
          </p>
        </div>

        <div className="relative flex items-center gap-3 border-t border-white/15 pt-6">
          <div className="flex items-center gap-2">
            <InstitutionLogo className="h-10 w-10 rounded-md border border-white/20 bg-white/10 p-1" />
            <DepartmentLogo className="h-10 w-10 rounded-md border border-white/20 bg-white/90 p-1" />
          </div>
          <p className="font-mono text-[0.6875rem] leading-relaxed tracking-[0.06em] opacity-70">
            {brand.institutionName}
            <span className="block opacity-80">{brand.departmentName}</span>
          </p>
        </div>
      </div>

      {/* Form column */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <Logo className="h-10 w-10 text-primary" />
              <InstitutionLogo className="h-10 w-10 rounded-md border border-border bg-card p-1" />
              <DepartmentLogo className="h-10 w-10 rounded-md border border-border bg-card p-1" />
            </div>
            <p className="kicker mb-2">{brand.departmentName}</p>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin
                ? `Sign in to continue to ${brand.appName}.`
                : `Register to start using ${brand.appName}.`}
            </p>
          </div>

          <div
            className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/70 p-1"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isLogin}
              onClick={() => switchMode(true)}
              className={`rounded-md px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.1em] transition-colors ${
                isLogin
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isLogin}
              onClick={() => switchMode(false)}
              className={`rounded-md px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.1em] transition-colors ${
                !isLogin
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Register
            </button>
          </div>

          <div className="surface-panel p-8">
            {isLogin ? (
              <Form {...loginForm} key="login">
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-11" placeholder="Enter your username" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              className="pl-11 pr-12"
                              placeholder="Enter your password"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {submitError && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <span className="text-sm">{submitError}</span>
                    </div>
                  )}
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...registerForm} key="register">
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={registerForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            First name <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Your first name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Last name <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Your last name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <ProfilePhotoInput
                    value={profilePhoto}
                    onChange={setProfilePhoto}
                    disabled={isSubmitting}
                  />
                  <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-11" placeholder="Enter your username" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter your email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              className="pl-11 pr-12"
                              placeholder="Enter your password"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              className="pl-11"
                              placeholder="Confirm your password"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {submitError && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <span className="text-sm">{submitError}</span>
                    </div>
                  )}
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </Form>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
