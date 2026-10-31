import { validOrganization } from './localCareer.mjs';

export function moveOrganizationRole(org, field, targetUid) {
  if (!['starUid', 'iglUid', 'mainAwperUid'].includes(field) || !validOrganization(org) || !['0', '1', '2', '3', '4'].includes(targetUid)) {
    throw new Error('The organization or its roles are not valid.');
  }
  if (org[field] === targetUid) return org;
  const other = field === 'iglUid' ? 'mainAwperUid' : field === 'mainAwperUid' ? 'iglUid' : null;
  return { ...org, [field]: targetUid, ...(other && org[other] === targetUid ? { [other]: org[field] } : {}) };
}
