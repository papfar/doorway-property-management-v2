import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userInviteSchema, type UserInviteData, type User, type Company, type UserInvitation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Users, Mail, Trash2, Copy, Building, Edit, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<(User & { assignedCompany?: Company })[]>({
    queryKey: ['/api/users'],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery<UserInvitation[]>({
    queryKey: ['/api/users/invitations'],
  });

  const form = useForm<UserInviteData>({
    resolver: zodResolver(userInviteSchema),
    defaultValues: {
      email: "",
      role: "user",
      assignedCompanyId: null,
    },
  });

  const editForm = useForm<{role: "admin" | "user", assignedCompanyId: string | null}>({
    defaultValues: {
      role: "user",
      assignedCompanyId: null,
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: UserInviteData) => {
      return await apiRequest("/api/users/invite", "POST", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/invitations"] });
      toast({
        title: "Bruger inviteret",
        description: `Invitation sendt til ${data.invitation.email}`,
      });
      
      // Copy invitation link to clipboard
      navigator.clipboard.writeText(data.invitationLink);
      toast({
        title: "Invitationslink kopieret",
        description: "Invitationslinket er kopieret til udklipsholderen",
      });
      
      setIsInviteOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error('Invitation error:', error);
      toast({
        title: "Fejl ved invitation",
        description: error.message || "Kunne ikke invitere bruger",
        variant: "destructive",
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/users/invitations/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/invitations"] });
      toast({
        title: "Invitation slettet",
        description: "Invitationen er blevet slettet",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke slette invitation",
        variant: "destructive",
      });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string, role: "admin" | "user", assignedCompanyId: string | null }) => {
      return await apiRequest(`/api/users/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Bruger opdateret",
        description: "Brugerens information er blevet opdateret",
      });
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke opdatere bruger",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/users/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Bruger slettet",
        description: "Brugeren er blevet slettet",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke slette bruger",
        variant: "destructive",
      });
    },
  });

  const handleInvite = (data: UserInviteData) => {
    inviteMutation.mutate(data);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      role: user.role as "admin" | "user",
      assignedCompanyId: user.assignedCompanyId,
    });
  };

  const handleUpdateUser = (data: {role: "admin" | "user", assignedCompanyId: string | null}) => {
    if (!editingUser) return;
    editUserMutation.mutate({
      id: editingUser.id,
      ...data,
    });
  };

  if (isLoadingUsers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Indlæser brugere...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Brugeradministration</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Administrer brugere og deres adgang til systemet
          </p>
        </div>

        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-invite-user">
              <UserPlus className="h-4 w-4 mr-2" />
              Invitér Bruger
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invitér Ny Bruger</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleInvite)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-invite-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rolle</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-role">
                          <SelectTrigger>
                            <SelectValue placeholder="Vælg rolle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Bruger</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                            <SelectItem value="broker">Mægler</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignedCompanyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tilknyttet Selskab (valgfrit)</FormLabel>
                      <FormControl>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? null : value)} 
                          defaultValue={field.value || "none"}
                          data-testid="select-company"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Vælg selskab" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Intet selskab</SelectItem>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                    Annullér
                  </Button>
                  <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-send-invitation">
                    {inviteMutation.isPending ? "Sender..." : "Send Invitation"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Aktive Brugere ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Ingen brugere endnu</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Tilknyttet Selskab</TableHead>
                  <TableHead>Oprettet</TableHead>
                  <TableHead className="text-center">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'Administrator' : user.role === 'broker' ? 'Mægler' : 'Bruger'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.assignedCompany ? (
                        <div className="flex items-center">
                          <Building className="h-4 w-4 mr-1 text-gray-400" />
                          {user.assignedCompany.name}
                        </div>
                      ) : (
                        <span className="text-gray-500">Intet selskab</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('da-DK', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-user-menu-${user.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditUser(user)} data-testid={`button-edit-user-${user.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Redigér
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} data-testid={`button-delete-user-${user.id}`}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Slet
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Slet bruger</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Er du sikker på at du vil slette brugeren "{user.name}"? Denne handling kan ikke fortrydes.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annullér</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUserMutation.mutate(user.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Slet
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Afventende Invitationer ({invitations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingInvitations ? (
            <div className="text-center py-4">Indlæser invitationer...</div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Ingen afventende invitationer</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Tilknyttet Selskab</TableHead>
                  <TableHead>Udløber</TableHead>
                  <TableHead className="text-center">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => {
                  const assignedCompany = companies.find(c => c.id === invitation.assignedCompanyId);
                  const isExpired = new Date(invitation.expiresAt) < new Date();
                  
                  return (
                    <TableRow key={invitation.id} data-testid={`row-invitation-${invitation.id}`}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>
                        <Badge variant={invitation.role === 'admin' ? 'default' : 'secondary'}>
                          {invitation.role === 'admin' ? 'Administrator' : invitation.role === 'broker' ? 'Mægler' : 'Bruger'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {assignedCompany ? (
                          <div className="flex items-center">
                            <Building className="h-4 w-4 mr-1 text-gray-400" />
                            {assignedCompany.name}
                          </div>
                        ) : (
                          <span className="text-gray-500">Intet selskab</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={isExpired ? "text-red-600" : ""}>
                          {new Date(invitation.expiresAt).toLocaleDateString('da-DK', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                          {isExpired && " (Udløbet)"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const link = `${window.location.protocol}//${window.location.host}/invitation/${invitation.token}`;
                              navigator.clipboard.writeText(link);
                              toast({
                                title: "Link kopieret",
                                description: "Invitationslinket er kopieret til udklipsholderen",
                              });
                            }}
                            data-testid={`button-copy-link-${invitation.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                            disabled={deleteInvitationMutation.isPending}
                            data-testid={`button-delete-invitation-${invitation.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigér Bruger</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdateUser)} className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    <strong>Navn:</strong> {editingUser.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>E-mail:</strong> {editingUser.email}
                  </p>
                </div>

                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rolle</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value} data-testid="select-edit-role">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Bruger</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="assignedCompanyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tilknyttet Selskab</FormLabel>
                      <FormControl>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? null : value)} 
                          value={field.value || "none"}
                          data-testid="select-edit-company"
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Intet selskab</SelectItem>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                    Annullér
                  </Button>
                  <Button type="submit" disabled={editUserMutation.isPending} data-testid="button-save-user-changes">
                    {editUserMutation.isPending ? "Gemmer..." : "Gem Ændringer"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}