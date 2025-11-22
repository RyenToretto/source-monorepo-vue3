import { ShapeFlags } from '@vue/shared'
import { getCurrentInstance } from '@vue/runtime-core'

export const isKeepAlive = type => type?.__isKeepAlive

export const KeepAlive = {
  name: 'KeepAlive',
  __isKeepAlive: true,
  props: ['max'],
  setup(props, { slots }) {
    const instance = getCurrentInstance()

    const { options, unmount } = instance.ctx.renderer
    const { createElement, insert } = options

    /**
     * 缓存：
     * component => vnode
     * or
     * key => vnode
     */
    const cache = new LRUCache(props.max)

    /**
     * 保存停用的 dom 元素
     */
    const storageContainer = createElement('div')

    /**
     * 激活的时候，renderer.ts 里面会调用这个方法，在 KeepAlive 中，需要将之前缓存的 DOM 元素，移动到 container 中
     */
    instance.ctx.activate = (vnode, container, anchor) => {
      insert(vnode.el, container, anchor)
    }

    /**
     * 虽然 unmount 不帮我卸载了，但是我自己需要把这个虚拟节点的 dom 给放到某一个地方去，我不希望它还在页面上了
     * @param vnode
     */
    instance.ctx.deactivate = vnode => {
      insert(vnode.el, storageContainer)
    }

    return () => {
      const vnode = slots.default()

      const key = vnode.key != null ? vnode.key : vnode.type
      /**
       * 先看一下之前有没有缓存过
       */
      const cachedVNode = cache.get(key)
      if (cachedVNode) {
        /**
         * 复用缓存过的组件实例
         * 复用缓存过的 dom 元素
         */
        vnode.component = cachedVNode.component
        vnode.el = cachedVNode.el
        /**
         * 再打个标记，告诉 processComponent 里面不要让它重新挂载，我要复用之前的
         * 标记：ShapeFlags.COMPONENT_KEPT_ALIVE
         */
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE
      }

      /**
       * 这一块，就是处理缓存的
       */
      const _vnode = cache.set(key, vnode)
      if (_vnode) {
        /**
         * 超出了，要卸载最近没使用过的
         */
        resetShapeFlag(_vnode)
        unmount(_vnode)
      }

      /**
       * 打个标记，告诉 unmount 别帮我卸载，我要作缓存
       * 标记：ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
       */
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      return vnode
    }
  },
}

function resetShapeFlag(vnode) {
  /**
   * 我要卸载这个子组件，你帮我把这两个标记删掉
   */
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
}

class LRUCache {
  cache = new Map()
  max
  constructor(max = Infinity) {
    this.max = max
  }

  get(key) {
    if (!this.cache.has(key)) return
    /**
     * 移动位置，移动到最后面去
     */

    const value = this.cache.get(key)

    this.cache.delete(key)
    this.cache.set(key, value)

    return value
  }

  set(key, value) {
    let vnode
    if (this.cache.has(key)) {
      /**
       * 之前有，先删掉，后面再 set，就是把它放到最后面去
       */
      this.cache.delete(key)
    } else {
      if (this.cache.size >= this.max) {
        /**
         * 之前没有，并且当前缓存的数量已经够了，把最久没有使用过的，给删掉，然后再把最新的 set 进去
         */
        const firstKey = this.cache.keys().next().value
        // 拿到 vnode，我一会儿要卸载它
        vnode = this.cache.get(firstKey)
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)

    return vnode
  }
}
