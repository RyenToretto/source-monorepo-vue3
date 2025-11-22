import { getCurrentInstance } from './component'

export function provide(key, value) {
  /**
   * count => 0
   */

  /**
   * 首次调用的时候，instance.provides 应该等于 parent.provides
   */
  const instance = getCurrentInstance()
  // 拿到父组件的 provides，如果父组件没有，证明是 根组件，我们应该拿 appContext.provides
  const parentProvides = instance.parent
    ? instance.parent.provides
    : instance.appContext.provides
  // 自己的 provides
  let provides = instance.provides
  if (provides === parentProvides) {
    // 在此之前，我是没有打算给我的后代留任何遗产的，我自己的钱本来都花光了
    // 但是突然中了彩票，这个时候就有点零花的了，要不就留给后代一点吧，这些里面包含我爸留给我的
    instance.provides = Object.create(parentProvides)
    provides = instance.provides
  }

  // 设置属性到 provides 上
  provides[key] = value
}

export function inject(key, defaultValue) {
  const instance = getCurrentInstance()
  // 拿到父组件的 provides，如果父组件没有，证明是 根组件，我们应该拿 appContext.provides
  const parentProvides = instance.parent
    ? instance.parent.provides
    : instance.appContext.provides

  if (key in parentProvides) {
    // 如果父组件的 provides 上面有这个 key，那就返回
    return parentProvides[key]
  }
  // 如果没有，返回默认值
  return defaultValue
}
