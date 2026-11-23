import { Alert, Typography } from "@nemo-ui/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@peopleops/validators";
import { useState } from "react";
import { useAuth } from "./auth-context";
import { ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { FormInput } from "../../components/form-input";
import illustration from "../../assets/auth/login-illustration.png";

interface LocationState {
  from?: string;
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.6" />
      {open ? (
        <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2" aria-label="PeopleOps">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--nemo-primary-500)] text-base font-bold text-white">
        P
      </span>
      <span className="text-2xl font-semibold tracking-tight text-[var(--nemo-neutral-900)]">
        People<span className="text-[var(--nemo-primary-600)]">Ops</span>
      </span>
    </div>
  );
}

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  const state = (location.state as LocationState | null) ?? null;

  async function onSubmit(values: LoginInput) {
    try {
      await login(values.email, values.password);
      navigate(state?.from ?? "/", { replace: true });
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.message
          : "Unable to sign in right now. Please try again.";
      setError("root", { message });
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#fdf1eb] lg:block">
        <img
          src={illustration}
          alt=""
          className="h-full w-full object-cover object-center"
          aria-hidden="true"
        />
      </div>

      <div className="flex min-h-screen min-w-0 flex-col px-6 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-[440px] min-w-0 flex-1 flex-col justify-center py-10">
          <div className="flex flex-col gap-10">
            <div className="flex justify-center">
              <Brand />
            </div>

            <div className="flex flex-col gap-2">
              <Typography variant="h3" as="h1" className="text-[28px] leading-tight">
                Sign In
              </Typography>
              <Typography variant="bodySmall" color="neutral">
                Please enter your details to sign in
              </Typography>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="flex flex-col gap-[18px]">
                {errors.root?.message ? (
                  <Alert tone="error" title="Sign in failed">
                    {errors.root.message}
                  </Alert>
                ) : null}

                <FormInput
                  control={control}
                  name="email"
                  label="Email Address"
                  aria-label="Email"
                  type="email"
                  autoComplete="username"
                  fullWidth
                  required
                />
                <FormInput
                  control={control}
                  name="password"
                  label="Password"
                  aria-label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  rightIcon={<EyeIcon open={showPassword} />}
                  rightIconAction={() => setShowPassword((current) => !current)}
                  fullWidth
                  required
                />

                <LoadingButton type="submit" className="w-full" loading={isSubmitting}>
                  Sign in
                </LoadingButton>
              </div>
            </form>

            <Typography variant="caption" color="neutral" align="center">
              Need access? Contact your HR administrator to get an account.
            </Typography>
          </div>
        </div>

        <Typography variant="caption" color="neutral" align="center">
          © {new Date().getFullYear()} PeopleOps. All rights reserved.
        </Typography>
      </div>
    </main>
  );
}
