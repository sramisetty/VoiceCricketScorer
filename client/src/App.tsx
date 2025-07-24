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
import UserManagement from "@/pages/UserManagement";
import FranchiseManagementComplete from "@/pages/FranchiseManagementComplete";
import MatchStats from "@/pages/MatchStats";
import Archives from "@/pages/Archives";
import PlayerStats from "@/pages/PlayerStats";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/Navigation";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Dashboard} />
      <Route path="/matches" component={MatchesWithNav} />
      <Route path="/match-setup" component={MatchSetupWithNav} />
      <Route path="/match-settings/:matchId" component={MatchSettingsWithNav} />
      <Route path="/scorer/:matchId" component={ScorerWithNav} />
      <Route path="/scoreboard/:matchId" component={ScoreboardWithNav} />
      <Route path="/players" component={PlayerManagementWithNav} />
      <Route path="/user-management" component={UserManagementWithNav} />
      <Route path="/franchises" component={FranchiseManagementWithNav} />
      <Route path="/match-stats" component={MatchStatsWithNav} />
      <Route path="/archives" component={ArchivesWithNav} />
      <Route path="/player-stats" component={PlayerStatsWithNav} />
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

function MatchesWithNav() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <Matches />
      </div>
    </div>
  );
}

function MatchSetupWithNav() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <MatchSetup />
      </div>
    </div>
  );
}

function ScorerWithNav({ params }: { params: { matchId: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Scorer params={params} />
    </div>
  );
}

function ScoreboardWithNav({ params }: { params: { matchId: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Scoreboard params={params} />
    </div>
  );
}

function PlayerManagementWithNav() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <PlayerManagement />
      </div>
    </div>
  );
}

function UserManagementWithNav() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <UserManagement />
      </div>
    </div>
  );
}

function FranchiseManagementWithNav() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <FranchiseManagementComplete />
      </div>
    </div>
  );
}

function MatchStatsWithNav() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <MatchStats />
      </div>
    </div>
  );
}

function ArchivesWithNav() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <Archives />
      </div>
    </div>
  );
}

function PlayerStatsWithNav() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <PlayerStats />
      </div>
    </div>
  );
}

function MatchSettingsWithNav({ params }: { params: { matchId: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <MatchSettings params={params} />
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
