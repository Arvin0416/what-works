import {
  PublishedArticleSchema,
  type PublishedArticle,
} from "./types";

const seedArticleData = {
  id: "seed-far-from-god",
  slug: "what-works-when-you-feel-far-from-god",
  status: "published",
  publishedAt: "2026-10-25T00:00:00.000Z",
  content: {
    title: "What Works When You Feel Far From God",
    dek: "When prayer feels quiet, take one honest next step toward Jesus.",
    categoryId: "spiritual-growth",
    summary:
      "You do not have to perform your way back to God. Notice what is true, remember what Scripture says, and practice one small response of trust today.",
    sections: [
      {
        heading: "Name the distance without hiding",
        body:
          "Feeling far from God can show up as silence, shame, distraction, or simple exhaustion. You can tell the truth about that experience without treating it as a final verdict. Start with one plain sentence: Jesus, I feel far away, but I am turning toward you.",
      },
      {
        heading: "Remember what remains true",
        body:
          "Psalm 13 gives you permission to bring a real complaint to God. James 4:8 invites a response of drawing near, not a performance of having everything figured out. Read the references slowly and let them be an invitation to honesty rather than a test you must pass.",
      },
      {
        heading: "Practice one small return",
        body:
          "Choose a next step you can actually keep: sit quietly for two minutes, read a short passage, write an honest prayer, or text a trusted Christian friend. Repeated small turns toward Jesus can make space for attention, even when your feelings have not caught up yet.",
      },
      {
        heading: "Reach out with wisdom",
        body:
          "If the distance is tangled with grief, anxiety, harm, or ongoing isolation, bring another safe person into the conversation. A pastor, counselor, doctor, or trusted friend can help you discern what kind of care you need. Seeking support is not a failure of faith.",
      },
    ],
    scriptureRefs: ["Psalm 13:1-2", "James 4:8", "Romans 8:38-39"],
    prayer:
      "Jesus, I feel far away and I do not want to pretend. Meet me in this honest moment, help me take the next faithful step, and lead me toward wise people who can walk with me. Amen.",
    safetyNote:
      "This guide offers spiritual encouragement; it is not a substitute for pastoral, medical, counseling, or emergency care. If you may hurt yourself or someone else, contact local emergency services or a trusted person now.",
    readingMinutes: 4,
  },
  sources: [
    {
      url: "https://www.biblegateway.com/passage/?search=Psalm%2013%3A1-2%2C%20James%204%3A8%2C%20Romans%208%3A38-39",
      title: "Scripture references for this guide",
      publisher: "Bible Gateway",
      retrievedAt: "2026-10-25T00:00:00.000Z",
      claimUse:
        "Reference-only Scripture lookup; the article wording is original and this citation does not imply ministry endorsement or affiliation.",
    },
  ],
  videos: [
    {
      videoId: "seed-prayer-01",
      title: "When faith feels quiet",
      channelId: "pastor-vlad",
      channelName: "Pastor Vlad",
      thumbnailUrl: "",
      watchUrl: "https://www.youtube.com/watch?v=seed-prayer-01",
      durationSeconds: null,
      topicId: "spiritual-growth",
      source: "youtube",
    },
    {
      videoId: "seed-prayer-02",
      title: "Returning to prayer with honesty",
      channelId: "victory",
      channelName: "Victory",
      thumbnailUrl: "",
      watchUrl: "https://youtu.be/seed-prayer-02",
      durationSeconds: null,
      topicId: "prayer",
      source: "youtube",
    },
    {
      videoId: "seed-prayer-03",
      title: "One faithful next step",
      channelId: "every-nation",
      channelName: "Every Nation",
      thumbnailUrl: "",
      watchUrl: "https://www.youtube.com/watch?v=seed-prayer-03",
      durationSeconds: null,
      topicId: "spiritual-growth",
      source: "youtube",
    },
  ],
} satisfies PublishedArticle;

export const SEED_PUBLISHED_ARTICLE: PublishedArticle =
  PublishedArticleSchema.parse(seedArticleData);

export const SEED_ARTICLE = SEED_PUBLISHED_ARTICLE;
export const seedArticle = SEED_PUBLISHED_ARTICLE;

export function getSeedPublishedArticle(): PublishedArticle {
  return SEED_PUBLISHED_ARTICLE;
}
