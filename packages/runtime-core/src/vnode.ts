import {
  isArray,
  isFunction,
  isNumber,
  isObject,
  isString,
  ShapeFlags,
} from '@vue/shared'
import { getCurrentRenderingInstance } from './component'
import { isTeleport } from './components/Teleport'
import { isRef } from '@vue/reactivity'

/**
 * 文本节点标记
 */
export const Text = Symbol('v-txt')

export const Fragment = Symbol('Fragment')

export function isSameVNodeType(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key
}

export function normalizeVNode(vnode) {
  if (isString(vnode) || isNumber(vnode)) {
    // 如果是 string 或者 number 转换成文本节点

    return createVNode(Text, null, String(vnode))
  }

  return vnode
}

/**
 * 判断是不是一个虚拟节点，根据 __v_isVNode 属性
 * @param value
 */
export function isVNode(value) {
  return value?.__v_isVNode
}

/**
 * 标准化 children
 */
function normalizeChildren(vnode, children) {
  let { shapeFlag } = vnode
  if (isArray(children)) {
    /**
     * children = [h('p','hello'),h('p','world')]
     */
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN
  } else if (isObject(children)) {
    /**
     * 对象
     * children = {header:()=>h('div','hello world')}
     */
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 如果是个组件，那就是插槽
      shapeFlag |= ShapeFlags.SLOTS_CHILDREN
    }
  } else if (isFunction(children)) {
    /**
     * children = ()=> h('div','hello world')
     */
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 如果是个组件，那就是插槽
      shapeFlag |= ShapeFlags.SLOTS_CHILDREN
      children = { default: children }
    }
  } else if (isNumber(children) || isString(children)) {
    // 如果 children 是 number 给它转换成字符串
    children = String(children)
    shapeFlag |= ShapeFlags.TEXT_CHILDREN
  }

  /**
   * 处理完了重新赋值 shapeFlag 和 children
   */
  vnode.shapeFlag = shapeFlag
  vnode.children = children
  return children
}

function normalizeRef(ref) {
  if (ref == null) return
  return {
    // 原始的 ref
    r: ref,
    // 当前正在渲染的组件实例
    i: getCurrentRenderingInstance(),
  }
}

/**
 * 创建虚拟节点的底层方法
 * @param type 节点类型
 * @param props 节点的属性
 * @param children 子节点
 * @param patchFlag 更新标记
 * @param isBlock 表示是不是一个块
 */
export function createVNode(
  type,
  props?,
  children = null,
  patchFlag = 0,
  isBlock = false,
) {
  let shapeFlag = 0

  //region 处理 type 的 shapeFlag
  if (isString(type)) {
    // div span p h1
    shapeFlag = ShapeFlags.ELEMENT
  } else if (isTeleport(type)) {
    // Teleport 组件
    shapeFlag = ShapeFlags.TELEPORT
  } else if (isObject(type)) {
    // 有状态的组件
    shapeFlag = ShapeFlags.STATEFUL_COMPONENT
  } else if (isFunction(type)) {
    // 函数式组件
    shapeFlag = ShapeFlags.FUNCTIONAL_COMPONENT
  }
  //endregion

  const vnode = {
    // 证明我是一个虚拟节点
    __v_isVNode: true,
    // div p span
    type,
    props,
    // hello world
    children: null,
    // 做 diff 用的
    key: props?.key,
    // 虚拟节点要挂载的元素
    el: null,
    dynamicChildren: null,
    shapeFlag,
    // 绑定 ref
    ref: normalizeRef(props?.ref),
    appContext: null,
    patchFlag,
  }

  if (patchFlag > 0 && currentBlock && !isBlock) {
    // currentBlock 有，并且这个 vnode 是动态的
    currentBlock.push(vnode)
  }

  /**
   * children 的标准化和 children 的 shapeFlag 给 normalizeChildren 处理
   */
  normalizeChildren(vnode, children)

  return vnode
}

const blockStack = []

// 当前正在收集的块
let currentBlock = null

export function openBlock() {
  currentBlock = []
  // 入栈
  blockStack.push(currentBlock)
}

function closeBlock() {
  // 出栈
  blockStack.pop()
  // 拿栈中的最后一个，给到 currentBlock
  currentBlock = blockStack.at(-1)
}

function setupBlock(vnode) {
  // 把收集到的动态节点，放到 vnode 上面去
  vnode.dynamicChildren = currentBlock
  closeBlock()
  if (currentBlock) {
    // 把当前 vnode 块，放到它的父级块上
    currentBlock.push(vnode)
  }
}

export function createElementBlock(type, props?, children?, patchFlag?) {
  const vnode = createVNode(type, props, children, patchFlag, true)

  setupBlock(vnode)
  // 这里还有别的事情
  return vnode
}

export function renderList(list, cb) {
  return list.map(cb)
}

/**
 * 把输入的 val 转换成字符串
 */
export function toDisplayString(val) {
  if (isString(val)) return val
  if (val == null) return ''
  if (isRef(val)) {
    return val.value
  }

  if (typeof val === 'object') {
    return JSON.stringify(val)
  }

  return String(val)
}
