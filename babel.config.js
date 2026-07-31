// https://www.nativewind.dev/getting-started/installation
module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Lets services/db/migrations/migrations.js `import` drizzle-kit's
      // generated `.sql` migration files as inlined raw-string content —
      // https://orm.drizzle.team/docs/get-started/expo-new
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
