import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon. Rendered full-bleed with no rounded corners of its own —
 * iOS applies its own mask, and pre-rounding would leave gaps at the corners.
 */
const BEAN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#6F4423"/>
  <g transform="rotate(-32 256 256)">
    <ellipse cx="256" cy="256" rx="140.8" ry="209.1" fill="#F6F2EC"/>
    <path d="M256 68.3c-64 89.6-64 285.9 0 375.5" fill="none" stroke="#6F4423" stroke-width="34" stroke-linecap="round"/>
  </g>
</svg>`;

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(BEAN).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#6F4423",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={size.width} height={size.height} alt="" />
      </div>
    ),
    size,
  );
}
