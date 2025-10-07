import { Sun, Zap, User, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export const TopHeader = () => {
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 h-16 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-full items-center justify-between px-4 gap-4">
        {/* Left Section: Trigger + Brand */}
        <div className="flex items-center gap-4">
          <SidebarTrigger className="hover:bg-accent transition-colors" />
          
          <div className="hidden md:flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-solar rounded-lg blur-sm opacity-50"></div>
              <div className="relative p-2 rounded-lg bg-gradient-solar">
                <Sun className="h-5 w-5 text-white" />
                <Zap className="h-3 w-3 text-yellow-300 absolute -top-1 -right-1" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-lg bg-gradient-solar bg-clip-text text-transparent">
                Evolight
              </h1>
              <p className="text-xs text-muted-foreground">Solar O&M Control</p>
            </div>
          </div>
        </div>

        {/* Right Section: User Info + Actions */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              3
            </Badge>
          </Button>

          {/* User Menu */}
          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-10">
                  <div className="h-8 w-8 rounded-full bg-gradient-solar flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium">{profile.nome}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {profile.role?.replace('_', ' ')}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs text-muted-foreground">
                  {profile.email}
                </DropdownMenuItem>
                {profile.telefone && (
                  <DropdownMenuItem className="text-xs text-muted-foreground">
                    {profile.telefone}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
};
