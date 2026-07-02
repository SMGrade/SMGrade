import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import Result from "@/pages/Result";
import Admin from "@/pages/Admin";
import Compare from "@/pages/Compare";
import LiveLookup from "@/pages/LiveLookup";
import MasterVault from "@/pages/MasterVault";
import NotFound from "@/pages/not-found";
import authStore from "@/lib/authStore";
import WelcomeScreen from "@/components/WelcomeScreen";

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
      <Route path="/compare" component={Compare} />
      <Route path="/live-lookup" component={LiveLookup} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => authStore.isLoggedIn() || authStore.isGuest());
  const [isAdminPath, setIsAdminPath] = useState(() => typeof window !== "undefined" && (window.location.pathname === "/admin" || window.location.pathname === "/vault"));

  useEffect(() => {
    const handleStorage = () => {
      setIsAuthenticated(authStore.isLoggedIn() || authStore.isGuest());
    };
    const handleLocationChange = () => {
      setIsAdminPath(window.location.pathname === "/admin" || window.location.pathname === "/vault");
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("popstate", handleLocationChange);
    
    const interval = setInterval(handleLocationChange, 200);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("popstate", handleLocationChange);
      clearInterval(interval);
    };
  }, []);

  const shouldShowApp = isAuthenticated || isAdminPath;

  return (
    <QueryClientProvider client={queryClient}>
      {shouldShowApp ? (
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      ) : (
        <WelcomeScreen onAuthSuccess={() => setIsAuthenticated(true)} />
      )}
      <Toaster />
    </QueryClientProvider>
  );
}
