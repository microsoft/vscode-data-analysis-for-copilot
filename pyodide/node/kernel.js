"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/comlink/dist/umd/comlink.js
var require_comlink = __commonJS({
  "node_modules/comlink/dist/umd/comlink.js"(exports2, module2) {
    (function(global, factory) {
      typeof exports2 === "object" && typeof module2 !== "undefined" ? factory(exports2) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.Comlink = {}));
    })(exports2, function(exports3) {
      "use strict";
      const proxyMarker = Symbol("Comlink.proxy");
      const createEndpoint = Symbol("Comlink.endpoint");
      const releaseProxy = Symbol("Comlink.releaseProxy");
      const finalizer = Symbol("Comlink.finalizer");
      const throwMarker = Symbol("Comlink.thrown");
      const isObject = (val) => typeof val === "object" && val !== null || typeof val === "function";
      const proxyTransferHandler = {
        canHandle: (val) => isObject(val) && val[proxyMarker],
        serialize(obj) {
          const { port1, port2 } = new MessageChannel();
          expose(obj, port1);
          return [port2, [port2]];
        },
        deserialize(port) {
          port.start();
          return wrap2(port);
        }
      };
      const throwTransferHandler = {
        canHandle: (value) => isObject(value) && throwMarker in value,
        serialize({ value }) {
          let serialized;
          if (value instanceof Error) {
            serialized = {
              isError: true,
              value: {
                message: value.message,
                name: value.name,
                stack: value.stack
              }
            };
          } else {
            serialized = { isError: false, value };
          }
          return [serialized, []];
        },
        deserialize(serialized) {
          if (serialized.isError) {
            throw Object.assign(new Error(serialized.value.message), serialized.value);
          }
          throw serialized.value;
        }
      };
      const transferHandlers = /* @__PURE__ */ new Map([
        ["proxy", proxyTransferHandler],
        ["throw", throwTransferHandler]
      ]);
      function isAllowedOrigin(allowedOrigins, origin) {
        for (const allowedOrigin of allowedOrigins) {
          if (origin === allowedOrigin || allowedOrigin === "*") {
            return true;
          }
          if (allowedOrigin instanceof RegExp && allowedOrigin.test(origin)) {
            return true;
          }
        }
        return false;
      }
      function expose(obj, ep = globalThis, allowedOrigins = ["*"]) {
        ep.addEventListener("message", function callback(ev) {
          if (!ev || !ev.data) {
            return;
          }
          if (!isAllowedOrigin(allowedOrigins, ev.origin)) {
            console.warn(`Invalid origin '${ev.origin}' for comlink proxy`);
            return;
          }
          const { id, type, path } = Object.assign({ path: [] }, ev.data);
          const argumentList = (ev.data.argumentList || []).map(fromWireValue);
          let returnValue;
          try {
            const parent = path.slice(0, -1).reduce((obj2, prop) => obj2[prop], obj);
            const rawValue = path.reduce((obj2, prop) => obj2[prop], obj);
            switch (type) {
              case "GET":
                {
                  returnValue = rawValue;
                }
                break;
              case "SET":
                {
                  parent[path.slice(-1)[0]] = fromWireValue(ev.data.value);
                  returnValue = true;
                }
                break;
              case "APPLY":
                {
                  returnValue = rawValue.apply(parent, argumentList);
                }
                break;
              case "CONSTRUCT":
                {
                  const value = new rawValue(...argumentList);
                  returnValue = proxy2(value);
                }
                break;
              case "ENDPOINT":
                {
                  const { port1, port2 } = new MessageChannel();
                  expose(obj, port2);
                  returnValue = transfer(port1, [port1]);
                }
                break;
              case "RELEASE":
                {
                  returnValue = void 0;
                }
                break;
              default:
                return;
            }
          } catch (value) {
            returnValue = { value, [throwMarker]: 0 };
          }
          Promise.resolve(returnValue).catch((value) => {
            return { value, [throwMarker]: 0 };
          }).then((returnValue2) => {
            const [wireValue, transferables] = toWireValue(returnValue2);
            ep.postMessage(Object.assign(Object.assign({}, wireValue), { id }), transferables);
            if (type === "RELEASE") {
              ep.removeEventListener("message", callback);
              closeEndPoint(ep);
              if (finalizer in obj && typeof obj[finalizer] === "function") {
                obj[finalizer]();
              }
            }
          }).catch((error) => {
            const [wireValue, transferables] = toWireValue({
              value: new TypeError("Unserializable return value"),
              [throwMarker]: 0
            });
            ep.postMessage(Object.assign(Object.assign({}, wireValue), { id }), transferables);
          });
        });
        if (ep.start) {
          ep.start();
        }
      }
      function isMessagePort(endpoint) {
        return endpoint.constructor.name === "MessagePort";
      }
      function closeEndPoint(endpoint) {
        if (isMessagePort(endpoint))
          endpoint.close();
      }
      function wrap2(ep, target) {
        return createProxy(ep, [], target);
      }
      function throwIfProxyReleased(isReleased) {
        if (isReleased) {
          throw new Error("Proxy has been released and is not useable");
        }
      }
      function releaseEndpoint(ep) {
        return requestResponseMessage(ep, {
          type: "RELEASE"
        }).then(() => {
          closeEndPoint(ep);
        });
      }
      const proxyCounter = /* @__PURE__ */ new WeakMap();
      const proxyFinalizers = "FinalizationRegistry" in globalThis && new FinalizationRegistry((ep) => {
        const newCount = (proxyCounter.get(ep) || 0) - 1;
        proxyCounter.set(ep, newCount);
        if (newCount === 0) {
          releaseEndpoint(ep);
        }
      });
      function registerProxy(proxy3, ep) {
        const newCount = (proxyCounter.get(ep) || 0) + 1;
        proxyCounter.set(ep, newCount);
        if (proxyFinalizers) {
          proxyFinalizers.register(proxy3, ep, proxy3);
        }
      }
      function unregisterProxy(proxy3) {
        if (proxyFinalizers) {
          proxyFinalizers.unregister(proxy3);
        }
      }
      function createProxy(ep, path = [], target = function() {
      }) {
        let isProxyReleased = false;
        const proxy3 = new Proxy(target, {
          get(_target, prop) {
            throwIfProxyReleased(isProxyReleased);
            if (prop === releaseProxy) {
              return () => {
                unregisterProxy(proxy3);
                releaseEndpoint(ep);
                isProxyReleased = true;
              };
            }
            if (prop === "then") {
              if (path.length === 0) {
                return { then: () => proxy3 };
              }
              const r = requestResponseMessage(ep, {
                type: "GET",
                path: path.map((p) => p.toString())
              }).then(fromWireValue);
              return r.then.bind(r);
            }
            return createProxy(ep, [...path, prop]);
          },
          set(_target, prop, rawValue) {
            throwIfProxyReleased(isProxyReleased);
            const [value, transferables] = toWireValue(rawValue);
            return requestResponseMessage(ep, {
              type: "SET",
              path: [...path, prop].map((p) => p.toString()),
              value
            }, transferables).then(fromWireValue);
          },
          apply(_target, _thisArg, rawArgumentList) {
            throwIfProxyReleased(isProxyReleased);
            const last = path[path.length - 1];
            if (last === createEndpoint) {
              return requestResponseMessage(ep, {
                type: "ENDPOINT"
              }).then(fromWireValue);
            }
            if (last === "bind") {
              return createProxy(ep, path.slice(0, -1));
            }
            const [argumentList, transferables] = processArguments(rawArgumentList);
            return requestResponseMessage(ep, {
              type: "APPLY",
              path: path.map((p) => p.toString()),
              argumentList
            }, transferables).then(fromWireValue);
          },
          construct(_target, rawArgumentList) {
            throwIfProxyReleased(isProxyReleased);
            const [argumentList, transferables] = processArguments(rawArgumentList);
            return requestResponseMessage(ep, {
              type: "CONSTRUCT",
              path: path.map((p) => p.toString()),
              argumentList
            }, transferables).then(fromWireValue);
          }
        });
        registerProxy(proxy3, ep);
        return proxy3;
      }
      function myFlat(arr) {
        return Array.prototype.concat.apply([], arr);
      }
      function processArguments(argumentList) {
        const processed = argumentList.map(toWireValue);
        return [processed.map((v) => v[0]), myFlat(processed.map((v) => v[1]))];
      }
      const transferCache = /* @__PURE__ */ new WeakMap();
      function transfer(obj, transfers) {
        transferCache.set(obj, transfers);
        return obj;
      }
      function proxy2(obj) {
        return Object.assign(obj, { [proxyMarker]: true });
      }
      function windowEndpoint(w, context = globalThis, targetOrigin = "*") {
        return {
          postMessage: (msg, transferables) => w.postMessage(msg, targetOrigin, transferables),
          addEventListener: context.addEventListener.bind(context),
          removeEventListener: context.removeEventListener.bind(context)
        };
      }
      function toWireValue(value) {
        for (const [name, handler] of transferHandlers) {
          if (handler.canHandle(value)) {
            const [serializedValue, transferables] = handler.serialize(value);
            return [
              {
                type: "HANDLER",
                name,
                value: serializedValue
              },
              transferables
            ];
          }
        }
        return [
          {
            type: "RAW",
            value
          },
          transferCache.get(value) || []
        ];
      }
      function fromWireValue(value) {
        switch (value.type) {
          case "HANDLER":
            return transferHandlers.get(value.name).deserialize(value.value);
          case "RAW":
            return value.value;
        }
      }
      function requestResponseMessage(ep, msg, transfers) {
        return new Promise((resolve) => {
          const id = generateUUID();
          ep.addEventListener("message", function l(ev) {
            if (!ev.data || !ev.data.id || ev.data.id !== id) {
              return;
            }
            ep.removeEventListener("message", l);
            resolve(ev.data);
          });
          if (ep.start) {
            ep.start();
          }
          ep.postMessage(Object.assign({ id }, msg), transfers);
        });
      }
      function generateUUID() {
        return new Array(4).fill(0).map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)).join("-");
      }
      exports3.createEndpoint = createEndpoint;
      exports3.expose = expose;
      exports3.finalizer = finalizer;
      exports3.proxy = proxy2;
      exports3.proxyMarker = proxyMarker;
      exports3.releaseProxy = releaseProxy;
      exports3.transfer = transfer;
      exports3.transferHandlers = transferHandlers;
      exports3.windowEndpoint = windowEndpoint;
      exports3.wrap = wrap2;
    });
  }
});

// node_modules/comlink/dist/umd/node-adapter.js
var require_node_adapter = __commonJS({
  "node_modules/comlink/dist/umd/node-adapter.js"(exports2, module2) {
    (function(global, factory) {
      typeof exports2 === "object" && typeof module2 !== "undefined" ? module2.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.Comlink = factory());
    })(exports2, function() {
      "use strict";
      function nodeEndpoint2(nep) {
        const listeners = /* @__PURE__ */ new WeakMap();
        return {
          postMessage: nep.postMessage.bind(nep),
          addEventListener: (_, eh) => {
            const l = (data) => {
              if ("handleEvent" in eh) {
                eh.handleEvent({ data });
              } else {
                eh({ data });
              }
            };
            nep.on("message", l);
            listeners.set(eh, l);
          },
          removeEventListener: (_, eh) => {
            const l = listeners.get(eh);
            if (!l) {
              return;
            }
            nep.off("message", l);
            listeners.delete(eh);
          },
          start: nep.start && nep.start.bind(nep)
        };
      }
      return nodeEndpoint2;
    });
  }
});

// src/node/kernel.ts
var kernel_exports = {};
__export(kernel_exports, {
  PyodideKernel: () => PyodideKernel
});
module.exports = __toCommonJS(kernel_exports);

// src/common/kernel.ts
var import_comlink = __toESM(require_comlink());
var import_node_adapter = __toESM(require_node_adapter());
var import_coreutils = require("@lumino/coreutils");
var import_coreutils2 = require("@jupyterlab/coreutils");

// node_modules/@jupyterlite/kernel/lib/kernel.js
var import_services = require("@jupyterlab/services");
var import_signaling = require("@lumino/signaling");
var BaseKernel = class {
  /**
   * Construct a new BaseKernel.
   *
   * @param options The instantiation options for a BaseKernel.
   */
  constructor(options) {
    this._history = [];
    this._executionCount = 0;
    this._isDisposed = false;
    this._disposed = new import_signaling.Signal(this);
    this._parentHeader = void 0;
    this._parent = void 0;
    const { id, name, location, sendMessage } = options;
    this._id = id;
    this._name = name;
    this._location = location;
    this._sendMessage = sendMessage;
  }
  /**
   * A promise that is fulfilled when the kernel is ready.
   */
  get ready() {
    return Promise.resolve();
  }
  /**
   * Return whether the kernel is disposed.
   */
  get isDisposed() {
    return this._isDisposed;
  }
  /**
   * A signal emitted when the kernel is disposed.
   */
  get disposed() {
    return this._disposed;
  }
  /**
   * Get the kernel id
   */
  get id() {
    return this._id;
  }
  /**
   * Get the name of the kernel
   */
  get name() {
    return this._name;
  }
  /**
   * The location in the virtual filesystem from which the kernel was started.
   */
  get location() {
    return this._location;
  }
  /**
   * The current execution count
   */
  get executionCount() {
    return this._executionCount;
  }
  /**
   * Get the last parent header
   */
  get parentHeader() {
    return this._parentHeader;
  }
  /**
   * Get the last parent message (mimic ipykernel's get_parent)
   */
  get parent() {
    return this._parent;
  }
  /**
   * Dispose the kernel.
   */
  dispose() {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._disposed.emit(void 0);
  }
  /**
   * Handle an incoming message from the client.
   *
   * @param msg The message to handle
   */
  async handleMessage(msg) {
    this._busy(msg);
    this._parent = msg;
    const msgType = msg.header.msg_type;
    switch (msgType) {
      case "kernel_info_request":
        await this._kernelInfo(msg);
        break;
      case "execute_request":
        await this._execute(msg);
        break;
      case "input_reply":
        this.inputReply(msg.content);
        break;
      case "inspect_request":
        await this._inspect(msg);
        break;
      case "is_complete_request":
        await this._isCompleteRequest(msg);
        break;
      case "complete_request":
        await this._complete(msg);
        break;
      case "history_request":
        await this._historyRequest(msg);
        break;
      case "comm_open":
        await this.commOpen(msg);
        break;
      case "comm_msg":
        await this.commMsg(msg);
        break;
      case "comm_close":
        await this.commClose(msg);
        break;
      default:
        break;
    }
    this._idle(msg);
  }
  /**
   * Stream an event from the kernel
   *
   * @param parentHeader The parent header.
   * @param content The stream content.
   */
  stream(content, parentHeader = void 0) {
    var _a;
    const parentHeaderValue = typeof parentHeader !== "undefined" ? parentHeader : this._parentHeader;
    const message = import_services.KernelMessage.createMessage({
      channel: "iopub",
      msgType: "stream",
      // TODO: better handle this
      session: (_a = parentHeaderValue === null || parentHeaderValue === void 0 ? void 0 : parentHeaderValue.session) !== null && _a !== void 0 ? _a : "",
      parentHeader: parentHeaderValue,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Send a `display_data` message to the client.
   *
   * @param parentHeader The parent header.
   * @param content The display_data content.
   */
  displayData(content, parentHeader = void 0) {
    var _a, _b;
    const parentHeaderValue = typeof parentHeader !== "undefined" ? parentHeader : this._parentHeader;
    content.metadata = (_a = content.metadata) !== null && _a !== void 0 ? _a : {};
    const message = import_services.KernelMessage.createMessage({
      channel: "iopub",
      msgType: "display_data",
      // TODO: better handle this
      session: (_b = parentHeaderValue === null || parentHeaderValue === void 0 ? void 0 : parentHeaderValue.session) !== null && _b !== void 0 ? _b : "",
      parentHeader: parentHeaderValue,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Send a `input_request` message to the client.
   *
   * @param parentHeader The parent header.
   * @param content The input_request content.
   */
  inputRequest(content, parentHeader = void 0) {
    var _a;
    const parentHeaderValue = typeof parentHeader !== "undefined" ? parentHeader : this._parentHeader;
    const message = import_services.KernelMessage.createMessage({
      channel: "stdin",
      msgType: "input_request",
      // TODO: better handle this
      session: (_a = parentHeaderValue === null || parentHeaderValue === void 0 ? void 0 : parentHeaderValue.session) !== null && _a !== void 0 ? _a : "",
      parentHeader: parentHeaderValue,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Send an `execute_result` message.
   *
   * @param parentHeader The parent header.
   * @param content The execute result content.
   */
  publishExecuteResult(content, parentHeader = void 0) {
    var _a;
    const parentHeaderValue = typeof parentHeader !== "undefined" ? parentHeader : this._parentHeader;
    const message = import_services.KernelMessage.createMessage({
      channel: "iopub",
      msgType: "execute_result",
      // TODO: better handle this
      session: (_a = parentHeaderValue === null || parentHeaderValue === void 0 ? void 0 : parentHeaderValue.session) !== null && _a !== void 0 ? _a : "",
      parentHeader: parentHeaderValue,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Send an `error` message to the client.
   *
   * @param parentHeader The parent header.
   * @param content The error content.
   */
  publishExecuteError(content, parentHeader = void 0) {
    var _a;
    const parentHeaderValue = typeof parentHeader !== "undefined" ? parentHeader : this._parentHeader;
    const message = import_services.KernelMessage.createMessage({
      channel: "iopub",
      msgType: "error",
      // TODO: better handle this
      session: (_a = parentHeaderValue === null || parentHeaderValue === void 0 ? void 0 : parentHeaderValue.session) !== null && _a !== void 0 ? _a : "",
      parentHeader: parentHeaderValue,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Send a `update_display_data` message to the client.
   *
   * @param parentHeader The parent header.
   * @param content The update_display_data content.
   */
  updateDisplayData(content, parentHeader = void 0) {
    var _a;
    const parentHeaderValue = typeof parentHeader !== "undefined" ? parentHeader : this._parentHeader;
    const message = import_services.KernelMessage.createMessage({
      channel: "iopub",
      msgType: "update_display_data",
      // TODO: better handle this
      session: (_a = parentHeaderValue === null || parentHeaderValue === void 0 ? void 0 : parentHeaderValue.session) !== null && _a !== void 0 ? _a : "",
      parentHeader: parentHeaderValue,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Send a `clear_output` message to the client.
   *
   * @param parentHeader The parent header.
   * @param content The clear_output content.
   */
  clearOutput(content, parentHeader = void 0) {
    var _a;
    const parentHeaderValue = typeof parentHeader !== "undefined" ? parentHeader : this._parentHeader;
    const message = import_services.KernelMessage.createMessage({
      channel: "iopub",
      msgType: "clear_output",
      // TODO: better handle this
      session: (_a = parentHeaderValue === null || parentHeaderValue === void 0 ? void 0 : parentHeaderValue.session) !== null && _a !== void 0 ? _a : "",
      parentHeader: parentHeaderValue,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Send a `comm` message to the client.
   *
   * @param .
   */
  handleComm(type, content, metadata, buffers, parentHeader = void 0) {
    var _a;
    const parentHeaderValue = typeof parentHeader !== "undefined" ? parentHeader : this._parentHeader;
    const message = import_services.KernelMessage.createMessage({
      channel: "iopub",
      msgType: type,
      // TODO: better handle this
      session: (_a = parentHeaderValue === null || parentHeaderValue === void 0 ? void 0 : parentHeaderValue.session) !== null && _a !== void 0 ? _a : "",
      parentHeader: parentHeaderValue,
      content,
      metadata,
      buffers
    });
    this._sendMessage(message);
  }
  /**
   * Send an 'idle' status message.
   *
   * @param parent The parent message
   */
  _idle(parent) {
    const message = import_services.KernelMessage.createMessage({
      msgType: "status",
      session: parent.header.session,
      parentHeader: parent.header,
      channel: "iopub",
      content: {
        execution_state: "idle"
      }
    });
    this._sendMessage(message);
  }
  /**
   * Send a 'busy' status message.
   *
   * @param parent The parent message.
   */
  _busy(parent) {
    const message = import_services.KernelMessage.createMessage({
      msgType: "status",
      session: parent.header.session,
      parentHeader: parent.header,
      channel: "iopub",
      content: {
        execution_state: "busy"
      }
    });
    this._sendMessage(message);
  }
  /**
   * Handle a kernel_info_request message
   *
   * @param parent The parent message.
   */
  async _kernelInfo(parent) {
    const content = await this.kernelInfoRequest();
    const message = import_services.KernelMessage.createMessage({
      msgType: "kernel_info_reply",
      channel: "shell",
      session: parent.header.session,
      parentHeader: parent.header,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Handle a `history_request` message
   *
   * @param msg The parent message.
   */
  async _historyRequest(msg) {
    const historyMsg = msg;
    const message = import_services.KernelMessage.createMessage({
      msgType: "history_reply",
      channel: "shell",
      parentHeader: historyMsg.header,
      session: msg.header.session,
      content: {
        status: "ok",
        history: this._history
      }
    });
    this._sendMessage(message);
  }
  /**
   * Send an `execute_input` message.
   *
   * @param msg The parent message.
   */
  _executeInput(msg) {
    const parent = msg;
    const code = parent.content.code;
    const message = import_services.KernelMessage.createMessage({
      msgType: "execute_input",
      parentHeader: parent.header,
      channel: "iopub",
      session: msg.header.session,
      content: {
        code,
        execution_count: this._executionCount
      }
    });
    this._sendMessage(message);
  }
  /**
   * Handle an execute_request message.
   *
   * @param msg The parent message.
   */
  async _execute(msg) {
    const executeMsg = msg;
    const content = executeMsg.content;
    if (content.store_history) {
      this._executionCount++;
    }
    this._parentHeader = executeMsg.header;
    this._executeInput(executeMsg);
    if (content.store_history) {
      this._history.push([0, 0, content.code]);
    }
    const reply = await this.executeRequest(executeMsg.content);
    const message = import_services.KernelMessage.createMessage({
      msgType: "execute_reply",
      channel: "shell",
      parentHeader: executeMsg.header,
      session: msg.header.session,
      content: reply
    });
    this._sendMessage(message);
  }
  /**
   * Handle an complete_request message
   *
   * @param msg The parent message.
   */
  async _complete(msg) {
    const completeMsg = msg;
    const content = await this.completeRequest(completeMsg.content);
    const message = import_services.KernelMessage.createMessage({
      msgType: "complete_reply",
      parentHeader: completeMsg.header,
      channel: "shell",
      session: msg.header.session,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Handle an inspect_request message
   *
   * @param msg The parent message.
   */
  async _inspect(msg) {
    const inspectMsg = msg;
    const content = await this.inspectRequest(inspectMsg.content);
    const message = import_services.KernelMessage.createMessage({
      msgType: "inspect_reply",
      parentHeader: inspectMsg.header,
      channel: "shell",
      session: msg.header.session,
      content
    });
    this._sendMessage(message);
  }
  /**
   * Handle an is_complete_request message
   *
   * @param msg The parent message.
   */
  async _isCompleteRequest(msg) {
    const isCompleteMsg = msg;
    const content = await this.isCompleteRequest(isCompleteMsg.content);
    const message = import_services.KernelMessage.createMessage({
      msgType: "is_complete_reply",
      parentHeader: isCompleteMsg.header,
      channel: "shell",
      session: msg.header.session,
      content
    });
    this._sendMessage(message);
  }
};

// src/common/_pypi.ts
var pipliteWheelUrl = { default: "" };

// src/common/syncMessagingMain.ts
var RES_SIZE = 256;
var encoder = new TextEncoder();
var sharedCtrlBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
var ctrlBuffer = new Int32Array(sharedCtrlBuffer);
var sharedValueBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * RES_SIZE);
var valueBuffer = new Int32Array(sharedValueBuffer);
var encodeBuffer = new Uint8Array(RES_SIZE);
function ctrlSignal(value) {
  Atomics.store(ctrlBuffer, 0, value);
  Atomics.notify(ctrlBuffer, 0);
}
var SyncMessaging = class {
  constructor(worker) {
    worker.postMessage({
      sharedCtrlBuffer,
      sharedValueBuffer
    });
  }
  send(message) {
    const length = encoder.encodeInto(message, encodeBuffer).written;
    for (let i = 0; i < length; i++) {
      Atomics.store(valueBuffer, i, encodeBuffer[i]);
    }
    ctrlSignal(length);
  }
};

// src/common/kernel.ts
var BasePyodideKernel = class extends BaseKernel {
  /**
   * Instantiate a new PyodideKernel
   *
   * @param options The instantiation options for a new PyodideKernel
   */
  constructor(options) {
    super(options);
    this._ready = new import_coreutils.PromiseDelegate();
    this._worker = this.initWorker(options);
    this.syncMessaging = new SyncMessaging(this._worker);
    this._worker.postMessage({ Init: 123 });
    this._remoteKernel = this.initRemote(options);
  }
  get remoteKernel() {
    return this._remoteKernel;
  }
  /**
   * Initialize the remote kernel.
   * Use coincident if crossOriginIsolated, comlink otherwise
   * See the two following issues for more context:
   *  - https://github.com/jupyterlite/jupyterlite/issues/1424
   *  - https://github.com/jupyterlite/pyodide-kernel/pull/126
   */
  initRemote(options) {
    const remote = (0, import_comlink.wrap)((0, import_node_adapter.default)(this._worker));
    remote.registerCallback((0, import_comlink.proxy)(this._processWorkerMessage.bind(this)));
    const remoteOptions = this.initRemoteOptions(options);
    remote.initialize(remoteOptions).then(this._ready.resolve.bind(this._ready));
    return remote;
  }
  initRemoteOptions(options) {
    const { pyodideUrl } = options;
    const indexUrl = pyodideUrl.slice(0, pyodideUrl.lastIndexOf("/") + 1);
    const baseUrl = options.baseUrl || import_coreutils2.PageConfig.getBaseUrl();
    const pipliteUrls = [...options.pipliteUrls || []];
    const disablePyPIFallback = !!options.disablePyPIFallback;
    return {
      baseUrl,
      pyodideUrl,
      indexUrl,
      pipliteWheelUrl: options.pipliteWheelUrl || pipliteWheelUrl.default,
      pipliteUrls,
      disablePyPIFallback,
      location: this.location,
      mountDrive: options.mountDrive,
      loadPyodideOptions: options.loadPyodideOptions || {
        lockFileURL: baseUrl + (!baseUrl.endsWith("/") && !baseUrl.endsWith("\\") ? "/" : "") + "/pyodide-lock.json",
        packages: []
      }
    };
  }
  /**
   * Dispose the kernel.
   */
  dispose() {
    if (this.isDisposed) {
      return;
    }
    this._worker.terminate();
    super.dispose();
  }
  /**
   * A promise that is fulfilled when the kernel is ready.
   */
  get ready() {
    return this._ready.promise;
  }
  /**
   * Process a message coming from the pyodide web worker.
   *
   * @param msg The worker message to process.
   */
  _processWorkerMessage(msg) {
    if (!msg.type) {
      return;
    }
    switch (msg.type) {
      case "stream": {
        const bundle = msg.bundle ?? { name: "stdout", text: "" };
        this.stream(bundle, msg.parentHeader);
        break;
      }
      case "input_request": {
        const bundle = msg.content ?? { prompt: "", password: false };
        this.inputRequest(bundle, msg.parentHeader);
        break;
      }
      case "display_data": {
        const bundle = msg.bundle ?? { data: {}, metadata: {}, transient: {} };
        this.displayData(bundle, msg.parentHeader);
        break;
      }
      case "update_display_data": {
        const bundle = msg.bundle ?? { data: {}, metadata: {}, transient: {} };
        this.updateDisplayData(bundle, msg.parentHeader);
        break;
      }
      case "clear_output": {
        const bundle = msg.bundle ?? { wait: false };
        this.clearOutput(bundle, msg.parentHeader);
        break;
      }
      case "execute_result": {
        const bundle = msg.bundle ?? {
          execution_count: 0,
          data: {},
          metadata: {}
        };
        this.publishExecuteResult(bundle, msg.parentHeader);
        break;
      }
      case "execute_error": {
        const bundle = msg.bundle ?? { ename: "", evalue: "", traceback: [] };
        this.publishExecuteError(bundle, msg.parentHeader);
        break;
      }
      case "comm_msg":
      case "comm_open":
      case "comm_close": {
        this.handleComm(msg.type, msg.content, msg.metadata, msg.buffers, msg.parentHeader);
        break;
      }
    }
  }
  /**
   * Handle a kernel_info_request message
   */
  async kernelInfoRequest() {
    const content = {
      implementation: "pyodide",
      implementation_version: "0.1.0",
      language_info: {
        codemirror_mode: {
          name: "python",
          version: 3
        },
        file_extension: ".py",
        mimetype: "text/x-python",
        name: "python",
        nbconvert_exporter: "python",
        pygments_lexer: "ipython3",
        version: "3.8"
      },
      protocol_version: "5.3",
      status: "ok",
      banner: "A WebAssembly-powered Python kernel backed by Pyodide",
      help_links: [
        {
          text: "Python (WASM) Kernel",
          url: "https://pyodide.org"
        }
      ]
    };
    return content;
  }
  /**
   * Handle an `execute_request` message
   *
   * @param msg The parent message.
   */
  async executeRequest(content) {
    await this.ready;
    const result = await this._remoteKernel.execute(content, this.parent);
    result.execution_count = this.executionCount;
    return result;
  }
  /**
   * Handle an complete_request message
   *
   * @param msg The parent message.
   */
  async completeRequest(content) {
    return await this._remoteKernel.complete(content, this.parent);
  }
  /**
   * Handle an `inspect_request` message.
   *
   * @param content - The content of the request.
   *
   * @returns A promise that resolves with the response message.
   */
  async inspectRequest(content) {
    return await this._remoteKernel.inspect(content, this.parent);
  }
  /**
   * Handle an `is_complete_request` message.
   *
   * @param content - The content of the request.
   *
   * @returns A promise that resolves with the response message.
   */
  async isCompleteRequest(content) {
    return await this._remoteKernel.isComplete(content, this.parent);
  }
  /**
   * Handle a `comm_info_request` message.
   *
   * @param content - The content of the request.
   *
   * @returns A promise that resolves with the response message.
   */
  async commInfoRequest(content) {
    return await this._remoteKernel.commInfo(content, this.parent);
  }
  /**
   * Send an `comm_open` message.
   *
   * @param msg - The comm_open message.
   */
  async commOpen(msg) {
    return await this._remoteKernel.commOpen(msg, this.parent);
  }
  /**
   * Send an `comm_msg` message.
   *
   * @param msg - The comm_msg message.
   */
  async commMsg(msg) {
    return await this._remoteKernel.commMsg(msg, this.parent);
  }
  /**
   * Send an `comm_close` message.
   *
   * @param close - The comm_close message.
   */
  async commClose(msg) {
    return await this._remoteKernel.commClose(msg, this.parent);
  }
  /**
   * Send an `input_reply` message.
   *
   * @param content - The content of the reply.
   */
  async inputReply(content) {
    if (content.status === "ok") {
      this.syncMessaging.send(content.value);
    } else {
      this.syncMessaging.send("");
    }
    return await this._remoteKernel.inputReply(content, this.parent);
  }
};

// src/node/kernel.ts
var import_node_worker_threads = require("node:worker_threads");
var PyodideKernel = class extends BasePyodideKernel {
  /**
   * Instantiate a new PyodideKernel
   *
   * @param options The instantiation options for a new PyodideKernel
   */
  constructor(options) {
    super(options);
  }
  /**
   * Load the worker.
   *
   * ### Note
   *
   * Subclasses must implement this typographically almost _exactly_ for
   * webpack to find it.
   */
  initWorker(options) {
    return new import_node_worker_threads.Worker(options.packagePath, {});
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PyodideKernel
});
/*! Bundled license information:

comlink/dist/umd/comlink.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   *)

comlink/dist/umd/node-adapter.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   *)
*/
//# sourceMappingURL=kernel.js.map
