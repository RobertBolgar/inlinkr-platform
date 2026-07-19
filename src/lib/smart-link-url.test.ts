/**
 * URL Generation Regression Tests
 * 
 * These tests verify that when custom subdomains are disabled (VITE_ENABLE_CUSTOM_SUBDOMAINS=false),
 * all generated URLs use go-dev.inlinkr.com and never use tubelinkr.com.
 * 
 * Run with: npx tsx src/lib/smart-link-url.test.ts
 */

// Mock environment variables for testing
process.env.VITE_REDIRECT_BASE_URL = 'https://go-dev.inlinkr.com';
process.env.VITE_ENABLE_CUSTOM_SUBDOMAINS = 'false';

// Mock import.meta.env
(global as any).import = {
  meta: {
    env: {
      VITE_REDIRECT_BASE_URL: 'https://go-dev.inlinkr.com',
      VITE_ENABLE_CUSTOM_SUBDOMAINS: 'false',
    }
  }
};

import { buildSmartLinkUrl, buildInviteUrl, buildPlacementUrl, buildQrUrl } from './smart-link-url';
import { User, Link as LinkType } from './cloudflare';

// Mock user objects
const freeUser: User = {
  id: '1',
  username: 'testuser',
  subdomain: undefined,
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_active: true,
  plan: 'free',
  has_founder_access: false,
};

const proUser: User = {
  id: '2',
  username: 'prouser',
  subdomain: 'prouser',
  email: 'pro@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_active: true,
  plan: 'pro',
  has_founder_access: false,
};

const founderUser: User = {
  id: '3',
  username: 'founder',
  subdomain: 'founder',
  email: 'founder@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_active: true,
  plan: 'pro',
  has_founder_access: true,
};

const usernameAccount: User = {
  id: '4',
  username: 'username',
  subdomain: undefined,
  email: 'username@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_active: true,
  plan: 'free',
  has_founder_access: false,
};

// Mock link object
const mockLink: LinkType = {
  id: '1',
  slug: 'test-link',
  public_code: 'abc123',
  user_id: '1',
  original_url: 'https://example.com',
  title: 'Test Link',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_active: true,
};

// Mock placement object
const mockPlacement = {
  public_code: 'placement123',
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

function assertNoTubelinkr(url: string, context: string) {
  const hasTubelinkr = url.includes('tubelinkr.com');
  assert(!hasTubelinkr, `${context} should not contain tubelinkr.com. Got: ${url}`);
}

function assertHasGoDevInlinkr(url: string, context: string) {
  const hasGoDev = url.includes('go-dev.inlinkr.com');
  assert(hasGoDev, `${context} should contain go-dev.inlinkr.com. Got: ${url}`);
}

console.log('Running URL Generation Regression Tests...\n');

// Test 1: Free user smart link URL
console.log('Test 1: Free user smart link URL');
const freeUserUrl = buildSmartLinkUrl({
  slug: mockLink.slug,
  publicCode: mockLink.public_code,
  username: freeUser.username,
}, freeUser);
assertNoTubelinkr(freeUserUrl, 'Free user smart link URL');
assertHasGoDevInlinkr(freeUserUrl, 'Free user smart link URL');
console.log(`  Generated URL: ${freeUserUrl}\n`);

// Test 2: Pro user smart link URL (custom subdomains disabled)
console.log('Test 2: Pro user smart link URL (custom subdomains disabled)');
const proUserUrl = buildSmartLinkUrl({
  slug: mockLink.slug,
  publicCode: mockLink.public_code,
  username: proUser.username,
}, proUser);
assertNoTubelinkr(proUserUrl, 'Pro user smart link URL (custom subdomains disabled)');
assertHasGoDevInlinkr(proUserUrl, 'Pro user smart link URL (custom subdomains disabled)');
console.log(`  Generated URL: ${proUserUrl}\n`);

// Test 3: Founder user smart link URL (custom subdomains disabled)
console.log('Test 3: Founder user smart link URL (custom subdomains disabled)');
const founderUserUrl = buildSmartLinkUrl({
  slug: mockLink.slug,
  publicCode: mockLink.public_code,
  username: founderUser.username,
}, founderUser);
assertNoTubelinkr(founderUserUrl, 'Founder user smart link URL (custom subdomains disabled)');
assertHasGoDevInlinkr(founderUserUrl, 'Founder user smart link URL (custom subdomains disabled)');
console.log(`  Generated URL: ${founderUserUrl}\n`);

// Test 4: Username account smart link URL
console.log('Test 4: Username account smart link URL');
const usernameAccountUrl = buildSmartLinkUrl({
  slug: mockLink.slug,
  publicCode: mockLink.public_code,
  username: usernameAccount.username,
}, usernameAccount);
assertNoTubelinkr(usernameAccountUrl, 'Username account smart link URL');
assertHasGoDevInlinkr(usernameAccountUrl, 'Username account smart link URL');
console.log(`  Generated URL: ${usernameAccountUrl}\n`);

// Test 5: Invite URL
console.log('Test 5: Invite URL');
const inviteUrl = buildInviteUrl(freeUser.username || null, freeUser);
assertNoTubelinkr(inviteUrl || '', 'Invite URL');
assertHasGoDevInlinkr(inviteUrl || '', 'Invite URL');
console.log(`  Generated URL: ${inviteUrl}\n`);

// Test 6: Placement URL
console.log('Test 6: Placement URL');
const placementUrl = buildPlacementUrl(mockLink, mockPlacement, freeUser.username || null, freeUser);
assertNoTubelinkr(placementUrl, 'Placement URL');
assertHasGoDevInlinkr(placementUrl, 'Placement URL');
console.log(`  Generated URL: ${placementUrl}\n`);

// Test 7: QR URL
console.log('Test 7: QR URL');
const qrUrl = buildQrUrl(mockLink, mockPlacement, freeUser.username || null, freeUser);
assertNoTubelinkr(qrUrl, 'QR URL');
assertHasGoDevInlinkr(qrUrl, 'QR URL');
console.log(`  Generated URL: ${qrUrl}\n`);

// Test 8: Pro user invite URL (custom subdomains disabled)
console.log('Test 8: Pro user invite URL (custom subdomains disabled)');
const proInviteUrl = buildInviteUrl(proUser.username || null, proUser);
assertNoTubelinkr(proInviteUrl || '', 'Pro user invite URL (custom subdomains disabled)');
assertHasGoDevInlinkr(proInviteUrl || '', 'Pro user invite URL (custom subdomains disabled)');
console.log(`  Generated URL: ${proInviteUrl}\n`);

// Test 9: Founder user invite URL (custom subdomains disabled)
console.log('Test 9: Founder user invite URL (custom subdomains disabled)');
const founderInviteUrl = buildInviteUrl(founderUser.username || null, founderUser);
assertNoTubelinkr(founderInviteUrl || '', 'Founder user invite URL (custom subdomains disabled)');
assertHasGoDevInlinkr(founderInviteUrl || '', 'Founder user invite URL (custom subdomains disabled)');
console.log(`  Generated URL: ${founderInviteUrl}\n`);

console.log('\n✅ All URL generation regression tests passed!');
console.log('No generated URLs contain tubelinkr.com when custom subdomains are disabled.');
