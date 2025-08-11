import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatPropertyType, formatDate, formatShareDisplay, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit2, Trash2, FileText, Building2, TrendingUp, Users, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import PropertyForm from "./PropertyForm";
import { toast } from "@/hooks/use-toast";
import type { Property, Company, Lease, LeaseTenant } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export default function PropertyDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const isAdmin = user?.role === 'admin';

  const { data: property, isLoading } = useQuery<Property>({
    queryKey: ["/api/properties", id],
    enabled: !!id,
  });

  const { data: ownerCompany } = useQuery<Company>({
    queryKey: ["/api/companies", property?.ownerCompanyId],
    enabled: !!property?.ownerCompanyId,
  });

  // Get leases for this property
  const { data: propertyLeases = [] } = useQuery<(Lease & { property: Property })[]>({
    queryKey: ["/api/properties", id, "leases"],
    enabled: !!id,
  });

  // Get all lease-tenants for calculating occupancy
  const { data: allLeaseTenants = [] } = useQuery<(LeaseTenant & { tenant: { name: string; internalNumber: number } })[]>({
    queryKey: ['/api/all-lease-tenants'],
    enabled: propertyLeases.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/properties/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Ejendom slettet",
      });
      setLocation("/properties");
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    setShowForm(true);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleBackToList = () => {
    setLocation("/properties");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Ejendom ikke fundet</h1>
        <Button onClick={handleBackToList} data-testid="button-back-to-list">
          <ArrowLeft className="mr-2" size={16} />
          Tilbage til ejendomme
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={handleBackToList}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          data-testid="button-back-to-list"
        >
          <ArrowLeft className="mr-2" size={16} />
          Tilbage til ejendomme
        </Button>
        <h1 className="text-2xl font-semibold text-gray-900">{property.name}</h1>
        <p className="text-gray-600">{property.address}, {property.postalCode} {property.city}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ejendomsoplysninger</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Ejendomsnavn</label>
                  <p className="text-gray-900" data-testid="text-property-name">{property.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Ejendomstype</label>
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full" data-testid="text-property-type">
                    {formatPropertyType(property.propertyType)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Adresse</label>
                  <p className="text-gray-900" data-testid="text-address">{property.address}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Postnummer og by</label>
                  <p className="text-gray-900" data-testid="text-postal-city">
                    {property.postalCode} {property.city}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Størrelse</label>
                  <p className="text-gray-900" data-testid="text-total-size">
                    {(() => {
                      const totalArea = propertyLeases.reduce((sum, lease) => {
                        return sum + (parseFloat(lease.totalArea.toString()) || 0);
                      }, 0);
                      return `${formatNumber(totalArea.toString())} m²`;
                    })()}
                  </p>
                </div>
                {property.shareNumerator && property.shareDenominator && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-500 mb-1">Fordelingstal</label>
                    <p className="text-gray-900" data-testid="text-share-display">
                      {formatShareDisplay(property.shareNumerator, property.shareDenominator)}
                    </p>
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Ejerselskab</label>
                  <p className="text-gray-900" data-testid="text-owner-company">
                    {ownerCompany ? (
                      <span>
                        {ownerCompany.name}
                        {ownerCompany.cvrNumber && (
                          <span className="text-gray-500 ml-2">(CVR: {ownerCompany.cvrNumber})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-500">Intet selskab tilknyttet</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Info */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Økonomiske oplysninger</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Anskaffelsessum</label>
                  <p className="text-2xl font-semibold text-gray-900" data-testid="text-acquisition-price">
                    {formatNumber(property.acquisitionPrice)} kr
                  </p>
                </div>
                {property.acquisitionDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Anskaffelsesdato</label>
                    <p className="text-gray-900" data-testid="text-acquisition-date">
                      {formatDate(property.acquisitionDate)}
                    </p>
                  </div>
                )}
                {/* Total Deposits and Prepaid Rent */}
                {propertyLeases.length > 0 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Total depositum</label>
                      <p className="text-gray-900" data-testid="text-total-deposits">
                        {(() => {
                          const totalDeposits = allLeaseTenants
                            .filter(lt => 
                              propertyLeases.some(lease => lease.id === lt.leaseId) &&
                              (!lt.periodEnd || new Date(lt.periodEnd) > new Date()) &&
                              lt.depositType !== 'none'
                            )
                            .reduce((sum, lt) => sum + (parseFloat(lt.depositAmount || '0') || 0), 0);
                          return `${formatNumber(totalDeposits.toString())} kr`;
                        })()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Total forudbetalt leje</label>
                      <p className="text-gray-900" data-testid="text-total-prepaid">
                        {(() => {
                          const totalPrepaid = allLeaseTenants
                            .filter(lt => 
                              propertyLeases.some(lease => lease.id === lt.leaseId) &&
                              (!lt.periodEnd || new Date(lt.periodEnd) > new Date()) &&
                              lt.prepaidType !== 'none'
                            )
                            .reduce((sum, lt) => sum + (parseFloat(lt.prepaidAmount || '0') || 0), 0);
                          return `${formatNumber(totalPrepaid.toString())} kr`;
                        })()}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {isAdmin && (
            <div className="mt-6 space-y-2">
              <Button 
                onClick={handleEdit}
                className="w-full flex items-center justify-center"
                data-testid="button-edit-property"
              >
                <Edit className="mr-2" size={16} />
                Redigér ejendom
              </Button>
              <Button 
                variant="outline"
                onClick={handleDelete}
                className="w-full flex items-center justify-center text-red-600 border-red-300 hover:bg-red-50"
                data-testid="button-delete-property"
              >
                <Trash2 className="mr-2" size={16} />
                Slet ejendom
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Leases and Statistics */}
      {propertyLeases.length > 0 && (
        <div className="mt-8 space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Occupancy Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Udlejning</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {(() => {
                  const occupiedLeases = propertyLeases.filter(lease => {
                    return allLeaseTenants.some(lt => 
                      lt.leaseId === lease.id && 
                      (!lt.periodEnd || new Date(lt.periodEnd) > new Date())
                    );
                  });
                  const occupancyRate = propertyLeases.length > 0 ? (occupiedLeases.length / propertyLeases.length) * 100 : 0;
                  
                  return (
                    <>
                      <div className="text-2xl font-bold">{Math.round(occupancyRate)}%</div>
                      <p className="text-xs text-muted-foreground">
                        {occupiedLeases.length} af {propertyLeases.length} lejemål udlejet
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Potential Income */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Potentiale</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {(() => {
                  const potentialIncome = propertyLeases.reduce((sum, lease) => {
                    const area = parseFloat(lease.totalArea.toString()) || 0;
                    const maxRent = parseFloat(lease.maxRentPerSqm?.toString() || '0') || 0;
                    return sum + (area * maxRent); // maxRentPerSqm er allerede årligt
                  }, 0);
                  
                  return (
                    <>
                      <div className="text-2xl font-bold">{formatNumber(potentialIncome.toString())} kr</div>
                      <p className="text-xs text-muted-foreground">
                        Årlig lejeindtægt ved fuld udlejning
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Current Income */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktuel Indtægt</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {(() => {
                  const currentIncome = allLeaseTenants
                    .filter(lt => 
                      propertyLeases.some(lease => lease.id === lt.leaseId) &&
                      (!lt.periodEnd || new Date(lt.periodEnd) > new Date())
                    )
                    .reduce((sum, lt) => sum + (parseFloat(lt.rentAmount) || 0), 0) * 12; // Årlig indtægt
                  
                  return (
                    <>
                      <div className="text-2xl font-bold">{formatNumber(currentIncome.toString())} kr</div>
                      <p className="text-xs text-muted-foreground">
                        Nuværende årlig lejeindtægt
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Leases List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Tilknyttede lejemål ({propertyLeases.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {propertyLeases.map((lease) => {
                  const activeTenant = allLeaseTenants.find(lt => 
                    lt.leaseId === lease.id && 
                    (!lt.periodEnd || new Date(lt.periodEnd) > new Date())
                  );
                  
                  return (
                    <div key={lease.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setLocation(`/leases/${lease.id}`)}>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium text-blue-600 hover:text-blue-800">{lease.name}</h4>
                          {lease.type && (
                            <Badge variant="outline" className="text-xs">
                              {lease.type}
                            </Badge>
                          )}
                          {activeTenant ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Udlejet
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              Tomgang
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {formatNumber(Math.round(parseFloat(lease.totalArea.toString())).toString())} m²
                          {lease.maxRentPerSqm && ` • Max ${formatCurrency(lease.maxRentPerSqm.toString())}/m²`}
                          {lease.vatRegistered && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                              Moms
                            </span>
                          )}
                        </div>
                        {activeTenant && (
                          <div className="text-sm text-gray-500 mt-1">
                            {user?.role === 'broker' ? 
                              `Lejer ${activeTenant.tenant.internalNumber}` : 
                              activeTenant.tenant.name
                            } • {formatCurrency(activeTenant.rentAmount || '0')}/mdr
                            {(() => {
                              const monthlyRent = parseFloat(activeTenant.rentAmount?.toString() || '0') || 0;
                              const area = parseFloat(lease.totalArea.toString()) || 0;
                              const yearlyRentPerSqm = area > 0 ? (monthlyRent * 12) / area : 0;
                              return ` • ${formatCurrency(yearlyRentPerSqm.toString())}/m²/år`;
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <PropertyForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        property={property}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet ejendom</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette ejendommen "{property.name}"? 
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuller</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Sletter..." : "Slet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
