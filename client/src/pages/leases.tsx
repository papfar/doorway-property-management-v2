import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FileText, Building2, Users, ArrowUpDown, Search, Filter, Eye, Edit2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeaseForm } from "@/components/leases/LeaseForm";
import { LeaseTenantForm } from "@/components/leases/LeaseTenantForm";
import { LeaseTenantsManager } from "@/components/leases/LeaseTenantsManager";
import { useAuth } from "@/hooks/useAuth";
import type { Lease, Property, LeaseTenant } from "@shared/schema";

type LeaseWithProperty = Lease & { property: Property };

type SortField = 'name' | 'type' | 'property' | 'area' | 'rent';
type SortDirection = 'asc' | 'desc';

export default function Leases() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [managingLease, setManagingLease] = useState<Lease | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { data: leases = [], isLoading } = useQuery<LeaseWithProperty[]>({
    queryKey: ['/api/leases'],
  });

  // Get all lease-tenants for showing active status
  const { data: allLeaseTenants = [] } = useQuery<(LeaseTenant & { tenant: { name: string; internalNumber: number } })[]>({
    queryKey: ['/api/all-lease-tenants'],
    enabled: leases.length > 0,
  });

  const { data: tenants = [] } = useQuery<LeaseTenant[]>({
    queryKey: ['/api/leases', selectedLeaseId, 'tenants'],
    enabled: !!selectedLeaseId,
  });

  const canCreateOrEdit = user?.role === 'admin';

  const handleCreateTenant = (leaseId: string) => {
    setSelectedLeaseId(leaseId);
    setIsTenantDialogOpen(true);
  };

  const handleManageLeaseTenantsOld = (lease: Lease) => {
    setManagingLease(lease);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedLeases = useMemo(() => {
    let filtered = leases.filter(lease => {
      const matchesSearch = lease.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           lease.property.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || lease.type === typeFilter;
      return matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'type':
          aValue = a.type?.toLowerCase() || '';
          bValue = b.type?.toLowerCase() || '';
          break;
        case 'property':
          aValue = a.property.name.toLowerCase();
          bValue = b.property.name.toLowerCase();
          break;
        case 'area':
          aValue = a.totalArea;
          bValue = b.totalArea;
          break;
        case 'rent':
          aValue = parseFloat(a.maxRentPerSqm || '0');
          bValue = parseFloat(b.maxRentPerSqm || '0');
          break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [leases, searchQuery, typeFilter, sortField, sortDirection]);

  const uniqueTypes = useMemo(() => {
    const types = leases.map(lease => lease.type).filter(Boolean);
    return Array.from(new Set(types));
  }, [leases]);

  // Helper function to get active lease-tenant for a lease
  const getActiveLeaseTenant = (leaseId: string) => {
    const now = new Date();
    return allLeaseTenants.find(lt => {
      if (lt.leaseId !== leaseId) return false;
      
      const startDate = new Date(lt.periodStart);
      const endDate = lt.periodEnd ? new Date(lt.periodEnd) : null;
      
      return now >= startDate && (!endDate || now <= endDate);
    });
  };

  // Helper function to check if lease is actively rented
  const isLeaseRented = (leaseId: string) => {
    return !!getActiveLeaseTenant(leaseId);
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatArea = (area: number) => {
    return new Intl.NumberFormat('da-DK').format(area);
  };

  const getLeaseTypeColor = (type: string) => {
    switch (type) {
      case 'Bolig': return 'bg-blue-100 text-blue-800';
      case 'Detail': return 'bg-green-100 text-green-800';
      case 'Kontor': return 'bg-purple-100 text-purple-800';
      case 'Lager': return 'bg-orange-100 text-orange-800';
      case 'Garage': return 'bg-gray-100 text-gray-800';
      case 'Industri': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Lejemål</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900">Lejemål</h1>
        </div>
        {canCreateOrEdit && (
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="button-create-lease"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nyt lejemål
          </Button>
        )}
      </div>

      {leases.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Ingen lejemål endnu
            </h2>
            <p className="text-gray-600 mb-4">
              {canCreateOrEdit 
                ? "Kom i gang ved at oprette dit første lejemål." 
                : "Der er ikke oprettet nogen lejemål endnu."}
            </p>
            {canCreateOrEdit && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Opret lejemål
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Filters and search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Søg efter lejemål eller ejendom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-leases"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48" data-testid="select-filter-type">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrer efter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle typer</SelectItem>
                {uniqueTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-600">
            Viser {filteredAndSortedLeases.length} af {leases.length} lejemål
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('name')}
                      className="h-auto p-0 font-semibold"
                      data-testid="sort-name"
                    >
                      Navn
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('type')}
                      className="h-auto p-0 font-semibold"
                      data-testid="sort-type"
                    >
                      Type
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('property')}
                      className="h-auto p-0 font-semibold"
                      data-testid="sort-property"
                    >
                      Ejendom
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('area')}
                      className="h-auto p-0 font-semibold"
                      data-testid="sort-area"
                    >
                      Areal
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('rent')}
                      className="h-auto p-0 font-semibold"
                      data-testid="sort-rent"
                    >
                      Max leje/m²
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">Lejer</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedLeases.map((lease) => (
                  <TableRow key={lease.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="font-medium">{lease.name}</div>
                      <div className="text-sm text-gray-500">
                        {formatArea(lease.totalArea)} m² samlet areal
                      </div>
                    </TableCell>
                    <TableCell>
                      {lease.type && (
                        <Badge className={getLeaseTypeColor(lease.type)}>
                          {lease.type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                        {lease.property.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatArea(lease.totalArea)} m²
                    </TableCell>
                    <TableCell className="text-right">
                      {lease.maxRentPerSqm ? formatCurrency(lease.maxRentPerSqm) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const activeTenant = getActiveLeaseTenant(lease.id);
                        return activeTenant ? (
                          <div className="text-sm">
                            <div className="font-medium">
                              <Link 
                                href={`/tenants?search=${encodeURIComponent(activeTenant.tenant.internalNumber.toString())}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                data-testid={`link-tenant-${activeTenant.tenant.internalNumber}`}
                              >
                                {user?.role === 'broker' ? `Lejer ${activeTenant.tenant.internalNumber}` : activeTenant.tenant.name}
                              </Link>
                            </div>
                            <div className="text-gray-500 text-xs">
                              {formatCurrency(activeTenant.rentAmount)}/mdr
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center space-y-1">
                        {lease.vatRegistered && (
                          <Badge variant="secondary" className="text-xs">
                            Moms
                          </Badge>
                        )}
                        {isLeaseRented(lease.id) ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            Udlejet
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Tomgang
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${lease.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/leases/${lease.id}`} data-testid={`menu-view-${lease.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Se lejemål
                            </Link>
                          </DropdownMenuItem>
                          {canCreateOrEdit && (
                            <>
                              <DropdownMenuItem onClick={() => setEditingLease(lease)} data-testid={`menu-edit-${lease.id}`}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Rediger
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setManagingLease(lease)} data-testid={`menu-manage-tenants-${lease.id}`}>
                                <Users className="h-4 w-4 mr-2" />
                                Håndter lejere
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAndSortedLeases.length === 0 && searchQuery && (
            <div className="text-center py-8 text-gray-500">
              Ingen lejemål matcher din søgning "{searchQuery}"
            </div>
          )}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nyt lejemål</DialogTitle>
          </DialogHeader>
          <LeaseForm onClose={() => setIsCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLease} onOpenChange={(open) => !open && setEditingLease(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rediger lejemål</DialogTitle>
          </DialogHeader>
          {editingLease && (
            <LeaseForm 
              lease={editingLease} 
              onClose={() => setEditingLease(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isTenantDialogOpen} onOpenChange={setIsTenantDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tilføj lejer til lejemål</DialogTitle>
          </DialogHeader>
          {selectedLeaseId && (
            <LeaseTenantForm
              leaseId={selectedLeaseId}
              onSuccess={() => {
                setIsTenantDialogOpen(false);
                setSelectedLeaseId(null);
              }}
              onCancel={() => {
                setIsTenantDialogOpen(false);
                setSelectedLeaseId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!managingLease} onOpenChange={(open) => !open && setManagingLease(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Administrer lejere</span>
            </DialogTitle>
          </DialogHeader>
          {managingLease && (
            <LeaseTenantsManager
              lease={managingLease}
              onClose={() => setManagingLease(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}