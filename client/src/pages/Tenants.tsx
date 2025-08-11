import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, User, Building, Mail, Phone, MoreHorizontal, ArrowUpDown, Search, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TenantForm } from "@/components/tenants/TenantForm";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Tenant } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export default function Tenants() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<'name' | 'email' | 'phone' | 'internalNumber'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handle URL search parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchQuery(decodeURIComponent(searchParam));
    }
  }, [location]);
  
  const canWrite = user?.role === 'admin' || user?.role === 'user';

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const filteredAndSortedTenants = useMemo(() => {
    let filtered = tenants.filter(tenant => {
      const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (tenant.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (tenant.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           tenant.internalNumber.toString().includes(searchQuery);
      const matchesType = typeFilter === "all" || tenant.type === typeFilter;
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
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          break;
        case 'phone':
          aValue = (a.phone || '').toLowerCase();
          bValue = (b.phone || '').toLowerCase();
          break;
        case 'internalNumber':
          aValue = a.internalNumber;
          bValue = b.internalNumber;
          break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [tenants, searchQuery, typeFilter, sortField, sortDirection]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const uniqueTypes = useMemo(() => {
    const types = tenants.map(tenant => tenant.type).filter(Boolean);
    return Array.from(new Set(types));
  }, [tenants]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/tenants/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setShowDeleteDialog(false);
      setTenantToDelete(null);
      toast({
        title: "Lejer slettet",
        description: "Lejeren er blevet slettet",
      });
    },
    onError: (error) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl ved sletning af lejeren",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowForm(true);
  };

  const handleDelete = (tenant: Tenant) => {
    setTenantToDelete(tenant);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (tenantToDelete) {
      deleteMutation.mutate(tenantToDelete.id);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedTenant(null);
    queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Lejere</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Lejere</h1>
          <p className="text-gray-600" data-testid="page-description">
            Administrer stamdata for alle lejere
          </p>
        </div>
        {canWrite && (
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-tenant" onClick={() => setSelectedTenant(null)}>
                <Plus className="w-4 h-4 mr-2" />
                Opret lejer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="dialog-title">
                  {selectedTenant ? "Rediger lejer" : "Opret ny lejer"}
                </DialogTitle>
                <DialogDescription data-testid="dialog-description">
                  {selectedTenant ? "Rediger lejerens stamdata" : "Udfyld stamdata for den nye lejer"}
                </DialogDescription>
              </DialogHeader>
              <TenantForm
                tenant={selectedTenant}
                onSuccess={handleFormSuccess}
                onCancel={() => setShowForm(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="empty-state-title">
              Ingen lejere endnu
            </h3>
            <p className="text-gray-600 text-center mb-4" data-testid="empty-state-description">
              Opret din første lejer for at komme i gang
            </p>
            {canWrite && (
              <Button onClick={() => setShowForm(true)} data-testid="button-create-first-tenant">
                <Plus className="w-4 h-4 mr-2" />
                Opret lejer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Search and filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Søg efter navn, e-mail, telefon eller internt nummer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-tenants"
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
                    {type === "erhverv" ? "Erhverv" : "Privat"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-600">
            Viser {filteredAndSortedTenants.length} af {tenants.length} lejere
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('internalNumber')}
                      className="h-auto p-0 font-semibold"
                      data-testid="sort-internal-number"
                    >
                      Intern nummer
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
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
                  <TableHead>Kontaktperson</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('email')}
                      className="h-auto p-0 font-semibold"
                      data-testid="sort-email"
                    >
                      E-mail
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('phone')}
                      className="h-auto p-0 font-semibold"
                      data-testid="sort-phone"
                    >
                      Telefon
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTenants.map((tenant) => (
                  <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                    <TableCell className="font-medium">
                      <div data-testid={`tenant-number-${tenant.id}`}>
                        #{tenant.internalNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div data-testid={`tenant-name-${tenant.id}`}>
                        {user?.role === 'broker' ? `Lejer ${tenant.internalNumber}` : tenant.name}
                      </div>
                      {tenant.type === "erhverv" && (
                        <Badge variant="default" className="mt-1" data-testid={`tenant-type-${tenant.id}`}>
                          <Building className="w-3 h-3 mr-1" />
                          Erhverv
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell data-testid={`tenant-contact-${tenant.id}`}>
                      {user?.role === 'broker' ? 
                        (tenant.contactPerson ? 'Anonymiseret' : '-') : 
                        (tenant.contactPerson || '-')
                      }
                    </TableCell>
                    <TableCell data-testid={`tenant-email-${tenant.id}`}>
                      {user?.role === 'broker' ? `${tenant.email?.[0] || '*'}*****@*****` : tenant.email || '-'}
                    </TableCell>
                    <TableCell data-testid={`tenant-phone-${tenant.id}`}>
                      {user?.role === 'broker' ? '*******' : tenant.phone || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {canWrite && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-actions-${tenant.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(tenant)} data-testid={`menu-edit-${tenant.id}`}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Rediger
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(tenant)} 
                              className="text-red-600"
                              data-testid={`menu-delete-${tenant.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Slet
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Slet lejer"
        description={`Er du sikker på, at du vil slette lejeren "${tenantToDelete?.name}"? Denne handling kan ikke fortrydes.`}
        confirmText="Slet"
        cancelText="Annuller"
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
        variant="destructive"
      />
    </div>
  );
}