module.exports = {
  jsc: {
    externalHelpers: true,
    experimental:
      process.env.BABEL_ENV == "COVERAGE"
        ? {
            plugins: [
              [
                "swc-plugin-coverage-instrument",
                {
                  unstableExclude: [
                    "packages/**",
                    "node_modules/**",
                    "**/*.app-test.js",
                    "**/*.test.js",
                  ],
                },
              ],
            ],
          }
        : undefined,
  },
};
