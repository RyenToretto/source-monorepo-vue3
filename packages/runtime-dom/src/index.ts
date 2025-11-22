import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'
import { createRenderer } from '@vue/runtime-core'
import { isString } from '@vue/shared'

export * from '@vue/runtime-core'

const renderOptions = { patchProp, ...nodeOps }

const renderer = createRenderer(renderOptions)

export function render(vnode, container) {
  renderer.render(vnode, container)
}

export function createApp(rootComponent, rootProps) {
  const app = renderer.createApp(rootComponent, rootProps)
  const _mount = app.mount.bind(app)
  /**
   * 重写 app mount，使用dom查询获取到元素
   */
  function mount(selector) {
    let el = selector
    if (isString(selector)) {
      el = document.querySelector(selector)
    }
    _mount(el)
  }

  app.mount = mount

  return app
}

export { renderOptions }
