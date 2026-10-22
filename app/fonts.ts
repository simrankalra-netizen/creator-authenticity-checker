// The two Collabgram fonts. To change a font, swap the name here; nothing else needs to change.
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

// Headings: modern and slightly bold
export const headingFont = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-heading" });

// Body text and numbers: clean and readable
export const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });
