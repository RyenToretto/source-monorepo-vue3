import { ShapeFlags } from '@vue/shared'

export function initSlots(instance) {
  const { slots, vnode } = instance
  if (vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    // 组件的子元素是
    const { children } = vnode
    /**
     * children = {header:()=> h('div','hello world') }
     * slots = {}
     */
    for (const key in children) {
      slots[key] = children[key]
    }
  }
}

export function updateSlots(instance, vnode) {
  const { slots } = instance

  if (vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    // 组件的子元素是插槽

    // 组件的子元素是
    const { children } = vnode
    /**
     * 将最新的全部更新到 slots 中
     * children = { default:()=> h('div','hello world') }
     * slots = { header:()=> h('div','hello world'), footer:()=> h('div','hello world') }
     */
    for (const key in children) {
      slots[key] = children[key]
    }

    /**
     * 把之前 slots 有的，现在没有的，删掉
     * slots = { header:()=> h('div','hello world'), footer:()=> h('div','hello world') }
     * children = { default:()=> h('div','hello world') }
     */
    for (const key in slots) {
      if (children[key] == null) {
        delete slots[key]
      }
    }
  }
}
