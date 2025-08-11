import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Key, LogOut, ChevronDown } from "lucide-react";
import { Logo } from "../ui/logo";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";

export default function TopBar() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Success",
        description: "Du er nu logget ud",
      });
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Kunne ikke logge ud",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  return (
    <header className="bg-white border-b border-gray-200 h-16 fixed top-0 left-0 right-0 z-30">
      <div className="flex items-center justify-between h-full px-6">
        {/* Logo */}
        <Logo size="sm" />

        {/* Avatar Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              data-testid="avatar-button"
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-white text-sm font-medium">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-gray-700">{user.name}</span>
              <ChevronDown className="text-gray-400 text-xs" size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem 
              onClick={() => setLocation("/profile")}
              className="flex items-center cursor-pointer"
              data-testid="menu-profile"
            >
              <User className="w-4 mr-3 text-gray-400" size={16} />
              Min profil
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setLocation("/profile?tab=password")}
              className="flex items-center cursor-pointer"
              data-testid="menu-change-password"
            >
              <Key className="w-4 mr-3 text-gray-400" size={16} />
              Skift adgangskode
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="flex items-center cursor-pointer text-red-600 hover:bg-red-50"
              data-testid="menu-logout"
            >
              <LogOut className="w-4 mr-3" size={16} />
              Log ud
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
