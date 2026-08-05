import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Synk — Find time. Together.",
    short_name: "Synk",
    description: "Availability polling and meeting scheduling made effortless.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080d18",
    theme_color: "#4197ff",
    icons: [
      {
        src: "/logo_nobg.png?v=31f7d33",
        sizes: "499x499",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
