import { PatchFlags, ShapeFlags } from '@vue/shared'
import { Fragment, isSameVNodeType, normalizeVNode, Text } from './vnode'
import { createAppAPI } from './apiCreateApp'
import { createComponentInstance, setupComponent } from './component'
import { ReactiveEffect } from '@vue/reactivity'
import { queueJob } from './scheduler'
import {
  renderComponentRoot,
  shouldUpdateComponent,
} from './componentRenderUtils'
import { updateProps } from './componentProps'
import { updateSlots } from './componentSlots'
import { LifecycleHooks, triggerHooks } from './apiLifecycle'
import { setRef } from './renderTemplateRef'
import { isKeepAlive } from './components/KeepAlive'

export function createRenderer(options) {
  // 提供虚拟节点 渲染到页面上的功能

  const {
    createElement: hostCreateElement,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText,
    createText: hostCreateText,
    setText: hostSetText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    patchProp: hostPatchProp,
  } = options

  // 卸载子元素
  const unmountChildren = children => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i])
    }
  }

  const unmountComponent = instance => {
    /**
     * 卸载前，触发 beforeUnmount
     */
    triggerHooks(instance, LifecycleHooks.BEFORE_UNMOUNT)

    // 把 subTree 卸载掉
    unmount(instance.subTree)

    /**
     * 卸载后，触发 unmounted
     */
    triggerHooks(instance, LifecycleHooks.UNMOUNTED)
  }

  // 卸载
  const unmount = vnode => {
    // 卸载

    const { shapeFlag, children, ref, transition, type } = vnode

    if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      /**
       * 我们虽然不用卸载 KeepAlive 要缓存的组件，但是我们要告诉 KeepAlive 你这个子节点已经停用了，你自己去处理停用的逻辑
       */
      const parentComponent = vnode.component.parent
      parentComponent.ctx.deactivate(vnode)
      return
    }

    if (type === Fragment) {
      // 卸载 Fragment
      unmountChildren(children)
      return
    }

    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 组件

      unmountComponent(vnode.component)
    } else if (shapeFlag & ShapeFlags.TELEPORT) {
      // Teleport 卸载
      unmountChildren(children)
      return
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 子节点是数组

      unmountChildren(children)
    }

    const remove = () => {
      // 移除 dom 元素
      vnode.el && hostRemove(vnode.el)
    }

    if (transition) {
      // 如果是过渡组件
      transition.leave(vnode.el, remove)
    } else {
      // 移除 dom 元素
      remove()
    }

    if (ref != null) {
      setRef(ref, null)
    }
  }

  // 挂载子元素
  const mountChildren = (children, el, parentComponent) => {
    for (let i = 0; i < children.length; i++) {
      // 进行标准化 vnode
      const child = (children[i] = normalizeVNode(children[i]))
      // 递归挂载子节点
      patch(null, child, el, null, parentComponent)
    }
  }

  const mountElement = (vnode, container, anchor, parentComponent) => {
    /**
     * 1. 创建一个 dom 节点
     * 2. 设置它的 props
     * 3. 挂载它的子节点
     */
    const { type, props, children, shapeFlag, transition } = vnode
    // 创建 dom 元素 type = div p span
    const el = hostCreateElement(type)
    // 复用，更新的时候，复用，卸载，把这个 el 删除，完成卸载
    vnode.el = el
    // 处理 props
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }

    // 处理子节点
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 子节点是文本
      hostSetElementText(el, children)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 子节点是数组
      mountChildren(children, el, parentComponent)
    }

    if (transition) {
      // 过渡组件插入之前
      transition.beforeEnter?.(el)
    }

    // 把 el 插入到 container 中
    hostInsert(el, container, anchor)

    if (transition) {
      // 过渡组件插入之后
      transition.enter?.(el)
    }
  }

  const patchProps = (el, oldProps, newProps) => {
    /**
     * 1. 把老的 props 全删掉
     * 2. 把新的 props 全部给它设置上
     */

    if (oldProps) {
      // 把老的 props 全干掉
      for (const key in oldProps) {
        hostPatchProp(el, key, oldProps[key], null)
      }
    }

    if (newProps) {
      for (const key in newProps) {
        hostPatchProp(el, key, oldProps?.[key], newProps[key])
      }
    }
  }

  const patchChildren = (n1, n2, el, parentComponent) => {
    /**
     * 1. 新节点它的子节点是 文本
     *   1.1 老的是数组
     *   1.2 老的也是文本
     * 2. 新节点的子节点是 数组 或者 null
     *   2.1 老的是文本
     *   2.2 老的也是数组
     *   2.3 老的可能是 null
     */

    const prevShapeFlag = n1.shapeFlag

    const shapeFlag = n2.shapeFlag

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      //  新的是文本
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        //  老的是数组，把老的children卸载掉
        unmountChildren(n1.children)
      }

      if (n1.children !== n2.children) {
        // 设置文本，如果n1和n2的children不一样
        hostSetElementText(el, n2.children)
      }
    } else {
      // 老的有可能是 数组 或者 null 或者 文本
      // 新的有可能是 数组 或者 null
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        // 老的是文本
        // 把老的文本节点干掉
        hostSetElementText(el, '')
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 挂载新的节点
          mountChildren(n2.children, el, parentComponent)
        }
      } else {
        // 老的数组 或者 null
        // 新的还是 数组 或者 null

        if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 老的是数组
          if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            // 老的是数组，新的也是数组
            patchKeyedChildren(n1.children, n2.children, el, parentComponent)
          } else {
            // 新的不是数组，卸载老的数组
            unmountChildren(n1.children)
          }
        } else {
          // 老的是 null
          if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            // 新的是数组，挂载新的
            mountChildren(n2.children, el, parentComponent)
          }
        }
      }
    }
  }

  const patchKeyedChildren = (c1, c2, container, parentComponent) => {
    /**
     * 全量 diff
     *
     * 1. 双端 diff
     *
     * 1.1 头部对比
     * c1 => [a, b]
     * c2 => [a, b, c, d]
     *
     * 开始时：i = 0, e1 = 1, e2 = 3
     * 结束时：i = 2, e1 = 1, e2 = 3
     *
     * 1.2 尾部对比
     * c1 => [a, b]
     * c2 => [c, d, a, b]
     * 开始时：i = 0, e1 = 1, e2 = 3
     * 结束时：i = 0，e1 = -1, e2 = 1
     *
     * 根据双端对比，得出结论：
     * i > e1 表示老的少，新的多，要挂载新的，挂载的范围是 i - e2
     * i > e2 的情况下，表示老的多，新的少，要把老的里面多余的卸载掉，卸载的范围是 i - e1
     *
     * 2. 乱序
     * c1 => [a, (b, c, d), e]
     * c2 => [a, (c, d, b), e]
     * 开始时：i = 0, e1 = 4, e2 = 4
     * 双端对比完结果：i = 1, e1 = 3, e2 = 3
     *
     */

    // 开始对比的下标
    let i = 0

    // 老的子节点的最后一个元素的下标
    let e1 = c1.length - 1

    // 新的子节点的最后一个元素的下标
    let e2 = c2.length - 1
    /**
     *
     * 1.1 头部对比
     * c1 => [a, b]
     * c2 => [a, b, c, d]
     *
     * 开始时：i = 0, e1 = 1, e2 = 3
     * 结束时：i = 2, e1 = 1, e2 = 3
     */
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = (c2[i] = normalizeVNode(c2[i]))

      if (isSameVNodeType(n1, n2)) {
        // 如果 n1 和 n2 是同一个类型的子节点，那就可以更新，更新完了，对比下一个
        patch(n1, n2, container, null, parentComponent)
      } else {
        break
      }

      i++
    }

    /**
     *
     * 1.2 尾部对比
     *
     * c1 => [a, b]
     * c2 => [c, d, a, b]
     * 开始时：i = 0, e1 = 1, e2 = 3
     * 结束时：i = 0，e1 = -1, e2 = 1
     */

    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = (c2[e2] = normalizeVNode(c2[e2]))

      if (isSameVNodeType(n1, n2)) {
        // 如果 n1 和 n2 是同一个类型的子节点，那就可以更新，更新完了之后，对比上一个
        patch(n1, n2, container, null, parentComponent)
      } else {
        break
      }

      // 更新尾指针
      e1--
      e2--
    }

    if (i > e1) {
      /**
       * 根据双端对比，得出结论：
       * i > e1 表示老的少，新的多，要挂载新的，挂载的范围是 i - e2
       */

      const nextPos = e2 + 1

      const anchor = nextPos < c2.length ? c2[nextPos].el : null

      while (i <= e2) {
        patch(
          null,
          (c2[i] = normalizeVNode(c2[i])),
          container,
          anchor,
          parentComponent,
        )
        i++
      }
    } else if (i > e2) {
      /**
       * 根据双端对比，得出结果：
       * i > e2 的情况下，表示老的多，新的少，要把老的里面多余的卸载掉，卸载的范围是 i - e1
       */
      while (i <= e1) {
        unmount(c1[i])
        i++
      }
    } else {
      /**
       * 2. 乱序
       * c1 => [a, (b, c, d), e]
       * c2 => [a, (c, d, b), e]
       * 开始时：i = 0, e1 = 4, e2 = 4
       * 双端对比完结果：i = 1, e1 = 3, e2 = 3
       *
       * 找到 key 相同的 虚拟节点，让它们 patch 一下
       */

      // 老的子节点开始查找的位置 s1 - e1
      let s1 = i
      // 新的子节点开始查找的位置 s2 - e2
      let s2 = i

      /**
       * 做一份新的子节点的key和index之间的映射关系
       * map = {
       *   c:1,
       *   d:2,
       *   b:3
       * }
       */
      const keyToNewIndexMap = new Map()

      const newIndexToOldIndexMap = new Array(e2 - s2 + 1)
      // -1 代表不需要计算的
      newIndexToOldIndexMap.fill(-1)

      /**
       * 遍历新的 s2 - e2 之间，这些是还没更新的，做一份 key => index map
       */
      for (let j = s2; j <= e2; j++) {
        const n2 = (c2[j] = normalizeVNode(c2[j]))
        keyToNewIndexMap.set(n2.key, j)
      }

      let pos = -1
      // 是否需要移动
      let moved = false

      /**
       * 遍历老的子节点
       */
      for (let j = s1; j <= e1; j++) {
        const n1 = c1[j]
        // 看一下这个key在新的里面有没有
        const newIndex = keyToNewIndexMap.get(n1.key)
        if (newIndex != null) {
          if (newIndex > pos) {
            // 如果每一次都是比上一次的大，表示就是连续递增的，不需要算
            pos = newIndex
          } else {
            // 如果突然有一天比上一次的小了，表示需要移动了
            moved = true
          }
          newIndexToOldIndexMap[newIndex] = j
          // 如果有，就怕patch
          patch(n1, c2[newIndex], container, null, parentComponent)
        } else {
          // 如果没有，表示老的有，新的没有，需要卸载
          unmount(n1)
        }
      }
      // 如果 moved 为 false，表示不需要移动，就别算了
      const newIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : []
      // 换成 Set 性能好一点
      const sequenceSet = new Set(newIndexSequence)

      /**
       * 1. 遍历新的子元素，调整顺序，倒序插入
       * 2. 新的有，老的没有的，我们需要重新挂载
       */
      for (let j = e2; j >= s2; j--) {
        /**
         * 倒序插入
         */
        const n2 = c2[j]
        // 拿到它的下一个子元素
        const anchor = c2[j + 1]?.el || null
        if (n2.el) {
          if (moved) {
            // 如果需要移动，再进去
            // 如果 j 不在最长递增子序列中，表示需要移动
            if (!sequenceSet.has(j)) {
              // 依次进行倒序插入，保证顺序的一致性
              hostInsert(n2.el, container, anchor)
            }
          }
        } else {
          // 新的有，老的没有，重新挂载
          patch(null, n2, container, anchor, parentComponent)
        }
      }
    }
  }

  const patchElement = (n1, n2, parentComponent) => {
    /**
     * 1. 复用 dom 元素
     * 2. 更新 props
     * 3. 更新 children
     */
    // 复用 dom 元素 每次进来，都拿上一次的 el，保存到最新的虚拟节点上 n2.el
    const el = (n2.el = n1.el)

    const { patchFlag, dynamicChildren } = n2

    // 更新 props

    const oldProps = n1.props
    const newProps = n2.props

    if (patchFlag > 0) {
      // patchFlag 有
      if (patchFlag & PatchFlags.CLASS) {
        // 类名是动态的
        hostPatchProp(el, 'class', oldProps?.class, newProps.class)
      }

      if (patchFlag & PatchFlags.STYLE) {
        // 类名是动态的
        hostPatchProp(el, 'style', oldProps?.style, newProps.style)
      }
      if (patchFlag & PatchFlags.TEXT) {
        // 子节点是文本，并且是动态的
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children)
        }
        return
      }
    } else {
      // patchFlag 没有，就更新所有的属性
      patchProps(el, oldProps, newProps)
    }

    if (dynamicChildren && n1.dynamicChildren) {
      // 这种情况下，我们只需要更新动态节点
      patchBlockChildren(
        n1.dynamicChildren,
        dynamicChildren,
        el,
        parentComponent,
      )
    } else {
      // 更新 children，全量diff
      patchChildren(n1, n2, el, parentComponent)
    }
  }

  const patchBlockChildren = (c1, c2, container, parentComponent) => {
    // 只对比当前 Block 的动态子节点
    for (let i = 0; i < c2.length; i++) {
      patch(c1[i], c2[i], container, null, parentComponent)
    }
  }

  /**
   * 处理元素的挂载和更新
   */
  const processElement = (n1, n2, container, anchor, parentComponent) => {
    if (n1 == null) {
      // 挂载
      mountElement(n2, container, anchor, parentComponent)
    } else {
      // 更新
      patchElement(n1, n2, parentComponent)
    }
  }

  /**
   * 处理文本的挂载和更新
   */
  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      // 挂载
      const el = hostCreateText(n2.children)
      // 给 vnode 绑定 el
      n2.el = el
      // 把文本节点插入到 container 中
      hostInsert(el, container, anchor)
    } else {
      // 更新
      // 复用节点
      n2.el = n1.el
      if (n1.children != n2.children) {
        // 如果文本内容变了，就更新
        hostSetText(n2.el, n2.children)
      }
    }
  }

  const updateComponentPreRender = (instance, nextVNode) => {
    /**
     * 更新 props
     * 更新 slots
     */
    // 更新虚拟节点
    instance.vnode = nextVNode
    instance.next = null
    /**
     * 更新组件的属性
     */
    updateProps(instance, nextVNode)

    /**
     * 更新组件的插槽
     */
    updateSlots(instance, nextVNode)
  }
  const setupRenderEffect = (instance, container, anchor) => {
    const componentUpdateFn = () => {
      /**
       * 区分挂载和更新
       */
      if (!instance.isMounted) {
        // 挂载的逻辑
        const { vnode } = instance
        /**
         * 挂载前，触发 beforeMount
         */
        triggerHooks(instance, LifecycleHooks.BEFORE_MOUNT)

        // 调用 render 拿到 subTree，this 指向 setupState
        const subTree = renderComponentRoot(instance)
        // 将 subTree 挂载到页面
        patch(null, subTree, container, anchor, instance)
        // 组件的 vnode 的 el，会指向 subTree 的 el，它们是相同的
        vnode.el = subTree?.el
        // 保存子树
        instance.subTree = subTree
        // 挂载完了
        instance.isMounted = true

        /**
         * 挂载后，触发 mounted
         */
        triggerHooks(instance, LifecycleHooks.MOUNTED)
      } else {
        // 更新的逻辑
        let { vnode, next } = instance

        if (next) {
          // 父组件传递的属性触发的更新，会走这里
          updateComponentPreRender(instance, next)
        } else {
          // 自身属性触发的更新，会走这边
          next = vnode
        }

        /**
         * 更新前，触发 beforeUpdate
         */
        triggerHooks(instance, LifecycleHooks.BEFORE_UPDATE)

        const prevSubTree = instance.subTree
        // 调用 render 拿到 subTree，this 指向 setupState
        const subTree = renderComponentRoot(instance)
        // 将 subTree 挂载到页面
        patch(prevSubTree, subTree, container, anchor, instance)
        // 组件的 vnode 的 el，会指向 subTree 的 el，它们是相同的
        next.el = subTree?.el
        // 保存这一次的 subTree
        instance.subTree = subTree

        /**
         * 更新后，触发 updated
         */
        triggerHooks(instance, LifecycleHooks.UPDATED)
      }
    }

    // 创建 effect
    const effect = new ReactiveEffect(componentUpdateFn)
    const update = effect.run.bind(effect)

    // 保存 effect run 到 instance.update
    instance.update = update

    effect.scheduler = () => {
      queueJob(update)
    }

    update()
  }

  const mountComponent = (vnode, container, anchor, parentComponent) => {
    /**
     * 1. 创建组件实例
     * 2. 初始化组件的状态
     * 3. 将组件挂载到页面中
     */
    // 创建组件实例
    const instance = createComponentInstance(vnode, parentComponent)

    if (isKeepAlive(vnode.type)) {
      instance.ctx.renderer = {
        options,
        unmount,
      }
    }

    // 将组件的实例保存到虚拟节点上，方便后续复用
    vnode.component = instance
    // 初始化组件的状态
    setupComponent(instance)

    setupRenderEffect(instance, container, anchor)
  }

  const updateComponent = (n1, n2) => {
    const instance = (n2.component = n1.component)
    /**
     * 该更新：props 或者 slots 发生了变化
     * 不该更新：啥都没变
     */
    if (shouldUpdateComponent(n1, n2)) {
      // 绑定新的虚拟节点到 instance 上面
      instance.next = n2

      instance.update()
    } else {
      /**
       * 没有任何属性发生变化，不需要更新，但是需要复用元素，更新虚拟节点
       */
      // 复用元素
      n2.el = n1.el
      // 更新虚拟节点
      instance.vnode = n2
    }
  }

  /**
   * 处理组件的挂载和更新
   */
  const processComponent = (n1, n2, container, anchor, parentComponent) => {
    if (n1 == null) {
      /**
       * 先看一下是不是 KeepAlive 缓存的子组件，要不要复用
       */
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        /**
         * 需要复用，不用重新挂载了，但是要告诉 KeepAlive 组件，让它自己处理激活的逻辑
         */
        parentComponent.ctx.activate(n2, container, anchor)
        return
      }

      // 挂载

      mountComponent(n2, container, anchor, parentComponent)
    } else {
      // 更新，父组件传递的属性发生变化，会走这边
      updateComponent(n1, n2)
    }
  }

  const processFragment = (n1, n2, container, parentComponent) => {
    const { patchFlag, dynamicChildren } = n2
    if (n1 == null) {
      // 挂载 Fragment
      mountChildren(n2.children, container, parentComponent)
    } else {
      if (
        dynamicChildren &&
        n1.dynamicChildren &&
        patchFlag & PatchFlags.STABLE_FRAGMENT
      ) {
        // 是稳定的序列，会走动态子节点更新
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          container,
          parentComponent,
        )
        return
      }

      // 更新 Fragment
      patchChildren(n1, n2, container, parentComponent)
    }
  }

  /**
   * 更新和挂载，都用这个函数
   * @param n1 老节点，之前的，如果有，表示要个 n2 做 diff，更新，如果没有，表示直接挂载 n2
   * @param n2 新节点
   * @param container 要挂载的容器
   * @param anchor
   * @param parentComponent 父组件
   */
  const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
    if (n1 === n2) {
      // 如果两次传递了同一个虚拟节点，啥都不干
      return
    }

    if (n1 && n2 == null) {
      unmount(n1)
      return
    }

    if (n1 && !isSameVNodeType(n1, n2)) {
      // 卸载 n1 之前，拿到 n1 的下一个节点，挂载的时候，将 n2 挂载到 n1 之前的位置
      anchor = hostNextSibling(n1.el)
      // 比如说 n1 是 div ，n2 是 span，这俩就不一样，或者 n1 的 key 是1，n2 的 key 是 2，也不一样，都要卸载掉 n1
      // 如果两个节点不是同一个类型，那就卸载 n1 直接挂载 n2
      unmount(n1)
      n1 = null
    }

    /**
     * 文本，元素，组件
     */

    const { shapeFlag, type, ref } = n2

    switch (type) {
      case Text:
        processText(n1, n2, container, anchor)
        break
      case Fragment:
        processFragment(n1, n2, container, parentComponent)
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理 dom 元素 div span p h1
          // 元素可能它的子节点是一个组件 <div> <Child/> </div>
          processElement(n1, n2, container, anchor, parentComponent)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 组件
          processComponent(n1, n2, container, anchor, parentComponent)
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          type.process(n1, n2, container, anchor, parentComponent, {
            mountChildren,
            patchChildren,
            options,
          })
        }
    }

    if (ref != null) {
      setRef(ref, n2)
    }
  }

  const render = (vnode, container) => {
    /**
     * 分三步：
     * 1. 挂载
     * 2. 更新
     * 3. 卸载
     */

    if (vnode == null) {
      if (container._vnode) {
        // 卸载
        unmount(container._vnode)
      }
    } else {
      // 挂载和更新
      patch(container._vnode || null, vnode, container)
    }

    // 把最新的 vnode 保存到 container 中，以便于下一次 diff 或者 卸载
    container._vnode = vnode
  }
  return {
    render,
    createApp: createAppAPI(render),
  }
}

/**
 * 求最长递增子序列
 */
function getSequence(arr) {
  const result = []
  // 记录前驱节点
  const map = new Map()

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    // -1 不在计算范围内
    if (item === -1 || item === undefined) continue

    if (result.length === 0) {
      // 如果 result 里面一个都没有，把当前的索引放进去
      result.push(i)
      continue
    }

    const lastIndex = result[result.length - 1]
    const lastItem = arr[lastIndex]

    if (item > lastItem) {
      // 如果当前这一项大于上一个，那么就直接把索引放到 result 中
      result.push(i)
      // 记录前驱节点
      map.set(i, lastIndex)
      continue
    }
    // item 小于 lastItem

    let left = 0
    let right = result.length - 1

    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      // 拿到中间项
      const midItem = arr[result[mid]]
      if (midItem < item) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    if (arr[result[left]] > item) {
      if (left > 0) {
        // 记录前驱节点
        map.set(i, result[left - 1])
      }
      // 找到最合适的，把索引替换进去
      result[left] = i
    }
  }

  // 反向追溯
  let l = result.length
  let last = result[l - 1]

  while (l > 0) {
    l--
    // 纠正顺序
    result[l] = last
    // 去前驱节点里面找
    last = map.get(last)
  }

  return result
}
