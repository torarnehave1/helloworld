import { onRequest as __api_save_hello_js_onRequest } from "/Users/torarnehave/Documents/GitHub/helloworld/functions/api/save-hello.js"

export const routes = [
    {
      routePath: "/api/save-hello",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_save_hello_js_onRequest],
    },
  ]