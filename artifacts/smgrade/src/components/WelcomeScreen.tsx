import { useState } from "react";
import authStore from "@/lib/authStore";

interface WelcomeScreenProps {
  onAuthSuccess: () => void;
}

export default function WelcomeScreen({ onAuthSuccess }: WelcomeScreenProps) {
  const [view, setView] = useState<"welcome" | "login" | "register">("welcome");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleContinueAsGuest() {
    authStore.setGuestMode();
    onAuthSuccess();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    if (view === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (view === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        });
        
        let data: any = {};
        try {
          const txt = await res.text();
          data = txt ? JSON.parse(txt) : {};
        } catch {
          data = { error: `Server returned invalid status code: ${res.status}` };
        }

        if (res.ok) {
          // Automatic login after account creation
          const loginRes = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username.trim(), password: password.trim() }),
          });
          
          let loginData: any = {};
          try {
            const lTxt = await loginRes.text();
            loginData = lTxt ? JSON.parse(lTxt) : {};
          } catch {
            loginData = { error: "Failed to read login response after registration" };
          }

          if (loginRes.ok && loginData.token) {
            authStore.setToken(loginData.token);
            onAuthSuccess();
          } else {
            setView("login");
            setPassword("");
            setConfirmPassword("");
            setError("Account created! Please log in.");
          }
        } else {
          setError(data.error || "Failed to create account.");
        }
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        });
        
        let data: any = {};
        try {
          const txt = await res.text();
          data = txt ? JSON.parse(txt) : {};
        } catch {
          data = { error: `Server returned invalid status code: ${res.status}` };
        }

        if (res.ok && data.token) {
          authStore.setToken(data.token);
          onAuthSuccess();
        } else {
          setError(data.error || "Failed to log in.");
        }
      }
    } catch (err) {
      setError("Connection error. Ensure the backend api-server is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-white flex items-center justify-center relative overflow-hidden bg-[#03050b]">
      {/* Background radial glow */}
      <div className="absolute top-[-10%] left-[50%] translate-x-[-50%] w-[600px] h-[300px] rounded-full bg-[#ffd700]/5 blur-[120px] pointer-events-none" />
      
      <div className="border border-white/[0.04] bg-[#05050f]/80 backdrop-blur-xl rounded-2xl p-8 w-full max-w-md space-y-6 shadow-[0_4px_30px_rgba(0,0,0,0.6)] text-center relative z-10">
        
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-amber-400 font-black text-2xl font-display tracking-tight">SM</span>
            <span className="text-white font-extrabold text-2xl font-display tracking-tight">Grade</span>
          </div>
        </div>

        {view === "welcome" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-xl font-black font-display tracking-tight text-white">Welcome to SMGrade</h1>
              <p className="text-xs text-amber-400/80 font-bold uppercase tracking-wider">
                The Ultimate SwordMasters Account Analyzer
              </p>
            </div>

            <div className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl text-left text-xs text-white/50 space-y-2.5 font-medium leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 select-none">✦</span>
                <span>Track your progress.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 select-none">✦</span>
                <span>Save your history.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 select-none">✦</span>
                <span>Receive personalized recommendations.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 select-none">✦</span>
                <span>Monitor your account growth over time.</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button 
                onClick={() => setView("login")} 
                className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest cursor-pointer transition-all"
              >
                Log In
              </button>
              <button 
                onClick={() => setView("register")} 
                className="w-full py-3 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] text-white/80 font-black text-xs uppercase tracking-widest cursor-pointer transition-all"
              >
                Create Account
              </button>
              <div className="border-t border-white/[0.04] pt-4 text-center">
                <button 
                  onClick={handleContinueAsGuest} 
                  className="text-[10px] text-white/35 hover:text-amber-400 transition-colors uppercase tracking-widest font-black cursor-pointer"
                >
                  Continue as Guest →
                </button>
              </div>
            </div>
          </div>
        )}

        {(view === "login" || view === "register") && (
          <div className="space-y-5 text-left">
            <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest text-center">
              {view === "login" ? "Account Authentication" : "Create SMGrade Account"}
            </h2>

            {view === "register" && (
              <p className="text-[10px] text-white/40 leading-relaxed font-semibold bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                Create your free SMGrade account to save your analysis history, track your account improvements, and continue your progress across future visits.
                <span className="block mt-1.5 text-amber-400/90 font-bold uppercase tracking-wide">
                  * This account is for SMGrade only. Not for SwordMasters.
                </span>
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">
                  {view === "login" ? "Username" : "Create Username"}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs px-3 py-2.5 rounded-lg outline-none transition-colors"
                  placeholder={view === "login" ? "Enter Username" : "Select username"}
                />
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs px-3 py-2.5 rounded-lg outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {view === "register" && (
                <div>
                  <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs px-3 py-2.5 rounded-lg outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              )}

              {error && <p className="text-red-400 text-xs font-semibold text-center">⚠️ {error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg button-gold text-xs font-black tracking-widest disabled:opacity-40 cursor-pointer"
              >
                {loading ? "Processing..." : view === "login" ? "Log In" : "Register & Enter"}
              </button>
            </form>

            <div className="text-center pt-2">
              <button 
                onClick={() => { setView("welcome"); setError(""); }} 
                className="text-[9px] text-white/35 hover:text-amber-400 transition-colors uppercase tracking-widest font-black cursor-pointer"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
