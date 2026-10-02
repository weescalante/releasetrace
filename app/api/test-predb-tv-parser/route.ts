import {
  NextResponse,
} from "next/server";

import {
  getPredbTvReleases,
} from "../../../data/predb";

import {
  parsePredbTvRelease,
} from "../../../lib/predbTvParser";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    /*
     * This fetches the current TV candidates
     * from:
     *
     * - PreDB TV
     * - relevant TV-looking releases from
     *   PreDB Unknown
     *
     * Nothing is written to Turso.
     */
    const releases =
      await getPredbTvReleases();

    const parsed =
      releases.map(
        (
          release,
        ) => {
          const tv =
            parsePredbTvRelease(
              release.releaseName,
            );

          return {
            postId:
              release.postId,

            sourcePage:
              release.sourcePage ??
              "UNKNOWN",

            releaseName:
              release.releaseName,

            signal:
              release.signal,

            quality:
              release.quality,

            preTime:
              release.publishedAt,

            sourceUrl:
              release.sourceUrl,

            parsed: {
              seriesTitle:
                tv.seriesTitle,

              titleCandidates:
                tv.titleCandidates,

              seasonNumber:
                tv.seasonNumber,

              episodeNumber:
                tv.episodeNumber,

              episodeAirDate:
                tv.episodeAirDate,

              apparentYear:
                tv.apparentYear,

              isEpisode:
                tv.isEpisode,

              isSeasonPack:
                tv.isSeasonPack,
            },
          };
        },
      );

    const withSeasonEpisode =
      parsed.filter(
        (
          item,
        ) =>
          item.parsed
            .seasonNumber !==
            null &&
          item.parsed
            .episodeNumber !==
            null,
      );

    const withAirDate =
      parsed.filter(
        (
          item,
        ) =>
          item.parsed
            .episodeAirDate !==
          null,
      );

    const seasonPacks =
      parsed.filter(
        (
          item,
        ) =>
          item.parsed
            .isSeasonPack,
      );

    const unknownSource =
      parsed.filter(
        (
          item,
        ) =>
          item.sourcePage ===
          "UNKNOWN",
      );

    const emptyTitles =
      parsed.filter(
        (
          item,
        ) =>
          !item.parsed
            .seriesTitle,
      );

    return NextResponse.json({
      success:
        true,

      databaseChanges:
        false,

      summary: {
        totalTvCandidates:
          parsed.length,

        fromUnknown:
          unknownSource.length,

        withSeasonEpisode:
          withSeasonEpisode.length,

        withAirDate:
          withAirDate.length,

        seasonPacks:
          seasonPacks.length,

        emptyTitles:
          emptyTitles.length,
      },

      latest: parsed.slice(
        0,
        30,
      ),

      seasonEpisodeExamples:
        withSeasonEpisode.slice(
          0,
          15,
        ),

      datedEpisodeExamples:
        withAirDate.slice(
          0,
          15,
        ),

      unknownExamples:
        unknownSource.slice(
          0,
          15,
        ),

      seasonPackExamples:
        seasonPacks.slice(
          0,
          10,
        ),

      parsingProblems:
        emptyTitles,
    });
  } catch (error) {
    console.error(
      "PreDB TV parser test failed:",
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
            : "Unknown PreDB TV parser test error.",
      },
      {
        status:
          500,
      },
    );
  }
}