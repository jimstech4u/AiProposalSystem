import { readJson } from './storage';
import type { AppRole } from './supabase';

export type CrudAction = 'create' | 'read' | 'update' | 'delete' | 'approve';
export type ResourceName =
  | 'dashboard'
  | 'requirements'
  | 'proposals'
  | 'proposal_reviews'
  | 'repository'
  | 'clients'
  | 'reports'
  | 'templates'
  | 'integrations'
  | 'security'
  | 'settings'
  | 'profiles';

type StoredSession = {
  role: AppRole;
  userId?: string;
  accessToken?: string;
  email?: string;
};

const permissions: Record<AppRole, Partial<Record<ResourceName, CrudAction[]>>> = {
  engineer: {
    dashboard: ['read'],
    requirements: ['create', 'read', 'update', 'delete'],
    proposals: ['create', 'read', 'update'],
    repository: ['read'],
    settings: ['read', 'update'],
    profiles: ['read', 'update'],
  },
  'project-manager': {
    dashboard: ['read'],
    requirements: ['create', 'read', 'update', 'delete'],
    proposals: ['create', 'read', 'update', 'delete'],
    proposal_reviews: ['create', 'read', 'update', 'delete', 'approve'],
    repository: ['create', 'read', 'update', 'delete'],
    clients: ['create', 'read', 'update', 'delete'],
    reports: ['create', 'read', 'update', 'delete'],
    templates: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update'],
    profiles: ['read', 'update'],
  },
  sales: {
    dashboard: ['read'],
    requirements: ['create', 'read', 'update'],
    proposals: ['create', 'read', 'update'],
    repository: ['read'],
    clients: ['create', 'read', 'update', 'delete'],
    reports: ['create', 'read', 'update'],
    settings: ['read', 'update'],
    profiles: ['read', 'update'],
  },
  admin: {
    dashboard: ['read'],
    requirements: ['create', 'read', 'update', 'delete'],
    proposals: ['create', 'read', 'update', 'delete'],
    proposal_reviews: ['create', 'read', 'update', 'delete', 'approve'],
    repository: ['create', 'read', 'update', 'delete'],
    clients: ['create', 'read', 'update', 'delete'],
    reports: ['create', 'read', 'update', 'delete'],
    templates: ['create', 'read', 'update', 'delete'],
    integrations: ['create', 'read', 'update', 'delete'],
    security: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update', 'delete'],
    profiles: ['create', 'read', 'update', 'delete'],
  },
};

export function getStoredSession() {
  return readJson<StoredSession | null>('session', null);
}

export function getStoredRole(): AppRole {
  return getStoredSession()?.role ?? 'engineer';
}

export function can(role: AppRole | undefined, resource: ResourceName, action: CrudAction) {
  if (!role) return false;
  return permissions[role]?.[resource]?.includes(action) ?? false;
}

export function canCurrentUser(resource: ResourceName, action: CrudAction) {
  return can(getStoredRole(), resource, action);
}
