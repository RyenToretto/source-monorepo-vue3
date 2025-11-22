import { hasOwn, isArray, ShapeFlags } from '@vue/shared'
import { reactive } from '@vue/reactivity'

export function normalizePropsOptions(props = {}) {
  /**
   * 要把数组转换成对象
   */

  if (isArray(props)) {
    /**
     * 把数组转换成对象
     * ['msg','count']
     * =>
     * { msg:true, count:true }
     */
    return props.reduce((prev, cur) => {
      prev[cur] = {}

      return prev
    }, {})
  }

  return props
}

/**
 * 设置所有的 props attrs
 */
function setFullProps(instance, rawProps, props, attrs) {
  const { propsOptions, vnode } = instance
  // 看一下是不是函数式组件
  const isFunctionalComponent =
    vnode.shapeFlag & ShapeFlags.FUNCTIONAL_COMPONENT
  const hasProps = Object.keys(propsOptions).length > 0
  if (rawProps) {
    /**
     * 函数式组件：
     * 如果没声明 props，那所有的属性，就都是 props => (isFunctionalComponent && !hasProps)
     * 如果声明了 props，和有状态的组件一致
     */
    for (const key in rawProps) {
      const value = rawProps[key]
      if (hasOwn(propsOptions, key) || (isFunctionalComponent && !hasProps)) {
        // 如果 propsOptions 里面有这个 key，应该放到 props 里面
        props[key] = value
      } else {
        // 否则就是 attrs 里面的
        attrs[key] = value
      }
    }
  }
}

export function initProps(instance) {
  const { vnode } = instance
  const rawProps = vnode.props

  const props = {}
  const attrs = {}
  setFullProps(instance, rawProps, props, attrs)
  // props 是响应式的，所以需要 reactive
  instance.props = reactive(props)
  // attrs 不是响应式的
  instance.attrs = attrs
}

/**
 * 更新组件的属性
 */
export function updateProps(instance, nextVNode) {
  const { props, attrs } = instance
  /**
   * props = {msg:'hello',age:0}
   * rawProps = {age:0}
   */
  const rawProps = nextVNode.props

  /**
   * 设置所有的
   */
  setFullProps(instance, rawProps, props, attrs)

  /**
   * props = {msg:'hello',age:0}
   * rawProps = {age:0}
   * 删除之前有，现在没有的
   */
  for (const key in props) {
    if (!hasOwn(rawProps, key)) {
      delete props[key]
    }
  }

  /**
   * props = {msg:'hello',age:0}
   * rawProps = {age:0}
   * 删除之前有，现在没有的
   */
  for (const key in attrs) {
    if (!hasOwn(rawProps, key)) {
      delete attrs[key]
    }
  }
}
