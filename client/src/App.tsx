import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Matches from "@/pages/matches-simple";
import MatchSetup from "@/pages/match-setup";
import MatchSettings from "@/pages/match-settings";
import Scorer from "@/pages/scorer";
import Scoreboard from "@/pages/scoreboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PlayerManagement from "@/pages/PlayerManagement";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/Navigation";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Dashboard} />
      <Route path="/matches" component={Matches} />
      <Route path="/match-setup" component={MatchSetup} />
      <Route path="/match-settings/:matchId" component={MatchSettings} />
      <Route path="/scorer/:matchId" component={Scorer} />
      <Route path="/scoreboard/:matchId" component={Scoreboard} />
      <Route path="/players" component={PlayerManagement} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <Matches />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
