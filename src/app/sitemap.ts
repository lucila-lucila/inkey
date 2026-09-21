import type { MetadataRoute } from "next";
import { serverEnv } from "@/lib/env";

/** La landing y nada más: el resto del producto es privado. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", serverEnv.siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
