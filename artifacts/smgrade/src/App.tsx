import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import Result from "@/pages/Result";
import Admin from "@/pages/Admin";
import Compare from "@/pages/Compare";
import LiveLookup from "@/pages/LiveLookup";
import MasterVault from "@/pages/MasterVault";
import Arcade from "@/pages/Arcade";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import { reloadGearDatabase } from "@/lib/gearDatabase";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
    mutations: { retry: 0 },
  },
});

function ConfigLoader({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    // Proceed after 3.5 seconds anyway in case of server delay
    const timeoutId = setTimeout(() => {
      if (active) {
        setLoaded(true);
      }
    }, 3500);

    fetch(`/api/master/admin/config?t=${Date.now()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Sync failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          localStorage.setItem("smg_items_db_v2", JSON.stringify(data.items));
        }
        if (data.prices && Array.isArray(data.prices) && data.prices.length > 0) {
          localStorage.setItem("smg_market_database_v1", JSON.stringify(data.prices));
        }
        if (data.benchmarks && Array.isArray(data.benchmarks) && data.benchmarks.length > 0) {
          localStorage.setItem("smg_benchmark_tiers_v2", JSON.stringify(data.benchmarks));
        }
        if (data.constants && typeof data.constants === "object" && Object.keys(data.constants).length > 0) {
          localStorage.setItem("smg_grading_settings_v1", JSON.stringify(data.constants));
        }
        reloadGearDatabase();
        clearTimeout(timeoutId);
        setLoaded(true);
      })
      .catch((err) => {
        console.warn("[SMGrade Config Sync] Initial sync failed:", err.message);
        if (active) {
          clearTimeout(timeoutId);
          setLoaded(true);
        }
      });

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#03050b] flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-xs font-mono text-white/40 uppercase tracking-widest animate-pulse">Synchronizing Grader Database...</p>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();

  useEffect(() => {
    // Background website visit recording
    try {
      let visitorId = localStorage.getItem("smg_visitor_id");
      if (!visitorId) {
        visitorId = "vis_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);
        localStorage.setItem("smg_visitor_id", visitorId);
      }
      fetch("/api/master/record-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: location, visitorId })
      }).catch(() => {});
    } catch (_) {}

    // Background sync on route changes to ensure fresh local cache
    fetch(`/api/master/admin/config?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Sync failed");
        return res.json();
      })
      .then((data) => {
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          localStorage.setItem("smg_items_db_v2", JSON.stringify(data.items));
        }
        if (data.prices && Array.isArray(data.prices) && data.prices.length > 0) {
          localStorage.setItem("smg_market_database_v1", JSON.stringify(data.prices));
        }
        if (data.benchmarks && Array.isArray(data.benchmarks) && data.benchmarks.length > 0) {
          localStorage.setItem("smg_benchmark_tiers_v2", JSON.stringify(data.benchmarks));
        }
        if (data.constants && typeof data.constants === "object" && Object.keys(data.constants).length > 0) {
          localStorage.setItem("smg_grading_settings_v1", JSON.stringify(data.constants));
        }
        reloadGearDatabase();
      })
      .catch((err) => {
        console.warn("[SMGrade Config Sync] Background sync failed:", err.message);
      });
  }, [location]);

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/result" component={Result} />
      <Route path="/admin" component={Admin} />
      <Route path="/vault" component={MasterVault} />
      <Route path="/master" component={MasterVault} />
      <Route path="/master-vault" component={MasterVault} />
      <Route path="/compare" component={Compare} />
      <Route path="/live-lookup" component={LiveLookup} />
      <Route path="/arcade" component={Arcade} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <ConfigLoader>
          <Router />
        </ConfigLoader>
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
