import { track, trigger } from './dep'
import { isRef } from './ref'
import { hasChanged, isObject } from '@vue/shared'
import { reactive } from './reactive'

export const mutableHandlers = {
  get(target, key, receiver) {
    /**
     * target = { a:0 }
     * 收集依赖，绑定 target 中某一个 key 和 sub 之间的关系
     */
    track(target, key)

    const res = Reflect.get(target, key, receiver)

    if (isRef(res)) {
      /**
       * target = {a:ref(0)}
       * 如果target.a 是一个 ref，那么就直接把值给它，不要让它 .value
       */
      return res.value
    }

    if (isObject(res)) {
      /**
       * 如果 res 是一个对象，那么我就给它包装成 reactive
       */
      return reactive(res)
    }

    /**
     * receiver 用来保证 访问器里面的 this 指向代理对象
     */
    return res
  },
  set(target, key, newValue, receiver) {
    const oldValue = target[key]

    //region 为了处理隐式更新数组的 length
    const targetIsArray = Array.isArray(target)
    const oldLength = targetIsArray ? target.length : 0
    //endregion

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

    /**
     * 触发更新，set 的时候，通知之前收集的依赖，重新执行
     */
    const res = Reflect.set(target, key, newValue, receiver)

    if (hasChanged(newValue, oldValue)) {
      /**
       * 如果新值和老值不一样，触发更新
       * 先 set 再通知 sub 重新执行
       */
      trigger(target, key)
    }

    //region 处理隐式更新数组的 length
    const newLength = targetIsArray ? target.length : 0
    if (targetIsArray && newLength !== oldLength && key !== 'length') {
      /**
       * 隐式更新 length
       * 更新前：length = 4 => ['a', 'b', 'c', 'd']
       * 更新后：length = 5 => ['a', 'b', 'c', 'd', 'e']
       * 更新动作，以 push 为例，追加了一个 e
       * 隐式更新 length 的方法：push pop shift unshift
       *
       * 如何知道 隐式更新了 length
       */
      trigger(target, 'length')
    }
    //endregion

    return res
  },
}
