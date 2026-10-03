import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://watchleaks.com";

  return [
    {
      url: baseUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/leak-detections`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/latest-cams`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/latest-web`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/latest-blurays`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/movies`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tv-shows`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/calendar`,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];
}