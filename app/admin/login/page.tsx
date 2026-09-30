import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import SiteHeader from "../../../components/SiteHeader";

type AdminLoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function verifyPassword(
  submittedPassword: string,
) {
  const adminPassword =
    process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error(
      "ADMIN_PASSWORD is missing.",
    );
  }

  const submittedBuffer =
    Buffer.from(
      submittedPassword,
      "utf8",
    );

  const expectedBuffer =
    Buffer.from(
      adminPassword,
      "utf8",
    );

  if (
    submittedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    submittedBuffer,
    expectedBuffer,
  );
}

function createAdminSessionToken() {
  const sessionSecret =
    process.env
      .ADMIN_SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is missing.",
    );
  }

  return createHmac(
    "sha256",
    sessionSecret,
  )
    .update(
      "shadowwindow-admin-session",
    )
    .digest("hex");
}

async function loginAdmin(
  formData: FormData,
) {
  "use server";

  const password =
    String(
      formData.get(
        "password",
      ) ?? "",
    );

  if (
    !verifyPassword(
      password,
    )
  ) {
    redirect(
      "/admin/login?error=invalid",
    );
  }

  const cookieStore =
    await cookies();

  cookieStore.set(
    "shadowwindow_admin",
    createAdminSessionToken(),
    {
      httpOnly: true,

      secure:
        process.env
          .NODE_ENV ===
        "production",

      sameSite: "lax",

      path: "/",

      maxAge:
        60 *
        60 *
        8,
    },
  );

  redirect("/admin");
}

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const params =
    await searchParams;

  const hasError =
    params.error ===
    "invalid";

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="mx-auto flex w-full max-w-7xl justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-red-500">
            Restricted Access
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            ShadowWindow Admin
          </h1>

          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Sign in to access internal
            monitoring and ingestion
            intelligence.
          </p>

          <form
            action={loginAdmin}
            className="mt-8 border border-zinc-800 bg-zinc-950 p-5"
          >
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400"
            >
              Admin Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              autoFocus
              className="mt-2 w-full border border-zinc-700 bg-black px-3 py-2.5 text-sm text-white outline-none transition focus:border-zinc-500"
            />

            {hasError && (
              <p className="mt-3 text-sm font-medium text-red-400">
                Incorrect password.
              </p>
            )}

            <button
              type="submit"
              className="mt-5 w-full bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-zinc-200"
            >
              Sign In
            </button>
          </form>

          <p className="mt-4 text-xs leading-5 text-zinc-600">
            Internal access only.
            Monitoring-source information
            is not exposed on the public
            ShadowWindow pages.
          </p>
        </div>
      </section>
    </main>
  );
}