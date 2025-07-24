import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Home, Users, Trophy, LogOut, User, Settings, Shield } from 'lucide-react';

interface UserData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default function Navigation() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check for stored user data
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    toast({
      title: 'Logged out',
      description: 'You have been logged out successfully'
    });
    setLocation('/');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'global_admin': return 'bg-red-100 text-red-800';
      case 'franchise_admin': return 'bg-blue-100 text-blue-800';
      case 'coach': return 'bg-blue-100 text-blue-800';
      case 'scorer': return 'bg-green-100 text-green-800';
      case 'player': return 'bg-purple-100 text-purple-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Trophy className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold text-gray-900">Cricket Scorer</h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Navigation Links */}
            <Button
              variant="ghost"
              onClick={() => setLocation('/')}
              className="flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Matches
            </Button>

            {user && (user.role === 'admin' || user.role === 'coach' || user.role === 'scorer' || user.role === 'global_admin' || user.role === 'franchise_admin') && (
              <Button
                variant="ghost"
                onClick={() => setLocation('/players')}
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Players
              </Button>
            )}

            {user && (user.role === 'admin' || user.role === 'global_admin' || user.role === 'franchise_admin') && (
              <Button
                variant="ghost"
                onClick={() => setLocation('/franchises')}
                className="flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Franchises
              </Button>
            )}

            {user && (user.role === 'admin' || user.role === 'coach' || user.role === 'global_admin' || user.role === 'franchise_admin') && (
              <Button
                variant="ghost"
                onClick={() => setLocation('/user-management')}
                className="flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Users
              </Button>
            )}
            
            {/* Stats and Analytics - Available to all users */}
            <Button
              variant="ghost"
              onClick={() => setLocation('/match-stats')}
              className="flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" />
              Match Stats
            </Button>

            <Button
              variant="ghost"
              onClick={() => setLocation('/archives')}
              className="flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" />
              Archives
            </Button>

            <Button
              variant="ghost"
              onClick={() => setLocation('/player-stats')}
              className="flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Player Stats
            </Button>
            
            {/* Show for all authenticated users */}
            {user && (
              <Button
                variant="ghost"
                onClick={() => setLocation('/match-setup')}
                className="flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                New Match
              </Button>
            )}

            {/* User Menu or Login */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-3 px-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-sm">
                        {getUserInitials(user.firstName, user.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">{user.firstName} {user.lastName}</span>
                      <Badge className={`text-xs ${getRoleColor(user.role)}`}>
                        {user.role}
                      </Badge>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  onClick={() => setLocation('/login')}
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => setLocation('/register')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}