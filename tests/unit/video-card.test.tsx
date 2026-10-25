import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VideoCard } from "../../components/site/video-card";
import { seedArticle } from "../../lib/content/seed";
import { renderPage } from "../utils/render-page";

describe("VideoCard", () => {
  it("shows video metadata without exposing the watch URL as card text", () => {
    const video = seedArticle.videos[0];

    renderPage(<VideoCard video={video} artworkIndex={0} />);

    const link = screen.getByRole("link", {
      name: new RegExp(`Watch ${video.title} on YouTube`, "i"),
    });

    expect(link).toHaveAttribute("href", video.watchUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(link).toHaveTextContent(video.title);
    expect(link).toHaveTextContent(video.channelName);
    expect(link).not.toHaveTextContent(video.watchUrl);
  });
});
