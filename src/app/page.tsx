import { Landing, landingMetadata } from "./tienda-online/landing";

// The platform home shows the commercial landing; /tienda-online is the canonical URL.
export const metadata = landingMetadata;

export default function Home() {
  return <Landing />;
}
