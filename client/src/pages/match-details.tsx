import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share2 } from 'lucide-react';
import { MatchSummary } from '@/components/match-summary';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';

export function MatchDetails() {
  const [, params] = useRoute('/match-details/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const matchId = params?.id ? parseInt(params.id) : null;

  if (!matchId) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-grow flex items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Match</h1>
            <p className="text-muted-foreground mb-4">
              The requested match ID is not valid.
            </p>
            <Button onClick={() => setLocation('/matches')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Matches
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Cricket Match Summary',
          text: 'Check out this cricket match summary',
          url: url,
        });
      } catch (error) {
        // User cancelled sharing or sharing failed
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link Copied",
      description: "Match summary link copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Navigation />
      
      <div className="flex-grow">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setLocation('/matches')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Matches
            </Button>
            
            <Button
              variant="outline"
              onClick={handleShare}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share Match
            </Button>
          </div>

          {/* Match Summary Component */}
          <MatchSummary matchId={matchId} />
        </div>
      </div>
      
      <Footer />
    </div>
  );
}