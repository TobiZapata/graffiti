import { validOrganization } from './localCareer.mjs';

export function moveOrganizationRole(org, field, targetUid) {
  if (!['starUid', 'iglUid', 'mainAwperUid'].includes(field) || !validOrganization(org) || !['0', '1', '2', '3', '4'].includes(targetUid)) {
    throw new Error('La organización o sus roles no son válidos.');
  }
  if (org[field] === targetUid) return org;
  const other = field === 'iglUid' ? 'mainAwperUid' : field === 'mainAwperUid' ? 'iglUid' : null;
  return { ...org, [field]: targetUid, ...(other && org[other] === targetUid ? { [other]: org[field] } : {}) };
}
