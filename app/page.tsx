"use client";

// The app reads saved answers from this browser tab, so it renders in the browser only.
import dynamic from "next/dynamic";

const App = dynamic(() => import("@/components/App"), { ssr: false });

export default function Home() {
  return <App />;
}
