"use client";

// The app reads saved answers from this browser tab, so it renders in the browser only.
// Until its code has loaded, a branded splash (sent ready-made from the server) shows instead of a blank page.
import dynamic from "next/dynamic";
import Splash from "@/components/Splash";

const App = dynamic(() => import("@/components/App"), { ssr: false, loading: () => <Splash /> });

export default function Home() {
  return <App />;
}
