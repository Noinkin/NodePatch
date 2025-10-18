import { patchModules, startRepl } from "../index.js";
import AuthService from "../test/services/authService.js";
import LoggerService from "../test/services/loggerService.js";

// 1️⃣ Register modules in code
patchModules.register("auth", new AuthService());
patchModules.register("logger", new LoggerService());

// 2️⃣ Use modules
patchModules.get("auth").login("alice");
patchModules.get("logger").log("Starting app...");

startRepl();
