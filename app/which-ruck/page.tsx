import type { Metadata } from "next";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import RuckQuiz from "@/components/quiz/RuckQuiz";
import { ruckCardSrc, ruckQuiz } from "@/lib/quiz/ruckQuiz";
import { findOutcome } from "@/lib/quiz/scoreQuiz";

// Same as metadataBase in app/layout.tsx. Link previews need absolute URLs.
const SITE_URL = "https://sc-toolkit.vercel.app";
const PAGE_PATH = "/which-ruck";

const DEFAULT_TITLE = "Which ruck are you?";
const DEFAULT_DESCRIPTION = `${ruckQuiz.questions.length} quick questions to find the AFL ruck who matches your style. A Fantasy King quiz.`;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type PageProps = {
  searchParams: SearchParams;
};

function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const outcome = findOutcome(ruckQuiz, (await searchParams).r);

  if (!outcome) {
    const images = [
      {
        url: absoluteUrl("/images/branding/fantasy-king-logo-full.png"),
        width: 1200,
        height: 630,
        alt: "Fantasy King",
      },
    ];

    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      alternates: { canonical: PAGE_PATH },
      openGraph: {
        type: "website",
        siteName: "Fantasy King",
        url: absoluteUrl(PAGE_PATH),
        title: `${DEFAULT_TITLE} | Fantasy King`,
        description: DEFAULT_DESCRIPTION,
        images,
      },
      twitter: {
        card: "summary_large_image",
        title: `${DEFAULT_TITLE} | Fantasy King`,
        description: DEFAULT_DESCRIPTION,
        images: images.map((image) => image.url),
      },
    };
  }

  const title = `I'm ${outcome.name}: ${outcome.archetype}`;
  const description = `${outcome.description} Which ruck are you?`;
  const resultUrl = absoluteUrl(
    `${PAGE_PATH}?r=${encodeURIComponent(outcome.id)}`,
  );
  const image = {
    url: absoluteUrl(ruckCardSrc(outcome.id)),
    width: 896,
    height: 1200,
    alt: `${outcome.name}, ${outcome.archetype}`,
  };

  return {
    title,
    description,
    alternates: { canonical: PAGE_PATH },
    openGraph: {
      type: "website",
      siteName: "Fantasy King",
      url: resultUrl,
      title: `${title} | Fantasy King`,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Fantasy King`,
      description,
      images: [image.url],
    },
  };
}

export default async function WhichRuckPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = findOutcome(ruckQuiz, params.r);
  const runnerUp = result ? findOutcome(ruckQuiz, params.ru) : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <Header />

      <section className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <RuckQuiz
          // A fresh quiz when the URL changes by navigation (e.g. footer link).
          key={result?.id ?? "start"}
          initialResultId={result?.id ?? null}
          initialRunnerUpId={
            runnerUp && runnerUp.id !== result?.id ? runnerUp.id : null
          }
        />
      </section>

      <Footer />
    </main>
  );
}
