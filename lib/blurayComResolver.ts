import {
  getBluRayComReleaseWindow,
  type BluRayComRelease,
} from "../data/blurayCom";

import {
  matchBluRayComRelease,
  type BluRayComMatchInput,
  type BluRayComMatchResult,
} from "./blurayComMatcher";

const DEFAULT_WINDOW_DAYS =
  90;

export type BluRayComResolver = {
  source:
    string;

  fetchedAt:
    string;

  months:
    string[];

  totalReleaseRecords:
    number;

  releases:
    BluRayComRelease[];

  resolve:
    (
      input:
        BluRayComMatchInput,
    ) =>
      BluRayComMatchResult;
};

export async function createBluRayComResolver({
  daysBefore =
    DEFAULT_WINDOW_DAYS,

  daysAfter =
    DEFAULT_WINDOW_DAYS,
}: {
  daysBefore?: number;

  daysAfter?: number;
} = {}): Promise<
  BluRayComResolver
> {
  /*
   * Fetch the entire relevant Blu-ray.com
   * calendar window ONCE.
   *
   * PreDB ingestion can then reuse this
   * in-memory index for every Blu-ray
   * release discovered during the same
   * ingestion run.
   *
   * This is much better than fetching
   * Blu-ray.com separately for every movie.
   */
  const index =
    await getBluRayComReleaseWindow({
      daysBefore,

      daysAfter,
    });

  return {
    source:
      index.source,

    fetchedAt:
      index.fetchedAt,

    months:
      index.months,

    totalReleaseRecords:
      index.total,

    releases:
      index.releases,

    resolve(
      input:
        BluRayComMatchInput,
    ) {
      return matchBluRayComRelease({
        input,

        releases:
          index.releases,
      });
    },
  };
}