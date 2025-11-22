import { isObject } from '@vue/shared'
import { mutableHandlers } from './baseHandlers'

export function reactive(target) {
  return createReactiveObject(target)
}

/**
 * 保存 target 和 响应式对象之间的关联关系
 * target => proxy
 */
const reactiveMap = new WeakMap()

/**
 * 保存所有使用 reactive 创建出来的响应式对象
 */
const reactiveSet = new WeakSet()

function createReactiveObject(target) {
  /**
   * reactive 必须接受一个对象
   */
  if (!isObject(target)) {
    /**
     * target 不是一个对象，哪儿来的回哪儿去
     */
    return target
  }

  /**
   * 看一下这个 target 在不在 reactiveSet 里面，如果在，就证明 target 是响应式的，直接返回
   */
  if (reactiveSet.has(target)) {
    return target
  }

  /**
   * 获取到之前这个 target 创建的代理对象
   */
  const existingProxy = reactiveMap.get(target)

  if (existingProxy) {
    /**
     * 如果这个 target 之前使用 reactive 创建过响应式对象，那就直接返回这个响应式对象
     */
    return existingProxy
  }

  /**
   * 创建 target 的代理对象
   */
  const proxy = new Proxy(target, mutableHandlers)

  /**
   * 保存 target 和 proxy 之间的关联关系
   * target => proxy
   */
  reactiveMap.set(target, proxy)

  // 保存响应式对象到 reactiveSet
  reactiveSet.add(proxy)
  return proxy
}

/**
 * 判断 target 是不是响应式对象，只要在 reactiveSet 中，它就是响应式的
 */
export function isReactive(target) {
  return reactiveSet.has(target)
}
