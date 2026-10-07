import { defineConfig } from "oxlint";
import recommended from "@timmo001/oxlint-rules/configs/recommended";

export default defineConfig({
  extends: [recommended],
  ignorePatterns: ["vendor/**"],
  options: {
    typeAware: true,
    maxWarnings: 0,
  },
});
