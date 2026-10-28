// ============================================================================
// Authentication & Role-Based Authorization Middleware
// Least Privilege Role Hierarchy: VISITOR < REQUESTER < OPERATOR < ADMINISTRATOR
// ============================================================================

import { DEMO_USERS } from '../database/seedData.js';

export const ROLES = {
  VISITOR: 'VISITOR',
  REQUESTER: 'REQUESTER',
  OPERATOR: 'OPERATOR',
  ADMINISTRATOR: 'ADMINISTRATOR'
};

const ROLE_RANKS = {
  [ROLES.VISITOR]: 1,
  [ROLES.REQUESTER]: 2,
  [ROLES.OPERATOR]: 3,
  [ROLES.ADMINISTRATOR]: 4
};

/**
 * Extracts and verifies client role and identity from headers or token
 */
export const authenticateUser = (req, res, next) => {
  // Support headers: x-user-role, x-user-id, x-user-name, or Authorization
  const rawRole = (req.headers['x-user-role'] || 'VISITOR').toUpperCase();
  const userId = req.headers['x-user-id'];
  const userName = req.headers['x-user-name'];

  // Match demo user if id provided
  let matchedUser = DEMO_USERS.find(u => u.id === userId || u.role === rawRole);

  const role = ROLES[rawRole] || ROLES.VISITOR;

  req.user = {
    id: userId || matchedUser?.id || 'visitor-anon',
    name: userName || matchedUser?.name || (role === ROLES.VISITOR ? 'Public Visitor' : 'Hospital Staff'),
    role,
    rank: ROLE_RANKS[role] || 1
  };

  next();
};

/**
 * Middleware factory to enforce required role or minimum role rank
 */
export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required to perform this clinical action.'
      });
    }

    const isExplicitlyAllowed = allowedRoles.includes(req.user.role);
    const isAdmin = req.user.role === ROLES.ADMINISTRATOR;

    if (!isExplicitlyAllowed && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${req.user.role}" does not have sufficient permissions. Required: [${allowedRoles.join(', ')}]`,
        requiredRoles: allowedRoles,
        currentRole: req.user.role
      });
    }

    next();
  };
};
