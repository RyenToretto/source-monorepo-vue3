import {
  setCurrentRenderingInstance,
  unsetCurrentRenderingInstance,
} from './component'
import { ShapeFlags } from '@vue/shared'

function hasPropsChanged(prevProps, nextProps) {
  const nextKeys = Object.keys(nextProps)
  /**
   * prevProps = { msg:'hello', count:0 } 2
   * nextProps = { msg:'hello' } 1
   */
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }

  /**
   * prevProps = { msg:'hello', count:0 }
   * nextProps = { msg:'hello', count:1 }
   */
  for (const key of nextKeys) {
    if (nextProps[key] !== prevProps[key]) {
      return true
    }
  }
  /**
   * 遍历完了，全部一致，不需要更新
   */
  return false
}

export function shouldUpdateComponent(n1, n2) {
  const { props: prevProps, children: prevChildren } = n1
  const { props: nextProps, children: nextChildren } = n2

  /**
   * 任意一个有插槽，就需要更新
   */
  if (prevChildren || nextChildren) {
    return true
  }

  if (!prevProps) {
    // 老的没有，新的有，需要更新
    // 老的没有，新的也没有，不需要更新
    return !!nextProps
  }

  if (!nextProps) {
    // 老的有，新的没有，需要更新
    return true
  }

  /**
   * 老的有，新的也有
   */
  return hasPropsChanged(prevProps, nextProps)
}

export function renderComponentRoot(instance) {
  const { vnode } = instance
  if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    // 有状态的组件
    // render 之前设置组件实例
    setCurrentRenderingInstance(instance)
    const subTree = instance.render.call(instance.proxy)
    // render 调用完了，清空
    unsetCurrentRenderingInstance()
    return subTree
  } else {
    // 函数式组件
    return vnode.type(instance.props, {
      get attrs() {
        return instance.attrs
      },
      slots: instance.slots,
      emit: instance.emit,
    })
  }
}
