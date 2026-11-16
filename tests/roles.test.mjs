import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRoles, hasRole, adminAccess} from '../lib/auth/roles.ts';

test('keeps only known roles from untrusted DB values', () => {
  assert.deepEqual(parseRoles(['student', 'admin', 'superuser', 3, null]), ['student', 'admin']);
  assert.deepEqual(parseRoles('admin'), []);
  assert.deepEqual(parseRoles(null), []);
});

test('admin access: anonymous, forbidden, admin', () => {
  assert.equal(adminAccess(null, ['admin']), 'anonymous');
  assert.equal(adminAccess('u1', ['student']), 'forbidden');
  assert.equal(adminAccess('u1', ['student', 'admin']), 'admin');
});

test('fails closed when the profile could not be read', () => {
  assert.equal(adminAccess('u1', null), 'forbidden');
  assert.equal(adminAccess('u1', []), 'forbidden');
});

test('hasRole is exact (no prefix or case tricks)', () => {
  assert.equal(hasRole(['Admin'], 'admin'), false);
  assert.equal(hasRole(['administrator'], 'admin'), false);
});
