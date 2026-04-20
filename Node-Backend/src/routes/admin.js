const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { listUsers, updateUser, deleteUser, bootstrapAdmin } = require('../controllers/adminController');

/**
 * @swagger
 * /admin/bootstrap:
 *   post:
 *     summary: Bootstrap the first admin user
 *     description: Finds the user with the lowest ID and grants them admin privileges. Only works if no admin users exist yet.
 *     tags: [Admin]
 *     security: []
 *     responses:
 *       200:
 *         description: Admin user created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       403:
 *         description: Admin already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 *       404:
 *         description: No users found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 */
router.post('/bootstrap', async (req, res, next) => {
  try {
    await bootstrapAdmin(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users
 *     description: Returns a paginated list of all users. Supports optional search by email, username, or full name.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter users by email, username, or full name (case-insensitive partial match)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 total:
 *                   type: integer
 *                   description: Total number of matching users
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                 pages:
 *                   type: integer
 *                   description: Total number of pages
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 */
router.get('/users', authenticateAdmin, async (req, res, next) => {
  try {
    await listUsers(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/users/{id}:
 *   patch:
 *     summary: Update a user
 *     description: Update a user's is_active, is_admin, or is_verified status. Admins cannot deactivate themselves.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_active:
 *                 type: boolean
 *               is_admin:
 *                 type: boolean
 *               is_verified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated user object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Cannot deactivate yourself
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 */
router.patch('/users/:id', authenticateAdmin, async (req, res, next) => {
  try {
    await updateUser(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Permanently delete a user by ID. Admins cannot delete themselves.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 detail:
 *                   type: string
 *                   example: User deleted
 *       400:
 *         description: Cannot delete yourself
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorDetail'
 */
router.delete('/users/:id', authenticateAdmin, async (req, res, next) => {
  try {
    await deleteUser(req, res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
