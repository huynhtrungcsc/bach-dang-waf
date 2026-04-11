import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Eye, EyeOff, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

import {
  validateAccessListName,
  validateAccessListIp,
  validateUsername,
  validatePassword,
  getAccessListHints,
  getAccessListExample
} from '@/utils/access-list-validators';
import {
  useCreateAccessList,
  useUpdateAccessList,
  useRemoveFromDomain,
} from '@/queries/access-lists.query-options';
import { domainQueryOptions } from '@/queries/domain.query-options';
import type { AccessList } from '@/services/access-lists.service';
import { toast } from 'sonner';

interface AccessListFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessList?: AccessList;
}

interface AuthUserFormData {
  username: string;
  password: string;
  description?: string;
  showPassword?: boolean;
}

export function AccessListFormDialog({
  open,
  onOpenChange,
  accessList,
}: AccessListFormDialogProps) {
  const isEditMode = !!accessList;

  const createMutation = useCreateAccessList();
  const updateMutation = useUpdateAccessList();
  const removeFromDomainMutation = useRemoveFromDomain();

  // Fetch domains for selection
  const { data: domainsData } = useQuery(domainQueryOptions.all({ page: 1, limit: 100 }));
  const domains = domainsData?.data || [];

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'ip_whitelist' as 'ip_whitelist' | 'http_basic_auth' | 'combined',
    enabled: true,
  });

  const [allowedIps, setAllowedIps] = useState<string[]>(['']);
  const [authUsers, setAuthUsers] = useState<AuthUserFormData[]>([
    { username: '', password: '', description: '', showPassword: false },
  ]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [originalDomainIds, setOriginalDomainIds] = useState<string[]>([]); // Track original domains for edit mode

  // Validation states
  const [nameValidation, setNameValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });
  const [ipValidations, setIpValidations] = useState<Record<number, { valid: boolean; error?: string }>>({});
  const [userValidations, setUserValidations] = useState<Record<number, { username: { valid: boolean; error?: string }; password: { valid: boolean; error?: string } }>>({});

  // Validate name in real-time
  useEffect(() => {
    if (formData.name.trim().length > 0) {
      setNameValidation(validateAccessListName(formData.name));
    } else {
      setNameValidation({ valid: true });
    }
  }, [formData.name]);

  // Reset form when dialog opens or access list changes
  useEffect(() => {
    if (open) {
      if (accessList) {
        // Edit mode
        setFormData({
          name: accessList.name,
          description: accessList.description || '',
          type: accessList.type,
          enabled: accessList.enabled,
        });

        setAllowedIps(
          accessList.allowedIps && accessList.allowedIps.length > 0
            ? accessList.allowedIps
            : ['']
        );

        setAuthUsers(
          accessList.authUsers && accessList.authUsers.length > 0
            ? accessList.authUsers.map((u) => ({
                username: u.username,
                password: '', // Don't populate password for security
                description: u.description || '',
                showPassword: false,
              }))
            : [{ username: '', password: '', description: '', showPassword: false }]
        );

        const domainIds = accessList.domains?.map((d) => d.domainId) || [];
        setSelectedDomains(domainIds);
        setOriginalDomainIds(domainIds); // Store original for comparison
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          description: '',
          type: 'ip_whitelist',
          enabled: true,
        });
        setAllowedIps(['']);
        setAuthUsers([{ username: '', password: '', description: '', showPassword: false }]);
        setSelectedDomains([]);
        setOriginalDomainIds([]); // Reset original domains
      }
      // Reset validations
      setNameValidation({ valid: true });
      setIpValidations({});
      setUserValidations({});
    }
  }, [open, accessList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error('Error', { description: 'Access list name is required' })
      return;
    }

    // Validate based on type
    if (formData.type === 'ip_whitelist' || formData.type === 'combined') {
      const validIps = allowedIps.filter((ip) => ip.trim());
      if (validIps.length === 0) {
        toast.error('Error', { description: 'At least one IP address is required for IP whitelist' })
        return;
      }
    }

    if (formData.type === 'http_basic_auth' || formData.type === 'combined') {
      // In edit mode, password is optional (empty = keep existing)
      // In create mode, password is required
      const validUsers = authUsers.filter((u) => {
        if (isEditMode) {
          return u.username.trim(); // Only username required in edit mode
        }
        return u.username.trim() && u.password.trim(); // Both required in create mode
      });
      
      if (validUsers.length === 0) {
        toast.error('Error', { description: 'At least one auth user is required for HTTP Basic Auth' })
        return;
      }
      
      // Validate username and password length
      for (const user of validUsers) {
        if (!user.username.trim()) {
          toast.error('Error', { description: 'Username is required for all auth users' })
          return;
        }
        // In create mode, password is required
        // In edit mode, empty password means keep existing password
        if (!isEditMode && !user.password.trim()) {
          toast.error('Error', { description: 'Password is required for new auth users' })
          return;
        }
        // If password is provided, validate minimum length
        if (user.password.trim() && user.password.length < 4) {
          toast.error('Error', { description: 'Password must be at least 4 characters' })
          return;
        }
      }
    }

    const payload = {
      ...formData,
      allowedIps:
        formData.type === 'ip_whitelist' || formData.type === 'combined'
          ? allowedIps.filter((ip) => ip.trim())
          : undefined,
      authUsers:
        formData.type === 'http_basic_auth' || formData.type === 'combined'
          ? authUsers
              .filter((u) => {
                // In create mode, require both username and password
                // In edit mode, only require username (empty password = keep existing)
                if (isEditMode) {
                  return u.username.trim();
                }
                return u.username.trim() && u.password.trim();
              })
              .map(({ username, password, description }) => ({
                username,
                password, // In edit mode, empty password will be handled by backend
                description,
              }))
          : undefined,
      domainIds: selectedDomains.length > 0 ? selectedDomains : undefined,
    };

    try {
      if (isEditMode) {
        // Detect removed domains (domains that were assigned but now unchecked)
        const removedDomainIds = originalDomainIds.filter(
          (domainId) => !selectedDomains.includes(domainId)
        );

        // Remove domains first if any
        if (removedDomainIds.length > 0) {
          await Promise.all(
            removedDomainIds.map((domainId) =>
              removeFromDomainMutation.mutateAsync({
                accessListId: accessList.id,
                domainId,
              })
            )
          );
        }

        // Then update the access list
        await updateMutation.mutateAsync({ id: accessList.id, data: payload });
        toast.success('Success', { description: 'Access list updated successfully' })
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Success', { description: 'Access list created successfully' })
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Error', { description: error.response?.data?.message || 'Failed to save access list' })
    }
  };

  const addIpField = () => {
    setAllowedIps([...allowedIps, '']);
  };

  const removeIpField = (index: number) => {
    setAllowedIps(allowedIps.filter((_, i) => i !== index));
  };

  const updateIpField = (index: number, value: string) => {
    const newIps = [...allowedIps];
    newIps[index] = value;
    setAllowedIps(newIps);

    // Validate IP in real-time
    if (value.trim().length > 0) {
      const validation = validateAccessListIp(value);
      setIpValidations(prev => ({ ...prev, [index]: validation }));
    } else {
      setIpValidations(prev => {
        const newValidations = { ...prev };
        delete newValidations[index];
        return newValidations;
      });
    }
  };

  const addAuthUser = () => {
    setAuthUsers([
      ...authUsers,
      { username: '', password: '', description: '', showPassword: false },
    ]);
  };

  const removeAuthUser = (index: number) => {
    setAuthUsers(authUsers.filter((_, i) => i !== index));
  };

  const updateAuthUser = (
    index: number,
    field: keyof AuthUserFormData,
    value: string | boolean
  ) => {
    const newUsers = [...authUsers];
    (newUsers[index] as any)[field] = value;
    setAuthUsers(newUsers);

    // Validate username/password in real-time
    if (field === 'username' && typeof value === 'string') {
      if (value.trim().length > 0) {
        const validation = validateUsername(value);
        setUserValidations(prev => ({
          ...prev,
          [index]: {
            username: validation,
            password: prev[index]?.password || { valid: true }
          }
        }));
      }
    } else if (field === 'password' && typeof value === 'string') {
      if (value.trim().length > 0) {
        const validation = validatePassword(value, !isEditMode);
        setUserValidations(prev => ({
          ...prev,
          [index]: {
            username: prev[index]?.username || { valid: true },
            password: validation
          }
        }));
      }
    }
  };

  const toggleDomainSelection = (domainId: string) => {
    setSelectedDomains((prev) => {
      const isSelected = prev.includes(domainId);
      const newSelection = isSelected
        ? prev.filter((id) => id !== domainId)
        : [...prev, domainId];
      return newSelection;
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px]">
            {isEditMode ? 'Edit Access Policy' : 'New Access Policy'}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {isEditMode
              ? 'Update the IP allowlist or Basic Auth credentials for this policy, then re-bind domains as needed.'
              : 'Define an IP source allowlist or HTTP Basic Auth policy to control inbound access on one or more domains.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Basic Info — 2-column layout ── */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">

            {/* LEFT: Policy Name */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] font-medium">Policy Name</Label>
              <div className="relative">
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={getAccessListExample('name')}
                  disabled={isPending}
                  required
                  className={[
                    'h-9 text-[13px] pr-8',
                    !nameValidation.valid && formData.name.trim().length > 0 ? 'border-red-500' :
                    nameValidation.valid && formData.name.trim().length > 0 ? 'border-emerald-500' : '',
                  ].join(' ')}
                />
                {nameValidation.valid && formData.name.trim().length > 0 && (
                  <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />
                )}
                {!nameValidation.valid && formData.name.trim().length > 0 && (
                  <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-500" />
                )}
              </div>
              {!nameValidation.valid && nameValidation.error ? (
                <p className="text-[11px] text-red-500">{nameValidation.error}</p>
              ) : (
                <p className="text-[11px] text-slate-400">{getAccessListHints('name')}</p>
              )}
            </div>

            {/* RIGHT: Policy Type */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] font-medium">Policy Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                disabled={isPending}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip_whitelist">IP Source Allowlist</SelectItem>
                  <SelectItem value="http_basic_auth">HTTP Basic Authentication</SelectItem>
                  <SelectItem value="combined">IP + HTTP Auth (Combined)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">Determines which access controls nginx enforces</p>
            </div>

            {/* LEFT: Notes */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] font-medium">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this policy's purpose and scope"
                disabled={isPending}
                rows={3}
                className="text-[13px] resize-none"
              />
            </div>

            {/* RIGHT: Activate toggle */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] font-medium">Enforcement Status</Label>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-3 h-[88px]">
                <div>
                  <p className="text-[13px] font-medium text-slate-700">Activate policy</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Enable enforcement immediately on save</p>
                </div>
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* Configuration Tabs */}
          <Tabs defaultValue="access" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="access" className="text-[12px]">Access Controls</TabsTrigger>
              <TabsTrigger value="domains" className="text-[12px]">Domain Binding</TabsTrigger>
            </TabsList>

            <TabsContent value="access" className="space-y-4">
              {/* IP Whitelist */}
              {(formData.type === 'ip_whitelist' ||
                formData.type === 'combined') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[12px] font-medium">Permitted Source CIDRs</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[12px]"
                      onClick={addIpField}
                      disabled={isPending}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add CIDR
                    </Button>
                  </div>

                  {allowedIps.map((ip, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            value={ip}
                            onChange={(e) => updateIpField(index, e.target.value)}
                            placeholder={getAccessListExample('ip')}
                            disabled={isPending}
                            className={ipValidations[index] && !ipValidations[index].valid ? 'border-red-500' : ipValidations[index]?.valid ? 'border-green-500' : ''}
                          />
                          {ipValidations[index]?.valid && ip.trim().length > 0 && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                          )}
                          {ipValidations[index] && !ipValidations[index].valid && (
                            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                          )}
                        </div>
                        {allowedIps.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeIpField(index)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {ipValidations[index] && !ipValidations[index].valid && ipValidations[index].error && (
                        <p className="text-xs text-red-500">{ipValidations[index].error}</p>
                      )}
                    </div>
                  ))}
                  <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[12px] text-slate-500">{getAccessListHints('ip')}</p>
                  </div>
                </div>
              )}

              {/* HTTP Basic Auth */}
              {(formData.type === 'http_basic_auth' ||
                formData.type === 'combined') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[12px] font-medium">Basic Auth Credentials</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[12px]"
                      onClick={addAuthUser}
                      disabled={isPending}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Credential
                    </Button>
                  </div>

                  {authUsers.map((user, index) => (
                    <div key={index} className="space-y-2 p-4 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <Label className="text-[12px] font-medium text-slate-600">
                          Credential #{index + 1}
                        </Label>
                        {authUsers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAuthUser(index)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px] text-slate-500">Username <span className="text-slate-400">(≥ 3 chars)</span></Label>
                          <div className="relative">
                            <Input
                              value={user.username}
                              onChange={(e) =>
                                updateAuthUser(index, 'username', e.target.value)
                              }
                              placeholder={getAccessListExample('username')}
                              disabled={isPending}
                              minLength={3}
                              className={userValidations[index]?.username && !userValidations[index].username.valid ? 'border-red-500' : userValidations[index]?.username?.valid ? 'border-green-500' : ''}
                            />
                            {userValidations[index]?.username?.valid && user.username.trim().length > 0 && (
                              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                            )}
                            {userValidations[index]?.username && !userValidations[index].username.valid && (
                              <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                            )}
                          </div>
                          {userValidations[index]?.username && !userValidations[index].username.valid && userValidations[index].username.error && (
                            <p className="text-xs text-red-500 mt-1">{userValidations[index].username.error}</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-[11px] text-slate-500">
                            Password <span className="text-slate-400">{isEditMode ? '(leave blank to keep)' : '(≥ 4 chars)'}</span>
                          </Label>
                          <div className="relative">
                            <Input
                              type={user.showPassword ? 'text' : 'password'}
                              value={user.password}
                              minLength={4}
                              onChange={(e) =>
                                updateAuthUser(index, 'password', e.target.value)
                              }
                              placeholder="password"
                              disabled={isPending}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() =>
                                updateAuthUser(
                                  index,
                                  'showPassword',
                                  !user.showPassword
                                )
                              }
                            >
                              {user.showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-[11px] text-slate-500">Notes <span className="text-slate-400">(optional)</span></Label>
                        <Input
                          value={user.description}
                          onChange={(e) => updateAuthUser(index, 'description', e.target.value)}
                          placeholder="e.g., CI/CD service account"
                          disabled={isPending}
                          className="h-8 text-[12px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="domains" className="space-y-3">
              <div>
                <Label className="text-[12px] font-medium">Attach to Domains</Label>
                <p className="text-[12px] text-slate-400 mt-0.5 mb-3">
                  Select domains to enforce this access policy. You can bind or unbind domains at any time.
                </p>

                {domains.length === 0 ? (
                  <p className="text-[13px] text-slate-400 text-center py-6">No domains configured yet</p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2.5">
                    {domains.map((domain) => {
                      const isSelected = selectedDomains.includes(domain.id);
                      return (
                        <div
                          key={domain.id}
                          className="flex items-center gap-2.5 px-2 py-2 hover:bg-slate-50 rounded-md cursor-pointer"
                          onClick={() => !isPending && toggleDomainSelection(domain.id)}
                        >
                          <Switch
                            checked={isSelected}
                            onCheckedChange={() => toggleDomainSelection(domain.id)}
                            disabled={isPending}
                          />
                          <span className="text-[13px] font-medium text-slate-700 flex-1">{domain.name}</span>
                          <Badge variant={domain.status === 'active' ? 'default' : 'secondary'} className="text-[11px]">
                            {domain.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[13px]"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="text-[13px]" disabled={isPending}>
              {isPending ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
