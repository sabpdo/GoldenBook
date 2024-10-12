type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type InputTag = "input" | "textarea" | "json";
type Field = InputTag | { [key: string]: Field };
type Fields = Record<string, Field>;

type Operation = {
  name: string;
  endpoint: string;
  method: HttpMethod;
  fields: Fields;
};

/**
 * This list of operations is used to generate the manual testing UI.
 */
const operations: Operation[] = [
  {
    name: "Get Session User (logged in user)",
    endpoint: "/api/session",
    method: "GET",
    fields: {},
  },
  {
    name: "Create User",
    endpoint: "/api/users",
    method: "POST",
    fields: { username: "input", password: "input" },
  },
  {
    name: "Login",
    endpoint: "/api/login",
    method: "POST",
    fields: { username: "input", password: "input" },
  },
  {
    name: "Logout",
    endpoint: "/api/logout",
    method: "POST",
    fields: {},
  },
  {
    name: "Update Password",
    endpoint: "/api/users/password",
    method: "PATCH",
    fields: { currentPassword: "input", newPassword: "input" },
  },
  {
    name: "Delete User",
    endpoint: "/api/users",
    method: "DELETE",
    fields: {},
  },
  {
    name: "Get Users (empty for all)",
    endpoint: "/api/users/:username",
    method: "GET",
    fields: { username: "input" },
  },
  {
    name: "Get Posts (empty for all)",
    endpoint: "/api/posts",
    method: "GET",
    fields: { author: "input" },
  },
  {
    name: "Create Post",
    endpoint: "/api/posts",
    method: "POST",
    fields: { content: "input" },
  },
  {
    name: "Update Post",
    endpoint: "/api/posts/:id",
    method: "PATCH",
    fields: { id: "input", content: "input", options: { backgroundColor: "input" } },
  },
  {
    name: "Delete Post",
    endpoint: "/api/posts/:id",
    method: "DELETE",
    fields: { id: "input" },
  },
  {
    name: "Get Messages (empty for all)",
    endpoint: "/api/messages",
    method: "GET",
    fields: { sender: "input", receiver: "input" },
  },
  {
    name: "Send Message",
    endpoint: "/api/messages",
    method: "POST",
    fields: { to: "input", content: "input" },
  },
  {
    name: "Delete Message",
    endpoint: "/api/messages/:id",
    method: "DELETE",
    fields: { id: "input" },
  },
  {
    name: "Get Nudges (empty for all)",
    endpoint: "/api/nudges",
    method: "GET",
    fields: { sender: "input", receiver: "input", action: "input", time: "input" },
  },
  {
    name: "Send Nudge to Message",
    endpoint: "/api/nudges/message",
    method: "POST",
    fields: { to: "input", time: "input" },
  },
  {
    name: "Send Periodic Nudge",
    endpoint: "/api/nudges/message/periodic",
    method: "POST",
    fields: { to: "input", action: "input", start: "input", end: "input", frequency: "input" },
  },
  {
    name: "Delete Nudge",
    endpoint: "/api/nudges/:id",
    method: "DELETE",
    fields: { id: "input" },
  },
  {
    name: "Get Records",
    endpoint: "/api/records",
    method: "GET",
    fields: { receiver: "input" },
  },
  {
    name: "Create Record",
    endpoint: "/api/records",
    method: "POST",
    fields: { action: "input", time: "input" },
  },
  {
    name: "Delete Record",
    endpoint: "/api/records/:id",
    method: "DELETE",
    fields: { id: "input" },
  },
  {
    name: "Start Automatic Recording of Message Activity",
    endpoint: "/api/records/automatic/message",
    method: "POST",
    fields: {},
  },
  {
    name: "Stop Automatic Recording of Messaging",
    endpoint: "/api/records/automatic/message",
    method: "DELETE",
    fields: {},
  },
  {
    name: "Start Automatic Recording of Posting",
    endpoint: "/api/records/automatic/post",
    method: "POST",
    fields: {},
  },
  {
    name: "Stop Automatic Recording of Posting",
    endpoint: "/api/records/automatic/post",
    method: "DELETE",
    fields: {},
  },
  {
    name: "Get Denied Actions for User",
    endpoint: "/api/authorize/:username",
    method: "GET",
    fields: { username: "input" },
  },
  {
    name: "Get Denied Actions for Current User",
    endpoint: "/api/authorize",
    method: "GET",
    fields: {},
  },
  {
    name: "Authorize Message",
    endpoint: "/api/authorize/allow/message",
    method: "POST",
    fields: { username: "input" },
  },
  {
    name: "Deny Message",
    endpoint: "/api/authorize/deny/message",
    method: "POST",
    fields: { username: "input" },
  },
  {
    name: "Allow Post",
    endpoint: "/api/authorize/allow/post",
    method: "POST",
    fields: { username: "input" },
  },
  {
    name: "Deny Post",
    endpoint: "/api/authorize/deny/post",
    method: "POST",
    fields: { username: "input" },
  },
  {
    name: "Authorize Nudge",
    endpoint: "/api/authorize/allow/nudge",
    method: "POST",
    fields: { username: "input" },
  },
  {
    name: "Deny Nudge",
    endpoint: "/api/authorize/deny/nudge",
    method: "POST",
    fields: { username: "input" },
  },
  {
    name: "Authorize Record",
    endpoint: "/api/authorize/allow/record",
    method: "POST",
    fields: { username: "input" },
  },
  {
    name: "Deny Record",
    endpoint: "/api/authorize/deny/record",
    method: "POST",
    fields: { username: "input" },
  },
  {
    name: "Get Authorizees and Authorizers for Current User",
    endpoint: "/api/authorize/control",
    method: "GET",
    fields: {},
  },
  {
    name: "Give Authorization Permission",
    endpoint: "/api/authorize/control",
    method: "POST",
    fields: { username: "input" },
  },
  {
    name: "Revoke Authorization Permission",
    endpoint: "/api/authorize/control",
    method: "DELETE",
    fields: { username: "input" },
  },
];

/*
 * You should not need to edit below.
 * Please ask if you have questions about what this test code is doing!
 */

function updateResponse(code: string, response: string) {
  document.querySelector("#status-code")!.innerHTML = code;
  document.querySelector("#response-text")!.innerHTML = response;
}

async function request(method: HttpMethod, endpoint: string, params?: unknown) {
  try {
    if (method === "GET" && params) {
      endpoint += "?" + new URLSearchParams(params as Record<string, string>).toString();
      params = undefined;
    }

    const res = fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: params ? JSON.stringify(params) : undefined,
    });

    return {
      $statusCode: (await res).status,
      $response: await (await res).json(),
    };
  } catch (e) {
    console.log(e);
    return {
      $statusCode: "???",
      $response: { error: "Something went wrong, check your console log.", details: e },
    };
  }
}

function fieldsToHtml(fields: Record<string, Field>, indent = 0, prefix = ""): string {
  return Object.entries(fields)
    .map(([name, tag]) => {
      const htmlTag = tag === "json" ? "textarea" : tag;
      return `
        <div class="field" style="margin-left: ${indent}px">
          <label>${name}:
          ${typeof tag === "string" ? `<${htmlTag} name="${prefix}${name}"></${htmlTag}>` : fieldsToHtml(tag, indent + 10, prefix + name + ".")}
          </label>
        </div>`;
    })
    .join("");
}

function getHtmlOperations() {
  return operations.map((operation) => {
    return `<li class="operation">
      <h3>${operation.name}</h3>
      <form class="operation-form">
        <input type="hidden" name="$endpoint" value="${operation.endpoint}" />
        <input type="hidden" name="$method" value="${operation.method}" />
        ${fieldsToHtml(operation.fields)}
        <button type="submit">Submit</button>
      </form>
    </li>`;
  });
}

function prefixedRecordIntoObject(record: Record<string, string>) {
  const obj: any = {}; // eslint-disable-line
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const keys = key.split(".");
    const lastKey = keys.pop()!;
    let currentObj = obj;
    for (const key of keys) {
      if (!currentObj[key]) {
        currentObj[key] = {};
      }
      currentObj = currentObj[key];
    }
    currentObj[lastKey] = value;
  }
  return obj;
}

async function submitEventHandler(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const { $method, $endpoint, ...reqData } = Object.fromEntries(new FormData(form));

  // Replace :param with the actual value.
  const endpoint = ($endpoint as string).replace(/:(\w+)/g, (_, key) => {
    const param = reqData[key] as string;
    delete reqData[key];
    return param;
  });

  const op = operations.find((op) => op.endpoint === $endpoint && op.method === $method);
  const pairs = Object.entries(reqData);
  for (const [key, val] of pairs) {
    if (val === "") {
      delete reqData[key];
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const type = key.split(".").reduce((obj, key) => obj[key], op?.fields as any);
    if (type === "json") {
      reqData[key] = JSON.parse(val as string);
    }
  }

  const data = prefixedRecordIntoObject(reqData as Record<string, string>);

  updateResponse("", "Loading...");
  const response = await request($method as HttpMethod, endpoint as string, Object.keys(data).length > 0 ? data : undefined);
  updateResponse(response.$statusCode.toString(), JSON.stringify(response.$response, null, 2));
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("#operations-list")!.innerHTML = getHtmlOperations().join("");
  document.querySelectorAll(".operation-form").forEach((form) => form.addEventListener("submit", submitEventHandler));
});
