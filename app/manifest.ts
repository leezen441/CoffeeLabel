import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bean Label — Coffee Sticker Studio",
    short_name: "Bean Label",
    description: "Design, store and print brew-guide stickers for your coffee beans.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2ec",
    theme_color: "#6f4423",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
