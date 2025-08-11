import { Link, useLocation } from "wouter";
import { Home, Building2, Building, BarChart3, Users, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "../ui/logo";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Ejendomme", href: "/properties", icon: Building2 },
  { name: "Lejemål", href: "/leases", icon: FileText },
  { name: "Lejere", href: "/tenants", icon: User },
  { name: "Koncern", href: "/companies", icon: Building },
  { name: "Brugere", href: "/users", icon: Users, adminOnly: true },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-gray-200">
      <div className="flex flex-col flex-grow pt-20 overflow-y-auto">
        <nav className="flex-1 px-4 pb-4 space-y-1">
          {navigation.filter(item => !item.adminOnly || user?.role === 'admin').map((item) => {
            const isActive = location === item.href || 
              (item.href !== "/dashboard" && location.startsWith(item.href));
            
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary border-r-2 border-primary" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
                data-testid={`nav-${item.name.toLowerCase()}`}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-500"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}