import {
  NextResponse,
} from "next/server";

import {
  verifyTvMatchWithAI,
} from "../../../lib/aiTvMatchVerifier";

import type {
  AiTvMatchVerificationInput,
} from "../../../lib/aiTvMatchVerifier";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

export async function POST(
  request: Request,
) {
  try {
    const input =
      await request.json() as
        AiTvMatchVerificationInput;

    const verification =
      await verifyTvMatchWithAI(
        input,
      );

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      verification,
    });
  } catch (error) {
    console.error(
      "TV AI verifier diagnostic failed:",
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        databaseChanges:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "Unknown TV AI verifier diagnostic error.",
      },
      {
        status:
          500,
      },
    );
  }
}