import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-8 text-white relative overflow-hidden">
      {/* Dynamic background effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-neutral-950 to-neutral-950"></div>
      
      <div className="z-10 flex flex-col items-center gap-8 text-center">
        <h1 className="text-6xl font-black tracking-tighter sm:text-8xl bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text text-transparent drop-shadow-lg">
          CS MAJOR SIMULATOR
        </h1>
        
        <p className="max-w-2xl text-lg text-neutral-400 sm:text-xl">
          Build your ultimate dream team. Strategize your economy, master the roles, and lead your squad through the grueling Swiss Stage to reach Major glory.
        </p>

        <Link
          href="/play"
          className="group relative inline-flex items-center justify-center gap-4 overflow-hidden rounded-full bg-amber-600 px-12 py-5 text-2xl font-black text-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-amber-500 hover:shadow-amber-500/50"
        >
          <span className="relative z-10 flex items-center gap-2 tracking-wide">
            JUGAR MAJOR
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </span>
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-amber-400 to-amber-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
        </Link>
      </div>
    </main>
  );
}
