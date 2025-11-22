import { isRef } from '@vue/reactivity'
import { isString, ShapeFlags } from '@vue/shared'
import { getComponentPublicInstance } from './component'

export function setRef(ref, vnode) {
  const { r: rawRef, i: instance } = ref
  if (vnode == null) {
    // 卸载了，要清除
    if (isRef(rawRef)) {
      // 如果是 ref，就给它设置成 null
      rawRef.value = null
    } else if (isString(rawRef)) {
      // 字符串 修改 refs[key] = null
      instance.refs[rawRef] = null
    }

    return
  }

  const { shapeFlag } = vnode
  if (isRef(rawRef)) {
    // 如果 ref 是一个 响应式的 Ref

    if (shapeFlag & ShapeFlags.COMPONENT) {
      // vnode 是一个组件类型
      rawRef.value = getComponentPublicInstance(vnode.component)
    } else {
      // vnode 是一个 DOM 元素类型
      rawRef.value = vnode.el
    }
  } else if (isString(rawRef)) {
    // 把 vnode.el 绑定到 instance.$refs[ref] 上面
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 组件
      instance.refs[rawRef] = getComponentPublicInstance(vnode.component)
    } else {
      // DOM 元素
      instance.refs[rawRef] = vnode.el
    }
  }
}
