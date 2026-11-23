import base from "@peopleops/config/eslint";

export default [
  ...base,
  {
    rules: {
      // Nest emits constructor parameter types into decorator metadata. Converting
      // injected services to `import type` would erase them at runtime and break DI.
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
];
