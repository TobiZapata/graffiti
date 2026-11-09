import { validOrganization } from './localCareer.mjs';

export function moveOrganizationRole(org, field, targetUid) {
  if (!['starUid', 'iglUid', 'mainAwperUid'].includes(field) || !validOrganization(org) || !['0', '1', '2', '3', '4'].includes(targetUid)) {
    throw new Error('The organization or its roles are not valid.');
  }
  if (org[field] === targetUid) return org;
  return { ...org, [field]: targetUid };
}
