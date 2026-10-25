import type { ApprovedChannel } from "./types";

/**
 * These entries are a discovery allowlist only. Listing a channel here does
 * not imply endorsement, partnership, or ministry affiliation with this site.
 */
export const APPROVED_CHANNELS = [
  {
    id: "pastor-vlad",
    name: "Pastor Vlad",
    handle: "@PastorVlad",
    canonicalUrl: "https://www.youtube.com/@PastorVlad",
    active: true,
  },
  {
    id: "victory",
    name: "Victory",
    handle: "@Victory",
    canonicalUrl: "https://www.youtube.com/@Victory",
    active: true,
  },
  {
    id: "every-nation",
    name: "Every Nation",
    handle: "@EveryNation",
    canonicalUrl: "https://www.youtube.com/@EveryNation",
    active: true,
  },
] as const satisfies readonly ApprovedChannel[];

export const APPROVED_YOUTUBE_CHANNELS = APPROVED_CHANNELS;
export const approvedChannels = APPROVED_CHANNELS;
