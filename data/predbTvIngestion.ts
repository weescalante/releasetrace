import {
  getPredbTvReleases,
} from "./predb";

import {
  dedupePredbTvReleases,
} from "../lib/predbTvDeduper";

import {
  matchTvSource,
} from "../lib/tvMatchEngine";

import {
  savePredbTvFirstSeenDetection,
} from "../lib/predbTvDetectionStore";

const PREDB_SOURCE =
  "PreDB";

export type PredbTvIngestionSummary = {
  rawPosts:
    number;

  uniqueEvents:
    number;

  matched:
    number;

  inserted:
    number;

  earlierUpdated:
    number;

  alreadyTracked:
    number;

  review:
    number;

  unmatched:
    number;

  skipped:
    number;

  invalidIdentity:
    number;

  errors:
    number;

  databaseChanges:
    boolean;
};

export type PredbTvIngestionItemStatus =
  | "DRY_RUN_MATCHED"
  | "INSERTED"
  | "EARLIER_UPDATED"
  | "ALREADY_TRACKED"
  | "REVIEW"
  | "UNMATCHED"
  | "SKIPPED"
  | "INVALID_IDENTITY"
  | "ERROR";

export type PredbTvIngestionItem = {
  eventKey:
    string;

  title:
    string;

  releaseName:
    string;

  postId:
    string;

  publishedAt:
    string;

  status:
    PredbTvIngestionItemStatus;

  tmdbId:
    number | null;

  tmdbTitle:
    string | null;

  seasonNumber:
    number | null;

  episodeNumber:
    number | null;

  episodeTitle:
    string | null;

  episodeAirDate:
    string | null;

  details:
    string | null;
};

export type PredbTvIngestionResult = {
  success:
    boolean;

  summary:
    PredbTvIngestionSummary;

  items:
    PredbTvIngestionItem[];
};

function hasValidTimestamp(
  value:
    string,
) {
  const timestamp =
    new Date(
      value,
    ).getTime();

  return !Number.isNaN(
    timestamp,
  );
}

function isValidDateOnly(
  value:
    string | null,
) {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    value,
  );
}

function hasValidEpisodeIdentity({
  seasonNumber,

  episodeNumber,

  episodeAirDate,
}: {
  seasonNumber:
    number | null;

  episodeNumber:
    number | null;

  episodeAirDate:
    string | null;
}) {
  const hasSeason =
    seasonNumber !==
    null;

  const hasEpisode =
    episodeNumber !==
    null;

  /*
   * A partial SxxExx identity is invalid.
   */
  if (
    hasSeason !==
    hasEpisode
  ) {
    return false;
  }

  if (
    hasSeason &&
    hasEpisode
  ) {
    return (
      Number.isInteger(
        seasonNumber,
      ) &&
      Number.isInteger(
        episodeNumber,
      ) &&
      (
        seasonNumber ??
        -1
      ) >=
        0 &&
      (
        episodeNumber ??
        -1
      ) >=
        0
    );
  }

  /*
   * Date-formatted television releases such
   * as:
   *
   * Fair.City.2026.09.29
   *
   * can use the verified episode air date as
   * their logical identity when no SxxExx
   * number exists.
   */
  return isValidDateOnly(
    episodeAirDate,
  );
}

export async function ingestPredbTv({
  write = false,
}: {
  write?:
    boolean;
} = {}): Promise<
  PredbTvIngestionResult
> {
  const rawReleases =
    await getPredbTvReleases();

  /*
   * Collapse multiple encodes of the same
   * logical television episode before TMDB
   * matching or persistence.
   */
  const events =
    dedupePredbTvReleases(
      rawReleases,
    );

  const summary:
    PredbTvIngestionSummary = {
      rawPosts:
        rawReleases.length,

      uniqueEvents:
        events.length,

      matched:
        0,

      inserted:
        0,

      earlierUpdated:
        0,

      alreadyTracked:
        0,

      review:
        0,

      unmatched:
        0,

      skipped:
        0,

      invalidIdentity:
        0,

      errors:
        0,

      databaseChanges:
        write,
    };

  const items:
    PredbTvIngestionItem[] =
    [];

  console.log(
    `PreDB TV raw posts: ${rawReleases.length}`,
  );

  console.log(
    `PreDB TV unique episode events: ${events.length}`,
  );

  console.log(
    `PreDB TV write mode: ${write}`,
  );

  /*
   * Keep the first production implementation
   * deliberately sequential.
   *
   * Correct episode identity and first-seen
   * persistence are more important than
   * maximizing throughput.
   *
   * Once the production behavior is proven,
   * TMDB matching can be parallelized with a
   * bounded worker pool if necessary.
   */
  for (
    const event of
    events
  ) {
    const release =
      event.release;

    const parsed =
      event.parsed;

    try {
      /*
       * The TV pipeline currently supports
       * WEB episode availability only.
       */
      if (
        release.signal !==
        "WEB"
      ) {
        summary.skipped +=
          1;

        items.push({
          eventKey:
            event.eventKey,

          title:
            parsed.seriesTitle,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "SKIPPED",

          tmdbId:
            null,

          tmdbTitle:
            null,

          seasonNumber:
            parsed.seasonNumber,

          episodeNumber:
            parsed.episodeNumber,

          episodeTitle:
            null,

          episodeAirDate:
            parsed.episodeAirDate,

          details:
            `Unsupported TV detection signal: ${release.signal}.`,
        });

        continue;
      }

      if (
        !hasValidTimestamp(
          release.publishedAt,
        )
      ) {
        summary.skipped +=
          1;

        items.push({
          eventKey:
            event.eventKey,

          title:
            parsed.seriesTitle,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "SKIPPED",

          tmdbId:
            null,

          tmdbTitle:
            null,

          seasonNumber:
            parsed.seasonNumber,

          episodeNumber:
            parsed.episodeNumber,

          episodeTitle:
            null,

          episodeAirDate:
            parsed.episodeAirDate,

          details:
            "PreDB TV item has no valid publication timestamp.",
        });

        continue;
      }

      /*
       * Season packs require a different
       * persistence identity from individual
       * episodes.
       *
       * Do not pretend a season pack is an
       * episode detection until that model is
       * explicitly designed.
       */
      if (
        parsed.isSeasonPack
      ) {
        summary.skipped +=
          1;

        items.push({
          eventKey:
            event.eventKey,

          title:
            parsed.seriesTitle,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "SKIPPED",

          tmdbId:
            null,

          tmdbTitle:
            null,

          seasonNumber:
            parsed.seasonNumber,

          episodeNumber:
            parsed.episodeNumber,

          episodeTitle:
            null,

          episodeAirDate:
            parsed.episodeAirDate,

          details:
            "Season-pack persistence is not enabled. Individual episode identity is required.",
        });

        continue;
      }

      const match =
        await matchTvSource({
          seriesTitle:
            parsed.seriesTitle,

          titleCandidates:
            parsed.titleCandidates,

          apparentYear:
            parsed.apparentYear,

          seasonNumber:
            parsed.seasonNumber,

          episodeNumber:
            parsed.episodeNumber,

          episodeAirDate:
            parsed.episodeAirDate,

          /*
           * Required for the generic
           * split-series fallback.
           */
          detectedAt:
            release.publishedAt,
        });

      if (
        match.status ===
        "REVIEW"
      ) {
        summary.review +=
          1;

        /*
         * IMPORTANT:
         *
         * TV reviews are intentionally NOT
         * written to the existing movie
         * match_reviews table.
         *
         * We will add a media-type-aware TV
         * review workflow separately.
         */
        items.push({
          eventKey:
            event.eventKey,

          title:
            parsed.seriesTitle,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "REVIEW",

          tmdbId:
            match.tmdbId,

          tmdbTitle:
            match.tmdbTitle,

          seasonNumber:
            match.seasonNumber,

          episodeNumber:
            match.episodeNumber,

          episodeTitle:
            match.episodeTitle,

          episodeAirDate:
            match.episodeAirDate,

          details:
            match.details,
        });

        continue;
      }

      if (
        match.status ===
        "UNMATCHED"
      ) {
        summary.unmatched +=
          1;

        items.push({
          eventKey:
            event.eventKey,

          title:
            parsed.seriesTitle,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "UNMATCHED",

          tmdbId:
            null,

          tmdbTitle:
            null,

          seasonNumber:
            parsed.seasonNumber,

          episodeNumber:
            parsed.episodeNumber,

          episodeTitle:
            null,

          episodeAirDate:
            parsed.episodeAirDate,

          details:
            match.details,
        });

        continue;
      }

      /*
       * MATCHED must still contain a complete
       * verified TMDB identity.
       */
      if (
        match.tmdbId ===
          null ||
        match.tmdbTitle ===
          null
      ) {
        summary.invalidIdentity +=
          1;

        items.push({
          eventKey:
            event.eventKey,

          title:
            parsed.seriesTitle,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "INVALID_IDENTITY",

          tmdbId:
            match.tmdbId,

          tmdbTitle:
            match.tmdbTitle,

          seasonNumber:
            match.seasonNumber,

          episodeNumber:
            match.episodeNumber,

          episodeTitle:
            match.episodeTitle,

          episodeAirDate:
            match.episodeAirDate,

          details:
            "MATCHED TV result did not contain a complete verified TMDB TV identity.",
        });

        continue;
      }

      const seasonNumber =
        match.seasonNumber;

      const episodeNumber =
        match.episodeNumber;

      /*
       * Prefer TMDB-confirmed episode date.
       *
       * Then use the source episode date for
       * date-formatted releases such as Fair
       * City when TMDB episode enumeration is
       * unavailable.
       */
      const episodeAirDate =
        match.episodeAirDate ??
        match.sourceEpisodeAirDate ??
        parsed.episodeAirDate;

      if (
        !hasValidEpisodeIdentity({
          seasonNumber,

          episodeNumber,

          episodeAirDate,
        })
      ) {
        summary.invalidIdentity +=
          1;

        items.push({
          eventKey:
            event.eventKey,

          title:
            parsed.seriesTitle,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "INVALID_IDENTITY",

          tmdbId:
            match.tmdbId,

          tmdbTitle:
            match.tmdbTitle,

          seasonNumber,

          episodeNumber,

          episodeTitle:
            match.episodeTitle,

          episodeAirDate,

          details:
            "Matched TV event has neither a complete season/episode identity nor a valid episode air date.",
        });

        continue;
      }

      summary.matched +=
        1;

      /*
       * Dry run stops here.
       *
       * No Turso write occurs unless the
       * caller explicitly supplies:
       *
       *   write: true
       */
      if (!write) {
        items.push({
          eventKey:
            event.eventKey,

          title:
            parsed.seriesTitle,

          releaseName:
            release.releaseName,

          postId:
            release.postId,

          publishedAt:
            release.publishedAt,

          status:
            "DRY_RUN_MATCHED",

          tmdbId:
            match.tmdbId,

          tmdbTitle:
            match.tmdbTitle,

          seasonNumber,

          episodeNumber,

          episodeTitle:
            match.episodeTitle,

          episodeAirDate,

          details:
            match.details,
        });

        continue;
      }

      const saveResult =
        await savePredbTvFirstSeenDetection({
          tmdbId:
            match.tmdbId,

          title:
            match.tmdbTitle,

          year:
            match.tmdbYear ===
            null
              ? null
              : String(
                  match.tmdbYear,
                ),

          quality:
            release.quality ??
            null,

          detectedAt:
            release.publishedAt,

          posterPath:
            match.posterPath,

          sourceUrl:
            release.sourceUrl ??
            null,

          /*
           * These are the canonical matched
           * episode coordinates.
           *
           * For a split-series case the TMDB
           * season can intentionally differ
           * from the source season.
           */
          seasonNumber,

          episodeNumber,

          episodeTitle:
            match.episodeTitle,

          episodeAirDate,
        });

      if (
        saveResult.action ===
        "INSERTED"
      ) {
        summary.inserted +=
          1;
      } else if (
        saveResult.action ===
        "EARLIER_UPDATED"
      ) {
        summary.earlierUpdated +=
          1;
      } else {
        summary.alreadyTracked +=
          1;
      }

      items.push({
        eventKey:
          event.eventKey,

        title:
          parsed.seriesTitle,

        releaseName:
          release.releaseName,

        postId:
          release.postId,

        publishedAt:
          release.publishedAt,

        status:
          saveResult.action,

        tmdbId:
          match.tmdbId,

        tmdbTitle:
          match.tmdbTitle,

        seasonNumber,

        episodeNumber,

        episodeTitle:
          match.episodeTitle,

        episodeAirDate,

        details:
          match.details,
      });
    } catch (error) {
      summary.errors +=
        1;

      items.push({
        eventKey:
          event.eventKey,

        title:
          parsed.seriesTitle,

        releaseName:
          release.releaseName,

        postId:
          release.postId,

        publishedAt:
          release.publishedAt,

        status:
          "ERROR",

        tmdbId:
          null,

        tmdbTitle:
          null,

        seasonNumber:
          parsed.seasonNumber,

        episodeNumber:
          parsed.episodeNumber,

        episodeTitle:
          null,

        episodeAirDate:
          parsed.episodeAirDate,

        details:
          error instanceof
          Error
            ? error.message
            : "Unknown PreDB TV ingestion error.",
      });

      console.error(
        `PreDB TV ingestion failed for ${release.releaseName}:`,
        error,
      );
    }
  }

  console.log(
    `PreDB TV matched identities: ${summary.matched}`,
  );

  console.log(
    `PreDB TV inserted: ${summary.inserted}`,
  );

  console.log(
    `PreDB TV earlier first-seen updates: ${summary.earlierUpdated}`,
  );

  console.log(
    `PreDB TV already tracked: ${summary.alreadyTracked}`,
  );

  console.log(
    `PreDB TV reviews: ${summary.review}`,
  );

  console.log(
    `PreDB TV unmatched: ${summary.unmatched}`,
  );

  console.log(
    `PreDB TV skipped: ${summary.skipped}`,
  );

  console.log(
    `PreDB TV invalid identities: ${summary.invalidIdentity}`,
  );

  console.log(
    `PreDB TV errors: ${summary.errors}`,
  );

  return {
    success:
      summary.errors ===
        0 &&
      summary.invalidIdentity ===
        0,

    summary,

    items,
  };
}