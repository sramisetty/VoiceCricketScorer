import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Home, Users, LogOut, User, Settings, Shield, Trophy, Menu, X } from 'lucide-react';
import Logo from '@/components/Logo';



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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Logo size="medium" showText={true} />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            {/* Navigation Links */}
            <Button
              variant="ghost"
              onClick={() => setLocation('/')}
              className="flex items-center gap-1 lg:gap-2 text-sm lg:text-base px-2 lg:px-3"
            >
              <Home className="w-4 h-4" />
              <span className="hidden lg:inline">Matches</span>
            </Button>

            {user && (user.role === 'admin' || user.role === 'global_admin') && (
              <Button
                variant="ghost"
                onClick={() => setLocation('/players')}
                className="flex items-center gap-1 lg:gap-2 text-sm lg:text-base px-2 lg:px-3"
              >
                <Users className="w-4 h-4" />
                <span className="hidden lg:inline">Players</span>
              </Button>
            )}

            {user && (user.role === 'admin' || user.role === 'global_admin' || user.role === 'franchise_admin') && (
              <Button
                variant="ghost"
                onClick={() => setLocation('/franchises')}
                className="flex items-center gap-1 lg:gap-2 text-sm lg:text-base px-2 lg:px-3"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden lg:inline">Franchises</span>
              </Button>
            )}

            {user && (user.role === 'admin' || user.role === 'global_admin') && (
              <Button
                variant="ghost"
                onClick={() => setLocation('/user-management')}
                className="flex items-center gap-1 lg:gap-2 text-sm lg:text-base px-2 lg:px-3"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden lg:inline">Users</span>
              </Button>
            )}
            
            {/* Stats and Analytics - Available to all users */}

            <Button
              variant="ghost"
              onClick={() => setLocation('/archives')}
              className="flex items-center gap-1 lg:gap-2 text-sm lg:text-base px-2 lg:px-3"
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden lg:inline">Archives</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => setLocation('/player-stats')}
              className="flex items-center gap-1 lg:gap-2 text-sm lg:text-base px-2 lg:px-3"
            >
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">Stats</span>
            </Button>
            


            {/* User Menu or Login */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 lg:gap-3 px-2 lg:px-3">
                    <Avatar className="h-7 w-7 lg:h-8 lg:w-8">
                      <AvatarFallback className="text-xs lg:text-sm">
                        {getUserInitials(user.firstName, user.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden xl:flex flex-col items-start">
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
                  className="text-sm lg:text-base px-2 lg:px-4"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => setLocation('/register')}
                  className="bg-green-600 hover:bg-green-700 text-sm lg:text-base px-2 lg:px-4"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Button
                variant="ghost"
                onClick={() => {
                  setLocation('/');
                  setMobileMenuOpen(false);
                }}
                className="w-full justify-start"
              >
                <Home className="w-4 h-4 mr-3" />
                Matches
              </Button>

              {user && (user.role === 'admin' || user.role === 'global_admin') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLocation('/players');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start"
                >
                  <Users className="w-4 h-4 mr-3" />
                  Players
                </Button>
              )}

              {user && (user.role === 'admin' || user.role === 'global_admin' || user.role === 'franchise_admin') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLocation('/franchises');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start"
                >
                  <Shield className="w-4 h-4 mr-3" />
                  Franchises
                </Button>
              )}

              {user && (user.role === 'admin' || user.role === 'global_admin') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLocation('/user-management');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start"
                >
                  <Shield className="w-4 h-4 mr-3" />
                  Users
                </Button>
              )}

              <Button
                variant="ghost"
                onClick={() => {
                  setLocation('/archives');
                  setMobileMenuOpen(false);
                }}
                className="w-full justify-start"
              >
                <Trophy className="w-4 h-4 mr-3" />
                Archives
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setLocation('/player-stats');
                  setMobileMenuOpen(false);
                }}
                className="w-full justify-start"
              >
                <Users className="w-4 h-4 mr-3" />
                Player Stats
              </Button>

              {/* Mobile user menu */}
              {user ? (
                <div className="border-t pt-3 mt-3">
                  <div className="px-3 pb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {getUserInitials(user.firstName, user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        <Badge className={`text-xs mt-1 ${getRoleColor(user.role)}`}>
                          {user.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setLocation('/profile');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start"
                  >
                    <User className="w-4 h-4 mr-3" />
                    Profile
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setLocation('/settings');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start"
                  >
                    <Settings className="w-4 h-4 mr-3" />
                    Settings
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start text-red-600"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Log out
                  </Button>
                </div>
              ) : (
                <div className="border-t pt-3 mt-3 space-y-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setLocation('/login');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={() => {
                      setLocation('/register');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}