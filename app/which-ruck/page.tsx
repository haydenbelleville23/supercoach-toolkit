import type { Metadata } from "next";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import RuckQuiz from "@/components/quiz/RuckQuiz";
import { ruckCardSrc, ruckQuiz } from "@/lib/quiz/ruckQuiz";
import { findOutcome } from "@/lib/quiz/scoreQuiz";
import { absoluteUrl, BRAND, SITE_NAME } from "@/lib/site";

// Link previews need absolute URLs: absoluteUrl uses NEXT_PUBLIC_SITE_URL.
const PAGE_PATH = "/which-ruck";

const DEFAULT_TITLE = "Which ruck are you?";
const DEFAULT_DESCRIPTION = `${ruckQuiz.questions.length} quick questions to find the AFL ruck who matches your style. A ${SITE_NAME} quiz.`;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type PageProps = {
  searchParams: SearchParams;
};

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const outcome = findOutcome(ruckQuiz, (await searchParams).r);

  if (!outcome) {
    const images = [
      {
        url: absoluteUrl(BRAND.socialShare),
        ...BRAND.socialShareSize,
        alt: `${DEFAULT_TITLE} | ${SITE_NAME}`,
      },
    ];

    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      alternates: { canonical: PAGE_PATH },
      openGraph: {
        type: "website",
        siteName: SITE_NAME,
        url: absoluteUrl(PAGE_PATH),
        title: `${DEFAULT_TITLE} | ${SITE_NAME}`,
        description: DEFAULT_DESCRIPTION,
        images,
      },
      twitter: {
        card: "summary_large_image",
        title: `${DEFAULT_TITLE} | ${SITE_NAME}`,
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
      siteName: SITE_NAME,
      url: resultUrl,
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
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
