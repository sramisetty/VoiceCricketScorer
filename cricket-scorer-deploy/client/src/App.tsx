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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Matches} />
      <Route path="/matches" component={Matches} />
      <Route path="/match-setup" component={MatchSetup} />
      <Route path="/match-settings/:matchId" component={MatchSettings} />
      <Route path="/scorer/:matchId" component={Scorer} />
      <Route path="/scoreboard/:matchId" component={Scoreboard} />
      <Route component={NotFound} />
    </Switch>
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
