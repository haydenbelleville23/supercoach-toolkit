import type { MetadataRoute } from "next";

import { BRAND, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#1c242f",
    theme_color: "#1c242f",
    icons: [
      { src: BRAND.iconSquare512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: BRAND.iconSquare1024, sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  };
}
