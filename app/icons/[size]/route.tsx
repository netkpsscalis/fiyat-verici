import { ImageResponse } from "next/og";

/** Uygulama ikonu: lacivert zemin üstünde köşesi kesik, delikli sarı fiyat etiketi ve üç fiyat çizgisi. */
export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = raw === "512" ? 512 : raw === "180" ? 180 : 192;
  const maskable = new URL(req.url).searchParams.has("maskable");
  const pad = maskable ? size * 0.22 : size * 0.14;
  const w = size - pad * 2;
  const h = w * 0.72;
  const cut = w * 0.22;
  // Köşeyi kesmek için köşeye oturan 45° döndürülmüş kare (ikon çizicisi clip-path'i güvenilir uygulamıyor)
  const notch = cut * Math.SQRT2;
  const bar = (width: number, height: number) => (
    <div style={{ width, height, borderRadius: height / 2, background: "#2a1f00" }} />
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#13233a",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            position: "relative",
            width: w,
            height: h,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: h * 0.1,
            paddingLeft: w * 0.3,
            background: "#ffc83d",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -notch / 2,
              left: -notch / 2,
              width: notch,
              height: notch,
              background: "#13233a",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: h * 0.22,
              left: w * 0.15,
              width: w * 0.07,
              height: w * 0.07,
              borderRadius: w,
              background: "#13233a",
            }}
          />
          {bar(w * 0.3, h * 0.09)}
          {bar(w * 0.48, h * 0.16)}
          {bar(w * 0.38, h * 0.09)}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
