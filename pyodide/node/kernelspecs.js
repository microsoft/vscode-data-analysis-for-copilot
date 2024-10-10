var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/@jupyterlite/kernel/lib/index.js
var lib_exports = {};
__export(lib_exports, {
  BaseKernel: () => BaseKernel,
  FALLBACK_KERNEL: () => FALLBACK_KERNEL,
  IKernelSpecs: () => IKernelSpecs,
  IKernels: () => IKernels,
  KernelSpecs: () => KernelSpecs,
  Kernels: () => Kernels
});
module.exports = __toCommonJS(lib_exports);

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

// node_modules/@jupyterlab/observables/lib/observablemap.js
var import_signaling2 = require("@lumino/signaling");
var ObservableMap = class {
  /**
   * Construct a new observable map.
   */
  constructor(options = {}) {
    this._map = /* @__PURE__ */ new Map();
    this._changed = new import_signaling2.Signal(this);
    this._isDisposed = false;
    this._itemCmp = options.itemCmp || Private.itemCmp;
    if (options.values) {
      for (const key in options.values) {
        this._map.set(key, options.values[key]);
      }
    }
  }
  /**
   * The type of the Observable.
   */
  get type() {
    return "Map";
  }
  /**
   * A signal emitted when the map has changed.
   */
  get changed() {
    return this._changed;
  }
  /**
   * Whether this map has been disposed.
   */
  get isDisposed() {
    return this._isDisposed;
  }
  /**
   * The number of key-value pairs in the map.
   */
  get size() {
    return this._map.size;
  }
  /**
   * Set a key-value pair in the map
   *
   * @param key - The key to set.
   *
   * @param value - The value for the key.
   *
   * @returns the old value for the key, or undefined
   *   if that did not exist.
   *
   * @throws if the new value is undefined.
   *
   * #### Notes
   * This is a no-op if the value does not change.
   */
  set(key, value) {
    const oldVal = this._map.get(key);
    if (value === void 0) {
      throw Error("Cannot set an undefined value, use remove");
    }
    const itemCmp = this._itemCmp;
    if (oldVal !== void 0 && itemCmp(oldVal, value)) {
      return oldVal;
    }
    this._map.set(key, value);
    this._changed.emit({
      type: oldVal ? "change" : "add",
      key,
      oldValue: oldVal,
      newValue: value
    });
    return oldVal;
  }
  /**
   * Get a value for a given key.
   *
   * @param key - the key.
   *
   * @returns the value for that key.
   */
  get(key) {
    return this._map.get(key);
  }
  /**
   * Check whether the map has a key.
   *
   * @param key - the key to check.
   *
   * @returns `true` if the map has the key, `false` otherwise.
   */
  has(key) {
    return this._map.has(key);
  }
  /**
   * Get a list of the keys in the map.
   *
   * @returns - a list of keys.
   */
  keys() {
    const keyList = [];
    this._map.forEach((v, k) => {
      keyList.push(k);
    });
    return keyList;
  }
  /**
   * Get a list of the values in the map.
   *
   * @returns - a list of values.
   */
  values() {
    const valList = [];
    this._map.forEach((v, k) => {
      valList.push(v);
    });
    return valList;
  }
  /**
   * Remove a key from the map
   *
   * @param key - the key to remove.
   *
   * @returns the value of the given key,
   *   or undefined if that does not exist.
   *
   * #### Notes
   * This is a no-op if the value does not change.
   */
  delete(key) {
    const oldVal = this._map.get(key);
    const removed = this._map.delete(key);
    if (removed) {
      this._changed.emit({
        type: "remove",
        key,
        oldValue: oldVal,
        newValue: void 0
      });
    }
    return oldVal;
  }
  /**
   * Set the ObservableMap to an empty map.
   */
  clear() {
    const keyList = this.keys();
    for (let i = 0; i < keyList.length; i++) {
      this.delete(keyList[i]);
    }
  }
  /**
   * Dispose of the resources held by the map.
   */
  dispose() {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    import_signaling2.Signal.clearData(this);
    this._map.clear();
  }
};
var Private;
(function(Private2) {
  function itemCmp(first, second) {
    return first === second;
  }
  Private2.itemCmp = itemCmp;
})(Private || (Private = {}));

// node_modules/@jupyterlite/kernel/lib/kernels.js
var import_serialize = require("@jupyterlab/services/lib/kernel/serialize");
var import_messages = require("@jupyterlab/services/lib/kernel/messages");
var import_coreutils = require("@lumino/coreutils");
var import_mock_socket = require("mock-socket");

// node_modules/async-mutex/index.mjs
var E_TIMEOUT = new Error("timeout while waiting for mutex to become available");
var E_ALREADY_LOCKED = new Error("mutex already locked");
var E_CANCELED = new Error("request for lock canceled");
var __awaiter$2 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var Semaphore = class {
  constructor(_maxConcurrency, _cancelError = E_CANCELED) {
    this._maxConcurrency = _maxConcurrency;
    this._cancelError = _cancelError;
    this._queue = [];
    this._waiters = [];
    if (_maxConcurrency <= 0) {
      throw new Error("semaphore must be initialized to a positive value");
    }
    this._value = _maxConcurrency;
  }
  acquire() {
    const locked = this.isLocked();
    const ticketPromise = new Promise((resolve, reject) => this._queue.push({ resolve, reject }));
    if (!locked)
      this._dispatch();
    return ticketPromise;
  }
  runExclusive(callback) {
    return __awaiter$2(this, void 0, void 0, function* () {
      const [value, release] = yield this.acquire();
      try {
        return yield callback(value);
      } finally {
        release();
      }
    });
  }
  waitForUnlock() {
    return __awaiter$2(this, void 0, void 0, function* () {
      if (!this.isLocked()) {
        return Promise.resolve();
      }
      const waitPromise = new Promise((resolve) => this._waiters.push({ resolve }));
      return waitPromise;
    });
  }
  isLocked() {
    return this._value <= 0;
  }
  /** @deprecated Deprecated in 0.3.0, will be removed in 0.4.0. Use runExclusive instead. */
  release() {
    if (this._maxConcurrency > 1) {
      throw new Error("this method is unavailable on semaphores with concurrency > 1; use the scoped release returned by acquire instead");
    }
    if (this._currentReleaser) {
      const releaser = this._currentReleaser;
      this._currentReleaser = void 0;
      releaser();
    }
  }
  cancel() {
    this._queue.forEach((ticket) => ticket.reject(this._cancelError));
    this._queue = [];
  }
  _dispatch() {
    const nextTicket = this._queue.shift();
    if (!nextTicket)
      return;
    let released = false;
    this._currentReleaser = () => {
      if (released)
        return;
      released = true;
      this._value++;
      this._resolveWaiters();
      this._dispatch();
    };
    nextTicket.resolve([this._value--, this._currentReleaser]);
  }
  _resolveWaiters() {
    this._waiters.forEach((waiter) => waiter.resolve());
    this._waiters = [];
  }
};
var __awaiter$1 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var Mutex = class {
  constructor(cancelError) {
    this._semaphore = new Semaphore(1, cancelError);
  }
  acquire() {
    return __awaiter$1(this, void 0, void 0, function* () {
      const [, releaser] = yield this._semaphore.acquire();
      return releaser;
    });
  }
  runExclusive(callback) {
    return this._semaphore.runExclusive(() => callback());
  }
  isLocked() {
    return this._semaphore.isLocked();
  }
  waitForUnlock() {
    return this._semaphore.waitForUnlock();
  }
  /** @deprecated Deprecated in 0.3.0, will be removed in 0.4.0. Use runExclusive instead. */
  release() {
    this._semaphore.release();
  }
  cancel() {
    return this._semaphore.cancel();
  }
};

// node_modules/@jupyterlite/kernel/lib/kernels.js
var import_coreutils2 = require("@jupyterlab/coreutils");
var KERNEL_WEBSOCKET_PROTOCOL = import_messages.supportedKernelWebSocketProtocols.v1KernelWebsocketJupyterOrg;
var Kernels = class _Kernels {
  /**
   * Construct a new Kernels
   *
   * @param options The instantiation options
   */
  constructor(options) {
    this._kernels = new ObservableMap();
    this._clients = new ObservableMap();
    this._kernelClients = new ObservableMap();
    const { kernelspecs } = options;
    this._kernelspecs = kernelspecs;
  }
  /**
   * Start a new kernel.
   *
   * @param options The kernel start options.
   */
  async startNew(options) {
    const { id, name, location } = options;
    const factory = this._kernelspecs.factories.get(name);
    if (!factory) {
      return { id, name };
    }
    const mutex = new Mutex();
    const hook = (kernelId2, clientId, socket) => {
      var _a;
      const kernel2 = this._kernels.get(kernelId2);
      if (!kernel2) {
        throw Error(`No kernel ${kernelId2}`);
      }
      this._clients.set(clientId, socket);
      (_a = this._kernelClients.get(kernelId2)) === null || _a === void 0 ? void 0 : _a.add(clientId);
      const processMsg = async (msg) => {
        await mutex.runExclusive(async () => {
          await kernel2.ready;
          await kernel2.handleMessage(msg);
        });
      };
      socket.on("message", async (message) => {
        let msg;
        if (message instanceof ArrayBuffer) {
          message = new Uint8Array(message).buffer;
          msg = (0, import_serialize.deserialize)(message, KERNEL_WEBSOCKET_PROTOCOL);
        } else if (typeof message === "string") {
          const encoder = new TextEncoder();
          const encodedData = encoder.encode(message);
          msg = (0, import_serialize.deserialize)(encodedData.buffer, KERNEL_WEBSOCKET_PROTOCOL);
        } else {
          return;
        }
        if (msg.header.msg_type === "input_reply") {
          kernel2.handleMessage(msg);
        } else {
          void processMsg(msg);
        }
      });
      const removeClient = () => {
        var _a2;
        this._clients.delete(clientId);
        (_a2 = this._kernelClients.get(kernelId2)) === null || _a2 === void 0 ? void 0 : _a2.delete(clientId);
      };
      kernel2.disposed.connect(removeClient);
      socket.onclose = removeClient;
    };
    const kernelId = id !== null && id !== void 0 ? id : import_coreutils.UUID.uuid4();
    const kernelUrl = `${_Kernels.WS_BASE_URL}api/kernels/${kernelId}/channels`;
    const runningKernel = this._kernels.get(kernelId);
    if (runningKernel) {
      return {
        id: runningKernel.id,
        name: runningKernel.name
      };
    }
    const sendMessage = (msg) => {
      const clientId = msg.header.session;
      const socket = this._clients.get(clientId);
      if (!socket) {
        console.warn(`Trying to send message on removed socket for kernel ${kernelId}`);
        return;
      }
      const message = (0, import_serialize.serialize)(msg, KERNEL_WEBSOCKET_PROTOCOL);
      if (msg.channel === "iopub") {
        const clients = this._kernelClients.get(kernelId);
        clients === null || clients === void 0 ? void 0 : clients.forEach((id2) => {
          var _a;
          (_a = this._clients.get(id2)) === null || _a === void 0 ? void 0 : _a.send(message);
        });
        return;
      }
      socket.send(message);
    };
    const kernel = await factory({
      id: kernelId,
      sendMessage,
      name,
      location
    });
    this._kernels.set(kernelId, kernel);
    this._kernelClients.set(kernelId, /* @__PURE__ */ new Set());
    const wsServer = new import_mock_socket.Server(kernelUrl, {
      mock: false,
      selectProtocol: () => KERNEL_WEBSOCKET_PROTOCOL
    });
    wsServer.on("connection", (socket) => {
      var _a;
      const url = new URL(socket.url);
      const clientId = (_a = url.searchParams.get("session_id")) !== null && _a !== void 0 ? _a : "";
      hook(kernelId, clientId, socket);
    });
    wsServer.on("close", () => {
      this._clients.keys().forEach((clientId) => {
        var _a;
        const socket = this._clients.get(clientId);
        if ((socket === null || socket === void 0 ? void 0 : socket.readyState) === WebSocket.CLOSED) {
          this._clients.delete(clientId);
          (_a = this._kernelClients.get(kernelId)) === null || _a === void 0 ? void 0 : _a.delete(clientId);
        }
      });
    });
    kernel.disposed.connect(() => {
      wsServer.close();
      this._kernels.delete(kernelId);
      this._kernelClients.delete(kernelId);
    });
    return {
      id: kernel.id,
      name: kernel.name
    };
  }
  /**
   * Restart a kernel.
   *
   * @param kernelId The kernel id.
   */
  async restart(kernelId) {
    const kernel = this._kernels.get(kernelId);
    if (!kernel) {
      throw Error(`Kernel ${kernelId} does not exist`);
    }
    const { id, name, location } = kernel;
    kernel.dispose();
    return this.startNew({ id, name, location });
  }
  /**
   * List the running kernels.
   */
  async list() {
    return [...this._kernels.values()].map((kernel) => ({
      id: kernel.id,
      name: kernel.name
    }));
  }
  /**
   * Shut down a kernel.
   *
   * @param id The kernel id.
   */
  async shutdown(id) {
    var _a;
    (_a = this._kernels.delete(id)) === null || _a === void 0 ? void 0 : _a.dispose();
  }
  /**
   * Get a kernel by id
   */
  async get(id) {
    return this._kernels.get(id);
  }
};
(function(Kernels2) {
  Kernels2.WS_BASE_URL = import_coreutils2.PageConfig.getBaseUrl().replace(/^http/, "ws");
})(Kernels || (Kernels = {}));

// node_modules/@jupyterlite/kernel/lib/kernelspecs.js
var import_coreutils4 = require("@jupyterlab/coreutils");

// node_modules/@jupyterlite/kernel/lib/tokens.js
var import_coreutils3 = require("@lumino/coreutils");
var IKernels = new import_coreutils3.Token("@jupyterlite/kernel:IKernels");
var FALLBACK_KERNEL = "javascript";
var IKernelSpecs = new import_coreutils3.Token("@jupyterlite/kernel:IKernelSpecs");

// node_modules/@jupyterlite/kernel/lib/kernelspecs.js
var KernelSpecs = class {
  constructor() {
    this._specs = /* @__PURE__ */ new Map();
    this._factories = /* @__PURE__ */ new Map();
  }
  /**
   * Get the kernel specs.
   */
  get specs() {
    if (this._specs.size === 0) {
      return null;
    }
    return {
      default: this.defaultKernelName,
      kernelspecs: Object.fromEntries(this._specs)
    };
  }
  /**
   * Get the default kernel name.
   */
  get defaultKernelName() {
    let defaultKernelName = import_coreutils4.PageConfig.getOption("defaultKernelName");
    if (!defaultKernelName && this._specs.size) {
      const keys = Array.from(this._specs.keys());
      keys.sort();
      defaultKernelName = keys[0];
    }
    return defaultKernelName || FALLBACK_KERNEL;
  }
  /**
   * Get the kernel factories for the current kernels.
   */
  get factories() {
    return this._factories;
  }
  /**
   * Register a new kernel.
   *
   * @param options The options to register a new kernel.
   */
  register(options) {
    const { spec, create } = options;
    this._specs.set(spec.name, spec);
    this._factories.set(spec.name, create);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BaseKernel,
  FALLBACK_KERNEL,
  IKernelSpecs,
  IKernels,
  KernelSpecs,
  Kernels
});
//# sourceMappingURL=kernelspecs.js.map
