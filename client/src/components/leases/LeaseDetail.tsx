import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Edit, Trash2, Building2, Users, TrendingUp, Calendar, DollarSign, FileText, Calculator, Banknote } from "lucide-react";
import { LeaseForm } from "./LeaseForm";
import { LeaseTenantForm } from "./LeaseTenantForm";
import { toast } from "@/hooks/use-toast";
import type { Lease, Property, LeaseTenant, Tenant } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

type LeaseWithProperty = Lease & { property: Property };
type LeaseTenantWithTenant = LeaseTenant & { tenant: Tenant };

export default function LeaseDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTenantForm, setShowTenantForm] = useState(false);
  
  const canEdit = user?.role === 'admin';

  const { data: lease, isLoading } = useQuery<LeaseWithProperty>({
    queryKey: ["/api/leases", id],
    enabled: !!id,
  });

  // Get historical tenants for this lease
  const { data: tenantHistory = [] } = useQuery<LeaseTenantWithTenant[]>({
    queryKey: ["/api/leases", id, "tenants"],
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/leases/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      toast({
        title: "Succes",
        description: "Lejemål slettet",
      });
      setLocation("/leases");
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl ved sletning af lejemål",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900">Lejemål ikke fundet</h2>
        <Button 
          variant="outline" 
          onClick={() => setLocation("/leases")}
          className="mt-4"
          data-testid="button-back-to-leases"
        >
          <ArrowLeft className="mr-2" size={16} />
          Tilbage til lejemål
        </Button>
      </div>
    );
  }

  // Calculate current annual rent (from active contracts)
  const currentTenants = tenantHistory.filter(t => !t.periodEnd || new Date(t.periodEnd) >= new Date());
  const currentAnnualRent = currentTenants.reduce((sum, t) => sum + (parseFloat(t.rentAmount) * 12), 0);

  // Calculate potential annual rent (based on max rent per sqm)
  const potentialAnnualRent = lease.maxRentPerSqm 
    ? parseFloat(lease.maxRentPerSqm) * lease.totalArea 
    : null;

  // Sort tenant history by period start date (newest first)
  const sortedTenantHistory = [...tenantHistory].sort((a, b) => 
    new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()
  );

  const getRegulationTypeLabel = (type: string) => {
    switch (type) {
      case "NPI": return "NPI";
      case "NPI_min_1": return "NPI min. 1%";
      case "NPI_min_2": return "NPI min. 2%";
      case "NPI_min_3": return "NPI min. 3%";
      case "none": return "Ingen regulering";
      default: return type;
    }
  };

  const getStatusBadge = (tenant: LeaseTenantWithTenant) => {
    const now = new Date();
    const start = new Date(tenant.periodStart);
    const end = tenant.periodEnd ? new Date(tenant.periodEnd) : null;

    if (start > now) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700">Kommende</Badge>;
    } else if (!end || end >= now) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Aktiv</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Tidligere</Badge>;
    }
  };

  const getTotalAdvances = (tenant: LeaseTenantWithTenant) => {
    const advances = [
      tenant.advanceWater ? parseFloat(tenant.advanceWater) : 0,
      tenant.advanceHeating ? parseFloat(tenant.advanceHeating) : 0,
      tenant.advanceElectricity ? parseFloat(tenant.advanceElectricity) : 0,
      tenant.advanceOther ? parseFloat(tenant.advanceOther) : 0,
    ];
    return advances.reduce((sum, advance) => sum + advance, 0);
  };

  return (
    <>
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => setLocation("/leases")}
          className="mb-4"
          data-testid="button-back-to-leases"
        >
          <ArrowLeft className="mr-2" size={16} />
          Tilbage til lejemål
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900" data-testid="text-lease-name">
              {lease.name}
            </h1>
            <p className="text-gray-600 mt-1" data-testid="text-property-name">
              {lease.property?.name || 'Ukendt ejendom'}
            </p>
          </div>
          {canEdit && (
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowForm(true)}
                data-testid="button-edit-lease"
              >
                <Edit className="mr-2" size={16} />
                Rediger
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
                data-testid="button-delete-lease"
              >
                <Trash2 className="mr-2" size={16} />
                Slet
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Basic Information Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grundoplysninger</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Type:</span> {lease.type}
              </div>
              <div>
                <span className="font-medium">Tinglyst areal:</span> {formatNumber(lease.registeredArea)} m²
              </div>
              <div>
                <span className="font-medium">Samlet areal:</span> {formatNumber(lease.totalArea)} m²
              </div>
              <div>
                <span className="font-medium">Momsregistreret:</span> {lease.vatRegistered ? "Ja" : "Nej"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Information Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Økonomiske oplysninger</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Faktisk årlig leje:</span>
                <div className="text-lg font-bold text-green-600" data-testid="text-current-rent">
                  {formatCurrency(currentAnnualRent)}
                </div>
              </div>
              {potentialAnnualRent && (
                <div>
                  <span className="font-medium">Årligt potentiale:</span>
                  <div className="text-lg font-bold text-blue-600" data-testid="text-potential-rent">
                    {formatCurrency(potentialAnnualRent)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Yield Requirement Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Afkastkrav</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {lease.yieldRequirementPct ? (
                <div className="text-2xl font-bold text-purple-600" data-testid="text-yield-requirement">
                  {parseFloat(lease.yieldRequirementPct).toFixed(2)}%
                </div>
              ) : (
                <div className="text-gray-500">Ikke angivet</div>
              )}
              {lease.maxRentPerSqm && (
                <div>
                  <span className="font-medium">Max leje pr. m²:</span>
                  <div className="text-sm" data-testid="text-max-rent-sqm">
                    {formatCurrency(parseFloat(lease.maxRentPerSqm))}/m²
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Tenants Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive lejere</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-tenants">
              {currentTenants.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {tenantHistory.length} total i historik
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant History Table */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Lejerhistorik</span>
          </CardTitle>
          {canEdit && (
            <Button 
              onClick={() => setShowTenantForm(true)}
              data-testid="button-add-tenant"
            >
              Tilføj lejer
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {sortedTenantHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Ingen lejere registreret endnu
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Lejer</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Månedlig leje</TableHead>
                    <TableHead className="text-right">Leje/m²</TableHead>
                    <TableHead className="text-right">Aconto forbrug</TableHead>
                    <TableHead className="text-right">Forudbetalt</TableHead>
                    <TableHead>Regulering</TableHead>
                    <TableHead className="text-right">Depositum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTenantHistory.map((tenant) => {
                    const monthlyRent = parseFloat(tenant.rentAmount);
                    const rentPerSqm = monthlyRent / lease.totalArea;
                    const totalAdvances = getTotalAdvances(tenant);
                    const prepaidAmount = tenant.prepaidAmount ? parseFloat(tenant.prepaidAmount) : 0;

                    return (
                      <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                        <TableCell>
                          {getStatusBadge(tenant)}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            <div data-testid={`text-tenant-name-${tenant.id}`}>
                              {user?.role === 'broker' ? `Lejer ${tenant.tenant.internalNumber}` : tenant.tenant.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              #{tenant.tenant.internalNumber}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div data-testid={`text-period-start-${tenant.id}`}>
                              Fra: {formatDate(tenant.periodStart)}
                            </div>
                            {tenant.periodEnd && (
                              <div data-testid={`text-period-end-${tenant.id}`}>
                                Til: {formatDate(tenant.periodEnd)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium" data-testid={`text-monthly-rent-${tenant.id}`}>
                          {formatCurrency(monthlyRent)}
                        </TableCell>
                        <TableCell className="text-right font-medium" data-testid={`text-rent-per-sqm-${tenant.id}`}>
                          {formatCurrency(rentPerSqm * 12)}/m²
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-advances-${tenant.id}`}>
                          {totalAdvances > 0 ? formatCurrency(totalAdvances) : "-"}
                          {totalAdvances > 0 && (
                            <div className="text-xs text-gray-500">
                              {tenant.advanceWater && `V: ${formatCurrency(parseFloat(tenant.advanceWater))}`}
                              {tenant.advanceHeating && ` H: ${formatCurrency(parseFloat(tenant.advanceHeating))}`}
                              {tenant.advanceElectricity && ` E: ${formatCurrency(parseFloat(tenant.advanceElectricity))}`}
                              {tenant.advanceOther && ` Ø: ${formatCurrency(parseFloat(tenant.advanceOther))}`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-prepaid-${tenant.id}`}>
                          {prepaidAmount > 0 ? formatCurrency(prepaidAmount) : "-"}
                          {tenant.prepaidType !== "none" && tenant.prepaidType !== "amount" && prepaidAmount > 0 && (
                            <div className="text-xs text-gray-500">
                              ({tenant.prepaidType.replace("_", " ")})
                            </div>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-regulation-${tenant.id}`}>
                          {getRegulationTypeLabel(tenant.regulationType)}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-deposit-${tenant.id}`}>
                          {tenant.depositAmount 
                            ? formatCurrency(parseFloat(tenant.depositAmount))
                            : "-"
                          }
                          {tenant.depositType !== "none" && tenant.depositType !== "amount" && (
                            <div className="text-xs text-gray-500">
                              ({tenant.depositType.replace("_", " ")})
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rent Development Statistics */}
      {sortedTenantHistory.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Lejeudvikling</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => {
                const rents = sortedTenantHistory.map(t => parseFloat(t.rentAmount)).reverse();
                const firstRent = rents[0];
                const lastRent = rents[rents.length - 1];
                const totalChange = lastRent - firstRent;
                const percentChange = ((lastRent - firstRent) / firstRent) * 100;
                const avgRent = rents.reduce((sum, rent) => sum + rent, 0) / rents.length;

                return (
                  <>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-sm text-gray-600">Første registrerede leje</div>
                      <div className="text-xl font-bold text-blue-600" data-testid="text-first-rent">
                        {formatCurrency(firstRent)}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-sm text-gray-600">Nuværende leje</div>
                      <div className="text-xl font-bold text-green-600" data-testid="text-current-monthly-rent">
                        {formatCurrency(lastRent)}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-sm text-gray-600">Samlet ændring</div>
                      <div className={`text-xl font-bold ${totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-rent-change">
                        {totalChange >= 0 ? '+' : ''}{formatCurrency(totalChange)}
                      </div>
                      <div className={`text-sm ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-rent-change-percent">
                        ({percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%)
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forms and Dialogs */}
      {showForm && (
        <LeaseForm 
          lease={lease} 
          onClose={() => setShowForm(false)} 
        />
      )}

      {showTenantForm && (
        <LeaseTenantForm 
          leaseId={lease.id}
          onSuccess={() => {
            setShowTenantForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/leases", id, "tenants"] });
          }}
          onCancel={() => setShowTenantForm(false)} 
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet lejemål</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette dette lejemål? Denne handling kan ikke fortrydes.
              Alle tilknyttede lejere og kontrakter vil også blive slettet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Annuller
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
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