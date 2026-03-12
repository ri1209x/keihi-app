import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", ".open-next/**"],
  },
  ...nextVitals,
];

export default config;
