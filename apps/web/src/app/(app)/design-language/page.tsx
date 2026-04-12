import type { Metadata } from "next";
import { DesignLanguageShowcase } from "../../../components/routes/design-language-showcase";

export const metadata: Metadata = {
  title: "Design language",
  description: "Obscura Dark Room visual language reference — typography, surfaces, buttons, and motion.",
  robots: { index: false, follow: false },
};

export default function DesignLanguagePage() {
  return <DesignLanguageShowcase />;
}
