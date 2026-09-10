export default function TeamRosterModal({ team, onClose }) {
  if (!team) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-neutral-900 border border-neutral-700 p-6 rounded-xl max-w-md w-full mx-4 shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white"
        >
          ✕
        </button>
        
        <div className="flex flex-col items-center mb-6">
          {team.icon ? (
            <img src={team.icon} alt={team.name} className="w-20 h-20 object-contain mb-3 drop-shadow-md" />
          ) : (
            <div className="w-20 h-20 bg-neutral-800 rounded-lg flex items-center justify-center text-2xl font-bold text-neutral-500 mb-3">
              {team.name.slice(0, 3).toUpperCase()}
            </div>
          )}
          <h2 className="text-2xl font-bold text-white text-center leading-tight">{team.name}</h2>
          {team.major && (
            <div className="text-amber-500 font-medium text-sm mt-1">{team.major}</div>
          )}
        </div>

        <div className="space-y-2">
          {team.players?.map((p, idx) => (
            <div key={p.uid || idx} className="flex items-center justify-between bg-neutral-800/50 p-3 rounded-lg border border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-neutral-950 rounded flex items-center justify-center text-xs font-bold text-neutral-500 border border-neutral-800">
                  {p.role?.slice(0, 3) || "PLY"}
                </div>
                <span className="font-bold text-neutral-200">{p.name}</span>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Rating</div>
                <div className="font-mono text-sm text-blue-400">{Number(p.rating || 0).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
