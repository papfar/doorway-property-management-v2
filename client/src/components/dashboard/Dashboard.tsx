import DashboardStats from "./DashboardStats";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Building, Plus, ToggleLeft, ToggleRight, Info } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import PropertyForm from "../properties/PropertyForm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDateTime, formatDate, formatPropertyType } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Property } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery<{
    count: number;
    totalValue: string;
    latestProperty: { name: string; acquisitionDate: string } | null;
    leaseStats: { count: number; totalRentCapacity: string };
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentProperties } = useQuery<Property[]>({
    queryKey: ["/api/dashboard/recent"],
  });

  const handleCreateFirstProperty = () => {
    setShowForm(true);
  };

  const handleGoToProperties = () => {
    setLocation("/properties");
  };

  const toggleViewModeMutation = useMutation({
    mutationFn: async (newMode: "total" | "weighted") => {
      await apiRequest("/api/user/preferences", "PUT", { dashboardViewMode: newMode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Visningsform opdateret",
        description: user?.dashboardViewMode === "total" ? "Viser nu vægtet andel" : "Viser nu total portefølje",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke opdatere visningsform",
        variant: "destructive",
      });
    },
  });

  const handleToggleViewMode = () => {
    const newMode = user?.dashboardViewMode === "total" ? "weighted" : "total";
    toggleViewModeMutation.mutate(newMode);
  };

  // Show empty state if no properties exist
  if (stats && stats.count === 0) {
    return (
      <>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Oversigt over dine ejendomme og nøgletal</p>
        </div>

        <div className="text-center py-12" data-testid="dashboard-empty-state">
          <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Building className="text-gray-400 text-3xl" size={48} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen ejendomme endnu</h3>
          <p className="text-gray-600 mb-6 max-w-sm mx-auto">
            Kom i gang ved at oprette din første ejendom og se dine nøgletal her.
          </p>
          <Button onClick={handleCreateFirstProperty} data-testid="button-create-first-property">
            <Plus className="mr-2" size={16} />
            Opret første ejendom
          </Button>
        </div>

        <PropertyForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
              {user?.role === "broker" && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  Mægler (læseadgang)
                </Badge>
              )}
            </div>
            <p className="text-gray-600 mt-1">Oversigt over dine ejendomme og nøgletal</p>
          </div>
          
{user?.role !== "broker" && (
            <TooltipProvider>
              <div className="flex items-center space-x-3">
                <span className={`text-sm ${user?.dashboardViewMode === "total" ? "font-medium text-gray-900" : "text-gray-500"}`}>
                  Total portefølje
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleViewMode}
                  disabled={toggleViewModeMutation.isPending}
                  data-testid="button-toggle-view-mode"
                  className="p-1"
                >
                  {user?.dashboardViewMode === "total" ? (
                    <ToggleLeft className="h-6 w-6 text-gray-400" />
                  ) : (
                    <ToggleRight className="h-6 w-6 text-blue-600" />
                  )}
                </Button>
                <span className={`text-sm ${user?.dashboardViewMode === "weighted" ? "font-medium text-gray-900" : "text-gray-500"}`}>
                  Vægtet andel
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-1">
                      <Info className="h-4 w-4 text-gray-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2">
                      <p className="font-medium">Forskel på visningstyper:</p>
                      <div className="text-sm space-y-1">
                        <p><strong>Total portefølje:</strong> Viser alle ejendomme i koncernen</p>
                        <p><strong>Vægtet andel:</strong> Viser din relative andel baseret på koncernens struktur og ejerandele</p>
                      </div>
                      {user && (
                        <div className="text-xs text-gray-500 pt-1 border-t">
                          Du er logget ind som <strong>{user.name}</strong>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

      <DashboardStats />
      


      <Card className="mt-8">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Seneste aktivitet</h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGoToProperties}
              data-testid="button-view-all-properties"
            >
              Se alle ejendomme
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          {recentProperties && recentProperties.length > 0 ? (
            <div className="space-y-0">
              {recentProperties.map((property, index) => (
                <div 
                  key={property.id} 
                  className={`flex items-center space-x-4 p-6 ${
                    index < recentProperties.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                  data-testid={`recent-property-${property.id}`}
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Plus className="text-blue-600 text-sm" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium" data-testid={`text-property-name-${property.id}`}>
                        {property.name}
                      </span> blev anskaffet
                    </p>
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-xs text-gray-500" data-testid={`text-property-type-${property.id}`}>
                        {formatPropertyType(property.propertyType)}
                      </p>
                      <p className="text-xs text-gray-500" data-testid={`text-acquisition-date-${property.id}`}>
                        {property.acquisitionDate ? formatDate(property.acquisitionDate) : 'Ukendt dato'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6">
              <p className="text-gray-500 text-sm">Ingen aktivitet endnu</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
