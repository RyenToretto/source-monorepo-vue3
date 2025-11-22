import { activeSub } from './effect'
import { Dependency, Link, link, propagate } from './system'
import { hasChanged, isObject } from '@vue/shared'
import { reactive } from './reactive'

export enum ReactiveFlags {
  IS_REF = '__v_isRef',
}

/**
 * Ref 的类
 */
class RefImpl implements Dependency {
  // 保存实际的值
  _value;
  // ref 标记，证明是一个 ref
  [ReactiveFlags.IS_REF] = true

  /**
   * 订阅者链表的头节点，理解为我们将的 head
   */
  subs: Link

  /**
   * 订阅者链表的尾节点，理解为我们讲的 tail
   */
  subsTail: Link

  constructor(value) {
    /**
     * 如果 value 是一个对象，那么我们使用 reactive 给它搞成响应式对象
     */
    this._value = isObject(value) ? reactive(value) : value
  }

  get value() {
    // 收集依赖
    if (activeSub) {
      trackRef(this)
    }
    return this._value
  }

  set value(newValue) {
    if (hasChanged(newValue, this._value)) {
      // 只有在 值发生变化之后，才触发更新
      // 触发更新
      this._value = isObject(newValue) ? reactive(newValue) : newValue
      triggerRef(this)
    }
  }
}

export function ref(value) {
  return new RefImpl(value)
}

/**
 * 判断是不是一个 ref
 * @param value
 */
export function isRef(value) {
  return !!(value && value[ReactiveFlags.IS_REF])
}

/**
 * 收集依赖，建立 ref 和 effect 之间的链表关系
 * @param dep
 */
export function trackRef(dep) {
  if (activeSub) {
    link(dep, activeSub)
  }
}

/**
 * 触发 ref 关联的 effect 重新执行
 * @param dep
 */
export function triggerRef(dep) {
  if (dep.subs) {
    propagate(dep.subs)
  }
}

class ObjectRefImpl {
  [ReactiveFlags.IS_REF] = true
  constructor(
    public _object,
    public _key,
  ) {}

  get value() {
    return this._object[this._key]
  }

  set value(newVal) {
    this._object[this._key] = newVal
  }
}

export function toRef(target, key) {
  return new ObjectRefImpl(target, key)
}

export function toRefs(target) {
  const res = {}

  for (const key in target) {
    res[key] = new ObjectRefImpl(target, key)
  }

  return res // name => ObjectRefImpl, age => ObjectRefImpl
}

export function unref(value) {
  return isRef(value) ? value.value : value
}

export function proxyRefs(target) {
  return new Proxy(target, {
    get(...args) {
      /**
       * 自动解包 ref
       * 如果这个 target[key] 是一个 ref，那就返回 ref.value，否则返回 target[key]
       */

      const res = Reflect.get(...args)

      return unref(res)
    },
    set(target, key, newValue, receiver) {
      const oldValue = target[key]
      /**
       * 如果更新了 state.a 它之前是个 ref，那么会修改原始的 ref.value 的值 等于 newValue
       * 如果 newValue 是一个 ref，那就算了
       */
      if (isRef(oldValue) && !isRef(newValue)) {
        /**
         * const a = ref(0)
         * target = { a }
         * 更新 target.a = 1 ，它就等于更新了 a.value
         * a.value = 1
         */
        oldValue.value = newValue
        return true
      }

      return Reflect.set(target, key, newValue, receiver)
    },
  })
}
