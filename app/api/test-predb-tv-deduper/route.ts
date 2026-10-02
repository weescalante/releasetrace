import {
  NextResponse,
} from "next/server";

import {
  getPredbTvReleases,
} from "../../../data/predb";

import {
  dedupePredbTvReleases,
} from "../../../lib/predbTvDeduper";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    const releases =
      await getPredbTvReleases();

    const events =
      dedupePredbTvReleases(
        releases,
      );

    const collapsedCount =
      releases.length -
      events.length;

    const duplicateEvents =
      events.filter(
        (
          event,
        ) =>
          event.variantCount >
          1,
      );

    const seasonEpisodeEvents =
      events.filter(
        (
          event,
        ) =>
          event.parsed
            .seasonNumber !==
            null &&
          event.parsed
            .episodeNumber !==
            null,
      );

    const datedEvents =
      events.filter(
        (
          event,
        ) =>
          event.parsed
            .episodeAirDate !==
          null,
      );

    const unknownEvents =
      events.filter(
        (
          event,
        ) =>
          event.release
            .sourcePage ===
          "UNKNOWN",
      );

    function summarizeEvent(
      event:
        (typeof events)[number],
    ) {
      return {
        eventKey:
          event.eventKey,

        seriesTitle:
          event.parsed
            .seriesTitle,

        titleCandidates:
          event.parsed
            .titleCandidates,

        seasonNumber:
          event.parsed
            .seasonNumber,

        episodeNumber:
          event.parsed
            .episodeNumber,

        episodeAirDate:
          event.parsed
            .episodeAirDate,

        apparentYear:
          event.parsed
            .apparentYear,

        sourcePage:
          event.release
            .sourcePage ??
          "UNKNOWN",

        signal:
          event.release
            .signal,

        quality:
          event.release
            .quality,

        firstSeen:
          event.release
            .publishedAt,

        canonicalReleaseName:
          event.release
            .releaseName,

        canonicalPostId:
          event.release
            .postId,

        variantCount:
          event.variantCount,

        variants:
          event.variants.map(
            (
              variant,
            ) => ({
              postId:
                variant.postId,

              releaseName:
                variant.releaseName,

              quality:
                variant.quality,

              publishedAt:
                variant.publishedAt,

              sourcePage:
                variant.sourcePage ??
                "UNKNOWN",
            }),
          ),
      };
    }

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      tmdbRequests:
        0,

      summary: {
        rawTvCandidates:
          releases.length,

        uniqueTvEvents:
          events.length,

        variantsCollapsed:
          collapsedCount,

        eventsWithMultipleVariants:
          duplicateEvents.length,

        seasonEpisodeEvents:
          seasonEpisodeEvents.length,

        datedEpisodeEvents:
          datedEvents.length,

        unknownSourceEvents:
          unknownEvents.length,
      },

      duplicateExamples:
        duplicateEvents
          .slice(
            0,
            20,
          )
          .map(
            summarizeEvent,
          ),

      latestUniqueEvents:
        events
          .slice(
            0,
            30,
          )
          .map(
            summarizeEvent,
          ),

      datedEpisodeExamples:
        datedEvents
          .slice(
            0,
            15,
          )
          .map(
            summarizeEvent,
          ),

      unknownExamples:
        unknownEvents
          .slice(
            0,
            15,
          )
          .map(
            summarizeEvent,
          ),
    });
  } catch (error) {
    console.error(
      "PreDB TV deduper test failed:",
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        databaseChanges:
          false,

        tmdbRequests:
          0,

        message:
          error instanceof
          Error
            ? error.message
            : "Unknown PreDB TV deduper test error.",
      },
      {
        status:
          500,
      },
    );
  }
}