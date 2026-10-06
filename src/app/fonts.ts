import localFont from "next/font/local";

export const jakarta = localFont({
  src: [
    { path: "../../public/fonts/plus-jakarta-sans-300.ttf", weight: "300" },
    { path: "../../public/fonts/plus-jakarta-sans-400.ttf", weight: "400" },
    { path: "../../public/fonts/plus-jakarta-sans-600.ttf", weight: "600" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

export const playfair = localFont({
  src: [
    {
      path: "../../public/fonts/playfair-display-latin.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/playfair-display-italic-latin.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-playfair",
  display: "swap",
});
