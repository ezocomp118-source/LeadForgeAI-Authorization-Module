import { buildPaths, componentsSchemas, routes } from "./swagger-contracts.js";
import { verificationPaths, verificationSchemas } from "./swagger-verification.js";

const { API_PREFIX: apiPrefix = "" } = process.env;

export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "LeadForge Authorization API",
    version: "0.1.0",
  },
  servers: [{ url: apiPrefix }],
  paths: {
    ...buildPaths(routes),
    ...verificationPaths,
  },
  components: {
    schemas: {
      ...componentsSchemas,
      ...verificationSchemas,
    },
  },
};
