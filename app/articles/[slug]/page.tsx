import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleReader } from "../../../components/site/article-reader";
import {
  getPublishedArticleBySlug,
  getPublishedArticleSlugs,
} from "../../../lib/content/article-slugs";
import { SiteFooter } from "../../../components/site/site-footer";
import { SiteHeader } from "../../../components/site/site-header";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = true;

function getCanonicalUrl(slug: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return new URL(`/articles/${encodeURIComponent(slug)}`, siteUrl).toString();
}

export async function generateStaticParams() {
  return getPublishedArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  if (!article) {
    return {
      title: "Article not found | What Works Daily",
      description: "This published guide could not be found.",
    };
  }

  return {
    title: article.content.title,
    description: article.content.dek,
    alternates: {
      canonical: getCanonicalUrl(article.slug),
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <ArticleReader article={article} />
      </main>
      <SiteFooter />
    </>
  );
}
