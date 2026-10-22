// Shown instantly while the app's code loads: the welcome screen's moving
// background and the logo. It is sent ready-made from the server, so something
// branded appears straight away instead of a blank page.
import Logo from "@/components/Logo";

export default function Splash() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden text-ink" aria-busy="true">
      <div aria-hidden className="cg-gradient-shift absolute inset-0" style={{ backgroundImage: "linear-gradient(120deg, #efe9ff, #e3f6ef, #f6f9e1, #ece6ff)" }} />
      <div aria-hidden className="cg-drift absolute -left-24 -top-24 h-80 w-80 rounded-full bg-logo-violet/30 blur-3xl" />
      <div aria-hidden className="cg-drift absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-brand-mint/25 blur-3xl" style={{ animationDelay: "-7s" }} />
      <div aria-hidden className="cg-drift absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-brand-lime/25 blur-3xl" style={{ animationDelay: "-13s" }} />
      <div className="relative z-10 cg-fade">
        <Logo size="lg" />
        <p className="sr-only">Loading Collabgram…</p>
      </div>
    </main>
  );
}
