import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Building, Trash2, Edit2, Network, UserPlus, Users, MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import CompanyRelationForm from "@/components/companies/CompanyRelationForm";
import CompanyStructureChart from "@/components/companies/CompanyStructureChart";
import OwnershipManagementDialog from "@/components/companies/OwnershipManagementDialog";
import type { Company } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export default function CompaniesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRelationFormOpen, setIsRelationFormOpen] = useState(false);
  const [relationFormData, setRelationFormData] = useState<{
    companyId: string;
    companyName: string;
    relationType: "parent" | "child";
  } | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    cvrNumber: ""
  });

  const isAdmin = user?.role === 'admin';

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  const { data: companyRelations = [] } = useQuery<any[]>({
    queryKey: ['/api/company-relations'],
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setIsCreateOpen(false);
      setFormData({ name: "", cvrNumber: "" });
      toast({ title: "Selskab oprettet", description: "Selskabet blev oprettet med succes" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Fejl", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await fetch(`/api/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setIsEditOpen(false);
      setEditingCompany(null);
      setFormData({ name: "", cvrNumber: "" });
      toast({ title: "Selskab opdateret", description: "Selskabet blev opdateret med succes" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Fejl", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/companies/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: "Selskab slettet", description: "Selskabet blev slettet med succes" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Fejl", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const { data: parentRelations = [] } = useQuery({
    queryKey: ['/api/companies', selectedCompany?.id, 'parents'],
    enabled: !!selectedCompany,
  });

  const { data: childRelations = [] } = useQuery({
    queryKey: ['/api/companies', selectedCompany?.id, 'children'],
    enabled: !!selectedCompany,
  });

  // Helper function to find majority owner of a company
  const getMajorityOwner = (companyId: string) => {
    if (!companyRelations || companyRelations.length === 0) return null;
    
    const parentRelations = companyRelations.filter((rel: any) => rel.childCompanyId === companyId);
    if (parentRelations.length === 0) return null;
    
    // Find the owner with the highest percentage
    const majorityRelation = parentRelations.reduce((highest: any, current: any) => {
      const currentPercentage = parseFloat(current.ownershipPercentage);
      const highestPercentage = parseFloat(highest.ownershipPercentage);
      return currentPercentage > highestPercentage ? current : highest;
    });
    
    const majorityPercentage = parseFloat(majorityRelation.ownershipPercentage);
    
    // Only show as majority owner if they own more than 50%
    if (majorityPercentage > 50) {
      const ownerCompany = companies.find(c => c.id === majorityRelation.parentCompanyId);
      return {
        name: ownerCompany?.name || 'Ukendt',
        percentage: majorityPercentage
      };
    }
    
    // If no single majority owner, show the largest owner with "Største:"
    const ownerCompany = companies.find(c => c.id === majorityRelation.parentCompanyId);
    return {
      name: ownerCompany?.name || 'Ukendt',
      percentage: majorityPercentage,
      isLargest: true
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCompany) {
      updateMutation.mutate({
        id: editingCompany.id,
        name: formData.name,
        cvrNumber: formData.cvrNumber ? parseInt(formData.cvrNumber) : null
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        cvrNumber: formData.cvrNumber ? parseInt(formData.cvrNumber) : null
      });
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      cvrNumber: company.cvrNumber?.toString() || ""
    });
    setIsEditOpen(true);
  };

  const handleDelete = (company: Company) => {
    if (confirm(`Er du sikker på, at du vil slette selskabet "${company.name}"?`)) {
      deleteMutation.mutate(company.id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Building className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Koncern</h1>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-company">
                <Plus className="h-4 w-4 mr-2" />
                Opret Selskab
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opret Nyt Selskab</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Selskabsnavn</Label>
                <Input
                  id="name"
                  data-testid="input-company-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Indtast selskabsnavn"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cvr">CVR-nummer (valgfrit)</Label>
                <Input
                  id="cvr"
                  data-testid="input-cvr-number"
                  value={formData.cvrNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 8) {
                      setFormData(prev => ({ ...prev, cvrNumber: value }));
                    }
                  }}
                  placeholder="12345678"
                  maxLength={8}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  data-testid="button-cancel"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Annullér
                </Button>
                <Button 
                  type="submit" 
                  data-testid="button-submit-company"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Opretter..." : "Opret"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Ingen selskaber endnu</h3>
            <p className="text-gray-500 text-center mb-6">
              Opret dit første selskab for at begynde at administrere din koncernstruktur
            </p>
            {isAdmin && (
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-company">
                <Plus className="h-4 w-4 mr-2" />
                Opret Dit Første Selskab
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="companies" className="space-y-6">
          <TabsList>
            <TabsTrigger value="companies" data-testid="tab-companies">Selskaber</TabsTrigger>
            <TabsTrigger value="structure" data-testid="tab-structure">Koncernstruktur</TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <CardTitle>Alle Selskaber ({companies.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Selskabsnavn</TableHead>
                      <TableHead>CVR-nummer</TableHead>
                      <TableHead>Majoritetsejer</TableHead>
                      <TableHead>Oprettelsesdato</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => {
                      const majorityOwner = getMajorityOwner(company.id);
                      return (
                        <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell>{company.cvrNumber || "-"}</TableCell>
                          <TableCell>
                            {majorityOwner ? (
                              <div className="text-sm">
                                <div className="font-medium">
                                  {majorityOwner.isLargest ? 'Største: ' : ''}{majorityOwner.name}
                                </div>
                                <div className={`text-xs ${majorityOwner.isLargest ? 'text-amber-600' : 'text-green-600'}`}>
                                  {majorityOwner.percentage.toFixed(1)}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">Ingen ejere</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {company.createdAt ? new Date(company.createdAt).toLocaleDateString('da-DK', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            }) : '-'}
                          </TableCell>
                        <TableCell className="text-center">
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`button-actions-${company.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedCompany(company)} data-testid={`menu-relations-${company.id}`}>
                                  <Network className="h-4 w-4 mr-2" />
                                  Administrer ejerskab
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(company)} data-testid={`menu-edit-${company.id}`}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Rediger
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(company)} 
                                  className="text-red-600"
                                  data-testid={`menu-delete-${company.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Slet
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structure">
            <CompanyStructureChart organizationId="" />
          </TabsContent>
        </Tabs>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger Selskab</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Selskabsnavn</Label>
              <Input
                id="edit-name"
                data-testid="input-edit-company-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Indtast selskabsnavn"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-cvr">CVR-nummer (valgfrit)</Label>
              <Input
                id="edit-cvr"
                data-testid="input-edit-cvr-number"
                value={formData.cvrNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 8) {
                    setFormData(prev => ({ ...prev, cvrNumber: value }));
                  }
                }}
                placeholder="12345678"
                maxLength={8}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                data-testid="button-cancel-edit"
                onClick={() => setIsEditOpen(false)}
              >
                Annullér
              </Button>
              <Button 
                type="submit" 
                data-testid="button-update-company"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Opdaterer..." : "Opdater"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ownership Management Dialog */}
      <OwnershipManagementDialog
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        company={selectedCompany}
      />

      {/* Company Relations Dialog */}
      {relationFormData && (
        <CompanyRelationForm
          isOpen={isRelationFormOpen}
          onClose={() => {
            setIsRelationFormOpen(false);
            setRelationFormData(null);
          }}
          companyId={relationFormData.companyId}
          companyName={relationFormData.companyName}
          relationType={relationFormData.relationType}
        />
      )}
    </div>
  );
}