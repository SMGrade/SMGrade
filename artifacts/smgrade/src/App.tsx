import { Switch, Route, Router as WouterRouter } from "wouter";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
    mutations: { retry: 0 },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/result" component={Result} />
      <Route path="/admin" component={Admin} />
      <Route path="/vault" component={MasterVault} />
      <Route path="/master" component={MasterVault} />
      <Route path="/compare" component={Compare} />
      <Route path="/live-lookup" component={LiveLookup} />
      <Route path="/arcade" component={Arcade} />
      <Route component={NotFound} />
    </Switch>
  );
}

import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    fetch("/api/master/admin/config")
      .then((res) => {
        if (!res.ok) throw new Error("Backend offline or error status");
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
      })
      .catch((err) => {
        console.warn("[SMGrade Config Sync] Server offline or unconfigured:", err.message);
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
