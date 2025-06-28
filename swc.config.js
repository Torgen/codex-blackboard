module.exports =
  process.env.BABEL_ENV == "COVERAGE"
    ? {
        jsc: {
          experimental: {
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
          },
        },
      }
    : {};
