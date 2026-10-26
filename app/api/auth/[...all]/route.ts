import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/domains/account/index";

export const { GET, POST } = toNextJsHandler(auth);
