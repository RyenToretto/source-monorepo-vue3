import {
  getCurrentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from './component'

export enum LifecycleHooks {
  // 挂载 instance.bm
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',

  // 更新
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',

  // 卸载
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um',
}

function createHook(type) {
  return (hook, target = getCurrentInstance()) => {
    injectHook(target, hook, type)
  }
}

/**
 * 注入生命周期
 * @param target 当前组件的实例
 * @param hook 用户传递的回调函数
 * @param type 生命周期的类型 bm um
 */
function injectHook(target, hook, type) {
  // 如果一开始 instance[type] 没有值，我们给它个数组
  if (target[type] == null) {
    target[type] = []
  }
  // 将 hook 放到数组里面去
  target[type].push(hook)
}

// 挂载
export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
// 更新
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)
// 卸载
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)

/**
 * 触发生命周期钩子
 * @param instance 当前组件的实例
 * @param type 生命周期的类型 bm m bu bum
 */
export function triggerHooks(instance, type) {
  // 拿到生命周期 instance.bm => [fn1,fn2]
  const hooks = instance[type]

  if (hooks) {
    // 执行之前，设置 currentInstance
    setCurrentInstance(instance)
    // 如果有，依次执行
    try {
      hooks.forEach(hook => hook())
    } finally {
      // 执行完了，清除 currentInstance
      unsetCurrentInstance()
    }
  }
}
