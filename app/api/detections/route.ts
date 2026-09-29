import { NextRequest, NextResponse } from "next/server";
import {
  DetectionType,
  getCloudPublicDetectionsPage,
} from "../../../lib/cloudDatabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams =
      request.nextUrl.searchParams;

    const type = searchParams.get("type");

    const limit = Number(
      searchParams.get("limit") ?? "8",
    );

    const offset = Number(
      searchParams.get("offset") ?? "0",
    );

    if (type !== "CAM" && type !== "WEB") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Detection type must be CAM or WEB.",
        },
        {
          status: 400,
        },
      );
    }

    const detectionType =
      type as DetectionType;

    const page =
      await getCloudPublicDetectionsPage({
        detectionType,
        limit,
        offset,
      });

    return NextResponse.json({
      success: true,
      ...page,
    });
  } catch (error) {
    console.error(
      "Detection pagination failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load detections.",
      },
      {
        status: 500,
      },
    );
  }
}