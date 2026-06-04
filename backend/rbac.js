const db = require('./db');

// Role-to-Permissions static mapping for default setup
const ROLE_PERMISSIONS = {
  'SUPER_ADMIN': ['*'],
  'COMPANY_ADMIN': ['projects.create', 'projects.read', 'projects.update', 'projects.award', 'repositories.read'],
  'COMPANY_MANAGER': ['projects.create', 'projects.read', 'projects.update', 'repositories.read'],
  'UNIVERSITY_ADMIN': ['opportunities.read', 'proposals.create', 'projects.read'],
  'COLLEGE_COORDINATOR': ['projects.read', 'faculty.assign', 'teams.approve', 'repositories.grant', 'repositories.revoke'],
  'FACULTY_COORDINATOR': ['projects.read', 'students.assign', 'team.manage', 'repositories.approve', 'submissions.read', 'submissions.approve'],
  'PROJECT_LEAD': ['projects.read', 'branches.create', 'pullrequests.review', 'pullrequests.approve', 'tasks.create', 'tasks.update'],
  'TEAM_MEMBER': ['projects.read', 'branches.create', 'pullrequests.create', 'tasks.update'],
  'STUDENT': ['projects.read', 'tasks.update', 'submissions.create'],
  'REVIEWER': ['projects.read', 'submissions.read', 'submissions.grade']
};

/**
 * Enterprise RBAC Authorization Middleware.
 * Checks whether user role has the required permission.
 */
function checkPermission(requiredPermission) {
  return async (req, res, next) => {
    // Authenticated user populated by verifyToken
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized. JWT token verification required." });
    }

    const role = (user.role || '').toUpperCase();
    const permissions = ROLE_PERMISSIONS[role] || [];

    // SUPER_ADMIN wildcard bypass or direct permission match
    if (permissions.includes('*') || permissions.includes(requiredPermission)) {
      return next();
    }

    // Dynamic database validation (fallback check in database table role_permissions)
    try {
      const dbCheck = await db.query(
        `SELECT p.name 
         FROM role_permissions rp
         JOIN roles r ON rp.role_id = r.id
         JOIN permissions p ON rp.permission_id = p.id
         WHERE UPPER(r.name) = $1 AND p.name = $2`,
        [role, requiredPermission]
      );
      if (dbCheck.rows.length > 0) {
        return next();
      }
    } catch (err) {
      console.error("Database RBAC validation failed:", err.message);
    }

    return res.status(403).json({ error: `Forbidden. Role '${user.role}' lacks permission '${requiredPermission}'.` });
  };
}

module.exports = {
  checkPermission,
  ROLE_PERMISSIONS
};
