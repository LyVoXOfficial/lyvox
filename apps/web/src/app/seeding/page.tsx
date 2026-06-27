import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Test Data Seeding | LyVoX',
  description: 'Populate development marketplace with realistic test data - 80+ listings, 10 users, 240 photos',
};

export default function SeedingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🌱 Test Data Seeding
          </h1>
          <p className="text-xl text-gray-600">
            Populate your development marketplace with realistic test data
          </p>
        </div>

        {/* Quick Start Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🚀 Quick Start</h2>

          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">10</div>
                <div className="text-sm text-gray-600">Test Users</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">80+</div>
                <div className="text-sm text-gray-600">Listings</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">240</div>
                <div className="text-sm text-gray-600">Photos</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">270+</div>
                <div className="text-sm text-gray-600">Likes</div>
              </div>
            </div>

            {/* Run Command */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Run Seeding</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                node scripts/runSeed.mjs scripts/seed-test-data.sql
              </div>
            </div>

            {/* Test Credentials */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Test Credentials</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Any of these emails:</strong>
                </p>
                <ul className="text-sm text-gray-600 space-y-1 font-mono">
                  <li>• anna.brussels@test.com</li>
                  <li>• mark.gent@test.com</li>
                  <li>• lisa.antwerp@test.com</li>
                  <li>• emma.liege@test.com</li>
                  <li>+ 6 more...</li>
                </ul>
                <p className="text-sm text-gray-700 mt-3">
                  <strong>Password:</strong> <code className="bg-white px-2 py-1 rounded">TestPassword123!</code>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What You Get */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">✨ What You Get</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Product Listings</h3>
              <ul className="text-gray-700 space-y-2">
                <li>✓ 20 Used Cars</li>
                <li>✓ 20 Apartments</li>
                <li>✓ 20 Electronics</li>
                <li>✓ 20 Clothing Items</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Features</h3>
              <ul className="text-gray-700 space-y-2">
                <li>✓ 3 Photos per listing</li>
                <li>✓ Multiple user roles</li>
                <li>✓ Mix of verified/unverified</li>
                <li>✓ Realistic pricing</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Documentation Links */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📚 Documentation</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <a
              href="/docs/seeding/SEED_QUICK_START.md"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition"
            >
              <div className="font-semibold text-blue-600 mb-1">Quick Start</div>
              <div className="text-sm text-gray-600">30-second setup guide</div>
            </a>

            <a
              href="/docs/seeding/SEED_TEST_DATA_README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition"
            >
              <div className="font-semibold text-green-600 mb-1">Complete Guide</div>
              <div className="text-sm text-gray-600">Detailed documentation</div>
            </a>

            <a
              href="/docs/seeding/SEEDING_IMPLEMENTATION.md"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition"
            >
              <div className="font-semibold text-purple-600 mb-1">Technical Details</div>
              <div className="text-sm text-gray-600">Implementation guide</div>
            </a>

            <a
              href="/docs/seeding/SEEDING_DONE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border-2 border-orange-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition"
            >
              <div className="font-semibold text-orange-600 mb-1">Checklist</div>
              <div className="text-sm text-gray-600">Verification steps</div>
            </a>
          </div>
        </div>

        {/* Setup Steps */}
        <div className="bg-white rounded-lg shadow-lg p-8 mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📋 Setup Steps</h2>

          <ol className="space-y-4">
            <li className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-semibold text-gray-900">Start Supabase</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">supabase start</code>
              </div>
            </li>

            <li className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-semibold text-gray-900">Run Seeding Script</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  node scripts/runSeed.mjs scripts/seed-test-data.sql
                </code>
              </div>
            </li>

            <li className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-semibold text-gray-900">Start Dev Server</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">pnpm dev</code>
              </div>
            </li>

            <li className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <p className="font-semibold text-gray-900">Visit Marketplace</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">http://localhost:3000</code>
              </div>
            </li>

            <li className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                5
              </div>
              <div>
                <p className="font-semibold text-gray-900">Log In & Browse</p>
                <p className="text-sm text-gray-600">Use test credentials above</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-600">
          <p>
            View the raw documentation files in <code>/docs/seeding/</code>
          </p>
        </div>
      </div>
    </div>
  );
}
