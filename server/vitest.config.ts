import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tests run against an isolated in-memory MongoDB (mongodb-memory-server) started in
 * tests/testHelper.ts — never against a real/production database.
 * Razorpay credentials below are dummy values: the HTTP layer is mocked in payments.test.ts,
 * and the signature checks use these secrets so the HMAC path is exercised for real.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 120000, // first run may download the mongod binary
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'nightowl-test-jwt-secret-not-for-production',
      MONGODB_URI: 'mongodb://127.0.0.1:1/nightowl-test-unused', // overridden by the in-memory server
      RESEND_API_KEY: '',
      RAZORPAY_KEY_ID: 'rzp_test_NIGHTOWL000001',
      RAZORPAY_KEY_SECRET: 'nightowl_test_key_secret',
      RAZORPAY_WEBHOOK_SECRET: 'nightowl_test_webhook_secret',
      RAZORPAY_ROUTE_ENABLED: 'false',
      POOL_MIN_DURATION_MINUTES: '5',
      POOL_MAX_DURATION_MINUTES: '180',
      // Cache the mongod binary inside the workspace so repeated runs never re-download.
      MONGOMS_DOWNLOAD_DIR: path.resolve(here, '..', 'node_modules', '.cache', 'mongodb-memory-server'),
    },
  },
});
