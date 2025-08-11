import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Users, Calendar, DollarSign, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeaseTenantForm } from "./LeaseTenantForm";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { LeaseTenant, Tenant, Lease } from "@shared/schema";

type LeaseTenantWithTenant = LeaseTenant & { tenant: Tenant };

interface LeaseTenantsManagerProps {
  lease: Lease;
  onClose: () => void;
}

export function LeaseTenantsManager({ lease, onClose }: LeaseTenantsManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLeaseTenant, setEditingLeaseTenant] = useState<LeaseTenantWithTenant | null>(null);
  const [deletingLeaseTenant, setDeletingLeaseTenant] = useState<LeaseTenantWithTenant | null>(null);

  const { data: leaseTenants = [], isLoading } = useQuery<LeaseTenantWithTenant[]>({
    queryKey: ['/api/leases', lease.id, 'tenants'],
  });

  const canCreateOrEdit = user?.role === 'admin';

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/lease-tenants/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Lejekontrakt slettet",
        description: "Lejekontrakten er blevet slettet",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leases', lease.id, 'tenants'] });
      setDeletingLeaseTenant(null);
    },
    onError: (error) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl ved sletning af lejekontrakten",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0 kr';
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadge = (leaseTenant: LeaseTenantWithTenant) => {
    const now = new Date();
    const startDate = new Date(leaseTenant.periodStart);
    const endDate = leaseTenant.periodEnd ? new Date(leaseTenant.periodEnd) : null;

    if (now < startDate) {
      return <Badge variant="secondary">Fremtidig</Badge>;
    }
    
    if (endDate && now > endDate) {
      return <Badge variant="destructive">Udløbet</Badge>;
    }
    
    return <Badge className="bg-green-100 text-green-800">Aktiv</Badge>;
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingLeaseTenant(null);
    queryClient.invalidateQueries({ queryKey: ['/api/leases', lease.id, 'tenants'] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Indlæser lejekontraktrakter...</h3>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Lejere for {lease.name}</h3>
          <p className="text-sm text-gray-600">
            Administrer lejekontraktrakter for dette lejemål
          </p>
        </div>
        {canCreateOrEdit && (
          <Button onClick={() => setIsFormOpen(true)} data-testid="button-add-lease-tenant">
            <Plus className="mr-2 h-4 w-4" />
            Tilføj lejer
          </Button>
        )}
      </div>

      {leaseTenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Ingen lejere endnu
            </h4>
            <p className="text-gray-600 mb-4">
              {canCreateOrEdit 
                ? "Dette lejemål har ikke nogen lejekontraktrakter endnu. Kom i gang ved at tilføje den første lejer." 
                : "Der er ikke oprettet nogen lejekontraktrakter for dette lejemål endnu."}
            </p>
            {canCreateOrEdit && (
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Tilføj første lejer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lejer</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Månedlig leje</TableHead>
                <TableHead className="text-right">Depositum</TableHead>
                <TableHead className="text-right">Forudbetalt</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {canCreateOrEdit && <TableHead className="text-center">Handlinger</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaseTenants.map((leaseTenant) => (
                <TableRow key={leaseTenant.id} data-testid={`row-lease-tenant-${leaseTenant.id}`}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{leaseTenant.tenant.name}</span>
                      <span className="text-sm text-gray-500">
                        #{leaseTenant.tenant.internalNumber}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">
                        {formatDate(leaseTenant.periodStart)}
                        {leaseTenant.periodEnd && ` - ${formatDate(leaseTenant.periodEnd)}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span>{formatCurrency(leaseTenant.rentAmount)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {leaseTenant.depositType === 'none' ? 
                      'Ingen' : 
                      leaseTenant.depositAmount ? 
                        formatCurrency(leaseTenant.depositAmount) : 
                        '-'
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    {leaseTenant.prepaidType === 'none' ? 
                      'Ingen' : 
                      leaseTenant.prepaidAmount ? 
                        formatCurrency(leaseTenant.prepaidAmount) : 
                        '-'
                    }
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(leaseTenant)}
                  </TableCell>
                  {canCreateOrEdit && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingLeaseTenant(leaseTenant)}
                          data-testid={`button-edit-lease-tenant-${leaseTenant.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingLeaseTenant(leaseTenant)}
                          data-testid={`button-delete-lease-tenant-${leaseTenant.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Form Dialog */}
      <Dialog open={isFormOpen || !!editingLeaseTenant} onOpenChange={(open) => {
        if (!open) {
          setIsFormOpen(false);
          setEditingLeaseTenant(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLeaseTenant ? "Rediger lejekontrakt" : "Tilføj lejer til lejemål"}
            </DialogTitle>
            <DialogDescription>
              {editingLeaseTenant ? 
                "Rediger lejekontraktens detaljer nedenfor." : 
                "Udfyld formularen for at tilføje en ny lejer til dette lejemål."
              }
            </DialogDescription>
          </DialogHeader>
          <LeaseTenantForm
            leaseId={lease.id}
            leaseTenant={editingLeaseTenant}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingLeaseTenant(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingLeaseTenant} onOpenChange={(open) => {
        if (!open) setDeletingLeaseTenant(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span>Slet lejekontrakt</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette lejekontrakten for{" "}
              <strong>{deletingLeaseTenant?.tenant.name}</strong>?
              <br /><br />
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLeaseTenant && deleteMutation.mutate(deletingLeaseTenant.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Slet lejekontrakt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}