import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { parsePlayerData } from "@/lib/parser";
import { scorePlayer } from "@/lib/scorer";

export default function Home() {
  const [, navigate] = useLocation();
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const analyze = useCallback(() => {
    setError("");
    const text = pasteText.trim();
    if (!text) {
      setError("Paste your SwordMasters stats first.");
      return;
    }
    const player = parsePlayerData(text);
    if (!player || player.level === 0) {
      setError("Could not parse player data. Make sure you paste the full bot output.");
      return;
    }
    const scores = scorePlayer(player);
    const encoded = encodeURIComponent(JSON.stringify({ player, scores }));
    navigate(`/result?d=${encoded}`);
  }, [pasteText, navigate]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        setError("Screenshot upload is available — paste text works best for accuracy.");
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#222] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#c9a84c] font-bold text-xl tracking-wide">SM</span>
            <span className="text-white font-bold text-xl tracking-wide">Grade</span>
          </div>
          <span className="text-[#444] text-sm">SwordMasters Account Grader</span>
        </div>
        <a
          href="/admin"
          className="flex items-center gap-1.5 text-[#1e1e1e] hover:text-[#333] transition-colors text-xs select-none"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
          </svg>
          admin
        </a>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 max-w-2xl mx-auto w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            <span className="text-[#c9a84c]">SM</span>Grade
          </h1>
          <p className="text-[#888] text-base leading-relaxed max-w-md mx-auto">
            Paste your SwordMasters bot stats. Get an instant, data-driven grade compared to real players at your level.
          </p>
        </div>

        {/* Paste Box */}
        <div className="w-full space-y-3">
          <label className="text-xs font-medium text-[#666] uppercase tracking-wider">
            Paste Bot Output
          </label>
          <div
            className={`relative rounded-sm border transition-colors ${
              isDragging ? "border-[#c9a84c]" : "border-[#2a2a2a]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <textarea
              className="w-full bg-[#111] text-[#ddd] text-sm font-mono rounded-sm p-4 resize-none outline-none placeholder-[#333] min-h-[220px] leading-relaxed"
              placeholder={`Paste your /stats bot output here...\n\nExample:\nYAMxARF Stats\nLevel\n12586\nGold\n 1.04QT\nPower\n 9.95QT\nSword\nSolbrand, Level 4  1%\nShield\nSunward Bulwark, Level 4  1%`}
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); setError(""); }}
              spellCheck={false}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm border border-red-900 bg-red-950/30 px-3 py-2 rounded-sm">
              {error}
            </p>
          )}

          <button
            onClick={analyze}
            className="w-full bg-[#c9a84c] hover:bg-[#d4b45c] text-black font-semibold py-3 px-6 rounded-sm transition-colors text-sm tracking-wide"
          >
            Analyze Account
          </button>

          <p className="text-center text-[#444] text-xs">
            Copy the full bot response from Discord and paste it above
          </p>
        </div>

        {/* How it works */}
        <div className="mt-16 w-full border-t border-[#1a1a1a] pt-10">
          <p className="text-[#444] text-xs uppercase tracking-widest text-center mb-6">How it works</p>
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { step: "01", title: "Paste Stats", desc: "Copy your bot output from Discord" },
              { step: "02", title: "Parse & Score", desc: "Deterministic engine compares you to real players" },
              { step: "03", title: "Get Grade", desc: "Receive scores, grade, and AI analysis" },
            ].map((item) => (
              <div key={item.step} className="space-y-2">
                <div className="text-[#c9a84c] text-xs font-mono">{item.step}</div>
                <div className="text-white text-sm font-medium">{item.title}</div>
                <div className="text-[#555] text-xs leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#1a1a1a] px-6 py-4 text-center text-[#333] text-xs">
        SMGrade — not affiliated with SwordMasters
      </footer>
    </div>
  );
}
