import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-white relative overflow-hidden">
      {/* Dynamic background effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent"></div>
      
      <div className="z-10 flex flex-col items-center gap-8 text-center">
        <h1 className="text-6xl font-black tracking-tighter sm:text-8xl bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text text-transparent drop-shadow-lg">
          CS MAJOR SIMULATOR
        </h1>
        
        <p className="max-w-2xl text-lg text-neutral-400 sm:text-xl">
          Build your ultimate dream team. Strategize your economy, master the roles, and lead your squad through the grueling Swiss Stage to reach Major glory.
        </p>

        <div className="flex gap-6 mt-4">
          <Link
            href="/play"
            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-neutral-800 px-10 py-5 text-xl font-black text-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-neutral-700 border border-neutral-700"
          >
            SINGLEPLAYER
          </Link>
          <Link
            href="/multiplayer"
            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-amber-600 px-10 py-5 text-xl font-black text-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-amber-500 hover:shadow-amber-500/50"
          >
            MULTIPLAYER
          </Link>
        </div>
      </div>
    </main>
  );
}
