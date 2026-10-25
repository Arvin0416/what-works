import { getCategoryById } from "../../lib/content/categories";
import type { VideoRecommendation } from "../../lib/content/types";

type VideoCardProps = {
  video: VideoRecommendation;
  artworkIndex: number;
};

function formatDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VideoCard({ video, artworkIndex }: VideoCardProps) {
  const category = getCategoryById(video.topicId);
  const artworkClass = `video-card__artwork--${artworkIndex % 4}`;

  return (
    <li className="video-card">
      <a
        className="video-card__link"
        href={video.watchUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Watch ${video.title} on YouTube`}
      >
        <div className="video-card__media">
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnailUrl}
              alt=""
              aria-hidden="true"
              width={640}
              height={360}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={`video-card__artwork ${artworkClass}`} aria-hidden="true">
              <span>What works</span>
              <strong>{category?.label ?? "Faith"}</strong>
            </div>
          )}
          <span className="video-card__watch">Watch</span>
        </div>

        <div className="video-card__body">
          <div className="video-card__meta">
            <span>{category?.label ?? "Faith"}</span>
            {video.durationSeconds !== null ? (
              <time dateTime={`PT${video.durationSeconds}S`}>
                {formatDuration(video.durationSeconds)}
              </time>
            ) : null}
          </div>
          <h3>{video.title}</h3>
          <p>{video.channelName}</p>
          <span className="video-card__source">YouTube</span>
        </div>
      </a>
    </li>
  );
}
