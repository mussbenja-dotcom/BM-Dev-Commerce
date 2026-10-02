import { ImageResponse } from "next/og";

export const alt = "BM Dev E-commerce: tiendas online personalizadas para tu negocio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f5f4f1", padding: 72, color: "#111318" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: "#111318", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700 }}>BM</div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600 }}>BM Dev<span style={{ color: "#e8551f", marginLeft: 10 }}>E-commerce</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Tu tienda online, hecha para tu negocio.</div>
          <div style={{ fontSize: 32, color: "#5b6068" }}>Tu marca, tu dominio, Mercado Pago, transferencia y WhatsApp. Sin comisión de BM Dev por venta.</div>
        </div>
        <div style={{ display: "flex", height: 12, width: 220, background: "#e8551f", borderRadius: 6 }} />
      </div>
    ),
    size,
  );
}
