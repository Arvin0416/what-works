import { getCategoryById } from "../../lib/content/categories";
import type { VideoRecommendation } from "../../lib/content/types";
import { SectionLabel } from "./section-label";
import { VideoCard } from "./video-card";

type WatchGalleryProps = {
  videos: VideoRecommendation[];
  activeTopicId?: string;
};

export function WatchGallery({ videos, activeTopicId }: WatchGalleryProps) {
  const visibleVideos = activeTopicId
    ? videos.filter((video) => video.topicId === activeTopicId)
    : videos;
  const topicLabel = activeTopicId
    ? getCategoryById(activeTopicId)?.label ?? "this topic"
    : "this topic";

  return (
    <section id="watch" className="watch-section" aria-labelledby="watch-heading">
      <div className="site-container">
        <div className="watch-section__intro">
          <div>
            <SectionLabel className="section-label--on-dark">
              Watch what works
            </SectionLabel>
            <h2 id="watch-heading">A visual shelf for the week.</h2>
          </div>
          <p>
            Recommendations come from configured Christian channels. Open the
            original video when you are ready to listen, learn, or pray.
          </p>
        </div>

        {visibleVideos.length > 0 ? (
          <ul className="video-gallery">
            {visibleVideos.map((video, index) => (
              <VideoCard key={video.videoId} video={video} artworkIndex={index} />
            ))}
          </ul>
        ) : (
          <p className="empty-state empty-state--on-dark">
            There are no recommendations filed under {topicLabel} yet.
          </p>
        )}
      </div>
    </section>
  );
}
