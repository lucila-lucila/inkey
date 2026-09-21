import type { MetadataRoute } from "next";
import { serverEnv } from "@/lib/env";

/** La landing y los textos legales: el resto del producto es privado. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (ruta: string) => new URL(ruta, serverEnv.siteUrl).toString();

  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/terminos"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/privacidad"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
