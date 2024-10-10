"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
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
    (function(global2, factory) {
      typeof exports2 === "object" && typeof module2 !== "undefined" ? factory(exports2) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self, factory(global2.Comlink = {}));
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
          expose2(obj, port1);
          return [port2, [port2]];
        },
        deserialize(port) {
          port.start();
          return wrap(port);
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
      function expose2(obj, ep = globalThis, allowedOrigins = ["*"]) {
        ep.addEventListener("message", function callback(ev) {
          if (!ev || !ev.data) {
            return;
          }
          if (!isAllowedOrigin(allowedOrigins, ev.origin)) {
            console.warn(`Invalid origin '${ev.origin}' for comlink proxy`);
            return;
          }
          const { id, type, path: path2 } = Object.assign({ path: [] }, ev.data);
          const argumentList = (ev.data.argumentList || []).map(fromWireValue);
          let returnValue;
          try {
            const parent = path2.slice(0, -1).reduce((obj2, prop) => obj2[prop], obj);
            const rawValue = path2.reduce((obj2, prop) => obj2[prop], obj);
            switch (type) {
              case "GET":
                {
                  returnValue = rawValue;
                }
                break;
              case "SET":
                {
                  parent[path2.slice(-1)[0]] = fromWireValue(ev.data.value);
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
                  returnValue = proxy(value);
                }
                break;
              case "ENDPOINT":
                {
                  const { port1, port2 } = new MessageChannel();
                  expose2(obj, port2);
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
      function wrap(ep, target) {
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
      function registerProxy(proxy2, ep) {
        const newCount = (proxyCounter.get(ep) || 0) + 1;
        proxyCounter.set(ep, newCount);
        if (proxyFinalizers) {
          proxyFinalizers.register(proxy2, ep, proxy2);
        }
      }
      function unregisterProxy(proxy2) {
        if (proxyFinalizers) {
          proxyFinalizers.unregister(proxy2);
        }
      }
      function createProxy(ep, path2 = [], target = function() {
      }) {
        let isProxyReleased = false;
        const proxy2 = new Proxy(target, {
          get(_target, prop) {
            throwIfProxyReleased(isProxyReleased);
            if (prop === releaseProxy) {
              return () => {
                unregisterProxy(proxy2);
                releaseEndpoint(ep);
                isProxyReleased = true;
              };
            }
            if (prop === "then") {
              if (path2.length === 0) {
                return { then: () => proxy2 };
              }
              const r = requestResponseMessage(ep, {
                type: "GET",
                path: path2.map((p) => p.toString())
              }).then(fromWireValue);
              return r.then.bind(r);
            }
            return createProxy(ep, [...path2, prop]);
          },
          set(_target, prop, rawValue) {
            throwIfProxyReleased(isProxyReleased);
            const [value, transferables] = toWireValue(rawValue);
            return requestResponseMessage(ep, {
              type: "SET",
              path: [...path2, prop].map((p) => p.toString()),
              value
            }, transferables).then(fromWireValue);
          },
          apply(_target, _thisArg, rawArgumentList) {
            throwIfProxyReleased(isProxyReleased);
            const last = path2[path2.length - 1];
            if (last === createEndpoint) {
              return requestResponseMessage(ep, {
                type: "ENDPOINT"
              }).then(fromWireValue);
            }
            if (last === "bind") {
              return createProxy(ep, path2.slice(0, -1));
            }
            const [argumentList, transferables] = processArguments(rawArgumentList);
            return requestResponseMessage(ep, {
              type: "APPLY",
              path: path2.map((p) => p.toString()),
              argumentList
            }, transferables).then(fromWireValue);
          },
          construct(_target, rawArgumentList) {
            throwIfProxyReleased(isProxyReleased);
            const [argumentList, transferables] = processArguments(rawArgumentList);
            return requestResponseMessage(ep, {
              type: "CONSTRUCT",
              path: path2.map((p) => p.toString()),
              argumentList
            }, transferables).then(fromWireValue);
          }
        });
        registerProxy(proxy2, ep);
        return proxy2;
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
      function proxy(obj) {
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
        for (const [name2, handler] of transferHandlers) {
          if (handler.canHandle(value)) {
            const [serializedValue, transferables] = handler.serialize(value);
            return [
              {
                type: "HANDLER",
                name: name2,
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
      exports3.expose = expose2;
      exports3.finalizer = finalizer;
      exports3.proxy = proxy;
      exports3.proxyMarker = proxyMarker;
      exports3.releaseProxy = releaseProxy;
      exports3.transfer = transfer;
      exports3.transferHandlers = transferHandlers;
      exports3.windowEndpoint = windowEndpoint;
      exports3.wrap = wrap;
    });
  }
});

// node_modules/@lumino/algorithm/dist/index.js
var require_dist = __commonJS({
  "node_modules/@lumino/algorithm/dist/index.js"(exports2, module2) {
    (function(global2, factory) {
      typeof exports2 === "object" && typeof module2 !== "undefined" ? factory(exports2) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self, factory(global2.lumino_algorithm = {}));
    })(exports2, function(exports3) {
      "use strict";
      exports3.ArrayExt = void 0;
      (function(ArrayExt) {
        function firstIndexOf(array, value, start = 0, stop = -1) {
          let n = array.length;
          if (n === 0) {
            return -1;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          let span;
          if (stop < start) {
            span = stop + 1 + (n - start);
          } else {
            span = stop - start + 1;
          }
          for (let i = 0; i < span; ++i) {
            let j = (start + i) % n;
            if (array[j] === value) {
              return j;
            }
          }
          return -1;
        }
        ArrayExt.firstIndexOf = firstIndexOf;
        function lastIndexOf(array, value, start = -1, stop = 0) {
          let n = array.length;
          if (n === 0) {
            return -1;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          let span;
          if (start < stop) {
            span = start + 1 + (n - stop);
          } else {
            span = start - stop + 1;
          }
          for (let i = 0; i < span; ++i) {
            let j = (start - i + n) % n;
            if (array[j] === value) {
              return j;
            }
          }
          return -1;
        }
        ArrayExt.lastIndexOf = lastIndexOf;
        function findFirstIndex(array, fn, start = 0, stop = -1) {
          let n = array.length;
          if (n === 0) {
            return -1;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          let span;
          if (stop < start) {
            span = stop + 1 + (n - start);
          } else {
            span = stop - start + 1;
          }
          for (let i = 0; i < span; ++i) {
            let j = (start + i) % n;
            if (fn(array[j], j)) {
              return j;
            }
          }
          return -1;
        }
        ArrayExt.findFirstIndex = findFirstIndex;
        function findLastIndex(array, fn, start = -1, stop = 0) {
          let n = array.length;
          if (n === 0) {
            return -1;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          let d;
          if (start < stop) {
            d = start + 1 + (n - stop);
          } else {
            d = start - stop + 1;
          }
          for (let i = 0; i < d; ++i) {
            let j = (start - i + n) % n;
            if (fn(array[j], j)) {
              return j;
            }
          }
          return -1;
        }
        ArrayExt.findLastIndex = findLastIndex;
        function findFirstValue(array, fn, start = 0, stop = -1) {
          let index = findFirstIndex(array, fn, start, stop);
          return index !== -1 ? array[index] : void 0;
        }
        ArrayExt.findFirstValue = findFirstValue;
        function findLastValue(array, fn, start = -1, stop = 0) {
          let index = findLastIndex(array, fn, start, stop);
          return index !== -1 ? array[index] : void 0;
        }
        ArrayExt.findLastValue = findLastValue;
        function lowerBound(array, value, fn, start = 0, stop = -1) {
          let n = array.length;
          if (n === 0) {
            return 0;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          let begin = start;
          let span = stop - start + 1;
          while (span > 0) {
            let half = span >> 1;
            let middle = begin + half;
            if (fn(array[middle], value) < 0) {
              begin = middle + 1;
              span -= half + 1;
            } else {
              span = half;
            }
          }
          return begin;
        }
        ArrayExt.lowerBound = lowerBound;
        function upperBound(array, value, fn, start = 0, stop = -1) {
          let n = array.length;
          if (n === 0) {
            return 0;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          let begin = start;
          let span = stop - start + 1;
          while (span > 0) {
            let half = span >> 1;
            let middle = begin + half;
            if (fn(array[middle], value) > 0) {
              span = half;
            } else {
              begin = middle + 1;
              span -= half + 1;
            }
          }
          return begin;
        }
        ArrayExt.upperBound = upperBound;
        function shallowEqual(a, b, fn) {
          if (a === b) {
            return true;
          }
          if (a.length !== b.length) {
            return false;
          }
          for (let i = 0, n = a.length; i < n; ++i) {
            if (fn ? !fn(a[i], b[i]) : a[i] !== b[i]) {
              return false;
            }
          }
          return true;
        }
        ArrayExt.shallowEqual = shallowEqual;
        function slice(array, options = {}) {
          let { start, stop, step } = options;
          if (step === void 0) {
            step = 1;
          }
          if (step === 0) {
            throw new Error("Slice `step` cannot be zero.");
          }
          let n = array.length;
          if (start === void 0) {
            start = step < 0 ? n - 1 : 0;
          } else if (start < 0) {
            start = Math.max(start + n, step < 0 ? -1 : 0);
          } else if (start >= n) {
            start = step < 0 ? n - 1 : n;
          }
          if (stop === void 0) {
            stop = step < 0 ? -1 : n;
          } else if (stop < 0) {
            stop = Math.max(stop + n, step < 0 ? -1 : 0);
          } else if (stop >= n) {
            stop = step < 0 ? n - 1 : n;
          }
          let length;
          if (step < 0 && stop >= start || step > 0 && start >= stop) {
            length = 0;
          } else if (step < 0) {
            length = Math.floor((stop - start + 1) / step + 1);
          } else {
            length = Math.floor((stop - start - 1) / step + 1);
          }
          let result = [];
          for (let i = 0; i < length; ++i) {
            result[i] = array[start + i * step];
          }
          return result;
        }
        ArrayExt.slice = slice;
        function move(array, fromIndex, toIndex) {
          let n = array.length;
          if (n <= 1) {
            return;
          }
          if (fromIndex < 0) {
            fromIndex = Math.max(0, fromIndex + n);
          } else {
            fromIndex = Math.min(fromIndex, n - 1);
          }
          if (toIndex < 0) {
            toIndex = Math.max(0, toIndex + n);
          } else {
            toIndex = Math.min(toIndex, n - 1);
          }
          if (fromIndex === toIndex) {
            return;
          }
          let value = array[fromIndex];
          let d = fromIndex < toIndex ? 1 : -1;
          for (let i = fromIndex; i !== toIndex; i += d) {
            array[i] = array[i + d];
          }
          array[toIndex] = value;
        }
        ArrayExt.move = move;
        function reverse(array, start = 0, stop = -1) {
          let n = array.length;
          if (n <= 1) {
            return;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          while (start < stop) {
            let a = array[start];
            let b = array[stop];
            array[start++] = b;
            array[stop--] = a;
          }
        }
        ArrayExt.reverse = reverse;
        function rotate(array, delta, start = 0, stop = -1) {
          let n = array.length;
          if (n <= 1) {
            return;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          if (start >= stop) {
            return;
          }
          let length = stop - start + 1;
          if (delta > 0) {
            delta = delta % length;
          } else if (delta < 0) {
            delta = (delta % length + length) % length;
          }
          if (delta === 0) {
            return;
          }
          let pivot = start + delta;
          reverse(array, start, pivot - 1);
          reverse(array, pivot, stop);
          reverse(array, start, stop);
        }
        ArrayExt.rotate = rotate;
        function fill(array, value, start = 0, stop = -1) {
          let n = array.length;
          if (n === 0) {
            return;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          let span;
          if (stop < start) {
            span = stop + 1 + (n - start);
          } else {
            span = stop - start + 1;
          }
          for (let i = 0; i < span; ++i) {
            array[(start + i) % n] = value;
          }
        }
        ArrayExt.fill = fill;
        function insert(array, index, value) {
          let n = array.length;
          if (index < 0) {
            index = Math.max(0, index + n);
          } else {
            index = Math.min(index, n);
          }
          for (let i = n; i > index; --i) {
            array[i] = array[i - 1];
          }
          array[index] = value;
        }
        ArrayExt.insert = insert;
        function removeAt(array, index) {
          let n = array.length;
          if (index < 0) {
            index += n;
          }
          if (index < 0 || index >= n) {
            return void 0;
          }
          let value = array[index];
          for (let i = index + 1; i < n; ++i) {
            array[i - 1] = array[i];
          }
          array.length = n - 1;
          return value;
        }
        ArrayExt.removeAt = removeAt;
        function removeFirstOf(array, value, start = 0, stop = -1) {
          let index = firstIndexOf(array, value, start, stop);
          if (index !== -1) {
            removeAt(array, index);
          }
          return index;
        }
        ArrayExt.removeFirstOf = removeFirstOf;
        function removeLastOf(array, value, start = -1, stop = 0) {
          let index = lastIndexOf(array, value, start, stop);
          if (index !== -1) {
            removeAt(array, index);
          }
          return index;
        }
        ArrayExt.removeLastOf = removeLastOf;
        function removeAllOf(array, value, start = 0, stop = -1) {
          let n = array.length;
          if (n === 0) {
            return 0;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          let count = 0;
          for (let i = 0; i < n; ++i) {
            if (start <= stop && i >= start && i <= stop && array[i] === value) {
              count++;
            } else if (stop < start && (i <= stop || i >= start) && array[i] === value) {
              count++;
            } else if (count > 0) {
              array[i - count] = array[i];
            }
          }
          if (count > 0) {
            array.length = n - count;
          }
          return count;
        }
        ArrayExt.removeAllOf = removeAllOf;
        function removeFirstWhere(array, fn, start = 0, stop = -1) {
          let value;
          let index = findFirstIndex(array, fn, start, stop);
          if (index !== -1) {
            value = removeAt(array, index);
          }
          return { index, value };
        }
        ArrayExt.removeFirstWhere = removeFirstWhere;
        function removeLastWhere(array, fn, start = -1, stop = 0) {
          let value;
          let index = findLastIndex(array, fn, start, stop);
          if (index !== -1) {
            value = removeAt(array, index);
          }
          return { index, value };
        }
        ArrayExt.removeLastWhere = removeLastWhere;
        function removeAllWhere(array, fn, start = 0, stop = -1) {
          let n = array.length;
          if (n === 0) {
            return 0;
          }
          if (start < 0) {
            start = Math.max(0, start + n);
          } else {
            start = Math.min(start, n - 1);
          }
          if (stop < 0) {
            stop = Math.max(0, stop + n);
          } else {
            stop = Math.min(stop, n - 1);
          }
          let count = 0;
          for (let i = 0; i < n; ++i) {
            if (start <= stop && i >= start && i <= stop && fn(array[i], i)) {
              count++;
            } else if (stop < start && (i <= stop || i >= start) && fn(array[i], i)) {
              count++;
            } else if (count > 0) {
              array[i - count] = array[i];
            }
          }
          if (count > 0) {
            array.length = n - count;
          }
          return count;
        }
        ArrayExt.removeAllWhere = removeAllWhere;
      })(exports3.ArrayExt || (exports3.ArrayExt = {}));
      function* chain(...objects) {
        for (const object of objects) {
          yield* object;
        }
      }
      function* empty() {
        return;
      }
      function* enumerate(object, start = 0) {
        for (const value of object) {
          yield [start++, value];
        }
      }
      function* filter(object, fn) {
        let index = 0;
        for (const value of object) {
          if (fn(value, index++)) {
            yield value;
          }
        }
      }
      function find(object, fn) {
        let index = 0;
        for (const value of object) {
          if (fn(value, index++)) {
            return value;
          }
        }
        return void 0;
      }
      function findIndex(object, fn) {
        let index = 0;
        for (const value of object) {
          if (fn(value, index++)) {
            return index - 1;
          }
        }
        return -1;
      }
      function min(object, fn) {
        let result = void 0;
        for (const value of object) {
          if (result === void 0) {
            result = value;
            continue;
          }
          if (fn(value, result) < 0) {
            result = value;
          }
        }
        return result;
      }
      function max(object, fn) {
        let result = void 0;
        for (const value of object) {
          if (result === void 0) {
            result = value;
            continue;
          }
          if (fn(value, result) > 0) {
            result = value;
          }
        }
        return result;
      }
      function minmax(object, fn) {
        let empty2 = true;
        let vmin;
        let vmax;
        for (const value of object) {
          if (empty2) {
            vmin = value;
            vmax = value;
            empty2 = false;
          } else if (fn(value, vmin) < 0) {
            vmin = value;
          } else if (fn(value, vmax) > 0) {
            vmax = value;
          }
        }
        return empty2 ? void 0 : [vmin, vmax];
      }
      function toArray(object) {
        return Array.from(object);
      }
      function toObject(object) {
        const result = {};
        for (const [key, value] of object) {
          result[key] = value;
        }
        return result;
      }
      function each(object, fn) {
        let index = 0;
        for (const value of object) {
          if (false === fn(value, index++)) {
            return;
          }
        }
      }
      function every(object, fn) {
        let index = 0;
        for (const value of object) {
          if (false === fn(value, index++)) {
            return false;
          }
        }
        return true;
      }
      function some(object, fn) {
        let index = 0;
        for (const value of object) {
          if (fn(value, index++)) {
            return true;
          }
        }
        return false;
      }
      function* map(object, fn) {
        let index = 0;
        for (const value of object) {
          yield fn(value, index++);
        }
      }
      function* range(start, stop, step) {
        if (stop === void 0) {
          stop = start;
          start = 0;
          step = 1;
        } else if (step === void 0) {
          step = 1;
        }
        const length = Private2.rangeLength(start, stop, step);
        for (let index = 0; index < length; index++) {
          yield start + step * index;
        }
      }
      var Private2;
      (function(Private3) {
        function rangeLength(start, stop, step) {
          if (step === 0) {
            return Infinity;
          }
          if (start > stop && step > 0) {
            return 0;
          }
          if (start < stop && step < 0) {
            return 0;
          }
          return Math.ceil((stop - start) / step);
        }
        Private3.rangeLength = rangeLength;
      })(Private2 || (Private2 = {}));
      function reduce(object, fn, initial) {
        const it = object[Symbol.iterator]();
        let index = 0;
        let first = it.next();
        if (first.done && initial === void 0) {
          throw new TypeError("Reduce of empty iterable with no initial value.");
        }
        if (first.done) {
          return initial;
        }
        let second = it.next();
        if (second.done && initial === void 0) {
          return first.value;
        }
        if (second.done) {
          return fn(initial, first.value, index++);
        }
        let accumulator;
        if (initial === void 0) {
          accumulator = fn(first.value, second.value, index++);
        } else {
          accumulator = fn(fn(initial, first.value, index++), second.value, index++);
        }
        let next;
        while (!(next = it.next()).done) {
          accumulator = fn(accumulator, next.value, index++);
        }
        return accumulator;
      }
      function* repeat(value, count) {
        while (0 < count--) {
          yield value;
        }
      }
      function* once(value) {
        yield value;
      }
      function* retro(object) {
        if (typeof object.retro === "function") {
          yield* object.retro();
        } else {
          for (let index = object.length - 1; index > -1; index--) {
            yield object[index];
          }
        }
      }
      function topologicSort(edges) {
        let sorted = [];
        let visited = /* @__PURE__ */ new Set();
        let graph = /* @__PURE__ */ new Map();
        for (const edge of edges) {
          addEdge(edge);
        }
        for (const [k] of graph) {
          visit(k);
        }
        return sorted;
        function addEdge(edge) {
          let [fromNode, toNode] = edge;
          let children = graph.get(toNode);
          if (children) {
            children.push(fromNode);
          } else {
            graph.set(toNode, [fromNode]);
          }
        }
        function visit(node) {
          if (visited.has(node)) {
            return;
          }
          visited.add(node);
          let children = graph.get(node);
          if (children) {
            for (const child of children) {
              visit(child);
            }
          }
          sorted.push(node);
        }
      }
      function* stride(object, step) {
        let count = 0;
        for (const value of object) {
          if (0 === count++ % step) {
            yield value;
          }
        }
      }
      exports3.StringExt = void 0;
      (function(StringExt) {
        function findIndices(source, query, start = 0) {
          let indices = new Array(query.length);
          for (let i = 0, j = start, n = query.length; i < n; ++i, ++j) {
            j = source.indexOf(query[i], j);
            if (j === -1) {
              return null;
            }
            indices[i] = j;
          }
          return indices;
        }
        StringExt.findIndices = findIndices;
        function matchSumOfSquares(source, query, start = 0) {
          let indices = findIndices(source, query, start);
          if (!indices) {
            return null;
          }
          let score = 0;
          for (let i = 0, n = indices.length; i < n; ++i) {
            let j = indices[i] - start;
            score += j * j;
          }
          return { score, indices };
        }
        StringExt.matchSumOfSquares = matchSumOfSquares;
        function matchSumOfDeltas(source, query, start = 0) {
          let indices = findIndices(source, query, start);
          if (!indices) {
            return null;
          }
          let score = 0;
          let last = start - 1;
          for (let i = 0, n = indices.length; i < n; ++i) {
            let j = indices[i];
            score += j - last - 1;
            last = j;
          }
          return { score, indices };
        }
        StringExt.matchSumOfDeltas = matchSumOfDeltas;
        function highlight(source, indices, fn) {
          let result = [];
          let k = 0;
          let last = 0;
          let n = indices.length;
          while (k < n) {
            let i = indices[k];
            let j = indices[k];
            while (++k < n && indices[k] === j + 1) {
              j++;
            }
            if (last < i) {
              result.push(source.slice(last, i));
            }
            if (i < j + 1) {
              result.push(fn(source.slice(i, j + 1)));
            }
            last = j + 1;
          }
          if (last < source.length) {
            result.push(source.slice(last));
          }
          return result;
        }
        StringExt.highlight = highlight;
        function cmp(a, b) {
          return a < b ? -1 : a > b ? 1 : 0;
        }
        StringExt.cmp = cmp;
      })(exports3.StringExt || (exports3.StringExt = {}));
      function* take(object, count) {
        if (count < 1) {
          return;
        }
        const it = object[Symbol.iterator]();
        let item;
        while (0 < count-- && !(item = it.next()).done) {
          yield item.value;
        }
      }
      function* zip(...objects) {
        const iters = objects.map((obj) => obj[Symbol.iterator]());
        let tuple = iters.map((it) => it.next());
        for (; every(tuple, (item) => !item.done); tuple = iters.map((it) => it.next())) {
          yield tuple.map((item) => item.value);
        }
      }
      exports3.chain = chain;
      exports3.each = each;
      exports3.empty = empty;
      exports3.enumerate = enumerate;
      exports3.every = every;
      exports3.filter = filter;
      exports3.find = find;
      exports3.findIndex = findIndex;
      exports3.map = map;
      exports3.max = max;
      exports3.min = min;
      exports3.minmax = minmax;
      exports3.once = once;
      exports3.range = range;
      exports3.reduce = reduce;
      exports3.repeat = repeat;
      exports3.retro = retro;
      exports3.some = some;
      exports3.stride = stride;
      exports3.take = take;
      exports3.toArray = toArray;
      exports3.toObject = toObject;
      exports3.topologicSort = topologicSort;
      exports3.zip = zip;
    });
  }
});

// node_modules/@lumino/coreutils/dist/index.node.js
var require_index_node = __commonJS({
  "node_modules/@lumino/coreutils/dist/index.node.js"(exports2) {
    "use strict";
    var algorithm = require_dist();
    exports2.JSONExt = void 0;
    (function(JSONExt) {
      JSONExt.emptyObject = Object.freeze({});
      JSONExt.emptyArray = Object.freeze([]);
      function isPrimitive(value) {
        return value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string";
      }
      JSONExt.isPrimitive = isPrimitive;
      function isArray(value) {
        return Array.isArray(value);
      }
      JSONExt.isArray = isArray;
      function isObject(value) {
        return !isPrimitive(value) && !isArray(value);
      }
      JSONExt.isObject = isObject;
      function deepEqual(first, second) {
        if (first === second) {
          return true;
        }
        if (isPrimitive(first) || isPrimitive(second)) {
          return false;
        }
        let a1 = isArray(first);
        let a2 = isArray(second);
        if (a1 !== a2) {
          return false;
        }
        if (a1 && a2) {
          return deepArrayEqual(first, second);
        }
        return deepObjectEqual(first, second);
      }
      JSONExt.deepEqual = deepEqual;
      function deepCopy(value) {
        if (isPrimitive(value)) {
          return value;
        }
        if (isArray(value)) {
          return deepArrayCopy(value);
        }
        return deepObjectCopy(value);
      }
      JSONExt.deepCopy = deepCopy;
      function deepArrayEqual(first, second) {
        if (first === second) {
          return true;
        }
        if (first.length !== second.length) {
          return false;
        }
        for (let i = 0, n = first.length; i < n; ++i) {
          if (!deepEqual(first[i], second[i])) {
            return false;
          }
        }
        return true;
      }
      function deepObjectEqual(first, second) {
        if (first === second) {
          return true;
        }
        for (let key in first) {
          if (first[key] !== void 0 && !(key in second)) {
            return false;
          }
        }
        for (let key in second) {
          if (second[key] !== void 0 && !(key in first)) {
            return false;
          }
        }
        for (let key in first) {
          let firstValue = first[key];
          let secondValue = second[key];
          if (firstValue === void 0 && secondValue === void 0) {
            continue;
          }
          if (firstValue === void 0 || secondValue === void 0) {
            return false;
          }
          if (!deepEqual(firstValue, secondValue)) {
            return false;
          }
        }
        return true;
      }
      function deepArrayCopy(value) {
        let result = new Array(value.length);
        for (let i = 0, n = value.length; i < n; ++i) {
          result[i] = deepCopy(value[i]);
        }
        return result;
      }
      function deepObjectCopy(value) {
        let result = {};
        for (let key in value) {
          let subvalue = value[key];
          if (subvalue === void 0) {
            continue;
          }
          result[key] = deepCopy(subvalue);
        }
        return result;
      }
    })(exports2.JSONExt || (exports2.JSONExt = {}));
    var MimeData = class {
      constructor() {
        this._types = [];
        this._values = [];
      }
      /**
       * Get an array of the MIME types contained within the dataset.
       *
       * @returns A new array of the MIME types, in order of insertion.
       */
      types() {
        return this._types.slice();
      }
      /**
       * Test whether the dataset has an entry for the given type.
       *
       * @param mime - The MIME type of interest.
       *
       * @returns `true` if the dataset contains a value for the given
       *   MIME type, `false` otherwise.
       */
      hasData(mime2) {
        return this._types.indexOf(mime2) !== -1;
      }
      /**
       * Get the data value for the given MIME type.
       *
       * @param mime - The MIME type of interest.
       *
       * @returns The value for the given MIME type, or `undefined` if
       *   the dataset does not contain a value for the type.
       */
      getData(mime2) {
        let i = this._types.indexOf(mime2);
        return i !== -1 ? this._values[i] : void 0;
      }
      /**
       * Set the data value for the given MIME type.
       *
       * @param mime - The MIME type of interest.
       *
       * @param data - The data value for the given MIME type.
       *
       * #### Notes
       * This will overwrite any previous entry for the MIME type.
       */
      setData(mime2, data) {
        this.clearData(mime2);
        this._types.push(mime2);
        this._values.push(data);
      }
      /**
       * Remove the data entry for the given MIME type.
       *
       * @param mime - The MIME type of interest.
       *
       * #### Notes
       * This is a no-op if there is no entry for the given MIME type.
       */
      clearData(mime2) {
        let i = this._types.indexOf(mime2);
        if (i !== -1) {
          this._types.splice(i, 1);
          this._values.splice(i, 1);
        }
      }
      /**
       * Remove all data entries from the dataset.
       */
      clear() {
        this._types.length = 0;
        this._values.length = 0;
      }
    };
    var PluginRegistry = class {
      constructor(options = {}) {
        this._application = null;
        this._validatePlugin = () => true;
        this._plugins = /* @__PURE__ */ new Map();
        this._services = /* @__PURE__ */ new Map();
        if (options.validatePlugin) {
          console.info("Plugins may be rejected by the custom validation plugin method.");
          this._validatePlugin = options.validatePlugin;
        }
      }
      /**
       * The application object.
       *
       * It will be provided as first argument to the
       * plugins activation and deactivation functions.
       *
       * It can only be set once.
       *
       * By default, it is `null`.
       */
      get application() {
        return this._application;
      }
      set application(v) {
        if (this._application !== null) {
          throw Error("PluginRegistry.application is already set. It cannot be overridden.");
        }
        this._application = v;
      }
      /**
       * The list of all the deferred plugins.
       */
      get deferredPlugins() {
        return Array.from(this._plugins).filter(([id, plugin]) => plugin.autoStart === "defer").map(([id, plugin]) => id);
      }
      /**
       * Get a plugin description.
       *
       * @param id - The ID of the plugin of interest.
       *
       * @returns The plugin description.
       */
      getPluginDescription(id) {
        var _a, _b;
        return (_b = (_a = this._plugins.get(id)) === null || _a === void 0 ? void 0 : _a.description) !== null && _b !== void 0 ? _b : "";
      }
      /**
       * Test whether a plugin is registered with the application.
       *
       * @param id - The ID of the plugin of interest.
       *
       * @returns `true` if the plugin is registered, `false` otherwise.
       */
      hasPlugin(id) {
        return this._plugins.has(id);
      }
      /**
       * Test whether a plugin is activated with the application.
       *
       * @param id - The ID of the plugin of interest.
       *
       * @returns `true` if the plugin is activated, `false` otherwise.
       */
      isPluginActivated(id) {
        var _a, _b;
        return (_b = (_a = this._plugins.get(id)) === null || _a === void 0 ? void 0 : _a.activated) !== null && _b !== void 0 ? _b : false;
      }
      /**
       * List the IDs of the plugins registered with the application.
       *
       * @returns A new array of the registered plugin IDs.
       */
      listPlugins() {
        return Array.from(this._plugins.keys());
      }
      /**
       * Register a plugin with the application.
       *
       * @param plugin - The plugin to register.
       *
       * #### Notes
       * An error will be thrown if a plugin with the same ID is already
       * registered, or if the plugin has a circular dependency.
       *
       * If the plugin provides a service which has already been provided
       * by another plugin, the new service will override the old service.
       */
      registerPlugin(plugin) {
        if (this._plugins.has(plugin.id)) {
          throw new TypeError(`Plugin '${plugin.id}' is already registered.`);
        }
        if (!this._validatePlugin(plugin)) {
          throw new Error(`Plugin '${plugin.id}' is not valid.`);
        }
        const data = Private2.createPluginData(plugin);
        Private2.ensureNoCycle(data, this._plugins, this._services);
        if (data.provides) {
          this._services.set(data.provides, data.id);
        }
        this._plugins.set(data.id, data);
      }
      /**
       * Register multiple plugins with the application.
       *
       * @param plugins - The plugins to register.
       *
       * #### Notes
       * This calls `registerPlugin()` for each of the given plugins.
       */
      registerPlugins(plugins) {
        for (const plugin of plugins) {
          this.registerPlugin(plugin);
        }
      }
      /**
       * Deregister a plugin with the application.
       *
       * @param id - The ID of the plugin of interest.
       *
       * @param force - Whether to deregister the plugin even if it is active.
       */
      deregisterPlugin(id, force) {
        const plugin = this._plugins.get(id);
        if (!plugin) {
          return;
        }
        if (plugin.activated && !force) {
          throw new Error(`Plugin '${id}' is still active.`);
        }
        this._plugins.delete(id);
      }
      /**
       * Activate the plugin with the given ID.
       *
       * @param id - The ID of the plugin of interest.
       *
       * @returns A promise which resolves when the plugin is activated
       *   or rejects with an error if it cannot be activated.
       */
      async activatePlugin(id) {
        const plugin = this._plugins.get(id);
        if (!plugin) {
          throw new ReferenceError(`Plugin '${id}' is not registered.`);
        }
        if (plugin.activated) {
          return;
        }
        if (plugin.promise) {
          return plugin.promise;
        }
        const required = plugin.requires.map((t) => this.resolveRequiredService(t));
        const optional = plugin.optional.map((t) => this.resolveOptionalService(t));
        plugin.promise = Promise.all([...required, ...optional]).then((services) => plugin.activate.apply(void 0, [this.application, ...services])).then((service) => {
          plugin.service = service;
          plugin.activated = true;
          plugin.promise = null;
        }).catch((error) => {
          plugin.promise = null;
          throw error;
        });
        return plugin.promise;
      }
      /**
       * Activate all the deferred plugins.
       *
       * @returns A promise which will resolve when each plugin is activated
       * or rejects with an error if one cannot be activated.
       */
      async activatePlugins(kind, options = {}) {
        switch (kind) {
          case "defer": {
            const promises = this.deferredPlugins.filter((pluginId) => this._plugins.get(pluginId).autoStart).map((pluginId) => {
              return this.activatePlugin(pluginId);
            });
            await Promise.all(promises);
            break;
          }
          case "startUp": {
            const startups = Private2.collectStartupPlugins(this._plugins, options);
            const promises = startups.map(async (id) => {
              try {
                return await this.activatePlugin(id);
              } catch (error) {
                console.error(`Plugin '${id}' failed to activate.`, error);
              }
            });
            await Promise.all(promises);
            break;
          }
        }
      }
      /**
       * Deactivate the plugin and its downstream dependents if and only if the
       * plugin and its dependents all support `deactivate`.
       *
       * @param id - The ID of the plugin of interest.
       *
       * @returns A list of IDs of downstream plugins deactivated with this one.
       */
      async deactivatePlugin(id) {
        const plugin = this._plugins.get(id);
        if (!plugin) {
          throw new ReferenceError(`Plugin '${id}' is not registered.`);
        }
        if (!plugin.activated) {
          return [];
        }
        if (!plugin.deactivate) {
          throw new TypeError(`Plugin '${id}'#deactivate() method missing`);
        }
        const manifest = Private2.findDependents(id, this._plugins, this._services);
        const downstream = manifest.map((id2) => this._plugins.get(id2));
        for (const plugin2 of downstream) {
          if (!plugin2.deactivate) {
            throw new TypeError(`Plugin ${plugin2.id}#deactivate() method missing (depends on ${id})`);
          }
        }
        for (const plugin2 of downstream) {
          const services = [...plugin2.requires, ...plugin2.optional].map((service) => {
            const id2 = this._services.get(service);
            return id2 ? this._plugins.get(id2).service : null;
          });
          await plugin2.deactivate(this.application, ...services);
          plugin2.service = null;
          plugin2.activated = false;
        }
        manifest.pop();
        return manifest;
      }
      /**
       * Resolve a required service of a given type.
       *
       * @param token - The token for the service type of interest.
       *
       * @returns A promise which resolves to an instance of the requested
       *   service, or rejects with an error if it cannot be resolved.
       *
       * #### Notes
       * Services are singletons. The same instance will be returned each
       * time a given service token is resolved.
       *
       * If the plugin which provides the service has not been activated,
       * resolving the service will automatically activate the plugin.
       *
       * User code will not typically call this method directly. Instead,
       * the required services for the user's plugins will be resolved
       * automatically when the plugin is activated.
       */
      async resolveRequiredService(token) {
        const id = this._services.get(token);
        if (!id) {
          throw new TypeError(`No provider for: ${token.name}.`);
        }
        const plugin = this._plugins.get(id);
        if (!plugin.activated) {
          await this.activatePlugin(id);
        }
        return plugin.service;
      }
      /**
       * Resolve an optional service of a given type.
       *
       * @param token - The token for the service type of interest.
       *
       * @returns A promise which resolves to an instance of the requested
       *   service, or `null` if it cannot be resolved.
       *
       * #### Notes
       * Services are singletons. The same instance will be returned each
       * time a given service token is resolved.
       *
       * If the plugin which provides the service has not been activated,
       * resolving the service will automatically activate the plugin.
       *
       * User code will not typically call this method directly. Instead,
       * the optional services for the user's plugins will be resolved
       * automatically when the plugin is activated.
       */
      async resolveOptionalService(token) {
        const id = this._services.get(token);
        if (!id) {
          return null;
        }
        const plugin = this._plugins.get(id);
        if (!plugin.activated) {
          try {
            await this.activatePlugin(id);
          } catch (reason) {
            console.error(reason);
            return null;
          }
        }
        return plugin.service;
      }
    };
    var Private2;
    (function(Private3) {
      class PluginData {
        constructor(plugin) {
          var _a, _b, _c, _d;
          this._activated = false;
          this._promise = null;
          this._service = null;
          this.id = plugin.id;
          this.description = (_a = plugin.description) !== null && _a !== void 0 ? _a : "";
          this.activate = plugin.activate;
          this.deactivate = (_b = plugin.deactivate) !== null && _b !== void 0 ? _b : null;
          this.provides = (_c = plugin.provides) !== null && _c !== void 0 ? _c : null;
          this.autoStart = (_d = plugin.autoStart) !== null && _d !== void 0 ? _d : false;
          this.requires = plugin.requires ? plugin.requires.slice() : [];
          this.optional = plugin.optional ? plugin.optional.slice() : [];
        }
        /**
         * Whether the plugin has been activated.
         */
        get activated() {
          return this._activated;
        }
        set activated(a) {
          this._activated = a;
        }
        /**
         * The resolved service for the plugin, or `null`.
         */
        get service() {
          return this._service;
        }
        set service(s) {
          this._service = s;
        }
        /**
         * The pending resolver promise, or `null`.
         */
        get promise() {
          return this._promise;
        }
        set promise(p) {
          this._promise = p;
        }
      }
      function createPluginData(plugin) {
        return new PluginData(plugin);
      }
      Private3.createPluginData = createPluginData;
      function ensureNoCycle(plugin, plugins, services) {
        const dependencies = [...plugin.requires, ...plugin.optional];
        const visit = (token) => {
          if (token === plugin.provides) {
            return true;
          }
          const id = services.get(token);
          if (!id) {
            return false;
          }
          const visited = plugins.get(id);
          const dependencies2 = [...visited.requires, ...visited.optional];
          if (dependencies2.length === 0) {
            return false;
          }
          trace.push(id);
          if (dependencies2.some(visit)) {
            return true;
          }
          trace.pop();
          return false;
        };
        if (!plugin.provides || dependencies.length === 0) {
          return;
        }
        const trace = [plugin.id];
        if (dependencies.some(visit)) {
          throw new ReferenceError(`Cycle detected: ${trace.join(" -> ")}.`);
        }
      }
      Private3.ensureNoCycle = ensureNoCycle;
      function findDependents(id, plugins, services) {
        const edges = new Array();
        const add = (id2) => {
          const plugin = plugins.get(id2);
          const dependencies = [...plugin.requires, ...plugin.optional];
          edges.push(...dependencies.reduce((acc, dep) => {
            const service = services.get(dep);
            if (service) {
              acc.push([id2, service]);
            }
            return acc;
          }, []));
        };
        for (const id2 of plugins.keys()) {
          add(id2);
        }
        const newEdges = edges.filter((edge) => edge[1] === id);
        let oldSize = 0;
        while (newEdges.length > oldSize) {
          const previousSize = newEdges.length;
          const packagesOfInterest = new Set(newEdges.map((edge) => edge[0]));
          for (const poi of packagesOfInterest) {
            edges.filter((edge) => edge[1] === poi).forEach((edge) => {
              if (!newEdges.includes(edge)) {
                newEdges.push(edge);
              }
            });
          }
          oldSize = previousSize;
        }
        const sorted = algorithm.topologicSort(newEdges);
        const index = sorted.findIndex((candidate) => candidate === id);
        if (index === -1) {
          return [id];
        }
        return sorted.slice(0, index + 1);
      }
      Private3.findDependents = findDependents;
      function collectStartupPlugins(plugins, options) {
        const collection = /* @__PURE__ */ new Set();
        for (const id of plugins.keys()) {
          if (plugins.get(id).autoStart === true) {
            collection.add(id);
          }
        }
        if (options.startPlugins) {
          for (const id of options.startPlugins) {
            collection.add(id);
          }
        }
        if (options.ignorePlugins) {
          for (const id of options.ignorePlugins) {
            collection.delete(id);
          }
        }
        return Array.from(collection);
      }
      Private3.collectStartupPlugins = collectStartupPlugins;
    })(Private2 || (Private2 = {}));
    var PromiseDelegate2 = class {
      /**
       * Construct a new promise delegate.
       */
      constructor() {
        this.promise = new Promise((resolve, reject) => {
          this._resolve = resolve;
          this._reject = reject;
        });
      }
      /**
       * Resolve the wrapped promise with the given value.
       *
       * @param value - The value to use for resolving the promise.
       */
      resolve(value) {
        let resolve = this._resolve;
        resolve(value);
      }
      /**
       * Reject the wrapped promise with the given value.
       *
       * @reason - The reason for rejecting the promise.
       */
      reject(reason) {
        let reject = this._reject;
        reject(reason);
      }
    };
    var Token2 = class {
      /**
       * Construct a new token.
       *
       * @param name - A human readable name for the token.
       * @param description - Token purpose description for documentation.
       */
      constructor(name2, description) {
        this.name = name2;
        this.description = description !== null && description !== void 0 ? description : "";
        this._tokenStructuralPropertyT = null;
      }
    };
    function fallbackRandomValues(buffer) {
      let value = 0;
      for (let i = 0, n = buffer.length; i < n; ++i) {
        if (i % 4 === 0) {
          value = Math.random() * 4294967295 >>> 0;
        }
        buffer[i] = value & 255;
        value >>>= 8;
      }
    }
    exports2.Random = void 0;
    (function(Random) {
      Random.getRandomValues = (() => {
        const crypto = typeof require !== "undefined" && require("crypto") || null;
        if (crypto && typeof crypto.randomFillSync === "function") {
          return function getRandomValues(buffer) {
            return crypto.randomFillSync(buffer);
          };
        }
        if (crypto && typeof crypto.randomBytes === "function") {
          return function getRandomValues(buffer) {
            let bytes = crypto.randomBytes(buffer.length);
            for (let i = 0, n = bytes.length; i < n; ++i) {
              buffer[i] = bytes[i];
            }
          };
        }
        return fallbackRandomValues;
      })();
    })(exports2.Random || (exports2.Random = {}));
    function uuid4Factory(getRandomValues) {
      const bytes = new Uint8Array(16);
      const lut = new Array(256);
      for (let i = 0; i < 16; ++i) {
        lut[i] = "0" + i.toString(16);
      }
      for (let i = 16; i < 256; ++i) {
        lut[i] = i.toString(16);
      }
      return function uuid4() {
        getRandomValues(bytes);
        bytes[6] = 64 | bytes[6] & 15;
        bytes[8] = 128 | bytes[8] & 63;
        return lut[bytes[0]] + lut[bytes[1]] + lut[bytes[2]] + lut[bytes[3]] + "-" + lut[bytes[4]] + lut[bytes[5]] + "-" + lut[bytes[6]] + lut[bytes[7]] + "-" + lut[bytes[8]] + lut[bytes[9]] + "-" + lut[bytes[10]] + lut[bytes[11]] + lut[bytes[12]] + lut[bytes[13]] + lut[bytes[14]] + lut[bytes[15]];
      };
    }
    exports2.UUID = void 0;
    (function(UUID) {
      UUID.uuid4 = uuid4Factory(exports2.Random.getRandomValues);
    })(exports2.UUID || (exports2.UUID = {}));
    exports2.MimeData = MimeData;
    exports2.PluginRegistry = PluginRegistry;
    exports2.PromiseDelegate = PromiseDelegate2;
    exports2.Token = Token2;
  }
});

// node_modules/@lumino/signaling/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/@lumino/signaling/dist/index.js"(exports2, module2) {
    (function(global2, factory) {
      typeof exports2 === "object" && typeof module2 !== "undefined" ? factory(exports2, require_dist(), require_index_node()) : typeof define === "function" && define.amd ? define(["exports", "@lumino/algorithm", "@lumino/coreutils"], factory) : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self, factory(global2.lumino_signaling = {}, global2.lumino_algorithm, global2.lumino_coreutils));
    })(exports2, function(exports3, algorithm, coreutils) {
      "use strict";
      class Signal {
        /**
         * Construct a new signal.
         *
         * @param sender - The sender which owns the signal.
         */
        constructor(sender) {
          this.sender = sender;
        }
        /**
         * Connect a slot to the signal.
         *
         * @param slot - The slot to invoke when the signal is emitted.
         *
         * @param thisArg - The `this` context for the slot. If provided,
         *   this must be a non-primitive object.
         *
         * @returns `true` if the connection succeeds, `false` otherwise.
         */
        connect(slot, thisArg) {
          return Private2.connect(this, slot, thisArg);
        }
        /**
         * Disconnect a slot from the signal.
         *
         * @param slot - The slot to disconnect from the signal.
         *
         * @param thisArg - The `this` context for the slot. If provided,
         *   this must be a non-primitive object.
         *
         * @returns `true` if the connection is removed, `false` otherwise.
         */
        disconnect(slot, thisArg) {
          return Private2.disconnect(this, slot, thisArg);
        }
        /**
         * Emit the signal and invoke the connected slots.
         *
         * @param args - The args to pass to the connected slots.
         *
         * #### Notes
         * Slots are invoked synchronously in connection order.
         *
         * Exceptions thrown by connected slots will be caught and logged.
         */
        emit(args) {
          Private2.emit(this, args);
        }
      }
      (function(Signal2) {
        function disconnectBetween(sender, receiver) {
          Private2.disconnectBetween(sender, receiver);
        }
        Signal2.disconnectBetween = disconnectBetween;
        function disconnectSender(sender) {
          Private2.disconnectSender(sender);
        }
        Signal2.disconnectSender = disconnectSender;
        function disconnectReceiver(receiver) {
          Private2.disconnectReceiver(receiver);
        }
        Signal2.disconnectReceiver = disconnectReceiver;
        function disconnectAll(object) {
          Private2.disconnectAll(object);
        }
        Signal2.disconnectAll = disconnectAll;
        function clearData(object) {
          Private2.disconnectAll(object);
        }
        Signal2.clearData = clearData;
        function getExceptionHandler() {
          return Private2.exceptionHandler;
        }
        Signal2.getExceptionHandler = getExceptionHandler;
        function setExceptionHandler(handler) {
          let old = Private2.exceptionHandler;
          Private2.exceptionHandler = handler;
          return old;
        }
        Signal2.setExceptionHandler = setExceptionHandler;
      })(Signal || (Signal = {}));
      class Stream extends Signal {
        constructor() {
          super(...arguments);
          this._pending = new coreutils.PromiseDelegate();
        }
        /**
         * Return an async iterator that yields every emission.
         */
        async *[Symbol.asyncIterator]() {
          let pending = this._pending;
          while (true) {
            try {
              const { args, next } = await pending.promise;
              pending = next;
              yield args;
            } catch (_) {
              return;
            }
          }
        }
        /**
         * Emit the signal, invoke the connected slots, and yield the emission.
         *
         * @param args - The args to pass to the connected slots.
         */
        emit(args) {
          const pending = this._pending;
          const next = this._pending = new coreutils.PromiseDelegate();
          pending.resolve({ args, next });
          super.emit(args);
        }
        /**
         * Stop the stream's async iteration.
         */
        stop() {
          this._pending.promise.catch(() => void 0);
          this._pending.reject("stop");
          this._pending = new coreutils.PromiseDelegate();
        }
      }
      var Private2;
      (function(Private3) {
        Private3.exceptionHandler = (err) => {
          console.error(err);
        };
        function connect(signal, slot, thisArg) {
          thisArg = thisArg || void 0;
          let receivers = receiversForSender.get(signal.sender);
          if (!receivers) {
            receivers = [];
            receiversForSender.set(signal.sender, receivers);
          }
          if (findConnection(receivers, signal, slot, thisArg)) {
            return false;
          }
          let receiver = thisArg || slot;
          let senders = sendersForReceiver.get(receiver);
          if (!senders) {
            senders = [];
            sendersForReceiver.set(receiver, senders);
          }
          let connection = { signal, slot, thisArg };
          receivers.push(connection);
          senders.push(connection);
          return true;
        }
        Private3.connect = connect;
        function disconnect(signal, slot, thisArg) {
          thisArg = thisArg || void 0;
          let receivers = receiversForSender.get(signal.sender);
          if (!receivers || receivers.length === 0) {
            return false;
          }
          let connection = findConnection(receivers, signal, slot, thisArg);
          if (!connection) {
            return false;
          }
          let receiver = thisArg || slot;
          let senders = sendersForReceiver.get(receiver);
          connection.signal = null;
          scheduleCleanup(receivers);
          scheduleCleanup(senders);
          return true;
        }
        Private3.disconnect = disconnect;
        function disconnectBetween(sender, receiver) {
          let receivers = receiversForSender.get(sender);
          if (!receivers || receivers.length === 0) {
            return;
          }
          let senders = sendersForReceiver.get(receiver);
          if (!senders || senders.length === 0) {
            return;
          }
          for (const connection of senders) {
            if (!connection.signal) {
              continue;
            }
            if (connection.signal.sender === sender) {
              connection.signal = null;
            }
          }
          scheduleCleanup(receivers);
          scheduleCleanup(senders);
        }
        Private3.disconnectBetween = disconnectBetween;
        function disconnectSender(sender) {
          let receivers = receiversForSender.get(sender);
          if (!receivers || receivers.length === 0) {
            return;
          }
          for (const connection of receivers) {
            if (!connection.signal) {
              continue;
            }
            let receiver = connection.thisArg || connection.slot;
            connection.signal = null;
            scheduleCleanup(sendersForReceiver.get(receiver));
          }
          scheduleCleanup(receivers);
        }
        Private3.disconnectSender = disconnectSender;
        function disconnectReceiver(receiver) {
          let senders = sendersForReceiver.get(receiver);
          if (!senders || senders.length === 0) {
            return;
          }
          for (const connection of senders) {
            if (!connection.signal) {
              continue;
            }
            let sender = connection.signal.sender;
            connection.signal = null;
            scheduleCleanup(receiversForSender.get(sender));
          }
          scheduleCleanup(senders);
        }
        Private3.disconnectReceiver = disconnectReceiver;
        function disconnectAll(object) {
          disconnectSender(object);
          disconnectReceiver(object);
        }
        Private3.disconnectAll = disconnectAll;
        function emit(signal, args) {
          let receivers = receiversForSender.get(signal.sender);
          if (!receivers || receivers.length === 0) {
            return;
          }
          for (let i = 0, n = receivers.length; i < n; ++i) {
            let connection = receivers[i];
            if (connection.signal === signal) {
              invokeSlot(connection, args);
            }
          }
        }
        Private3.emit = emit;
        const receiversForSender = /* @__PURE__ */ new WeakMap();
        const sendersForReceiver = /* @__PURE__ */ new WeakMap();
        const dirtySet = /* @__PURE__ */ new Set();
        const schedule = (() => {
          let ok = typeof requestAnimationFrame === "function";
          return ok ? requestAnimationFrame : setImmediate;
        })();
        function findConnection(connections, signal, slot, thisArg) {
          return algorithm.find(connections, (connection) => connection.signal === signal && connection.slot === slot && connection.thisArg === thisArg);
        }
        function invokeSlot(connection, args) {
          let { signal, slot, thisArg } = connection;
          try {
            slot.call(thisArg, signal.sender, args);
          } catch (err) {
            Private3.exceptionHandler(err);
          }
        }
        function scheduleCleanup(array) {
          if (dirtySet.size === 0) {
            schedule(cleanupDirtySet);
          }
          dirtySet.add(array);
        }
        function cleanupDirtySet() {
          dirtySet.forEach(cleanupConnections);
          dirtySet.clear();
        }
        function cleanupConnections(connections) {
          algorithm.ArrayExt.removeAllWhere(connections, isDeadConnection);
        }
        function isDeadConnection(connection) {
          return connection.signal === null;
        }
      })(Private2 || (Private2 = {}));
      exports3.Signal = Signal;
      exports3.Stream = Stream;
    });
  }
});

// node_modules/@jupyterlab/coreutils/lib/activitymonitor.js
var require_activitymonitor = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/activitymonitor.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ActivityMonitor = void 0;
    var signaling_1 = require_dist2();
    var ActivityMonitor = class {
      /**
       * Construct a new activity monitor.
       */
      constructor(options) {
        this._timer = -1;
        this._timeout = -1;
        this._isDisposed = false;
        this._activityStopped = new signaling_1.Signal(this);
        options.signal.connect(this._onSignalFired, this);
        this._timeout = options.timeout || 1e3;
      }
      /**
       * A signal emitted when activity has ceased.
       */
      get activityStopped() {
        return this._activityStopped;
      }
      /**
       * The timeout associated with the monitor, in milliseconds.
       */
      get timeout() {
        return this._timeout;
      }
      set timeout(value) {
        this._timeout = value;
      }
      /**
       * Test whether the monitor has been disposed.
       *
       * #### Notes
       * This is a read-only property.
       */
      get isDisposed() {
        return this._isDisposed;
      }
      /**
       * Dispose of the resources used by the activity monitor.
       */
      dispose() {
        if (this._isDisposed) {
          return;
        }
        this._isDisposed = true;
        signaling_1.Signal.clearData(this);
      }
      /**
       * A signal handler for the monitored signal.
       */
      _onSignalFired(sender, args) {
        clearTimeout(this._timer);
        this._sender = sender;
        this._args = args;
        this._timer = setTimeout(() => {
          this._activityStopped.emit({
            sender: this._sender,
            args: this._args
          });
        }, this._timeout);
      }
    };
    exports2.ActivityMonitor = ActivityMonitor;
  }
});

// node_modules/@jupyterlab/coreutils/lib/interfaces.js
var require_interfaces = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/interfaces.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// node_modules/@jupyterlab/coreutils/lib/lru.js
var require_lru = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/lru.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.LruCache = void 0;
    var DEFAULT_MAX_SIZE = 128;
    var LruCache = class {
      constructor(options = {}) {
        this._map = /* @__PURE__ */ new Map();
        this._maxSize = (options === null || options === void 0 ? void 0 : options.maxSize) || DEFAULT_MAX_SIZE;
      }
      /**
       * Return the current size of the cache.
       */
      get size() {
        return this._map.size;
      }
      /**
       * Clear the values in the cache.
       */
      clear() {
        this._map.clear();
      }
      /**
       * Get a value (or null) from the cache, pushing the item to the front of the cache.
       */
      get(key) {
        const item = this._map.get(key) || null;
        if (item != null) {
          this._map.delete(key);
          this._map.set(key, item);
        }
        return item;
      }
      /**
       * Set a value in the cache, potentially evicting an old item.
       */
      set(key, value) {
        if (this._map.size >= this._maxSize) {
          this._map.delete(this._map.keys().next().value);
        }
        this._map.set(key, value);
      }
    };
    exports2.LruCache = LruCache;
  }
});

// node_modules/@jupyterlab/coreutils/lib/markdowncodeblocks.js
var require_markdowncodeblocks = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/markdowncodeblocks.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.MarkdownCodeBlocks = void 0;
    var MarkdownCodeBlocks;
    (function(MarkdownCodeBlocks2) {
      MarkdownCodeBlocks2.CODE_BLOCK_MARKER = "```";
      const markdownExtensions = [
        ".markdown",
        ".mdown",
        ".mkdn",
        ".md",
        ".mkd",
        ".mdwn",
        ".mdtxt",
        ".mdtext",
        ".text",
        ".txt",
        ".Rmd"
      ];
      class MarkdownCodeBlock {
        constructor(startLine) {
          this.startLine = startLine;
          this.code = "";
          this.endLine = -1;
        }
      }
      MarkdownCodeBlocks2.MarkdownCodeBlock = MarkdownCodeBlock;
      function isMarkdown(extension) {
        return markdownExtensions.indexOf(extension) > -1;
      }
      MarkdownCodeBlocks2.isMarkdown = isMarkdown;
      function findMarkdownCodeBlocks(text) {
        if (!text || text === "") {
          return [];
        }
        const lines = text.split("\n");
        const codeBlocks = [];
        let currentBlock = null;
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          const lineContainsMarker = line.indexOf(MarkdownCodeBlocks2.CODE_BLOCK_MARKER) === 0;
          const constructingBlock = currentBlock != null;
          if (!lineContainsMarker && !constructingBlock) {
            continue;
          }
          if (!constructingBlock) {
            currentBlock = new MarkdownCodeBlock(lineIndex);
            const firstIndex = line.indexOf(MarkdownCodeBlocks2.CODE_BLOCK_MARKER);
            const lastIndex = line.lastIndexOf(MarkdownCodeBlocks2.CODE_BLOCK_MARKER);
            const isSingleLine = firstIndex !== lastIndex;
            if (isSingleLine) {
              currentBlock.code = line.substring(firstIndex + MarkdownCodeBlocks2.CODE_BLOCK_MARKER.length, lastIndex);
              currentBlock.endLine = lineIndex;
              codeBlocks.push(currentBlock);
              currentBlock = null;
            }
          } else if (currentBlock) {
            if (lineContainsMarker) {
              currentBlock.endLine = lineIndex - 1;
              codeBlocks.push(currentBlock);
              currentBlock = null;
            } else {
              currentBlock.code += line + "\n";
            }
          }
        }
        return codeBlocks;
      }
      MarkdownCodeBlocks2.findMarkdownCodeBlocks = findMarkdownCodeBlocks;
    })(MarkdownCodeBlocks || (exports2.MarkdownCodeBlocks = MarkdownCodeBlocks = {}));
  }
});

// node_modules/minimist/index.js
var require_minimist = __commonJS({
  "node_modules/minimist/index.js"(exports2, module2) {
    "use strict";
    function hasKey(obj, keys) {
      var o = obj;
      keys.slice(0, -1).forEach(function(key2) {
        o = o[key2] || {};
      });
      var key = keys[keys.length - 1];
      return key in o;
    }
    function isNumber(x) {
      if (typeof x === "number") {
        return true;
      }
      if (/^0x[0-9a-f]+$/i.test(x)) {
        return true;
      }
      return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
    }
    function isConstructorOrProto(obj, key) {
      return key === "constructor" && typeof obj[key] === "function" || key === "__proto__";
    }
    module2.exports = function(args, opts) {
      if (!opts) {
        opts = {};
      }
      var flags = {
        bools: {},
        strings: {},
        unknownFn: null
      };
      if (typeof opts.unknown === "function") {
        flags.unknownFn = opts.unknown;
      }
      if (typeof opts.boolean === "boolean" && opts.boolean) {
        flags.allBools = true;
      } else {
        [].concat(opts.boolean).filter(Boolean).forEach(function(key2) {
          flags.bools[key2] = true;
        });
      }
      var aliases = {};
      function aliasIsBoolean(key2) {
        return aliases[key2].some(function(x) {
          return flags.bools[x];
        });
      }
      Object.keys(opts.alias || {}).forEach(function(key2) {
        aliases[key2] = [].concat(opts.alias[key2]);
        aliases[key2].forEach(function(x) {
          aliases[x] = [key2].concat(aliases[key2].filter(function(y) {
            return x !== y;
          }));
        });
      });
      [].concat(opts.string).filter(Boolean).forEach(function(key2) {
        flags.strings[key2] = true;
        if (aliases[key2]) {
          [].concat(aliases[key2]).forEach(function(k) {
            flags.strings[k] = true;
          });
        }
      });
      var defaults = opts.default || {};
      var argv = { _: [] };
      function argDefined(key2, arg2) {
        return flags.allBools && /^--[^=]+$/.test(arg2) || flags.strings[key2] || flags.bools[key2] || aliases[key2];
      }
      function setKey(obj, keys, value2) {
        var o = obj;
        for (var i2 = 0; i2 < keys.length - 1; i2++) {
          var key2 = keys[i2];
          if (isConstructorOrProto(o, key2)) {
            return;
          }
          if (o[key2] === void 0) {
            o[key2] = {};
          }
          if (o[key2] === Object.prototype || o[key2] === Number.prototype || o[key2] === String.prototype) {
            o[key2] = {};
          }
          if (o[key2] === Array.prototype) {
            o[key2] = [];
          }
          o = o[key2];
        }
        var lastKey = keys[keys.length - 1];
        if (isConstructorOrProto(o, lastKey)) {
          return;
        }
        if (o === Object.prototype || o === Number.prototype || o === String.prototype) {
          o = {};
        }
        if (o === Array.prototype) {
          o = [];
        }
        if (o[lastKey] === void 0 || flags.bools[lastKey] || typeof o[lastKey] === "boolean") {
          o[lastKey] = value2;
        } else if (Array.isArray(o[lastKey])) {
          o[lastKey].push(value2);
        } else {
          o[lastKey] = [o[lastKey], value2];
        }
      }
      function setArg(key2, val, arg2) {
        if (arg2 && flags.unknownFn && !argDefined(key2, arg2)) {
          if (flags.unknownFn(arg2) === false) {
            return;
          }
        }
        var value2 = !flags.strings[key2] && isNumber(val) ? Number(val) : val;
        setKey(argv, key2.split("."), value2);
        (aliases[key2] || []).forEach(function(x) {
          setKey(argv, x.split("."), value2);
        });
      }
      Object.keys(flags.bools).forEach(function(key2) {
        setArg(key2, defaults[key2] === void 0 ? false : defaults[key2]);
      });
      var notFlags = [];
      if (args.indexOf("--") !== -1) {
        notFlags = args.slice(args.indexOf("--") + 1);
        args = args.slice(0, args.indexOf("--"));
      }
      for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        var key;
        var next;
        if (/^--.+=/.test(arg)) {
          var m = arg.match(/^--([^=]+)=([\s\S]*)$/);
          key = m[1];
          var value = m[2];
          if (flags.bools[key]) {
            value = value !== "false";
          }
          setArg(key, value, arg);
        } else if (/^--no-.+/.test(arg)) {
          key = arg.match(/^--no-(.+)/)[1];
          setArg(key, false, arg);
        } else if (/^--.+/.test(arg)) {
          key = arg.match(/^--(.+)/)[1];
          next = args[i + 1];
          if (next !== void 0 && !/^(-|--)[^-]/.test(next) && !flags.bools[key] && !flags.allBools && (aliases[key] ? !aliasIsBoolean(key) : true)) {
            setArg(key, next, arg);
            i += 1;
          } else if (/^(true|false)$/.test(next)) {
            setArg(key, next === "true", arg);
            i += 1;
          } else {
            setArg(key, flags.strings[key] ? "" : true, arg);
          }
        } else if (/^-[^-]+/.test(arg)) {
          var letters = arg.slice(1, -1).split("");
          var broken = false;
          for (var j = 0; j < letters.length; j++) {
            next = arg.slice(j + 2);
            if (next === "-") {
              setArg(letters[j], next, arg);
              continue;
            }
            if (/[A-Za-z]/.test(letters[j]) && next[0] === "=") {
              setArg(letters[j], next.slice(1), arg);
              broken = true;
              break;
            }
            if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
              setArg(letters[j], next, arg);
              broken = true;
              break;
            }
            if (letters[j + 1] && letters[j + 1].match(/\W/)) {
              setArg(letters[j], arg.slice(j + 2), arg);
              broken = true;
              break;
            } else {
              setArg(letters[j], flags.strings[letters[j]] ? "" : true, arg);
            }
          }
          key = arg.slice(-1)[0];
          if (!broken && key !== "-") {
            if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1]) && !flags.bools[key] && (aliases[key] ? !aliasIsBoolean(key) : true)) {
              setArg(key, args[i + 1], arg);
              i += 1;
            } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
              setArg(key, args[i + 1] === "true", arg);
              i += 1;
            } else {
              setArg(key, flags.strings[key] ? "" : true, arg);
            }
          }
        } else {
          if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
            argv._.push(flags.strings._ || !isNumber(arg) ? arg : Number(arg));
          }
          if (opts.stopEarly) {
            argv._.push.apply(argv._, args.slice(i + 1));
            break;
          }
        }
      }
      Object.keys(defaults).forEach(function(k) {
        if (!hasKey(argv, k.split("."))) {
          setKey(argv, k.split("."), defaults[k]);
          (aliases[k] || []).forEach(function(x) {
            setKey(argv, x.split("."), defaults[k]);
          });
        }
      });
      if (opts["--"]) {
        argv["--"] = notFlags.slice();
      } else {
        notFlags.forEach(function(k) {
          argv._.push(k);
        });
      }
      return argv;
    };
  }
});

// node_modules/requires-port/index.js
var require_requires_port = __commonJS({
  "node_modules/requires-port/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function required(port, protocol) {
      protocol = protocol.split(":")[0];
      port = +port;
      if (!port) return false;
      switch (protocol) {
        case "http":
        case "ws":
          return port !== 80;
        case "https":
        case "wss":
          return port !== 443;
        case "ftp":
          return port !== 21;
        case "gopher":
          return port !== 70;
        case "file":
          return false;
      }
      return port !== 0;
    };
  }
});

// node_modules/querystringify/index.js
var require_querystringify = __commonJS({
  "node_modules/querystringify/index.js"(exports2) {
    "use strict";
    var has = Object.prototype.hasOwnProperty;
    var undef;
    function decode(input) {
      try {
        return decodeURIComponent(input.replace(/\+/g, " "));
      } catch (e) {
        return null;
      }
    }
    function encode(input) {
      try {
        return encodeURIComponent(input);
      } catch (e) {
        return null;
      }
    }
    function querystring(query) {
      var parser = /([^=?#&]+)=?([^&]*)/g, result = {}, part;
      while (part = parser.exec(query)) {
        var key = decode(part[1]), value = decode(part[2]);
        if (key === null || value === null || key in result) continue;
        result[key] = value;
      }
      return result;
    }
    function querystringify(obj, prefix) {
      prefix = prefix || "";
      var pairs = [], value, key;
      if ("string" !== typeof prefix) prefix = "?";
      for (key in obj) {
        if (has.call(obj, key)) {
          value = obj[key];
          if (!value && (value === null || value === undef || isNaN(value))) {
            value = "";
          }
          key = encode(key);
          value = encode(value);
          if (key === null || value === null) continue;
          pairs.push(key + "=" + value);
        }
      }
      return pairs.length ? prefix + pairs.join("&") : "";
    }
    exports2.stringify = querystringify;
    exports2.parse = querystring;
  }
});

// node_modules/url-parse/index.js
var require_url_parse = __commonJS({
  "node_modules/url-parse/index.js"(exports2, module2) {
    "use strict";
    var required = require_requires_port();
    var qs = require_querystringify();
    var controlOrWhitespace = /^[\x00-\x20\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/;
    var CRHTLF = /[\n\r\t]/g;
    var slashes = /^[A-Za-z][A-Za-z0-9+-.]*:\/\//;
    var port = /:\d+$/;
    var protocolre = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\\/]+)?([\S\s]*)/i;
    var windowsDriveLetter = /^[a-zA-Z]:/;
    function trimLeft(str) {
      return (str ? str : "").toString().replace(controlOrWhitespace, "");
    }
    var rules = [
      ["#", "hash"],
      // Extract from the back.
      ["?", "query"],
      // Extract from the back.
      function sanitize(address, url) {
        return isSpecial(url.protocol) ? address.replace(/\\/g, "/") : address;
      },
      ["/", "pathname"],
      // Extract from the back.
      ["@", "auth", 1],
      // Extract from the front.
      [NaN, "host", void 0, 1, 1],
      // Set left over value.
      [/:(\d*)$/, "port", void 0, 1],
      // RegExp the back.
      [NaN, "hostname", void 0, 1, 1]
      // Set left over.
    ];
    var ignore = { hash: 1, query: 1 };
    function lolcation(loc) {
      var globalVar;
      if (typeof window !== "undefined") globalVar = window;
      else if (typeof global !== "undefined") globalVar = global;
      else if (typeof self !== "undefined") globalVar = self;
      else globalVar = {};
      var location = globalVar.location || {};
      loc = loc || location;
      var finaldestination = {}, type = typeof loc, key;
      if ("blob:" === loc.protocol) {
        finaldestination = new Url(unescape(loc.pathname), {});
      } else if ("string" === type) {
        finaldestination = new Url(loc, {});
        for (key in ignore) delete finaldestination[key];
      } else if ("object" === type) {
        for (key in loc) {
          if (key in ignore) continue;
          finaldestination[key] = loc[key];
        }
        if (finaldestination.slashes === void 0) {
          finaldestination.slashes = slashes.test(loc.href);
        }
      }
      return finaldestination;
    }
    function isSpecial(scheme) {
      return scheme === "file:" || scheme === "ftp:" || scheme === "http:" || scheme === "https:" || scheme === "ws:" || scheme === "wss:";
    }
    function extractProtocol(address, location) {
      address = trimLeft(address);
      address = address.replace(CRHTLF, "");
      location = location || {};
      var match = protocolre.exec(address);
      var protocol = match[1] ? match[1].toLowerCase() : "";
      var forwardSlashes = !!match[2];
      var otherSlashes = !!match[3];
      var slashesCount = 0;
      var rest;
      if (forwardSlashes) {
        if (otherSlashes) {
          rest = match[2] + match[3] + match[4];
          slashesCount = match[2].length + match[3].length;
        } else {
          rest = match[2] + match[4];
          slashesCount = match[2].length;
        }
      } else {
        if (otherSlashes) {
          rest = match[3] + match[4];
          slashesCount = match[3].length;
        } else {
          rest = match[4];
        }
      }
      if (protocol === "file:") {
        if (slashesCount >= 2) {
          rest = rest.slice(2);
        }
      } else if (isSpecial(protocol)) {
        rest = match[4];
      } else if (protocol) {
        if (forwardSlashes) {
          rest = rest.slice(2);
        }
      } else if (slashesCount >= 2 && isSpecial(location.protocol)) {
        rest = match[4];
      }
      return {
        protocol,
        slashes: forwardSlashes || isSpecial(protocol),
        slashesCount,
        rest
      };
    }
    function resolve(relative, base) {
      if (relative === "") return base;
      var path2 = (base || "/").split("/").slice(0, -1).concat(relative.split("/")), i = path2.length, last = path2[i - 1], unshift = false, up = 0;
      while (i--) {
        if (path2[i] === ".") {
          path2.splice(i, 1);
        } else if (path2[i] === "..") {
          path2.splice(i, 1);
          up++;
        } else if (up) {
          if (i === 0) unshift = true;
          path2.splice(i, 1);
          up--;
        }
      }
      if (unshift) path2.unshift("");
      if (last === "." || last === "..") path2.push("");
      return path2.join("/");
    }
    function Url(address, location, parser) {
      address = trimLeft(address);
      address = address.replace(CRHTLF, "");
      if (!(this instanceof Url)) {
        return new Url(address, location, parser);
      }
      var relative, extracted, parse, instruction, index, key, instructions = rules.slice(), type = typeof location, url = this, i = 0;
      if ("object" !== type && "string" !== type) {
        parser = location;
        location = null;
      }
      if (parser && "function" !== typeof parser) parser = qs.parse;
      location = lolcation(location);
      extracted = extractProtocol(address || "", location);
      relative = !extracted.protocol && !extracted.slashes;
      url.slashes = extracted.slashes || relative && location.slashes;
      url.protocol = extracted.protocol || location.protocol || "";
      address = extracted.rest;
      if (extracted.protocol === "file:" && (extracted.slashesCount !== 2 || windowsDriveLetter.test(address)) || !extracted.slashes && (extracted.protocol || extracted.slashesCount < 2 || !isSpecial(url.protocol))) {
        instructions[3] = [/(.*)/, "pathname"];
      }
      for (; i < instructions.length; i++) {
        instruction = instructions[i];
        if (typeof instruction === "function") {
          address = instruction(address, url);
          continue;
        }
        parse = instruction[0];
        key = instruction[1];
        if (parse !== parse) {
          url[key] = address;
        } else if ("string" === typeof parse) {
          index = parse === "@" ? address.lastIndexOf(parse) : address.indexOf(parse);
          if (~index) {
            if ("number" === typeof instruction[2]) {
              url[key] = address.slice(0, index);
              address = address.slice(index + instruction[2]);
            } else {
              url[key] = address.slice(index);
              address = address.slice(0, index);
            }
          }
        } else if (index = parse.exec(address)) {
          url[key] = index[1];
          address = address.slice(0, index.index);
        }
        url[key] = url[key] || (relative && instruction[3] ? location[key] || "" : "");
        if (instruction[4]) url[key] = url[key].toLowerCase();
      }
      if (parser) url.query = parser(url.query);
      if (relative && location.slashes && url.pathname.charAt(0) !== "/" && (url.pathname !== "" || location.pathname !== "")) {
        url.pathname = resolve(url.pathname, location.pathname);
      }
      if (url.pathname.charAt(0) !== "/" && isSpecial(url.protocol)) {
        url.pathname = "/" + url.pathname;
      }
      if (!required(url.port, url.protocol)) {
        url.host = url.hostname;
        url.port = "";
      }
      url.username = url.password = "";
      if (url.auth) {
        index = url.auth.indexOf(":");
        if (~index) {
          url.username = url.auth.slice(0, index);
          url.username = encodeURIComponent(decodeURIComponent(url.username));
          url.password = url.auth.slice(index + 1);
          url.password = encodeURIComponent(decodeURIComponent(url.password));
        } else {
          url.username = encodeURIComponent(decodeURIComponent(url.auth));
        }
        url.auth = url.password ? url.username + ":" + url.password : url.username;
      }
      url.origin = url.protocol !== "file:" && isSpecial(url.protocol) && url.host ? url.protocol + "//" + url.host : "null";
      url.href = url.toString();
    }
    function set(part, value, fn) {
      var url = this;
      switch (part) {
        case "query":
          if ("string" === typeof value && value.length) {
            value = (fn || qs.parse)(value);
          }
          url[part] = value;
          break;
        case "port":
          url[part] = value;
          if (!required(value, url.protocol)) {
            url.host = url.hostname;
            url[part] = "";
          } else if (value) {
            url.host = url.hostname + ":" + value;
          }
          break;
        case "hostname":
          url[part] = value;
          if (url.port) value += ":" + url.port;
          url.host = value;
          break;
        case "host":
          url[part] = value;
          if (port.test(value)) {
            value = value.split(":");
            url.port = value.pop();
            url.hostname = value.join(":");
          } else {
            url.hostname = value;
            url.port = "";
          }
          break;
        case "protocol":
          url.protocol = value.toLowerCase();
          url.slashes = !fn;
          break;
        case "pathname":
        case "hash":
          if (value) {
            var char = part === "pathname" ? "/" : "#";
            url[part] = value.charAt(0) !== char ? char + value : value;
          } else {
            url[part] = value;
          }
          break;
        case "username":
        case "password":
          url[part] = encodeURIComponent(value);
          break;
        case "auth":
          var index = value.indexOf(":");
          if (~index) {
            url.username = value.slice(0, index);
            url.username = encodeURIComponent(decodeURIComponent(url.username));
            url.password = value.slice(index + 1);
            url.password = encodeURIComponent(decodeURIComponent(url.password));
          } else {
            url.username = encodeURIComponent(decodeURIComponent(value));
          }
      }
      for (var i = 0; i < rules.length; i++) {
        var ins = rules[i];
        if (ins[4]) url[ins[1]] = url[ins[1]].toLowerCase();
      }
      url.auth = url.password ? url.username + ":" + url.password : url.username;
      url.origin = url.protocol !== "file:" && isSpecial(url.protocol) && url.host ? url.protocol + "//" + url.host : "null";
      url.href = url.toString();
      return url;
    }
    function toString(stringify) {
      if (!stringify || "function" !== typeof stringify) stringify = qs.stringify;
      var query, url = this, host = url.host, protocol = url.protocol;
      if (protocol && protocol.charAt(protocol.length - 1) !== ":") protocol += ":";
      var result = protocol + (url.protocol && url.slashes || isSpecial(url.protocol) ? "//" : "");
      if (url.username) {
        result += url.username;
        if (url.password) result += ":" + url.password;
        result += "@";
      } else if (url.password) {
        result += ":" + url.password;
        result += "@";
      } else if (url.protocol !== "file:" && isSpecial(url.protocol) && !host && url.pathname !== "/") {
        result += "@";
      }
      if (host[host.length - 1] === ":" || port.test(url.hostname) && !url.port) {
        host += ":";
      }
      result += host + url.pathname;
      query = "object" === typeof url.query ? stringify(url.query) : url.query;
      if (query) result += "?" !== query.charAt(0) ? "?" + query : query;
      if (url.hash) result += url.hash;
      return result;
    }
    Url.prototype = { set, toString };
    Url.extractProtocol = extractProtocol;
    Url.location = lolcation;
    Url.trimLeft = trimLeft;
    Url.qs = qs;
    module2.exports = Url;
  }
});

// node_modules/@jupyterlab/coreutils/lib/url.js
var require_url = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/url.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.URLExt = void 0;
    var path_1 = require("path");
    var url_parse_1 = __importDefault2(require_url_parse());
    var URLExt2;
    (function(URLExt3) {
      function parse(url) {
        if (typeof document !== "undefined" && document) {
          const a = document.createElement("a");
          a.href = url;
          return a;
        }
        return (0, url_parse_1.default)(url);
      }
      URLExt3.parse = parse;
      function getHostName(url) {
        return (0, url_parse_1.default)(url).hostname;
      }
      URLExt3.getHostName = getHostName;
      function normalize(url) {
        return url && parse(url).toString();
      }
      URLExt3.normalize = normalize;
      function join(...parts) {
        let u = (0, url_parse_1.default)(parts[0], {});
        const isSchemaLess = u.protocol === "" && u.slashes;
        if (isSchemaLess) {
          u = (0, url_parse_1.default)(parts[0], "https:" + parts[0]);
        }
        const prefix = `${isSchemaLess ? "" : u.protocol}${u.slashes ? "//" : ""}${u.auth}${u.auth ? "@" : ""}${u.host}`;
        const path2 = path_1.posix.join(`${!!prefix && u.pathname[0] !== "/" ? "/" : ""}${u.pathname}`, ...parts.slice(1));
        return `${prefix}${path2 === "." ? "" : path2}`;
      }
      URLExt3.join = join;
      function encodeParts(url) {
        return join(...url.split("/").map(encodeURIComponent));
      }
      URLExt3.encodeParts = encodeParts;
      function objectToQueryString(value) {
        const keys = Object.keys(value).filter((key) => key.length > 0);
        if (!keys.length) {
          return "";
        }
        return "?" + keys.map((key) => {
          const content = encodeURIComponent(String(value[key]));
          return key + (content ? "=" + content : "");
        }).join("&");
      }
      URLExt3.objectToQueryString = objectToQueryString;
      function queryStringToObject(value) {
        return value.replace(/^\?/, "").split("&").reduce((acc, val) => {
          const [key, value2] = val.split("=");
          if (key.length > 0) {
            acc[key] = decodeURIComponent(value2 || "");
          }
          return acc;
        }, {});
      }
      URLExt3.queryStringToObject = queryStringToObject;
      function isLocal(url, allowRoot = false) {
        const { protocol } = parse(url);
        return (!protocol || url.toLowerCase().indexOf(protocol) !== 0) && (allowRoot ? url.indexOf("//") !== 0 : url.indexOf("/") !== 0);
      }
      URLExt3.isLocal = isLocal;
    })(URLExt2 || (exports2.URLExt = URLExt2 = {}));
  }
});

// node_modules/@jupyterlab/coreutils/lib/pageconfig.js
var require_pageconfig = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/pageconfig.js"(exports, module) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PageConfig = void 0;
    var coreutils_1 = require_index_node();
    var minimist_1 = __importDefault(require_minimist());
    var url_1 = require_url();
    var PageConfig;
    (function(PageConfig) {
      function getOption(name) {
        if (configData) {
          return configData[name] || getBodyData(name);
        }
        configData = /* @__PURE__ */ Object.create(null);
        let found = false;
        if (typeof document !== "undefined" && document) {
          const el = document.getElementById("jupyter-config-data");
          if (el) {
            configData = JSON.parse(el.textContent || "");
            found = true;
          }
        }
        if (!found && typeof process !== "undefined" && process.argv) {
          try {
            const cli = (0, minimist_1.default)(process.argv.slice(2));
            const path = require("path");
            let fullPath = "";
            if ("jupyter-config-data" in cli) {
              fullPath = path.resolve(cli["jupyter-config-data"]);
            } else if ("JUPYTER_CONFIG_DATA" in process.env) {
              fullPath = path.resolve(process.env["JUPYTER_CONFIG_DATA"]);
            }
            if (fullPath) {
              configData = eval("require")(fullPath);
            }
          } catch (e) {
            console.error(e);
          }
        }
        if (!coreutils_1.JSONExt.isObject(configData)) {
          configData = /* @__PURE__ */ Object.create(null);
        } else {
          for (const key in configData) {
            if (typeof configData[key] !== "string") {
              configData[key] = JSON.stringify(configData[key]);
            }
          }
        }
        return configData[name] || getBodyData(name);
      }
      PageConfig.getOption = getOption;
      function setOption(name2, value) {
        const last = getOption(name2);
        configData[name2] = value;
        return last;
      }
      PageConfig.setOption = setOption;
      function getBaseUrl() {
        return url_1.URLExt.normalize(getOption("baseUrl") || "/");
      }
      PageConfig.getBaseUrl = getBaseUrl;
      function getTreeUrl() {
        return url_1.URLExt.join(getBaseUrl(), getOption("treeUrl"));
      }
      PageConfig.getTreeUrl = getTreeUrl;
      function getShareUrl() {
        return url_1.URLExt.normalize(getOption("shareUrl") || getBaseUrl());
      }
      PageConfig.getShareUrl = getShareUrl;
      function getTreeShareUrl() {
        return url_1.URLExt.normalize(url_1.URLExt.join(getShareUrl(), getOption("treeUrl")));
      }
      PageConfig.getTreeShareUrl = getTreeShareUrl;
      function getUrl(options) {
        var _a, _b, _c, _d;
        let path2 = options.toShare ? getShareUrl() : getBaseUrl();
        const mode = (_a = options.mode) !== null && _a !== void 0 ? _a : getOption("mode");
        const workspace = (_b = options.workspace) !== null && _b !== void 0 ? _b : getOption("workspace");
        const labOrDoc = mode === "single-document" ? "doc" : "lab";
        path2 = url_1.URLExt.join(path2, labOrDoc);
        if (workspace !== PageConfig.defaultWorkspace) {
          path2 = url_1.URLExt.join(path2, "workspaces", encodeURIComponent((_c = getOption("workspace")) !== null && _c !== void 0 ? _c : PageConfig.defaultWorkspace));
        }
        const treePath = (_d = options.treePath) !== null && _d !== void 0 ? _d : getOption("treePath");
        if (treePath) {
          path2 = url_1.URLExt.join(path2, "tree", url_1.URLExt.encodeParts(treePath));
        }
        return path2;
      }
      PageConfig.getUrl = getUrl;
      PageConfig.defaultWorkspace = "default";
      function getWsUrl(baseUrl) {
        let wsUrl = getOption("wsUrl");
        if (!wsUrl) {
          baseUrl = baseUrl ? url_1.URLExt.normalize(baseUrl) : getBaseUrl();
          if (baseUrl.indexOf("http") !== 0) {
            return "";
          }
          wsUrl = "ws" + baseUrl.slice(4);
        }
        return url_1.URLExt.normalize(wsUrl);
      }
      PageConfig.getWsUrl = getWsUrl;
      function getNBConvertURL({ path: path2, format, download }) {
        const notebookPath = url_1.URLExt.encodeParts(path2);
        const url = url_1.URLExt.join(getBaseUrl(), "nbconvert", format, notebookPath);
        if (download) {
          return url + "?download=true";
        }
        return url;
      }
      PageConfig.getNBConvertURL = getNBConvertURL;
      function getToken() {
        return getOption("token") || getBodyData("jupyterApiToken");
      }
      PageConfig.getToken = getToken;
      function getNotebookVersion() {
        const notebookVersion = getOption("notebookVersion");
        if (notebookVersion === "") {
          return [0, 0, 0];
        }
        return JSON.parse(notebookVersion);
      }
      PageConfig.getNotebookVersion = getNotebookVersion;
      let configData = null;
      function getBodyData(key) {
        if (typeof document === "undefined" || !document.body) {
          return "";
        }
        const val = document.body.dataset[key];
        if (typeof val === "undefined") {
          return "";
        }
        return decodeURIComponent(val);
      }
      let Extension;
      (function(Extension2) {
        function populate(key) {
          try {
            const raw = getOption(key);
            if (raw) {
              return JSON.parse(raw);
            }
          } catch (error) {
            console.warn(`Unable to parse ${key}.`, error);
          }
          return [];
        }
        Extension2.deferred = populate("deferredExtensions");
        Extension2.disabled = populate("disabledExtensions");
        function isDeferred(id) {
          const separatorIndex = id.indexOf(":");
          let extName = "";
          if (separatorIndex !== -1) {
            extName = id.slice(0, separatorIndex);
          }
          return Extension2.deferred.some((val) => val === id || extName && val === extName);
        }
        Extension2.isDeferred = isDeferred;
        function isDisabled(id) {
          const separatorIndex = id.indexOf(":");
          let extName = "";
          if (separatorIndex !== -1) {
            extName = id.slice(0, separatorIndex);
          }
          return Extension2.disabled.some((val) => val === id || extName && val === extName);
        }
        Extension2.isDisabled = isDisabled;
      })(Extension = PageConfig.Extension || (PageConfig.Extension = {}));
    })(PageConfig || (exports.PageConfig = PageConfig = {}));
  }
});

// node_modules/@jupyterlab/coreutils/lib/path.js
var require_path = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/path.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.PathExt = void 0;
    var path_1 = require("path");
    var PathExt3;
    (function(PathExt4) {
      function join(...paths) {
        const path2 = path_1.posix.join(...paths);
        return path2 === "." ? "" : removeSlash(path2);
      }
      PathExt4.join = join;
      function joinWithLeadingSlash(...paths) {
        const path2 = path_1.posix.join(...paths);
        return path2 === "." ? "" : path2;
      }
      PathExt4.joinWithLeadingSlash = joinWithLeadingSlash;
      function basename(path2, ext) {
        return path_1.posix.basename(path2, ext);
      }
      PathExt4.basename = basename;
      function dirname(path2) {
        const dir = removeSlash(path_1.posix.dirname(path2));
        return dir === "." ? "" : dir;
      }
      PathExt4.dirname = dirname;
      function extname(path2) {
        return path_1.posix.extname(path2);
      }
      PathExt4.extname = extname;
      function normalize(path2) {
        if (path2 === "") {
          return "";
        }
        return removeSlash(path_1.posix.normalize(path2));
      }
      PathExt4.normalize = normalize;
      function resolve(...parts) {
        return removeSlash(path_1.posix.resolve(...parts));
      }
      PathExt4.resolve = resolve;
      function relative(from, to) {
        return removeSlash(path_1.posix.relative(from, to));
      }
      PathExt4.relative = relative;
      function normalizeExtension(extension) {
        if (extension.length > 0 && extension.indexOf(".") !== 0) {
          extension = `.${extension}`;
        }
        return extension;
      }
      PathExt4.normalizeExtension = normalizeExtension;
      function removeSlash(path2) {
        if (path2.indexOf("/") === 0) {
          path2 = path2.slice(1);
        }
        return path2;
      }
      PathExt4.removeSlash = removeSlash;
    })(PathExt3 || (exports2.PathExt = PathExt3 = {}));
  }
});

// node_modules/@jupyterlab/coreutils/lib/signal.js
var require_signal = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/signal.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.signalToPromise = void 0;
    var coreutils_12 = require_index_node();
    function signalToPromise(signal, timeout) {
      const waitForSignal = new coreutils_12.PromiseDelegate();
      function cleanup() {
        signal.disconnect(slot);
      }
      function slot(sender, args) {
        cleanup();
        waitForSignal.resolve([sender, args]);
      }
      signal.connect(slot);
      if ((timeout !== null && timeout !== void 0 ? timeout : 0) > 0) {
        setTimeout(() => {
          cleanup();
          waitForSignal.reject(`Signal not emitted within ${timeout} ms.`);
        }, timeout);
      }
      return waitForSignal.promise;
    }
    exports2.signalToPromise = signalToPromise;
  }
});

// node_modules/@jupyterlab/coreutils/lib/text.js
var require_text = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/text.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Text = void 0;
    var Text;
    (function(Text2) {
      const HAS_SURROGATES = "\u{1D41A}".length > 1;
      function jsIndexToCharIndex(jsIdx, text) {
        if (HAS_SURROGATES) {
          return jsIdx;
        }
        let charIdx = jsIdx;
        for (let i = 0; i + 1 < text.length && i < jsIdx; i++) {
          const charCode = text.charCodeAt(i);
          if (charCode >= 55296 && charCode <= 56319) {
            const nextCharCode = text.charCodeAt(i + 1);
            if (nextCharCode >= 56320 && nextCharCode <= 57343) {
              charIdx--;
              i++;
            }
          }
        }
        return charIdx;
      }
      Text2.jsIndexToCharIndex = jsIndexToCharIndex;
      function charIndexToJsIndex(charIdx, text) {
        if (HAS_SURROGATES) {
          return charIdx;
        }
        let jsIdx = charIdx;
        for (let i = 0; i + 1 < text.length && i < jsIdx; i++) {
          const charCode = text.charCodeAt(i);
          if (charCode >= 55296 && charCode <= 56319) {
            const nextCharCode = text.charCodeAt(i + 1);
            if (nextCharCode >= 56320 && nextCharCode <= 57343) {
              jsIdx++;
              i++;
            }
          }
        }
        return jsIdx;
      }
      Text2.charIndexToJsIndex = charIndexToJsIndex;
      function camelCase(str, upper = false) {
        return str.replace(/^(\w)|[\s-_:]+(\w)/g, function(match, p1, p2) {
          if (p2) {
            return p2.toUpperCase();
          } else {
            return upper ? p1.toUpperCase() : p1.toLowerCase();
          }
        });
      }
      Text2.camelCase = camelCase;
      function titleCase(str) {
        return (str || "").toLowerCase().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
      }
      Text2.titleCase = titleCase;
    })(Text || (exports2.Text = Text = {}));
  }
});

// node_modules/@jupyterlab/coreutils/lib/time.js
var require_time = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/time.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Time = void 0;
    var UNITS = [
      { name: "years", milliseconds: 365 * 24 * 60 * 60 * 1e3 },
      { name: "months", milliseconds: 30 * 24 * 60 * 60 * 1e3 },
      { name: "days", milliseconds: 24 * 60 * 60 * 1e3 },
      { name: "hours", milliseconds: 60 * 60 * 1e3 },
      { name: "minutes", milliseconds: 60 * 1e3 },
      { name: "seconds", milliseconds: 1e3 }
    ];
    var Time;
    (function(Time2) {
      function formatHuman(value, format2 = "long") {
        const lang = document.documentElement.lang || "en";
        const formatter = new Intl.RelativeTimeFormat(lang, {
          numeric: "auto",
          style: format2
        });
        const delta = new Date(value).getTime() - Date.now();
        for (let unit of UNITS) {
          const amount = Math.ceil(delta / unit.milliseconds);
          if (amount === 0) {
            continue;
          }
          return formatter.format(amount, unit.name);
        }
        return formatter.format(0, "seconds");
      }
      Time2.formatHuman = formatHuman;
      function format(value) {
        const lang = document.documentElement.lang || "en";
        const formatter = new Intl.DateTimeFormat(lang, {
          dateStyle: "short",
          timeStyle: "short"
        });
        return formatter.format(new Date(value));
      }
      Time2.format = format;
    })(Time || (exports2.Time = Time = {}));
  }
});

// node_modules/@jupyterlab/coreutils/lib/index.js
var require_lib = __commonJS({
  "node_modules/@jupyterlab/coreutils/lib/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_activitymonitor(), exports2);
    __exportStar(require_interfaces(), exports2);
    __exportStar(require_lru(), exports2);
    __exportStar(require_markdowncodeblocks(), exports2);
    __exportStar(require_pageconfig(), exports2);
    __exportStar(require_path(), exports2);
    __exportStar(require_signal(), exports2);
    __exportStar(require_text(), exports2);
    __exportStar(require_time(), exports2);
    __exportStar(require_url(), exports2);
  }
});

// node_modules/mime/Mime.js
var require_Mime = __commonJS({
  "node_modules/mime/Mime.js"(exports2, module2) {
    "use strict";
    function Mime() {
      this._types = /* @__PURE__ */ Object.create(null);
      this._extensions = /* @__PURE__ */ Object.create(null);
      for (let i = 0; i < arguments.length; i++) {
        this.define(arguments[i]);
      }
      this.define = this.define.bind(this);
      this.getType = this.getType.bind(this);
      this.getExtension = this.getExtension.bind(this);
    }
    Mime.prototype.define = function(typeMap, force) {
      for (let type in typeMap) {
        let extensions = typeMap[type].map(function(t) {
          return t.toLowerCase();
        });
        type = type.toLowerCase();
        for (let i = 0; i < extensions.length; i++) {
          const ext = extensions[i];
          if (ext[0] === "*") {
            continue;
          }
          if (!force && ext in this._types) {
            throw new Error(
              'Attempt to change mapping for "' + ext + '" extension from "' + this._types[ext] + '" to "' + type + '". Pass `force=true` to allow this, otherwise remove "' + ext + '" from the list of extensions for "' + type + '".'
            );
          }
          this._types[ext] = type;
        }
        if (force || !this._extensions[type]) {
          const ext = extensions[0];
          this._extensions[type] = ext[0] !== "*" ? ext : ext.substr(1);
        }
      }
    };
    Mime.prototype.getType = function(path2) {
      path2 = String(path2);
      let last = path2.replace(/^.*[/\\]/, "").toLowerCase();
      let ext = last.replace(/^.*\./, "").toLowerCase();
      let hasPath = last.length < path2.length;
      let hasDot = ext.length < last.length - 1;
      return (hasDot || !hasPath) && this._types[ext] || null;
    };
    Mime.prototype.getExtension = function(type) {
      type = /^\s*([^;\s]*)/.test(type) && RegExp.$1;
      return type && this._extensions[type.toLowerCase()] || null;
    };
    module2.exports = Mime;
  }
});

// node_modules/mime/types/standard.js
var require_standard = __commonJS({
  "node_modules/mime/types/standard.js"(exports2, module2) {
    module2.exports = { "application/andrew-inset": ["ez"], "application/applixware": ["aw"], "application/atom+xml": ["atom"], "application/atomcat+xml": ["atomcat"], "application/atomdeleted+xml": ["atomdeleted"], "application/atomsvc+xml": ["atomsvc"], "application/atsc-dwd+xml": ["dwd"], "application/atsc-held+xml": ["held"], "application/atsc-rsat+xml": ["rsat"], "application/bdoc": ["bdoc"], "application/calendar+xml": ["xcs"], "application/ccxml+xml": ["ccxml"], "application/cdfx+xml": ["cdfx"], "application/cdmi-capability": ["cdmia"], "application/cdmi-container": ["cdmic"], "application/cdmi-domain": ["cdmid"], "application/cdmi-object": ["cdmio"], "application/cdmi-queue": ["cdmiq"], "application/cu-seeme": ["cu"], "application/dash+xml": ["mpd"], "application/davmount+xml": ["davmount"], "application/docbook+xml": ["dbk"], "application/dssc+der": ["dssc"], "application/dssc+xml": ["xdssc"], "application/ecmascript": ["es", "ecma"], "application/emma+xml": ["emma"], "application/emotionml+xml": ["emotionml"], "application/epub+zip": ["epub"], "application/exi": ["exi"], "application/express": ["exp"], "application/fdt+xml": ["fdt"], "application/font-tdpfr": ["pfr"], "application/geo+json": ["geojson"], "application/gml+xml": ["gml"], "application/gpx+xml": ["gpx"], "application/gxf": ["gxf"], "application/gzip": ["gz"], "application/hjson": ["hjson"], "application/hyperstudio": ["stk"], "application/inkml+xml": ["ink", "inkml"], "application/ipfix": ["ipfix"], "application/its+xml": ["its"], "application/java-archive": ["jar", "war", "ear"], "application/java-serialized-object": ["ser"], "application/java-vm": ["class"], "application/javascript": ["js", "mjs"], "application/json": ["json", "map"], "application/json5": ["json5"], "application/jsonml+json": ["jsonml"], "application/ld+json": ["jsonld"], "application/lgr+xml": ["lgr"], "application/lost+xml": ["lostxml"], "application/mac-binhex40": ["hqx"], "application/mac-compactpro": ["cpt"], "application/mads+xml": ["mads"], "application/manifest+json": ["webmanifest"], "application/marc": ["mrc"], "application/marcxml+xml": ["mrcx"], "application/mathematica": ["ma", "nb", "mb"], "application/mathml+xml": ["mathml"], "application/mbox": ["mbox"], "application/mediaservercontrol+xml": ["mscml"], "application/metalink+xml": ["metalink"], "application/metalink4+xml": ["meta4"], "application/mets+xml": ["mets"], "application/mmt-aei+xml": ["maei"], "application/mmt-usd+xml": ["musd"], "application/mods+xml": ["mods"], "application/mp21": ["m21", "mp21"], "application/mp4": ["mp4s", "m4p"], "application/msword": ["doc", "dot"], "application/mxf": ["mxf"], "application/n-quads": ["nq"], "application/n-triples": ["nt"], "application/node": ["cjs"], "application/octet-stream": ["bin", "dms", "lrf", "mar", "so", "dist", "distz", "pkg", "bpk", "dump", "elc", "deploy", "exe", "dll", "deb", "dmg", "iso", "img", "msi", "msp", "msm", "buffer"], "application/oda": ["oda"], "application/oebps-package+xml": ["opf"], "application/ogg": ["ogx"], "application/omdoc+xml": ["omdoc"], "application/onenote": ["onetoc", "onetoc2", "onetmp", "onepkg"], "application/oxps": ["oxps"], "application/p2p-overlay+xml": ["relo"], "application/patch-ops-error+xml": ["xer"], "application/pdf": ["pdf"], "application/pgp-encrypted": ["pgp"], "application/pgp-signature": ["asc", "sig"], "application/pics-rules": ["prf"], "application/pkcs10": ["p10"], "application/pkcs7-mime": ["p7m", "p7c"], "application/pkcs7-signature": ["p7s"], "application/pkcs8": ["p8"], "application/pkix-attr-cert": ["ac"], "application/pkix-cert": ["cer"], "application/pkix-crl": ["crl"], "application/pkix-pkipath": ["pkipath"], "application/pkixcmp": ["pki"], "application/pls+xml": ["pls"], "application/postscript": ["ai", "eps", "ps"], "application/provenance+xml": ["provx"], "application/pskc+xml": ["pskcxml"], "application/raml+yaml": ["raml"], "application/rdf+xml": ["rdf", "owl"], "application/reginfo+xml": ["rif"], "application/relax-ng-compact-syntax": ["rnc"], "application/resource-lists+xml": ["rl"], "application/resource-lists-diff+xml": ["rld"], "application/rls-services+xml": ["rs"], "application/route-apd+xml": ["rapd"], "application/route-s-tsid+xml": ["sls"], "application/route-usd+xml": ["rusd"], "application/rpki-ghostbusters": ["gbr"], "application/rpki-manifest": ["mft"], "application/rpki-roa": ["roa"], "application/rsd+xml": ["rsd"], "application/rss+xml": ["rss"], "application/rtf": ["rtf"], "application/sbml+xml": ["sbml"], "application/scvp-cv-request": ["scq"], "application/scvp-cv-response": ["scs"], "application/scvp-vp-request": ["spq"], "application/scvp-vp-response": ["spp"], "application/sdp": ["sdp"], "application/senml+xml": ["senmlx"], "application/sensml+xml": ["sensmlx"], "application/set-payment-initiation": ["setpay"], "application/set-registration-initiation": ["setreg"], "application/shf+xml": ["shf"], "application/sieve": ["siv", "sieve"], "application/smil+xml": ["smi", "smil"], "application/sparql-query": ["rq"], "application/sparql-results+xml": ["srx"], "application/srgs": ["gram"], "application/srgs+xml": ["grxml"], "application/sru+xml": ["sru"], "application/ssdl+xml": ["ssdl"], "application/ssml+xml": ["ssml"], "application/swid+xml": ["swidtag"], "application/tei+xml": ["tei", "teicorpus"], "application/thraud+xml": ["tfi"], "application/timestamped-data": ["tsd"], "application/toml": ["toml"], "application/trig": ["trig"], "application/ttml+xml": ["ttml"], "application/ubjson": ["ubj"], "application/urc-ressheet+xml": ["rsheet"], "application/urc-targetdesc+xml": ["td"], "application/voicexml+xml": ["vxml"], "application/wasm": ["wasm"], "application/widget": ["wgt"], "application/winhlp": ["hlp"], "application/wsdl+xml": ["wsdl"], "application/wspolicy+xml": ["wspolicy"], "application/xaml+xml": ["xaml"], "application/xcap-att+xml": ["xav"], "application/xcap-caps+xml": ["xca"], "application/xcap-diff+xml": ["xdf"], "application/xcap-el+xml": ["xel"], "application/xcap-ns+xml": ["xns"], "application/xenc+xml": ["xenc"], "application/xhtml+xml": ["xhtml", "xht"], "application/xliff+xml": ["xlf"], "application/xml": ["xml", "xsl", "xsd", "rng"], "application/xml-dtd": ["dtd"], "application/xop+xml": ["xop"], "application/xproc+xml": ["xpl"], "application/xslt+xml": ["*xsl", "xslt"], "application/xspf+xml": ["xspf"], "application/xv+xml": ["mxml", "xhvml", "xvml", "xvm"], "application/yang": ["yang"], "application/yin+xml": ["yin"], "application/zip": ["zip"], "audio/3gpp": ["*3gpp"], "audio/adpcm": ["adp"], "audio/amr": ["amr"], "audio/basic": ["au", "snd"], "audio/midi": ["mid", "midi", "kar", "rmi"], "audio/mobile-xmf": ["mxmf"], "audio/mp3": ["*mp3"], "audio/mp4": ["m4a", "mp4a"], "audio/mpeg": ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"], "audio/ogg": ["oga", "ogg", "spx", "opus"], "audio/s3m": ["s3m"], "audio/silk": ["sil"], "audio/wav": ["wav"], "audio/wave": ["*wav"], "audio/webm": ["weba"], "audio/xm": ["xm"], "font/collection": ["ttc"], "font/otf": ["otf"], "font/ttf": ["ttf"], "font/woff": ["woff"], "font/woff2": ["woff2"], "image/aces": ["exr"], "image/apng": ["apng"], "image/avif": ["avif"], "image/bmp": ["bmp"], "image/cgm": ["cgm"], "image/dicom-rle": ["drle"], "image/emf": ["emf"], "image/fits": ["fits"], "image/g3fax": ["g3"], "image/gif": ["gif"], "image/heic": ["heic"], "image/heic-sequence": ["heics"], "image/heif": ["heif"], "image/heif-sequence": ["heifs"], "image/hej2k": ["hej2"], "image/hsj2": ["hsj2"], "image/ief": ["ief"], "image/jls": ["jls"], "image/jp2": ["jp2", "jpg2"], "image/jpeg": ["jpeg", "jpg", "jpe"], "image/jph": ["jph"], "image/jphc": ["jhc"], "image/jpm": ["jpm"], "image/jpx": ["jpx", "jpf"], "image/jxr": ["jxr"], "image/jxra": ["jxra"], "image/jxrs": ["jxrs"], "image/jxs": ["jxs"], "image/jxsc": ["jxsc"], "image/jxsi": ["jxsi"], "image/jxss": ["jxss"], "image/ktx": ["ktx"], "image/ktx2": ["ktx2"], "image/png": ["png"], "image/sgi": ["sgi"], "image/svg+xml": ["svg", "svgz"], "image/t38": ["t38"], "image/tiff": ["tif", "tiff"], "image/tiff-fx": ["tfx"], "image/webp": ["webp"], "image/wmf": ["wmf"], "message/disposition-notification": ["disposition-notification"], "message/global": ["u8msg"], "message/global-delivery-status": ["u8dsn"], "message/global-disposition-notification": ["u8mdn"], "message/global-headers": ["u8hdr"], "message/rfc822": ["eml", "mime"], "model/3mf": ["3mf"], "model/gltf+json": ["gltf"], "model/gltf-binary": ["glb"], "model/iges": ["igs", "iges"], "model/mesh": ["msh", "mesh", "silo"], "model/mtl": ["mtl"], "model/obj": ["obj"], "model/step+xml": ["stpx"], "model/step+zip": ["stpz"], "model/step-xml+zip": ["stpxz"], "model/stl": ["stl"], "model/vrml": ["wrl", "vrml"], "model/x3d+binary": ["*x3db", "x3dbz"], "model/x3d+fastinfoset": ["x3db"], "model/x3d+vrml": ["*x3dv", "x3dvz"], "model/x3d+xml": ["x3d", "x3dz"], "model/x3d-vrml": ["x3dv"], "text/cache-manifest": ["appcache", "manifest"], "text/calendar": ["ics", "ifb"], "text/coffeescript": ["coffee", "litcoffee"], "text/css": ["css"], "text/csv": ["csv"], "text/html": ["html", "htm", "shtml"], "text/jade": ["jade"], "text/jsx": ["jsx"], "text/less": ["less"], "text/markdown": ["markdown", "md"], "text/mathml": ["mml"], "text/mdx": ["mdx"], "text/n3": ["n3"], "text/plain": ["txt", "text", "conf", "def", "list", "log", "in", "ini"], "text/richtext": ["rtx"], "text/rtf": ["*rtf"], "text/sgml": ["sgml", "sgm"], "text/shex": ["shex"], "text/slim": ["slim", "slm"], "text/spdx": ["spdx"], "text/stylus": ["stylus", "styl"], "text/tab-separated-values": ["tsv"], "text/troff": ["t", "tr", "roff", "man", "me", "ms"], "text/turtle": ["ttl"], "text/uri-list": ["uri", "uris", "urls"], "text/vcard": ["vcard"], "text/vtt": ["vtt"], "text/xml": ["*xml"], "text/yaml": ["yaml", "yml"], "video/3gpp": ["3gp", "3gpp"], "video/3gpp2": ["3g2"], "video/h261": ["h261"], "video/h263": ["h263"], "video/h264": ["h264"], "video/iso.segment": ["m4s"], "video/jpeg": ["jpgv"], "video/jpm": ["*jpm", "jpgm"], "video/mj2": ["mj2", "mjp2"], "video/mp2t": ["ts"], "video/mp4": ["mp4", "mp4v", "mpg4"], "video/mpeg": ["mpeg", "mpg", "mpe", "m1v", "m2v"], "video/ogg": ["ogv"], "video/quicktime": ["qt", "mov"], "video/webm": ["webm"] };
  }
});

// node_modules/mime/types/other.js
var require_other = __commonJS({
  "node_modules/mime/types/other.js"(exports2, module2) {
    module2.exports = { "application/prs.cww": ["cww"], "application/vnd.1000minds.decision-model+xml": ["1km"], "application/vnd.3gpp.pic-bw-large": ["plb"], "application/vnd.3gpp.pic-bw-small": ["psb"], "application/vnd.3gpp.pic-bw-var": ["pvb"], "application/vnd.3gpp2.tcap": ["tcap"], "application/vnd.3m.post-it-notes": ["pwn"], "application/vnd.accpac.simply.aso": ["aso"], "application/vnd.accpac.simply.imp": ["imp"], "application/vnd.acucobol": ["acu"], "application/vnd.acucorp": ["atc", "acutc"], "application/vnd.adobe.air-application-installer-package+zip": ["air"], "application/vnd.adobe.formscentral.fcdt": ["fcdt"], "application/vnd.adobe.fxp": ["fxp", "fxpl"], "application/vnd.adobe.xdp+xml": ["xdp"], "application/vnd.adobe.xfdf": ["xfdf"], "application/vnd.ahead.space": ["ahead"], "application/vnd.airzip.filesecure.azf": ["azf"], "application/vnd.airzip.filesecure.azs": ["azs"], "application/vnd.amazon.ebook": ["azw"], "application/vnd.americandynamics.acc": ["acc"], "application/vnd.amiga.ami": ["ami"], "application/vnd.android.package-archive": ["apk"], "application/vnd.anser-web-certificate-issue-initiation": ["cii"], "application/vnd.anser-web-funds-transfer-initiation": ["fti"], "application/vnd.antix.game-component": ["atx"], "application/vnd.apple.installer+xml": ["mpkg"], "application/vnd.apple.keynote": ["key"], "application/vnd.apple.mpegurl": ["m3u8"], "application/vnd.apple.numbers": ["numbers"], "application/vnd.apple.pages": ["pages"], "application/vnd.apple.pkpass": ["pkpass"], "application/vnd.aristanetworks.swi": ["swi"], "application/vnd.astraea-software.iota": ["iota"], "application/vnd.audiograph": ["aep"], "application/vnd.balsamiq.bmml+xml": ["bmml"], "application/vnd.blueice.multipass": ["mpm"], "application/vnd.bmi": ["bmi"], "application/vnd.businessobjects": ["rep"], "application/vnd.chemdraw+xml": ["cdxml"], "application/vnd.chipnuts.karaoke-mmd": ["mmd"], "application/vnd.cinderella": ["cdy"], "application/vnd.citationstyles.style+xml": ["csl"], "application/vnd.claymore": ["cla"], "application/vnd.cloanto.rp9": ["rp9"], "application/vnd.clonk.c4group": ["c4g", "c4d", "c4f", "c4p", "c4u"], "application/vnd.cluetrust.cartomobile-config": ["c11amc"], "application/vnd.cluetrust.cartomobile-config-pkg": ["c11amz"], "application/vnd.commonspace": ["csp"], "application/vnd.contact.cmsg": ["cdbcmsg"], "application/vnd.cosmocaller": ["cmc"], "application/vnd.crick.clicker": ["clkx"], "application/vnd.crick.clicker.keyboard": ["clkk"], "application/vnd.crick.clicker.palette": ["clkp"], "application/vnd.crick.clicker.template": ["clkt"], "application/vnd.crick.clicker.wordbank": ["clkw"], "application/vnd.criticaltools.wbs+xml": ["wbs"], "application/vnd.ctc-posml": ["pml"], "application/vnd.cups-ppd": ["ppd"], "application/vnd.curl.car": ["car"], "application/vnd.curl.pcurl": ["pcurl"], "application/vnd.dart": ["dart"], "application/vnd.data-vision.rdz": ["rdz"], "application/vnd.dbf": ["dbf"], "application/vnd.dece.data": ["uvf", "uvvf", "uvd", "uvvd"], "application/vnd.dece.ttml+xml": ["uvt", "uvvt"], "application/vnd.dece.unspecified": ["uvx", "uvvx"], "application/vnd.dece.zip": ["uvz", "uvvz"], "application/vnd.denovo.fcselayout-link": ["fe_launch"], "application/vnd.dna": ["dna"], "application/vnd.dolby.mlp": ["mlp"], "application/vnd.dpgraph": ["dpg"], "application/vnd.dreamfactory": ["dfac"], "application/vnd.ds-keypoint": ["kpxx"], "application/vnd.dvb.ait": ["ait"], "application/vnd.dvb.service": ["svc"], "application/vnd.dynageo": ["geo"], "application/vnd.ecowin.chart": ["mag"], "application/vnd.enliven": ["nml"], "application/vnd.epson.esf": ["esf"], "application/vnd.epson.msf": ["msf"], "application/vnd.epson.quickanime": ["qam"], "application/vnd.epson.salt": ["slt"], "application/vnd.epson.ssf": ["ssf"], "application/vnd.eszigno3+xml": ["es3", "et3"], "application/vnd.ezpix-album": ["ez2"], "application/vnd.ezpix-package": ["ez3"], "application/vnd.fdf": ["fdf"], "application/vnd.fdsn.mseed": ["mseed"], "application/vnd.fdsn.seed": ["seed", "dataless"], "application/vnd.flographit": ["gph"], "application/vnd.fluxtime.clip": ["ftc"], "application/vnd.framemaker": ["fm", "frame", "maker", "book"], "application/vnd.frogans.fnc": ["fnc"], "application/vnd.frogans.ltf": ["ltf"], "application/vnd.fsc.weblaunch": ["fsc"], "application/vnd.fujitsu.oasys": ["oas"], "application/vnd.fujitsu.oasys2": ["oa2"], "application/vnd.fujitsu.oasys3": ["oa3"], "application/vnd.fujitsu.oasysgp": ["fg5"], "application/vnd.fujitsu.oasysprs": ["bh2"], "application/vnd.fujixerox.ddd": ["ddd"], "application/vnd.fujixerox.docuworks": ["xdw"], "application/vnd.fujixerox.docuworks.binder": ["xbd"], "application/vnd.fuzzysheet": ["fzs"], "application/vnd.genomatix.tuxedo": ["txd"], "application/vnd.geogebra.file": ["ggb"], "application/vnd.geogebra.tool": ["ggt"], "application/vnd.geometry-explorer": ["gex", "gre"], "application/vnd.geonext": ["gxt"], "application/vnd.geoplan": ["g2w"], "application/vnd.geospace": ["g3w"], "application/vnd.gmx": ["gmx"], "application/vnd.google-apps.document": ["gdoc"], "application/vnd.google-apps.presentation": ["gslides"], "application/vnd.google-apps.spreadsheet": ["gsheet"], "application/vnd.google-earth.kml+xml": ["kml"], "application/vnd.google-earth.kmz": ["kmz"], "application/vnd.grafeq": ["gqf", "gqs"], "application/vnd.groove-account": ["gac"], "application/vnd.groove-help": ["ghf"], "application/vnd.groove-identity-message": ["gim"], "application/vnd.groove-injector": ["grv"], "application/vnd.groove-tool-message": ["gtm"], "application/vnd.groove-tool-template": ["tpl"], "application/vnd.groove-vcard": ["vcg"], "application/vnd.hal+xml": ["hal"], "application/vnd.handheld-entertainment+xml": ["zmm"], "application/vnd.hbci": ["hbci"], "application/vnd.hhe.lesson-player": ["les"], "application/vnd.hp-hpgl": ["hpgl"], "application/vnd.hp-hpid": ["hpid"], "application/vnd.hp-hps": ["hps"], "application/vnd.hp-jlyt": ["jlt"], "application/vnd.hp-pcl": ["pcl"], "application/vnd.hp-pclxl": ["pclxl"], "application/vnd.hydrostatix.sof-data": ["sfd-hdstx"], "application/vnd.ibm.minipay": ["mpy"], "application/vnd.ibm.modcap": ["afp", "listafp", "list3820"], "application/vnd.ibm.rights-management": ["irm"], "application/vnd.ibm.secure-container": ["sc"], "application/vnd.iccprofile": ["icc", "icm"], "application/vnd.igloader": ["igl"], "application/vnd.immervision-ivp": ["ivp"], "application/vnd.immervision-ivu": ["ivu"], "application/vnd.insors.igm": ["igm"], "application/vnd.intercon.formnet": ["xpw", "xpx"], "application/vnd.intergeo": ["i2g"], "application/vnd.intu.qbo": ["qbo"], "application/vnd.intu.qfx": ["qfx"], "application/vnd.ipunplugged.rcprofile": ["rcprofile"], "application/vnd.irepository.package+xml": ["irp"], "application/vnd.is-xpr": ["xpr"], "application/vnd.isac.fcs": ["fcs"], "application/vnd.jam": ["jam"], "application/vnd.jcp.javame.midlet-rms": ["rms"], "application/vnd.jisp": ["jisp"], "application/vnd.joost.joda-archive": ["joda"], "application/vnd.kahootz": ["ktz", "ktr"], "application/vnd.kde.karbon": ["karbon"], "application/vnd.kde.kchart": ["chrt"], "application/vnd.kde.kformula": ["kfo"], "application/vnd.kde.kivio": ["flw"], "application/vnd.kde.kontour": ["kon"], "application/vnd.kde.kpresenter": ["kpr", "kpt"], "application/vnd.kde.kspread": ["ksp"], "application/vnd.kde.kword": ["kwd", "kwt"], "application/vnd.kenameaapp": ["htke"], "application/vnd.kidspiration": ["kia"], "application/vnd.kinar": ["kne", "knp"], "application/vnd.koan": ["skp", "skd", "skt", "skm"], "application/vnd.kodak-descriptor": ["sse"], "application/vnd.las.las+xml": ["lasxml"], "application/vnd.llamagraphics.life-balance.desktop": ["lbd"], "application/vnd.llamagraphics.life-balance.exchange+xml": ["lbe"], "application/vnd.lotus-1-2-3": ["123"], "application/vnd.lotus-approach": ["apr"], "application/vnd.lotus-freelance": ["pre"], "application/vnd.lotus-notes": ["nsf"], "application/vnd.lotus-organizer": ["org"], "application/vnd.lotus-screencam": ["scm"], "application/vnd.lotus-wordpro": ["lwp"], "application/vnd.macports.portpkg": ["portpkg"], "application/vnd.mapbox-vector-tile": ["mvt"], "application/vnd.mcd": ["mcd"], "application/vnd.medcalcdata": ["mc1"], "application/vnd.mediastation.cdkey": ["cdkey"], "application/vnd.mfer": ["mwf"], "application/vnd.mfmp": ["mfm"], "application/vnd.micrografx.flo": ["flo"], "application/vnd.micrografx.igx": ["igx"], "application/vnd.mif": ["mif"], "application/vnd.mobius.daf": ["daf"], "application/vnd.mobius.dis": ["dis"], "application/vnd.mobius.mbk": ["mbk"], "application/vnd.mobius.mqy": ["mqy"], "application/vnd.mobius.msl": ["msl"], "application/vnd.mobius.plc": ["plc"], "application/vnd.mobius.txf": ["txf"], "application/vnd.mophun.application": ["mpn"], "application/vnd.mophun.certificate": ["mpc"], "application/vnd.mozilla.xul+xml": ["xul"], "application/vnd.ms-artgalry": ["cil"], "application/vnd.ms-cab-compressed": ["cab"], "application/vnd.ms-excel": ["xls", "xlm", "xla", "xlc", "xlt", "xlw"], "application/vnd.ms-excel.addin.macroenabled.12": ["xlam"], "application/vnd.ms-excel.sheet.binary.macroenabled.12": ["xlsb"], "application/vnd.ms-excel.sheet.macroenabled.12": ["xlsm"], "application/vnd.ms-excel.template.macroenabled.12": ["xltm"], "application/vnd.ms-fontobject": ["eot"], "application/vnd.ms-htmlhelp": ["chm"], "application/vnd.ms-ims": ["ims"], "application/vnd.ms-lrm": ["lrm"], "application/vnd.ms-officetheme": ["thmx"], "application/vnd.ms-outlook": ["msg"], "application/vnd.ms-pki.seccat": ["cat"], "application/vnd.ms-pki.stl": ["*stl"], "application/vnd.ms-powerpoint": ["ppt", "pps", "pot"], "application/vnd.ms-powerpoint.addin.macroenabled.12": ["ppam"], "application/vnd.ms-powerpoint.presentation.macroenabled.12": ["pptm"], "application/vnd.ms-powerpoint.slide.macroenabled.12": ["sldm"], "application/vnd.ms-powerpoint.slideshow.macroenabled.12": ["ppsm"], "application/vnd.ms-powerpoint.template.macroenabled.12": ["potm"], "application/vnd.ms-project": ["mpp", "mpt"], "application/vnd.ms-word.document.macroenabled.12": ["docm"], "application/vnd.ms-word.template.macroenabled.12": ["dotm"], "application/vnd.ms-works": ["wps", "wks", "wcm", "wdb"], "application/vnd.ms-wpl": ["wpl"], "application/vnd.ms-xpsdocument": ["xps"], "application/vnd.mseq": ["mseq"], "application/vnd.musician": ["mus"], "application/vnd.muvee.style": ["msty"], "application/vnd.mynfc": ["taglet"], "application/vnd.neurolanguage.nlu": ["nlu"], "application/vnd.nitf": ["ntf", "nitf"], "application/vnd.noblenet-directory": ["nnd"], "application/vnd.noblenet-sealer": ["nns"], "application/vnd.noblenet-web": ["nnw"], "application/vnd.nokia.n-gage.ac+xml": ["*ac"], "application/vnd.nokia.n-gage.data": ["ngdat"], "application/vnd.nokia.n-gage.symbian.install": ["n-gage"], "application/vnd.nokia.radio-preset": ["rpst"], "application/vnd.nokia.radio-presets": ["rpss"], "application/vnd.novadigm.edm": ["edm"], "application/vnd.novadigm.edx": ["edx"], "application/vnd.novadigm.ext": ["ext"], "application/vnd.oasis.opendocument.chart": ["odc"], "application/vnd.oasis.opendocument.chart-template": ["otc"], "application/vnd.oasis.opendocument.database": ["odb"], "application/vnd.oasis.opendocument.formula": ["odf"], "application/vnd.oasis.opendocument.formula-template": ["odft"], "application/vnd.oasis.opendocument.graphics": ["odg"], "application/vnd.oasis.opendocument.graphics-template": ["otg"], "application/vnd.oasis.opendocument.image": ["odi"], "application/vnd.oasis.opendocument.image-template": ["oti"], "application/vnd.oasis.opendocument.presentation": ["odp"], "application/vnd.oasis.opendocument.presentation-template": ["otp"], "application/vnd.oasis.opendocument.spreadsheet": ["ods"], "application/vnd.oasis.opendocument.spreadsheet-template": ["ots"], "application/vnd.oasis.opendocument.text": ["odt"], "application/vnd.oasis.opendocument.text-master": ["odm"], "application/vnd.oasis.opendocument.text-template": ["ott"], "application/vnd.oasis.opendocument.text-web": ["oth"], "application/vnd.olpc-sugar": ["xo"], "application/vnd.oma.dd2+xml": ["dd2"], "application/vnd.openblox.game+xml": ["obgx"], "application/vnd.openofficeorg.extension": ["oxt"], "application/vnd.openstreetmap.data+xml": ["osm"], "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"], "application/vnd.openxmlformats-officedocument.presentationml.slide": ["sldx"], "application/vnd.openxmlformats-officedocument.presentationml.slideshow": ["ppsx"], "application/vnd.openxmlformats-officedocument.presentationml.template": ["potx"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"], "application/vnd.openxmlformats-officedocument.spreadsheetml.template": ["xltx"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"], "application/vnd.openxmlformats-officedocument.wordprocessingml.template": ["dotx"], "application/vnd.osgeo.mapguide.package": ["mgp"], "application/vnd.osgi.dp": ["dp"], "application/vnd.osgi.subsystem": ["esa"], "application/vnd.palm": ["pdb", "pqa", "oprc"], "application/vnd.pawaafile": ["paw"], "application/vnd.pg.format": ["str"], "application/vnd.pg.osasli": ["ei6"], "application/vnd.picsel": ["efif"], "application/vnd.pmi.widget": ["wg"], "application/vnd.pocketlearn": ["plf"], "application/vnd.powerbuilder6": ["pbd"], "application/vnd.previewsystems.box": ["box"], "application/vnd.proteus.magazine": ["mgz"], "application/vnd.publishare-delta-tree": ["qps"], "application/vnd.pvi.ptid1": ["ptid"], "application/vnd.quark.quarkxpress": ["qxd", "qxt", "qwd", "qwt", "qxl", "qxb"], "application/vnd.rar": ["rar"], "application/vnd.realvnc.bed": ["bed"], "application/vnd.recordare.musicxml": ["mxl"], "application/vnd.recordare.musicxml+xml": ["musicxml"], "application/vnd.rig.cryptonote": ["cryptonote"], "application/vnd.rim.cod": ["cod"], "application/vnd.rn-realmedia": ["rm"], "application/vnd.rn-realmedia-vbr": ["rmvb"], "application/vnd.route66.link66+xml": ["link66"], "application/vnd.sailingtracker.track": ["st"], "application/vnd.seemail": ["see"], "application/vnd.sema": ["sema"], "application/vnd.semd": ["semd"], "application/vnd.semf": ["semf"], "application/vnd.shana.informed.formdata": ["ifm"], "application/vnd.shana.informed.formtemplate": ["itp"], "application/vnd.shana.informed.interchange": ["iif"], "application/vnd.shana.informed.package": ["ipk"], "application/vnd.simtech-mindmapper": ["twd", "twds"], "application/vnd.smaf": ["mmf"], "application/vnd.smart.teacher": ["teacher"], "application/vnd.software602.filler.form+xml": ["fo"], "application/vnd.solent.sdkm+xml": ["sdkm", "sdkd"], "application/vnd.spotfire.dxp": ["dxp"], "application/vnd.spotfire.sfs": ["sfs"], "application/vnd.stardivision.calc": ["sdc"], "application/vnd.stardivision.draw": ["sda"], "application/vnd.stardivision.impress": ["sdd"], "application/vnd.stardivision.math": ["smf"], "application/vnd.stardivision.writer": ["sdw", "vor"], "application/vnd.stardivision.writer-global": ["sgl"], "application/vnd.stepmania.package": ["smzip"], "application/vnd.stepmania.stepchart": ["sm"], "application/vnd.sun.wadl+xml": ["wadl"], "application/vnd.sun.xml.calc": ["sxc"], "application/vnd.sun.xml.calc.template": ["stc"], "application/vnd.sun.xml.draw": ["sxd"], "application/vnd.sun.xml.draw.template": ["std"], "application/vnd.sun.xml.impress": ["sxi"], "application/vnd.sun.xml.impress.template": ["sti"], "application/vnd.sun.xml.math": ["sxm"], "application/vnd.sun.xml.writer": ["sxw"], "application/vnd.sun.xml.writer.global": ["sxg"], "application/vnd.sun.xml.writer.template": ["stw"], "application/vnd.sus-calendar": ["sus", "susp"], "application/vnd.svd": ["svd"], "application/vnd.symbian.install": ["sis", "sisx"], "application/vnd.syncml+xml": ["xsm"], "application/vnd.syncml.dm+wbxml": ["bdm"], "application/vnd.syncml.dm+xml": ["xdm"], "application/vnd.syncml.dmddf+xml": ["ddf"], "application/vnd.tao.intent-module-archive": ["tao"], "application/vnd.tcpdump.pcap": ["pcap", "cap", "dmp"], "application/vnd.tmobile-livetv": ["tmo"], "application/vnd.trid.tpt": ["tpt"], "application/vnd.triscape.mxs": ["mxs"], "application/vnd.trueapp": ["tra"], "application/vnd.ufdl": ["ufd", "ufdl"], "application/vnd.uiq.theme": ["utz"], "application/vnd.umajin": ["umj"], "application/vnd.unity": ["unityweb"], "application/vnd.uoml+xml": ["uoml"], "application/vnd.vcx": ["vcx"], "application/vnd.visio": ["vsd", "vst", "vss", "vsw"], "application/vnd.visionary": ["vis"], "application/vnd.vsf": ["vsf"], "application/vnd.wap.wbxml": ["wbxml"], "application/vnd.wap.wmlc": ["wmlc"], "application/vnd.wap.wmlscriptc": ["wmlsc"], "application/vnd.webturbo": ["wtb"], "application/vnd.wolfram.player": ["nbp"], "application/vnd.wordperfect": ["wpd"], "application/vnd.wqd": ["wqd"], "application/vnd.wt.stf": ["stf"], "application/vnd.xara": ["xar"], "application/vnd.xfdl": ["xfdl"], "application/vnd.yamaha.hv-dic": ["hvd"], "application/vnd.yamaha.hv-script": ["hvs"], "application/vnd.yamaha.hv-voice": ["hvp"], "application/vnd.yamaha.openscoreformat": ["osf"], "application/vnd.yamaha.openscoreformat.osfpvg+xml": ["osfpvg"], "application/vnd.yamaha.smaf-audio": ["saf"], "application/vnd.yamaha.smaf-phrase": ["spf"], "application/vnd.yellowriver-custom-menu": ["cmp"], "application/vnd.zul": ["zir", "zirz"], "application/vnd.zzazz.deck+xml": ["zaz"], "application/x-7z-compressed": ["7z"], "application/x-abiword": ["abw"], "application/x-ace-compressed": ["ace"], "application/x-apple-diskimage": ["*dmg"], "application/x-arj": ["arj"], "application/x-authorware-bin": ["aab", "x32", "u32", "vox"], "application/x-authorware-map": ["aam"], "application/x-authorware-seg": ["aas"], "application/x-bcpio": ["bcpio"], "application/x-bdoc": ["*bdoc"], "application/x-bittorrent": ["torrent"], "application/x-blorb": ["blb", "blorb"], "application/x-bzip": ["bz"], "application/x-bzip2": ["bz2", "boz"], "application/x-cbr": ["cbr", "cba", "cbt", "cbz", "cb7"], "application/x-cdlink": ["vcd"], "application/x-cfs-compressed": ["cfs"], "application/x-chat": ["chat"], "application/x-chess-pgn": ["pgn"], "application/x-chrome-extension": ["crx"], "application/x-cocoa": ["cco"], "application/x-conference": ["nsc"], "application/x-cpio": ["cpio"], "application/x-csh": ["csh"], "application/x-debian-package": ["*deb", "udeb"], "application/x-dgc-compressed": ["dgc"], "application/x-director": ["dir", "dcr", "dxr", "cst", "cct", "cxt", "w3d", "fgd", "swa"], "application/x-doom": ["wad"], "application/x-dtbncx+xml": ["ncx"], "application/x-dtbook+xml": ["dtb"], "application/x-dtbresource+xml": ["res"], "application/x-dvi": ["dvi"], "application/x-envoy": ["evy"], "application/x-eva": ["eva"], "application/x-font-bdf": ["bdf"], "application/x-font-ghostscript": ["gsf"], "application/x-font-linux-psf": ["psf"], "application/x-font-pcf": ["pcf"], "application/x-font-snf": ["snf"], "application/x-font-type1": ["pfa", "pfb", "pfm", "afm"], "application/x-freearc": ["arc"], "application/x-futuresplash": ["spl"], "application/x-gca-compressed": ["gca"], "application/x-glulx": ["ulx"], "application/x-gnumeric": ["gnumeric"], "application/x-gramps-xml": ["gramps"], "application/x-gtar": ["gtar"], "application/x-hdf": ["hdf"], "application/x-httpd-php": ["php"], "application/x-install-instructions": ["install"], "application/x-iso9660-image": ["*iso"], "application/x-iwork-keynote-sffkey": ["*key"], "application/x-iwork-numbers-sffnumbers": ["*numbers"], "application/x-iwork-pages-sffpages": ["*pages"], "application/x-java-archive-diff": ["jardiff"], "application/x-java-jnlp-file": ["jnlp"], "application/x-keepass2": ["kdbx"], "application/x-latex": ["latex"], "application/x-lua-bytecode": ["luac"], "application/x-lzh-compressed": ["lzh", "lha"], "application/x-makeself": ["run"], "application/x-mie": ["mie"], "application/x-mobipocket-ebook": ["prc", "mobi"], "application/x-ms-application": ["application"], "application/x-ms-shortcut": ["lnk"], "application/x-ms-wmd": ["wmd"], "application/x-ms-wmz": ["wmz"], "application/x-ms-xbap": ["xbap"], "application/x-msaccess": ["mdb"], "application/x-msbinder": ["obd"], "application/x-mscardfile": ["crd"], "application/x-msclip": ["clp"], "application/x-msdos-program": ["*exe"], "application/x-msdownload": ["*exe", "*dll", "com", "bat", "*msi"], "application/x-msmediaview": ["mvb", "m13", "m14"], "application/x-msmetafile": ["*wmf", "*wmz", "*emf", "emz"], "application/x-msmoney": ["mny"], "application/x-mspublisher": ["pub"], "application/x-msschedule": ["scd"], "application/x-msterminal": ["trm"], "application/x-mswrite": ["wri"], "application/x-netcdf": ["nc", "cdf"], "application/x-ns-proxy-autoconfig": ["pac"], "application/x-nzb": ["nzb"], "application/x-perl": ["pl", "pm"], "application/x-pilot": ["*prc", "*pdb"], "application/x-pkcs12": ["p12", "pfx"], "application/x-pkcs7-certificates": ["p7b", "spc"], "application/x-pkcs7-certreqresp": ["p7r"], "application/x-rar-compressed": ["*rar"], "application/x-redhat-package-manager": ["rpm"], "application/x-research-info-systems": ["ris"], "application/x-sea": ["sea"], "application/x-sh": ["sh"], "application/x-shar": ["shar"], "application/x-shockwave-flash": ["swf"], "application/x-silverlight-app": ["xap"], "application/x-sql": ["sql"], "application/x-stuffit": ["sit"], "application/x-stuffitx": ["sitx"], "application/x-subrip": ["srt"], "application/x-sv4cpio": ["sv4cpio"], "application/x-sv4crc": ["sv4crc"], "application/x-t3vm-image": ["t3"], "application/x-tads": ["gam"], "application/x-tar": ["tar"], "application/x-tcl": ["tcl", "tk"], "application/x-tex": ["tex"], "application/x-tex-tfm": ["tfm"], "application/x-texinfo": ["texinfo", "texi"], "application/x-tgif": ["*obj"], "application/x-ustar": ["ustar"], "application/x-virtualbox-hdd": ["hdd"], "application/x-virtualbox-ova": ["ova"], "application/x-virtualbox-ovf": ["ovf"], "application/x-virtualbox-vbox": ["vbox"], "application/x-virtualbox-vbox-extpack": ["vbox-extpack"], "application/x-virtualbox-vdi": ["vdi"], "application/x-virtualbox-vhd": ["vhd"], "application/x-virtualbox-vmdk": ["vmdk"], "application/x-wais-source": ["src"], "application/x-web-app-manifest+json": ["webapp"], "application/x-x509-ca-cert": ["der", "crt", "pem"], "application/x-xfig": ["fig"], "application/x-xliff+xml": ["*xlf"], "application/x-xpinstall": ["xpi"], "application/x-xz": ["xz"], "application/x-zmachine": ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"], "audio/vnd.dece.audio": ["uva", "uvva"], "audio/vnd.digital-winds": ["eol"], "audio/vnd.dra": ["dra"], "audio/vnd.dts": ["dts"], "audio/vnd.dts.hd": ["dtshd"], "audio/vnd.lucent.voice": ["lvp"], "audio/vnd.ms-playready.media.pya": ["pya"], "audio/vnd.nuera.ecelp4800": ["ecelp4800"], "audio/vnd.nuera.ecelp7470": ["ecelp7470"], "audio/vnd.nuera.ecelp9600": ["ecelp9600"], "audio/vnd.rip": ["rip"], "audio/x-aac": ["aac"], "audio/x-aiff": ["aif", "aiff", "aifc"], "audio/x-caf": ["caf"], "audio/x-flac": ["flac"], "audio/x-m4a": ["*m4a"], "audio/x-matroska": ["mka"], "audio/x-mpegurl": ["m3u"], "audio/x-ms-wax": ["wax"], "audio/x-ms-wma": ["wma"], "audio/x-pn-realaudio": ["ram", "ra"], "audio/x-pn-realaudio-plugin": ["rmp"], "audio/x-realaudio": ["*ra"], "audio/x-wav": ["*wav"], "chemical/x-cdx": ["cdx"], "chemical/x-cif": ["cif"], "chemical/x-cmdf": ["cmdf"], "chemical/x-cml": ["cml"], "chemical/x-csml": ["csml"], "chemical/x-xyz": ["xyz"], "image/prs.btif": ["btif"], "image/prs.pti": ["pti"], "image/vnd.adobe.photoshop": ["psd"], "image/vnd.airzip.accelerator.azv": ["azv"], "image/vnd.dece.graphic": ["uvi", "uvvi", "uvg", "uvvg"], "image/vnd.djvu": ["djvu", "djv"], "image/vnd.dvb.subtitle": ["*sub"], "image/vnd.dwg": ["dwg"], "image/vnd.dxf": ["dxf"], "image/vnd.fastbidsheet": ["fbs"], "image/vnd.fpx": ["fpx"], "image/vnd.fst": ["fst"], "image/vnd.fujixerox.edmics-mmr": ["mmr"], "image/vnd.fujixerox.edmics-rlc": ["rlc"], "image/vnd.microsoft.icon": ["ico"], "image/vnd.ms-dds": ["dds"], "image/vnd.ms-modi": ["mdi"], "image/vnd.ms-photo": ["wdp"], "image/vnd.net-fpx": ["npx"], "image/vnd.pco.b16": ["b16"], "image/vnd.tencent.tap": ["tap"], "image/vnd.valve.source.texture": ["vtf"], "image/vnd.wap.wbmp": ["wbmp"], "image/vnd.xiff": ["xif"], "image/vnd.zbrush.pcx": ["pcx"], "image/x-3ds": ["3ds"], "image/x-cmu-raster": ["ras"], "image/x-cmx": ["cmx"], "image/x-freehand": ["fh", "fhc", "fh4", "fh5", "fh7"], "image/x-icon": ["*ico"], "image/x-jng": ["jng"], "image/x-mrsid-image": ["sid"], "image/x-ms-bmp": ["*bmp"], "image/x-pcx": ["*pcx"], "image/x-pict": ["pic", "pct"], "image/x-portable-anymap": ["pnm"], "image/x-portable-bitmap": ["pbm"], "image/x-portable-graymap": ["pgm"], "image/x-portable-pixmap": ["ppm"], "image/x-rgb": ["rgb"], "image/x-tga": ["tga"], "image/x-xbitmap": ["xbm"], "image/x-xpixmap": ["xpm"], "image/x-xwindowdump": ["xwd"], "message/vnd.wfa.wsc": ["wsc"], "model/vnd.collada+xml": ["dae"], "model/vnd.dwf": ["dwf"], "model/vnd.gdl": ["gdl"], "model/vnd.gtw": ["gtw"], "model/vnd.mts": ["mts"], "model/vnd.opengex": ["ogex"], "model/vnd.parasolid.transmit.binary": ["x_b"], "model/vnd.parasolid.transmit.text": ["x_t"], "model/vnd.sap.vds": ["vds"], "model/vnd.usdz+zip": ["usdz"], "model/vnd.valve.source.compiled-map": ["bsp"], "model/vnd.vtu": ["vtu"], "text/prs.lines.tag": ["dsc"], "text/vnd.curl": ["curl"], "text/vnd.curl.dcurl": ["dcurl"], "text/vnd.curl.mcurl": ["mcurl"], "text/vnd.curl.scurl": ["scurl"], "text/vnd.dvb.subtitle": ["sub"], "text/vnd.fly": ["fly"], "text/vnd.fmi.flexstor": ["flx"], "text/vnd.graphviz": ["gv"], "text/vnd.in3d.3dml": ["3dml"], "text/vnd.in3d.spot": ["spot"], "text/vnd.sun.j2me.app-descriptor": ["jad"], "text/vnd.wap.wml": ["wml"], "text/vnd.wap.wmlscript": ["wmls"], "text/x-asm": ["s", "asm"], "text/x-c": ["c", "cc", "cxx", "cpp", "h", "hh", "dic"], "text/x-component": ["htc"], "text/x-fortran": ["f", "for", "f77", "f90"], "text/x-handlebars-template": ["hbs"], "text/x-java-source": ["java"], "text/x-lua": ["lua"], "text/x-markdown": ["mkd"], "text/x-nfo": ["nfo"], "text/x-opml": ["opml"], "text/x-org": ["*org"], "text/x-pascal": ["p", "pas"], "text/x-processing": ["pde"], "text/x-sass": ["sass"], "text/x-scss": ["scss"], "text/x-setext": ["etx"], "text/x-sfv": ["sfv"], "text/x-suse-ymp": ["ymp"], "text/x-uuencode": ["uu"], "text/x-vcalendar": ["vcs"], "text/x-vcard": ["vcf"], "video/vnd.dece.hd": ["uvh", "uvvh"], "video/vnd.dece.mobile": ["uvm", "uvvm"], "video/vnd.dece.pd": ["uvp", "uvvp"], "video/vnd.dece.sd": ["uvs", "uvvs"], "video/vnd.dece.video": ["uvv", "uvvv"], "video/vnd.dvb.file": ["dvb"], "video/vnd.fvt": ["fvt"], "video/vnd.mpegurl": ["mxu", "m4u"], "video/vnd.ms-playready.media.pyv": ["pyv"], "video/vnd.uvvu.mp4": ["uvu", "uvvu"], "video/vnd.vivo": ["viv"], "video/x-f4v": ["f4v"], "video/x-fli": ["fli"], "video/x-flv": ["flv"], "video/x-m4v": ["m4v"], "video/x-matroska": ["mkv", "mk3d", "mks"], "video/x-mng": ["mng"], "video/x-ms-asf": ["asf", "asx"], "video/x-ms-vob": ["vob"], "video/x-ms-wm": ["wm"], "video/x-ms-wmv": ["wmv"], "video/x-ms-wmx": ["wmx"], "video/x-ms-wvx": ["wvx"], "video/x-msvideo": ["avi"], "video/x-sgi-movie": ["movie"], "video/x-smv": ["smv"], "x-conference/x-cooltalk": ["ice"] };
  }
});

// node_modules/mime/index.js
var require_mime = __commonJS({
  "node_modules/mime/index.js"(exports2, module2) {
    "use strict";
    var Mime = require_Mime();
    module2.exports = new Mime(require_standard(), require_other());
  }
});

// node_modules/@jupyterlite/contents/lib/tokens.js
var import_coreutils, import_mime, import_coreutils2, IContents, MIME, FILE, IBroadcastChannelWrapper;
var init_tokens = __esm({
  "node_modules/@jupyterlite/contents/lib/tokens.js"() {
    import_coreutils = __toESM(require_lib());
    import_mime = __toESM(require_mime());
    import_coreutils2 = __toESM(require_index_node());
    IContents = new import_coreutils2.Token("@jupyterlite/contents:IContents");
    (function(MIME2) {
      MIME2.JSON = "application/json";
      MIME2.PLAIN_TEXT = "text/plain";
      MIME2.OCTET_STREAM = "octet/stream";
    })(MIME || (MIME = {}));
    (function(FILE2) {
      const TYPES = JSON.parse(import_coreutils.PageConfig.getOption("fileTypes") || "{}");
      function getType(ext, defaultType = null) {
        ext = ext.toLowerCase();
        for (const fileType of Object.values(TYPES)) {
          for (const fileExt of fileType.extensions || []) {
            if (fileExt === ext && fileType.mimeTypes && fileType.mimeTypes.length) {
              return fileType.mimeTypes[0];
            }
          }
        }
        return import_mime.default.getType(ext) || defaultType || MIME.OCTET_STREAM;
      }
      FILE2.getType = getType;
      function hasFormat(ext, fileFormat) {
        ext = ext.toLowerCase();
        for (const fileType of Object.values(TYPES)) {
          if (fileType.fileFormat !== fileFormat) {
            continue;
          }
          for (const fileExt of fileType.extensions || []) {
            if (fileExt === ext) {
              return true;
            }
          }
        }
        return false;
      }
      FILE2.hasFormat = hasFormat;
    })(FILE || (FILE = {}));
    IBroadcastChannelWrapper = new import_coreutils2.Token("@jupyterlite/contents:IBroadcastChannelWrapper");
  }
});

// node_modules/@jupyterlite/contents/lib/contents.js
var import_coreutils3, import_coreutils4, import_coreutils5, DEFAULT_STORAGE_NAME, N_CHECKPOINTS, Contents, Private;
var init_contents = __esm({
  "node_modules/@jupyterlite/contents/lib/contents.js"() {
    import_coreutils3 = __toESM(require_lib());
    import_coreutils4 = __toESM(require_lib());
    init_tokens();
    import_coreutils5 = __toESM(require_index_node());
    DEFAULT_STORAGE_NAME = "JupyterLite Storage";
    N_CHECKPOINTS = 5;
    Contents = class {
      /**
       * Construct a new localForage-powered contents provider
       */
      constructor(options) {
        this.reduceBytesToString = (data, byte) => {
          return data + String.fromCharCode(byte);
        };
        this._serverContents = /* @__PURE__ */ new Map();
        this._storageName = DEFAULT_STORAGE_NAME;
        this._storageDrivers = null;
        this._localforage = options.localforage;
        this._storageName = options.storageName || DEFAULT_STORAGE_NAME;
        this._storageDrivers = options.storageDrivers || null;
        this._ready = new import_coreutils5.PromiseDelegate();
      }
      /**
       * Finish any initialization after server has started and all extensions are applied.
       */
      async initialize() {
        await this.initStorage();
        this._ready.resolve(void 0);
      }
      /**
       * Initialize all storage instances
       */
      async initStorage() {
        this._storage = this.createDefaultStorage();
        this._counters = this.createDefaultCounters();
        this._checkpoints = this.createDefaultCheckpoints();
      }
      /**
       * A promise that resolves once all storage is fully initialized.
       */
      get ready() {
        return this._ready.promise;
      }
      /**
       * A lazy reference to the underlying storage.
       */
      get storage() {
        return this.ready.then(() => this._storage);
      }
      /**
       * A lazy reference to the underlying counters.
       */
      get counters() {
        return this.ready.then(() => this._counters);
      }
      /**
       * A lazy reference to the underlying checkpoints.
       */
      get checkpoints() {
        return this.ready.then(() => this._checkpoints);
      }
      /**
       * Get default options for localForage instances
       */
      get defaultStorageOptions() {
        const driver = this._storageDrivers && this._storageDrivers.length ? this._storageDrivers : null;
        return {
          version: 1,
          name: this._storageName,
          ...driver ? { driver } : {}
        };
      }
      /**
       * Initialize the default storage for contents.
       */
      createDefaultStorage() {
        return this._localforage.createInstance({
          description: "Offline Storage for Notebooks and Files",
          storeName: "files",
          ...this.defaultStorageOptions
        });
      }
      /**
       * Initialize the default storage for counting file suffixes.
       */
      createDefaultCounters() {
        return this._localforage.createInstance({
          description: "Store the current file suffix counters",
          storeName: "counters",
          ...this.defaultStorageOptions
        });
      }
      /**
       * Create the default checkpoint storage.
       */
      createDefaultCheckpoints() {
        return this._localforage.createInstance({
          description: "Offline Storage for Checkpoints",
          storeName: "checkpoints",
          ...this.defaultStorageOptions
        });
      }
      /**
       * Create a new untitled file or directory in the specified directory path.
       *
       * @param options: The options used to create the file.
       *
       * @returns A promise which resolves with the created file content when the file is created.
       */
      async newUntitled(options) {
        var _a, _b, _c;
        const path2 = (_a = options === null || options === void 0 ? void 0 : options.path) !== null && _a !== void 0 ? _a : "";
        const type = (_b = options === null || options === void 0 ? void 0 : options.type) !== null && _b !== void 0 ? _b : "notebook";
        const created = (/* @__PURE__ */ new Date()).toISOString();
        let dirname = import_coreutils4.PathExt.dirname(path2);
        const basename = import_coreutils4.PathExt.basename(path2);
        const extname = import_coreutils4.PathExt.extname(path2);
        const item = await this.get(dirname);
        let name2 = "";
        if (path2 && !extname && item) {
          dirname = `${path2}/`;
          name2 = "";
        } else if (dirname && basename) {
          dirname = `${dirname}/`;
          name2 = basename;
        } else {
          dirname = "";
          name2 = path2;
        }
        let file;
        switch (type) {
          case "directory": {
            const counter = await this._incrementCounter("directory");
            name2 = `Untitled Folder${counter || ""}`;
            file = {
              name: name2,
              path: `${dirname}${name2}`,
              last_modified: created,
              created,
              format: "json",
              mimetype: "",
              content: null,
              size: 0,
              writable: true,
              type: "directory"
            };
            break;
          }
          case "notebook": {
            const counter = await this._incrementCounter("notebook");
            name2 = name2 || `Untitled${counter || ""}.ipynb`;
            file = {
              name: name2,
              path: `${dirname}${name2}`,
              last_modified: created,
              created,
              format: "json",
              mimetype: MIME.JSON,
              content: Private.EMPTY_NB,
              size: JSON.stringify(Private.EMPTY_NB).length,
              writable: true,
              type: "notebook"
            };
            break;
          }
          default: {
            const ext = (_c = options === null || options === void 0 ? void 0 : options.ext) !== null && _c !== void 0 ? _c : ".txt";
            const counter = await this._incrementCounter("file");
            const mimetype = FILE.getType(ext) || MIME.OCTET_STREAM;
            let format;
            if (FILE.hasFormat(ext, "text") || mimetype.indexOf("text") !== -1) {
              format = "text";
            } else if (ext.indexOf("json") !== -1 || ext.indexOf("ipynb") !== -1) {
              format = "json";
            } else {
              format = "base64";
            }
            name2 = name2 || `untitled${counter || ""}${ext}`;
            file = {
              name: name2,
              path: `${dirname}${name2}`,
              last_modified: created,
              created,
              format,
              mimetype,
              content: "",
              size: 0,
              writable: true,
              type: "file"
            };
            break;
          }
        }
        const key = file.path;
        await (await this.storage).setItem(key, file);
        return file;
      }
      /**
       * Copy a file into a given directory.
       *
       * @param path - The original file path.
       * @param toDir - The destination directory path.
       *
       * @returns A promise which resolves with the new contents model when the
       *  file is copied.
       *
       * #### Notes
       * The server will select the name of the copied file.
       */
      async copy(path2, toDir) {
        let name2 = import_coreutils4.PathExt.basename(path2);
        toDir = toDir === "" ? "" : `${toDir.slice(1)}/`;
        while (await this.get(`${toDir}${name2}`, { content: true })) {
          const ext = import_coreutils4.PathExt.extname(name2);
          const base = name2.replace(ext, "");
          name2 = `${base} (copy)${ext}`;
        }
        const toPath = `${toDir}${name2}`;
        let item = await this.get(path2, { content: true });
        if (!item) {
          throw Error(`Could not find file with path ${path2}`);
        }
        item = {
          ...item,
          name: name2,
          path: toPath
        };
        await (await this.storage).setItem(toPath, item);
        return item;
      }
      /**
       * Get a file or directory.
       *
       * @param path: The path to the file.
       * @param options: The options used to fetch the file.
       *
       * @returns A promise which resolves with the file content.
       */
      async get(path2, options) {
        path2 = decodeURIComponent(path2.replace(/^\//, ""));
        if (path2 === "") {
          return await this._getFolder(path2);
        }
        const storage = await this.storage;
        const item = await storage.getItem(path2);
        const serverItem = await this._getServerContents(path2, options);
        const model = item || serverItem;
        if (!model) {
          return null;
        }
        if (!(options === null || options === void 0 ? void 0 : options.content)) {
          return {
            size: 0,
            ...model,
            content: null
          };
        }
        if (model.type === "directory") {
          const contentMap = /* @__PURE__ */ new Map();
          await storage.iterate((file, key) => {
            if (key === `${path2}/${file.name}`) {
              contentMap.set(file.name, file);
            }
          });
          const serverContents = serverItem ? serverItem.content : Array.from((await this._getServerDirectory(path2)).values());
          for (const file of serverContents) {
            if (!contentMap.has(file.name)) {
              contentMap.set(file.name, file);
            }
          }
          const content = [...contentMap.values()];
          return {
            name: import_coreutils4.PathExt.basename(path2),
            path: path2,
            last_modified: model.last_modified,
            created: model.created,
            format: "json",
            mimetype: MIME.JSON,
            content,
            size: 0,
            writable: true,
            type: "directory"
          };
        }
        return model;
      }
      /**
       * Rename a file or directory.
       *
       * @param oldLocalPath - The original file path.
       * @param newLocalPath - The new file path.
       *
       * @returns A promise which resolves with the new file content model when the file is renamed.
       */
      async rename(oldLocalPath, newLocalPath) {
        const path2 = decodeURIComponent(oldLocalPath);
        const file = await this.get(path2, { content: true });
        if (!file) {
          throw Error(`Could not find file with path ${path2}`);
        }
        const modified = (/* @__PURE__ */ new Date()).toISOString();
        const name2 = import_coreutils4.PathExt.basename(newLocalPath);
        const newFile = {
          ...file,
          name: name2,
          path: newLocalPath,
          last_modified: modified
        };
        const storage = await this.storage;
        await storage.setItem(newLocalPath, newFile);
        await storage.removeItem(path2);
        await (await this.checkpoints).removeItem(path2);
        if (file.type === "directory") {
          let child;
          for (child of file.content) {
            await this.rename(import_coreutils3.URLExt.join(oldLocalPath, child.name), import_coreutils3.URLExt.join(newLocalPath, child.name));
          }
        }
        return newFile;
      }
      /**
       * Save a file.
       *
       * @param path - The desired file path.
       * @param options - Optional overrides to the model.
       *
       * @returns A promise which resolves with the file content model when the file is saved.
       */
      async save(path2, options = {}) {
        var _a;
        path2 = decodeURIComponent(path2);
        const ext = import_coreutils4.PathExt.extname((_a = options.name) !== null && _a !== void 0 ? _a : "");
        const chunk = options.chunk;
        const chunked = chunk ? chunk > 1 || chunk === -1 : false;
        let item = await this.get(path2, { content: chunked });
        if (!item) {
          item = await this.newUntitled({ path: path2, ext, type: "file" });
        }
        if (!item) {
          return null;
        }
        const originalContent = item.content;
        const modified = (/* @__PURE__ */ new Date()).toISOString();
        item = {
          ...item,
          ...options,
          last_modified: modified
        };
        if (options.content && options.format === "base64") {
          const lastChunk = chunk ? chunk === -1 : true;
          if (ext === ".ipynb") {
            const content = this._handleChunk(options.content, originalContent, chunked);
            item = {
              ...item,
              content: lastChunk ? JSON.parse(content) : content,
              format: "json",
              type: "notebook",
              size: content.length
            };
          } else if (FILE.hasFormat(ext, "json")) {
            const content = this._handleChunk(options.content, originalContent, chunked);
            item = {
              ...item,
              content: lastChunk ? JSON.parse(content) : content,
              format: "json",
              type: "file",
              size: content.length
            };
          } else if (FILE.hasFormat(ext, "text")) {
            const content = this._handleChunk(options.content, originalContent, chunked);
            item = {
              ...item,
              content,
              format: "text",
              type: "file",
              size: content.length
            };
          } else {
            const content = options.content;
            item = {
              ...item,
              content,
              size: atob(content).length
            };
          }
        }
        await (await this.storage).setItem(path2, item);
        return item;
      }
      /**
       * Delete a file from browser storage.
       *
       * Has no effect on server-backed files, which will re-appear with their
       * original timestamp.
       *
       * @param path - The path to the file.
       */
      async delete(path2) {
        path2 = decodeURIComponent(path2);
        const slashed = `${path2}/`;
        const toDelete = (await (await this.storage).keys()).filter((key) => key === path2 || key.startsWith(slashed));
        await Promise.all(toDelete.map(this.forgetPath, this));
      }
      /**
       * Remove the localForage and checkpoints for a path.
       *
       * @param path - The path to the file
       */
      async forgetPath(path2) {
        await Promise.all([
          (await this.storage).removeItem(path2),
          (await this.checkpoints).removeItem(path2)
        ]);
      }
      /**
       * Create a checkpoint for a file.
       *
       * @param path - The path of the file.
       *
       * @returns A promise which resolves with the new checkpoint model when the
       *   checkpoint is created.
       */
      async createCheckpoint(path2) {
        var _a;
        const checkpoints = await this.checkpoints;
        path2 = decodeURIComponent(path2);
        const item = await this.get(path2, { content: true });
        if (!item) {
          throw Error(`Could not find file with path ${path2}`);
        }
        const copies = ((_a = await checkpoints.getItem(path2)) !== null && _a !== void 0 ? _a : []).filter(Boolean);
        copies.push(item);
        if (copies.length > N_CHECKPOINTS) {
          copies.splice(0, copies.length - N_CHECKPOINTS);
        }
        await checkpoints.setItem(path2, copies);
        const id = `${copies.length - 1}`;
        return { id, last_modified: item.last_modified };
      }
      /**
       * List available checkpoints for a file.
       *
       * @param path - The path of the file.
       *
       * @returns A promise which resolves with a list of checkpoint models for
       *    the file.
       */
      async listCheckpoints(path2) {
        const copies = await (await this.checkpoints).getItem(path2) || [];
        return copies.filter(Boolean).map(this.normalizeCheckpoint, this);
      }
      normalizeCheckpoint(model, id) {
        return { id: id.toString(), last_modified: model.last_modified };
      }
      /**
       * Restore a file to a known checkpoint state.
       *
       * @param path - The path of the file.
       * @param checkpointID - The id of the checkpoint to restore.
       *
       * @returns A promise which resolves when the checkpoint is restored.
       */
      async restoreCheckpoint(path2, checkpointID) {
        path2 = decodeURIComponent(path2);
        const copies = await (await this.checkpoints).getItem(path2) || [];
        const id = parseInt(checkpointID);
        const item = copies[id];
        await (await this.storage).setItem(path2, item);
      }
      /**
       * Delete a checkpoint for a file.
       *
       * @param path - The path of the file.
       * @param checkpointID - The id of the checkpoint to delete.
       *
       * @returns A promise which resolves when the checkpoint is deleted.
       */
      async deleteCheckpoint(path2, checkpointID) {
        path2 = decodeURIComponent(path2);
        const copies = await (await this.checkpoints).getItem(path2) || [];
        const id = parseInt(checkpointID);
        copies.splice(id, 1);
        await (await this.checkpoints).setItem(path2, copies);
      }
      /**
       * Handle a chunk of a file.
       * Decode and unescape a base64-encoded string.
       * @param content the content to process
       *
       * @returns the decoded string, appended to the original content if chunked
       * /
       */
      _handleChunk(newContent, originalContent, chunked) {
        const escaped = decodeURIComponent(escape(atob(newContent)));
        const content = chunked ? originalContent + escaped : escaped;
        return content;
      }
      /**
       * retrieve the contents for this path from the union of local storage and
       * `api/contents/{path}/all.json`.
       *
       * @param path - The contents path to retrieve
       *
       * @returns A promise which resolves with a Map of contents, keyed by local file name
       */
      async _getFolder(path2) {
        const content = /* @__PURE__ */ new Map();
        const storage = await this.storage;
        await storage.iterate((file, key) => {
          if (key.includes("/")) {
            return;
          }
          content.set(file.path, file);
        });
        for (const file of (await this._getServerDirectory(path2)).values()) {
          if (!content.has(file.path)) {
            content.set(file.path, file);
          }
        }
        if (path2 && content.size === 0) {
          return null;
        }
        return {
          name: "",
          path: path2,
          last_modified: (/* @__PURE__ */ new Date(0)).toISOString(),
          created: (/* @__PURE__ */ new Date(0)).toISOString(),
          format: "json",
          mimetype: MIME.JSON,
          content: Array.from(content.values()),
          size: 0,
          writable: true,
          type: "directory"
        };
      }
      /**
       * Attempt to recover the model from `{:path}/__all__.json` file, fall back to
       * deriving the model (including content) off the file in `/files/`. Otherwise
       * return `null`.
       */
      async _getServerContents(path2, options) {
        const name2 = import_coreutils4.PathExt.basename(path2);
        const parentContents = await this._getServerDirectory(import_coreutils3.URLExt.join(path2, ".."));
        let model = parentContents.get(name2);
        if (!model) {
          return null;
        }
        model = model || {
          name: name2,
          path: path2,
          last_modified: (/* @__PURE__ */ new Date(0)).toISOString(),
          created: (/* @__PURE__ */ new Date(0)).toISOString(),
          format: "text",
          mimetype: MIME.PLAIN_TEXT,
          type: "file",
          writable: true,
          size: 0,
          content: ""
        };
        if (options === null || options === void 0 ? void 0 : options.content) {
          if (model.type === "directory") {
            const serverContents = await this._getServerDirectory(path2);
            model = { ...model, content: Array.from(serverContents.values()) };
          } else {
            const fileUrl = import_coreutils3.URLExt.join(import_coreutils3.PageConfig.getBaseUrl(), "files", path2);
            const response = await fetch(fileUrl);
            if (!response.ok) {
              return null;
            }
            const mimetype = model.mimetype || response.headers.get("Content-Type");
            const ext = import_coreutils4.PathExt.extname(name2);
            if (model.type === "notebook" || FILE.hasFormat(ext, "json") || (mimetype === null || mimetype === void 0 ? void 0 : mimetype.indexOf("json")) !== -1 || path2.match(/\.(ipynb|[^/]*json[^/]*)$/)) {
              const contentText = await response.text();
              model = {
                ...model,
                content: JSON.parse(contentText),
                format: "json",
                mimetype: model.mimetype || MIME.JSON,
                size: contentText.length
              };
            } else if (FILE.hasFormat(ext, "text") || mimetype.indexOf("text") !== -1) {
              const contentText = await response.text();
              model = {
                ...model,
                content: contentText,
                format: "text",
                mimetype: mimetype || MIME.PLAIN_TEXT,
                size: contentText.length
              };
            } else {
              const contentBytes = await response.arrayBuffer();
              const contentBuffer = new Uint8Array(contentBytes);
              model = {
                ...model,
                content: btoa(contentBuffer.reduce(this.reduceBytesToString, "")),
                format: "base64",
                mimetype: mimetype || MIME.OCTET_STREAM,
                size: contentBuffer.length
              };
            }
          }
        }
        return model;
      }
      /**
       * retrieve the contents for this path from `__index__.json` in the appropriate
       * folder.
       *
       * @param newLocalPath - The new file path.
       *
       * @returns A promise which resolves with a Map of contents, keyed by local file name
       */
      async _getServerDirectory(path2) {
        const content = this._serverContents.get(path2) || /* @__PURE__ */ new Map();
        if (!this._serverContents.has(path2)) {
          const apiURL = import_coreutils3.URLExt.join(import_coreutils3.PageConfig.getBaseUrl(), "api/contents", path2, "all.json");
          try {
            const response = await fetch(apiURL);
            const json = JSON.parse(await response.text());
            for (const file of json["content"]) {
              content.set(file.name, file);
            }
          } catch (err) {
            console.warn(`don't worry, about ${err}... nothing's broken. If there had been a
          file at ${apiURL}, you might see some more files.`);
          }
          this._serverContents.set(path2, content);
        }
        return content;
      }
      /**
       * Increment the counter for a given file type.
       * Used to avoid collisions when creating new untitled files.
       *
       * @param type The file type to increment the counter for.
       */
      async _incrementCounter(type) {
        var _a;
        const counters = await this.counters;
        const current = (_a = await counters.getItem(type)) !== null && _a !== void 0 ? _a : -1;
        const counter = current + 1;
        await counters.setItem(type, counter);
        return counter;
      }
    };
    (function(Private2) {
      Private2.EMPTY_NB = {
        metadata: {
          orig_nbformat: 4
        },
        nbformat_minor: 4,
        nbformat: 4,
        cells: []
      };
    })(Private || (Private = {}));
  }
});

// node_modules/@jupyterlite/contents/lib/emscripten.js
function instanceOfStream(nodeOrStream) {
  return "node" in nodeOrStream;
}
var DIR_MODE, FILE_MODE, SEEK_CUR, SEEK_END;
var init_emscripten = __esm({
  "node_modules/@jupyterlite/contents/lib/emscripten.js"() {
    DIR_MODE = 16895;
    FILE_MODE = 33206;
    SEEK_CUR = 1;
    SEEK_END = 2;
  }
});

// node_modules/@jupyterlite/contents/lib/drivefs.js
var DRIVE_SEPARATOR, DRIVE_API_PATH, BLOCK_SIZE, encoder, decoder, flagNeedsWrite, DriveFSEmscriptenStreamOps, DriveFSEmscriptenNodeOps, ContentsAPI, ServiceWorkerContentsAPI, DriveFS;
var init_drivefs = __esm({
  "node_modules/@jupyterlite/contents/lib/drivefs.js"() {
    init_emscripten();
    DRIVE_SEPARATOR = ":";
    DRIVE_API_PATH = "/api/drive.v1";
    BLOCK_SIZE = 4096;
    encoder = new TextEncoder();
    decoder = new TextDecoder("utf-8");
    flagNeedsWrite = {
      0: false,
      1: true,
      2: true,
      64: true,
      65: true,
      66: true,
      129: true,
      193: true,
      514: true,
      577: true,
      578: true,
      705: true,
      706: true,
      1024: true,
      1025: true,
      1026: true,
      1089: true,
      1090: true,
      1153: true,
      1154: true,
      1217: true,
      1218: true,
      4096: true,
      4098: true
    };
    DriveFSEmscriptenStreamOps = class {
      constructor(fs2) {
        this.fs = fs2;
      }
      open(stream) {
        const path2 = this.fs.realPath(stream.node);
        if (this.fs.FS.isFile(stream.node.mode)) {
          stream.file = this.fs.API.get(path2);
        }
      }
      close(stream) {
        if (!this.fs.FS.isFile(stream.node.mode) || !stream.file) {
          return;
        }
        const path2 = this.fs.realPath(stream.node);
        const flags = stream.flags;
        let parsedFlags = typeof flags === "string" ? parseInt(flags, 10) : flags;
        parsedFlags &= 8191;
        let needsWrite = true;
        if (parsedFlags in flagNeedsWrite) {
          needsWrite = flagNeedsWrite[parsedFlags];
        }
        if (needsWrite) {
          this.fs.API.put(path2, stream.file);
        }
        stream.file = void 0;
      }
      read(stream, buffer, offset, length, position) {
        if (length <= 0 || stream.file === void 0 || position >= (stream.file.data.length || 0)) {
          return 0;
        }
        const size = Math.min(stream.file.data.length - position, length);
        buffer.set(stream.file.data.subarray(position, position + size), offset);
        return size;
      }
      write(stream, buffer, offset, length, position) {
        var _a;
        if (length <= 0 || stream.file === void 0) {
          return 0;
        }
        stream.node.timestamp = Date.now();
        if (position + length > (((_a = stream.file) === null || _a === void 0 ? void 0 : _a.data.length) || 0)) {
          const oldData = stream.file.data ? stream.file.data : new Uint8Array();
          stream.file.data = new Uint8Array(position + length);
          stream.file.data.set(oldData);
        }
        stream.file.data.set(buffer.subarray(offset, offset + length), position);
        return length;
      }
      llseek(stream, offset, whence) {
        let position = offset;
        if (whence === SEEK_CUR) {
          position += stream.position;
        } else if (whence === SEEK_END) {
          if (this.fs.FS.isFile(stream.node.mode)) {
            if (stream.file !== void 0) {
              position += stream.file.data.length;
            } else {
              throw new this.fs.FS.ErrnoError(this.fs.ERRNO_CODES.EPERM);
            }
          }
        }
        if (position < 0) {
          throw new this.fs.FS.ErrnoError(this.fs.ERRNO_CODES.EINVAL);
        }
        return position;
      }
    };
    DriveFSEmscriptenNodeOps = class {
      constructor(fs2) {
        this.fs = fs2;
      }
      node(nodeOrStream) {
        if (instanceOfStream(nodeOrStream)) {
          return nodeOrStream.node;
        }
        return nodeOrStream;
      }
      getattr(value) {
        const node = this.node(value);
        return {
          ...this.fs.API.getattr(this.fs.realPath(node)),
          mode: node.mode,
          ino: node.id
        };
      }
      setattr(value, attr) {
        const node = this.node(value);
        for (const [key, value2] of Object.entries(attr)) {
          switch (key) {
            case "mode":
              node.mode = value2;
              break;
            case "timestamp":
              node.timestamp = value2;
              break;
            default:
              console.warn("setattr", key, "of", value2, "on", node, "not yet implemented");
              break;
          }
        }
      }
      lookup(parent, name2) {
        const node = this.node(parent);
        const path2 = this.fs.PATH.join2(this.fs.realPath(node), name2);
        const result = this.fs.API.lookup(path2);
        if (!result.ok) {
          throw this.fs.FS.genericErrors[this.fs.ERRNO_CODES["ENOENT"]];
        }
        return this.fs.createNode(node, name2, result.mode, 0);
      }
      mknod(parent, name2, mode, dev) {
        const node = this.node(parent);
        const path2 = this.fs.PATH.join2(this.fs.realPath(node), name2);
        this.fs.API.mknod(path2, mode);
        return this.fs.createNode(node, name2, mode, dev);
      }
      rename(value, newDir, newName) {
        const oldNode = this.node(value);
        const newDirNode = this.node(newDir);
        this.fs.API.rename(oldNode.parent ? this.fs.PATH.join2(this.fs.realPath(oldNode.parent), oldNode.name) : oldNode.name, this.fs.PATH.join2(this.fs.realPath(newDirNode), newName));
        oldNode.name = newName;
        oldNode.parent = newDirNode;
      }
      unlink(parent, name2) {
        this.fs.API.rmdir(this.fs.PATH.join2(this.fs.realPath(this.node(parent)), name2));
      }
      rmdir(parent, name2) {
        this.fs.API.rmdir(this.fs.PATH.join2(this.fs.realPath(this.node(parent)), name2));
      }
      readdir(value) {
        return this.fs.API.readdir(this.fs.realPath(this.node(value)));
      }
      symlink(parent, newName, oldPath) {
        throw new this.fs.FS.ErrnoError(this.fs.ERRNO_CODES["EPERM"]);
      }
      readlink(node) {
        throw new this.fs.FS.ErrnoError(this.fs.ERRNO_CODES["EPERM"]);
      }
    };
    ContentsAPI = class {
      constructor(driveName, mountpoint, FS, ERRNO_CODES) {
        this._driveName = driveName;
        this._mountpoint = mountpoint;
        this.FS = FS;
        this.ERRNO_CODES = ERRNO_CODES;
      }
      lookup(path2) {
        return this.request({ method: "lookup", path: this.normalizePath(path2) });
      }
      getmode(path2) {
        return this.request({ method: "getmode", path: this.normalizePath(path2) });
      }
      mknod(path2, mode) {
        return this.request({
          method: "mknod",
          path: this.normalizePath(path2),
          data: { mode }
        });
      }
      rename(oldPath, newPath) {
        return this.request({
          method: "rename",
          path: this.normalizePath(oldPath),
          data: { newPath: this.normalizePath(newPath) }
        });
      }
      readdir(path2) {
        const dirlist = this.request({
          method: "readdir",
          path: this.normalizePath(path2)
        });
        dirlist.push(".");
        dirlist.push("..");
        return dirlist;
      }
      rmdir(path2) {
        return this.request({ method: "rmdir", path: this.normalizePath(path2) });
      }
      get(path2) {
        const response = this.request({
          method: "get",
          path: this.normalizePath(path2)
        });
        if (!response) {
          throw new this.FS.ErrnoError(this.ERRNO_CODES["ENOENT"]);
        }
        const serializedContent = response.content;
        const format = response.format;
        switch (format) {
          case "json":
          case "text":
            return {
              data: encoder.encode(serializedContent),
              format
            };
          case "base64": {
            const binString = atob(serializedContent);
            const len = binString.length;
            const data = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              data[i] = binString.charCodeAt(i);
            }
            return {
              data,
              format
            };
          }
          default:
            throw new this.FS.ErrnoError(this.ERRNO_CODES["ENOENT"]);
        }
      }
      put(path2, value) {
        switch (value.format) {
          case "json":
          case "text":
            return this.request({
              method: "put",
              path: this.normalizePath(path2),
              data: {
                format: value.format,
                data: decoder.decode(value.data)
              }
            });
          case "base64": {
            let binary = "";
            for (let i = 0; i < value.data.byteLength; i++) {
              binary += String.fromCharCode(value.data[i]);
            }
            return this.request({
              method: "put",
              path: this.normalizePath(path2),
              data: {
                format: value.format,
                data: btoa(binary)
              }
            });
          }
        }
      }
      getattr(path2) {
        const stats = this.request({
          method: "getattr",
          path: this.normalizePath(path2)
        });
        if (stats.atime) {
          stats.atime = new Date(stats.atime);
        }
        if (stats.mtime) {
          stats.mtime = new Date(stats.mtime);
        }
        if (stats.ctime) {
          stats.ctime = new Date(stats.ctime);
        }
        stats.size = stats.size || 0;
        return stats;
      }
      /**
       * Normalize a Path by making it compliant for the content manager
       *
       * @param path: the path relatively to the Emscripten drive
       */
      normalizePath(path2) {
        if (path2.startsWith(this._mountpoint)) {
          path2 = path2.slice(this._mountpoint.length);
        }
        if (this._driveName) {
          path2 = `${this._driveName}${DRIVE_SEPARATOR}${path2}`;
        }
        return path2;
      }
    };
    ServiceWorkerContentsAPI = class extends ContentsAPI {
      constructor(baseUrl, driveName, mountpoint, FS, ERRNO_CODES) {
        super(driveName, mountpoint, FS, ERRNO_CODES);
        this._baseUrl = baseUrl;
      }
      request(data) {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", encodeURI(this.endpoint), false);
        try {
          xhr.send(JSON.stringify(data));
        } catch (e) {
          console.error(e);
        }
        if (xhr.status >= 400) {
          throw new this.FS.ErrnoError(this.ERRNO_CODES["EINVAL"]);
        }
        return JSON.parse(xhr.responseText);
      }
      /**
       * Get the api/drive endpoint
       */
      get endpoint() {
        return `${this._baseUrl}api/drive`;
      }
    };
    DriveFS = class {
      constructor(options) {
        this.FS = options.FS;
        this.PATH = options.PATH;
        this.ERRNO_CODES = options.ERRNO_CODES;
        this.API = this.createAPI(options);
        this.driveName = options.driveName;
        this.node_ops = new DriveFSEmscriptenNodeOps(this);
        this.stream_ops = new DriveFSEmscriptenStreamOps(this);
      }
      /**
       * Create the ContentsAPI.
       *
       * This is supposed to be overwritten if needed.
       */
      createAPI(options) {
        return new ServiceWorkerContentsAPI(options.baseUrl, options.driveName, options.mountpoint, options.FS, options.ERRNO_CODES);
      }
      mount(mount) {
        return this.createNode(null, mount.mountpoint, DIR_MODE | 511, 0);
      }
      createNode(parent, name2, mode, dev) {
        const FS = this.FS;
        if (!FS.isDir(mode) && !FS.isFile(mode)) {
          throw new FS.ErrnoError(this.ERRNO_CODES["EINVAL"]);
        }
        const node = FS.createNode(parent, name2, mode, dev);
        node.node_ops = this.node_ops;
        node.stream_ops = this.stream_ops;
        return node;
      }
      getMode(path2) {
        return this.API.getmode(path2);
      }
      realPath(node) {
        const parts = [];
        let currentNode = node;
        parts.push(currentNode.name);
        while (currentNode.parent !== currentNode) {
          currentNode = currentNode.parent;
          parts.push(currentNode.name);
        }
        parts.reverse();
        return this.PATH.join.apply(null, parts);
      }
    };
  }
});

// node_modules/@jupyterlite/contents/lib/drivecontents.js
var import_coreutils6, DriveContentsProcessor;
var init_drivecontents = __esm({
  "node_modules/@jupyterlite/contents/lib/drivecontents.js"() {
    import_coreutils6 = __toESM(require_lib());
    init_drivefs();
    init_emscripten();
    DriveContentsProcessor = class {
      constructor(options) {
        this.contentsManager = options.contentsManager;
      }
      async processDriveRequest(request) {
        switch (request.method) {
          case "readdir":
            return this.readdir(request);
          case "rmdir":
            return this.rmdir(request);
          case "rename":
            return this.rename(request);
          case "getmode":
            return this.getmode(request);
          case "lookup":
            return this.lookup(request);
          case "mknod":
            return this.mknod(request);
          case "getattr":
            return this.getattr(request);
          case "get":
            return this.get(request);
          case "put":
            return this.put(request);
        }
        throw `Drive request ${request.method} does not exist.`;
      }
      async readdir(request) {
        const model = await this.contentsManager.get(request.path, { content: true });
        let response = [];
        if (model.type === "directory" && model.content) {
          response = model.content.map((subcontent) => subcontent.name);
        }
        return response;
      }
      async rmdir(request) {
        await this.contentsManager.delete(request.path);
        return null;
      }
      async rename(request) {
        await this.contentsManager.rename(request.path, request.data.newPath);
        return null;
      }
      async getmode(request) {
        const model = await this.contentsManager.get(request.path);
        let response;
        if (model.type === "directory") {
          response = DIR_MODE;
        } else {
          response = FILE_MODE;
        }
        return response;
      }
      async lookup(request) {
        let response;
        try {
          const model = await this.contentsManager.get(request.path);
          response = {
            ok: true,
            mode: model.type === "directory" ? DIR_MODE : FILE_MODE
          };
        } catch (e) {
          response = { ok: false };
        }
        return response;
      }
      async mknod(request) {
        const model = await this.contentsManager.newUntitled({
          path: import_coreutils6.PathExt.dirname(request.path),
          type: request.data.mode === DIR_MODE ? "directory" : "file",
          ext: import_coreutils6.PathExt.extname(request.path)
        });
        await this.contentsManager.rename(model.path, request.path);
        return null;
      }
      async getattr(request) {
        const model = await this.contentsManager.get(request.path);
        const defaultDate = (/* @__PURE__ */ new Date(0)).toISOString();
        return {
          dev: 1,
          nlink: 1,
          uid: 0,
          gid: 0,
          rdev: 0,
          size: model.size || 0,
          blksize: BLOCK_SIZE,
          blocks: Math.ceil(model.size || 0 / BLOCK_SIZE),
          atime: model.last_modified || defaultDate,
          mtime: model.last_modified || defaultDate,
          ctime: model.created || defaultDate,
          timestamp: 0
        };
      }
      async get(request) {
        const model = await this.contentsManager.get(request.path, { content: true });
        let response;
        if (model.type !== "directory") {
          response = {
            content: model.format === "json" ? JSON.stringify(model.content) : model.content,
            format: model.format
          };
        }
        return response;
      }
      async put(request) {
        await this.contentsManager.save(request.path, {
          content: request.data.format === "json" ? JSON.parse(request.data.data) : request.data.data,
          type: "file",
          format: request.data.format
        });
        return null;
      }
    };
  }
});

// node_modules/@jupyterlite/contents/lib/broadcast.js
var BroadcastChannelWrapper;
var init_broadcast = __esm({
  "node_modules/@jupyterlite/contents/lib/broadcast.js"() {
    init_drivefs();
    init_drivecontents();
    BroadcastChannelWrapper = class {
      constructor(options) {
        this.isDisposed = false;
        this._onMessage = async (event) => {
          if (!this._channel) {
            return;
          }
          const request = event.data;
          const receiver = request === null || request === void 0 ? void 0 : request.receiver;
          if (receiver !== "broadcast.ts") {
            return;
          }
          const response = await this._driveContentsProcessor.processDriveRequest(request);
          this._channel.postMessage(response);
        };
        this._channel = null;
        this._enabled = false;
        this._contents = options.contents;
        this._driveContentsProcessor = new DriveContentsProcessor({
          contentsManager: this._contents
        });
      }
      get enabled() {
        return this._enabled;
      }
      enable() {
        if (this._channel) {
          console.warn("BroadcastChannel already created and enabled");
          return;
        }
        this._channel = new BroadcastChannel(DRIVE_API_PATH);
        this._channel.addEventListener("message", this._onMessage);
        this._enabled = true;
      }
      disable() {
        if (this._channel) {
          this._channel.removeEventListener("message", this._onMessage);
          this._channel = null;
        }
        this._enabled = false;
      }
      /** Clean up the broadcaster. */
      dispose() {
        if (this.isDisposed) {
          return;
        }
        this.disable();
        this.isDisposed = true;
      }
    };
  }
});

// node_modules/@jupyterlite/contents/lib/index.js
var lib_exports = {};
__export(lib_exports, {
  BLOCK_SIZE: () => BLOCK_SIZE,
  BroadcastChannelWrapper: () => BroadcastChannelWrapper,
  Contents: () => Contents,
  ContentsAPI: () => ContentsAPI,
  DIR_MODE: () => DIR_MODE,
  DRIVE_API_PATH: () => DRIVE_API_PATH,
  DRIVE_SEPARATOR: () => DRIVE_SEPARATOR,
  DriveContentsProcessor: () => DriveContentsProcessor,
  DriveFS: () => DriveFS,
  DriveFSEmscriptenNodeOps: () => DriveFSEmscriptenNodeOps,
  DriveFSEmscriptenStreamOps: () => DriveFSEmscriptenStreamOps,
  FILE: () => FILE,
  FILE_MODE: () => FILE_MODE,
  IBroadcastChannelWrapper: () => IBroadcastChannelWrapper,
  IContents: () => IContents,
  MIME: () => MIME,
  SEEK_CUR: () => SEEK_CUR,
  SEEK_END: () => SEEK_END,
  ServiceWorkerContentsAPI: () => ServiceWorkerContentsAPI,
  instanceOfStream: () => instanceOfStream
});
var init_lib = __esm({
  "node_modules/@jupyterlite/contents/lib/index.js"() {
    init_contents();
    init_drivefs();
    init_tokens();
    init_broadcast();
    init_emscripten();
    init_drivecontents();
  }
});

// node_modules/comlink/dist/umd/node-adapter.js
var require_node_adapter = __commonJS({
  "node_modules/comlink/dist/umd/node-adapter.js"(exports2, module2) {
    (function(global2, factory) {
      typeof exports2 === "object" && typeof module2 !== "undefined" ? module2.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self, global2.Comlink = factory());
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

// src/node/comlink.worker.ts
var comlink_worker_exports = {};
__export(comlink_worker_exports, {
  PyodideComlinkKernel: () => PyodideComlinkKernel
});
module.exports = __toCommonJS(comlink_worker_exports);
var import_comlink = __toESM(require_comlink());

// src/common/worker.ts
var fs = __toESM(require("fs"));
var PyodideRemoteKernel = class {
  constructor(syncMessaging) {
    this.syncMessaging = syncMessaging;
    /**
     * Initialization options.
     */
    this._options = null;
    this._initializer = null;
    this._pyodide = null;
    /** TODO: real typing */
    this._localPath = "";
    this._driveName = "";
    this._driveFS = null;
    this._sendWorkerMessage = () => {
    };
    this._initialized = new Promise((resolve, reject) => {
      this._initializer = { resolve, reject };
    });
  }
  /**
   * Accept the URLs from the host
   **/
  async initialize(options) {
    this._options = options;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      console.log(`xxFetch ${JSON.stringify(input)} with ${JSON.stringify(init)}`);
      if (typeof input === "string" && input.endsWith("/pypi/all.json")) {
        const contents = fs.readFileSync("/Users/donjayamanne/Downloads/package6.1/pypi/all.json");
        return new Response(contents, { status: 200, statusText: "OK" });
      }
      return originalFetch(input, init);
    };
    if (options.location.includes(":")) {
      const parts = options.location.split(":");
      this._driveName = parts[0];
      this._localPath = parts[1];
    } else {
      this._driveName = "";
      this._localPath = options.location;
    }
    await this.initRuntime(options);
    await this.initFilesystem(options);
    await this.initPackageManager(options);
    await this.initKernel(options);
    await this.initGlobals(options);
    this._initializer?.resolve();
  }
  async initRuntime(options) {
    const { pyodideUrl, indexUrl } = options;
    const pyodideModule = await import(
      /* webpackIgnore: true */
      pyodideUrl
    );
    const loadPyodide = pyodideModule.loadPyodide || pyodideModule.default.loadPyodide;
    this._pyodide = await loadPyodide({
      indexURL: indexUrl,
      // packageCacheDir: '/Users/donjayamanne/Downloads/cache',
      fullStdLib: true,
      // ...options.loadPyodideOptions,
      stdout(msg) {
        console.log(msg);
      },
      stdin: () => {
        return "";
      }
    });
  }
  async initPackageManager(_options) {
    if (!this._options) {
      throw new Error("Uninitialized");
    }
    const { pipliteWheelUrl, disablePyPIFallback, pipliteUrls, loadPyodideOptions } = this._options;
    const preloaded = (loadPyodideOptions || {}).packages || [];
    if (!preloaded.includes("micropip")) {
      await this._pyodide.loadPackage(["micropip"]);
    }
    if (!preloaded.includes("piplite")) {
      await this._pyodide.runPythonAsync(`
      import micropip
      await micropip.install('${pipliteWheelUrl}', keep_going=True)
    `);
    }
    await this._pyodide.runPythonAsync(`
      import piplite.piplite
      piplite.piplite._PIPLITE_DISABLE_PYPI = ${disablePyPIFallback ? "True" : "False"}
      piplite.piplite._PIPLITE_URLS = ${JSON.stringify(pipliteUrls)}
    `);
  }
  async initKernel(options) {
    const preloaded = (options.loadPyodideOptions || {}).packages || [];
    const toLoad = ["ssl", "sqlite3", "ipykernel", "comm", "pyodide_kernel", "ipython"];
    const scriptLines = [];
    for (const pkgName of toLoad) {
      if (!preloaded.includes(pkgName)) {
        scriptLines.push(`await piplite.install('${pkgName}', keep_going=True)`);
      }
    }
    scriptLines.push("import pyodide_kernel");
    if (options.mountDrive && this._localPath) {
      scriptLines.push("import os", `os.chdir("${this._localPath}")`);
    }
    await this._pyodide.runPythonAsync(scriptLines.join("\n"));
  }
  async initGlobals(_options) {
    const { globals } = this._pyodide;
    this._kernel = globals.get("pyodide_kernel").kernel_instance.copy();
    this._stdout_stream = globals.get("pyodide_kernel").stdout_stream.copy();
    this._stderr_stream = globals.get("pyodide_kernel").stderr_stream.copy();
    this._interpreter = this._kernel.interpreter.copy();
    this._interpreter.send_comm = this.sendComm.bind(this);
  }
  /**
   * Setup custom Emscripten FileSystem
   */
  async initFilesystem(options) {
    if (options.mountDrive) {
      const mountpoint = "/drive";
      const { FS, PATH, ERRNO_CODES } = this._pyodide;
      const { baseUrl } = options;
      const { DriveFS: DriveFS2 } = await Promise.resolve().then(() => (init_lib(), lib_exports));
      const driveFS = new DriveFS2({
        FS,
        PATH,
        ERRNO_CODES,
        baseUrl,
        driveName: this._driveName,
        mountpoint
      });
      FS.mkdir(mountpoint);
      FS.mount(driveFS, {}, mountpoint);
      FS.chdir(mountpoint);
      this._driveFS = driveFS;
    }
  }
  /**
   * Recursively convert a Map to a JavaScript object
   * @param obj A Map, Array, or other  object to convert
   */
  mapToObject(obj) {
    const out = obj instanceof Array ? [] : {};
    obj.forEach((value, key) => {
      out[key] = value instanceof Map || value instanceof Array ? this.mapToObject(value) : value;
    });
    return out;
  }
  /**
   * Format the response from the Pyodide evaluation.
   *
   * @param res The result object from the Pyodide evaluation
   */
  formatResult(res) {
    if (!(res instanceof this._pyodide.ffi.PyProxy)) {
      return res;
    }
    const m = res.toJs();
    const results = this.mapToObject(m);
    return results;
  }
  /**
   * Register the callback function to send messages from the worker back to the main thread.
   * @param callback the callback to register
   */
  registerCallback(callback) {
    this._sendWorkerMessage = callback;
  }
  /**
   * Makes sure pyodide is ready before continuing, and cache the parent message.
   */
  async setup(parent) {
    await this._initialized;
    this._kernel._parent_header = this._pyodide.toPy(parent);
  }
  /**
   * Execute code with the interpreter.
   *
   * @param content The incoming message with the code to execute.
   */
  async execute(content, parent) {
    await this.setup(parent);
    const publishExecutionResult = (prompt_count, data, metadata) => {
      const bundle = {
        execution_count: prompt_count,
        data: this.formatResult(data),
        metadata: this.formatResult(metadata)
      };
      this._sendWorkerMessage({
        parentHeader: this.formatResult(this._kernel._parent_header)["header"],
        bundle,
        type: "execute_result"
      });
    };
    const publishExecutionError = (ename, evalue, traceback) => {
      const bundle = {
        ename,
        evalue,
        traceback
      };
      this._sendWorkerMessage({
        parentHeader: this.formatResult(this._kernel._parent_header)["header"],
        bundle,
        type: "execute_error"
      });
    };
    const clearOutputCallback = (wait) => {
      const bundle = {
        wait: this.formatResult(wait)
      };
      this._sendWorkerMessage({
        parentHeader: this.formatResult(this._kernel._parent_header)["header"],
        bundle,
        type: "clear_output"
      });
    };
    const displayDataCallback = (data, metadata, transient) => {
      const bundle = {
        data: this.formatResult(data),
        metadata: this.formatResult(metadata),
        transient: this.formatResult(transient)
      };
      this._sendWorkerMessage({
        parentHeader: this.formatResult(this._kernel._parent_header)["header"],
        bundle,
        type: "display_data"
      });
    };
    const updateDisplayDataCallback = (data, metadata, transient) => {
      const bundle = {
        data: this.formatResult(data),
        metadata: this.formatResult(metadata),
        transient: this.formatResult(transient)
      };
      this._sendWorkerMessage({
        parentHeader: this.formatResult(this._kernel._parent_header)["header"],
        bundle,
        type: "update_display_data"
      });
    };
    const publishStreamCallback = (name2, text) => {
      const bundle = {
        name: this.formatResult(name2),
        text: this.formatResult(text)
      };
      this._sendWorkerMessage({
        parentHeader: this.formatResult(this._kernel._parent_header)["header"],
        bundle,
        type: "stream"
      });
    };
    this._stdout_stream.publish_stream_callback = publishStreamCallback;
    this._stderr_stream.publish_stream_callback = publishStreamCallback;
    this._interpreter.display_pub.clear_output_callback = clearOutputCallback;
    this._interpreter.display_pub.display_data_callback = displayDataCallback;
    this._interpreter.display_pub.update_display_data_callback = updateDisplayDataCallback;
    this._interpreter.displayhook.publish_execution_result = publishExecutionResult;
    this._interpreter.input = this.input.bind(this);
    this._interpreter.getpass = this.getpass.bind(this);
    const res = await this._kernel.run(content.code);
    const results = this.formatResult(res);
    if (results["status"] === "error") {
      publishExecutionError(results["ename"], results["evalue"], results["traceback"]);
    }
    return results;
  }
  /**
   * Complete the code submitted by a user.
   *
   * @param content The incoming message with the code to complete.
   */
  async complete(content, parent) {
    await this.setup(parent);
    const res = this._kernel.complete(content.code, content.cursor_pos);
    const results = this.formatResult(res);
    return results;
  }
  /**
   * Inspect the code submitted by a user.
   *
   * @param content The incoming message with the code to inspect.
   */
  async inspect(content, parent) {
    await this.setup(parent);
    const res = this._kernel.inspect(content.code, content.cursor_pos, content.detail_level);
    const results = this.formatResult(res);
    return results;
  }
  /**
   * Check code for completeness submitted by a user.
   *
   * @param content The incoming message with the code to check.
   */
  async isComplete(content, parent) {
    await this.setup(parent);
    const res = this._kernel.is_complete(content.code);
    const results = this.formatResult(res);
    return results;
  }
  /**
   * Respond to the commInfoRequest.
   *
   * @param content The incoming message with the comm target name.
   */
  async commInfo(content, parent) {
    await this.setup(parent);
    const res = this._kernel.comm_info(content.target_name);
    const results = this.formatResult(res);
    return {
      comms: results,
      status: "ok"
    };
  }
  /**
   * Respond to the commOpen.
   *
   * @param content The incoming message with the comm open.
   */
  async commOpen(content, parent) {
    await this.setup(parent);
    const res = this._kernel.comm_manager.comm_open(
      this._pyodide.toPy(null),
      this._pyodide.toPy(null),
      this._pyodide.toPy(content)
    );
    const results = this.formatResult(res);
    return results;
  }
  /**
   * Respond to the commMsg.
   *
   * @param content The incoming message with the comm msg.
   */
  async commMsg(content, parent) {
    await this.setup(parent);
    const res = this._kernel.comm_manager.comm_msg(
      this._pyodide.toPy(null),
      this._pyodide.toPy(null),
      this._pyodide.toPy(content)
    );
    const results = this.formatResult(res);
    return results;
  }
  /**
   * Respond to the commClose.
   *
   * @param content The incoming message with the comm close.
   */
  async commClose(content, parent) {
    await this.setup(parent);
    const res = this._kernel.comm_manager.comm_close(
      this._pyodide.toPy(null),
      this._pyodide.toPy(null),
      this._pyodide.toPy(content)
    );
    const results = this.formatResult(res);
    return results;
  }
  /**
   * Resolve the input request by getting back the reply from the main thread
   *
   * @param content The incoming message with the reply
   */
  async inputReply(content, parent) {
    await this.setup(parent);
    this._resolveInputReply(content);
  }
  /**
   * Send a input request to the front-end.
   *
   * @param prompt the text to show at the prompt
   * @param password Is the request for a password?
   */
  async sendInputRequest(prompt, password) {
    const content = {
      prompt,
      password
    };
    this._sendWorkerMessage({
      type: "input_request",
      parentHeader: this.formatResult(this._kernel._parent_header)["header"],
      content
    });
  }
  async getpass(prompt) {
    prompt = typeof prompt === "undefined" ? "" : prompt;
    await this.sendInputRequest(prompt, true);
    const replyPromise = new Promise((resolve) => {
      this._resolveInputReply = resolve;
    });
    const result = await replyPromise;
    return result["value"];
  }
  // async input(prompt: string) {
  //   prompt = typeof prompt === 'undefined' ? '' : prompt;
  //   await this.sendInputRequest(prompt, false);
  //   const replyPromise = new Promise((resolve) => {
  //     this._resolveInputReply = resolve;
  //   });
  //   const result: any = await replyPromise;
  //   return result['value'];
  // }
  input(prompt) {
    prompt = typeof prompt === "undefined" ? "" : prompt;
    void this.sendInputRequest(prompt, false);
    return this.syncMessaging.wait();
  }
  /**
   * Send a comm message to the front-end.
   *
   * @param type The type of the comm message.
   * @param content The content.
   * @param metadata The metadata.
   * @param ident The ident.
   * @param buffers The binary buffers.
   */
  async sendComm(type, content, metadata, ident, buffers) {
    this._sendWorkerMessage({
      type,
      content: this.formatResult(content),
      metadata: this.formatResult(metadata),
      ident: this.formatResult(ident),
      buffers: this.formatResult(buffers),
      parentHeader: this.formatResult(this._kernel._parent_header)["header"]
    });
  }
};

// src/node/comlink.worker.ts
var import_node_adapter = __toESM(require_node_adapter());
var import_worker_threads = require("worker_threads");

// src/common/syncMessagingWorker.ts
var RES_SIZE = 256;
var decoder2 = new TextDecoder("utf8");
var decodeBuffer = new Uint8Array(RES_SIZE);
var SyncMessaging = class {
  constructor({
    sharedCtrlBuffer,
    sharedValueBuffer
  }) {
    this.ctrlBuffer = new Int32Array(sharedCtrlBuffer);
    this.valueBuffer = new Int32Array(sharedValueBuffer);
  }
  wait() {
    const length = this.ctrlWait();
    for (let i = 0; i < length; i++) {
      decodeBuffer[i] = Atomics.load(this.valueBuffer, i);
    }
    const res = decoder2.decode(decodeBuffer.slice(0, length));
    console.error("wait", res);
    return res;
  }
  ctrlWait() {
    Atomics.store(this.ctrlBuffer, 0, 0);
    Atomics.wait(this.ctrlBuffer, 0, 0);
    return this.ctrlBuffer[0];
  }
};

// src/node/comlink.worker.ts
var PyodideComlinkKernel = class extends PyodideRemoteKernel {
  /**
   * Setup custom Emscripten FileSystem
   */
  async initFilesystem(options) {
    if (options.mountDrive && this._localPath) {
      const { FS } = this._pyodide;
      const mountDir = this._localPath;
      FS.mkdirTree(mountDir);
      FS.mount(FS.filesystems.NODEFS, { root: mountDir }, mountDir);
      this._driveFS = FS.filesystems.NODEFS;
    }
  }
};
import_worker_threads.parentPort.once("message", (msg) => {
  const worker = new PyodideComlinkKernel(new SyncMessaging(msg));
  (0, import_comlink.expose)(worker, (0, import_node_adapter.default)(import_worker_threads.parentPort));
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PyodideComlinkKernel
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
//# sourceMappingURL=comlink.worker.js.map
