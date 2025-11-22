import { proxyRefs } from '@vue/reactivity'
import { initProps, normalizePropsOptions } from './componentProps'
import { hasOwn, isFunction, isObject } from '@vue/shared'
import { nextTick } from './scheduler'
import { initSlots } from './componentSlots'

/**
 * 创建组件实例
 */
export function createComponentInstance(vnode, parent) {
  const { type } = vnode
  // 根组件没有 parent，就 vnode.appContext，如果父组件有，那就拿 parent.appContext
  const appContext = parent ? parent.appContext : vnode.appContext

  const instance: any = {
    type,
    vnode,
    // createApp 产生的 appContext
    appContext,
    // 父组件
    parent,
    // 渲染函数
    render: null,
    // setup 返回的状态
    setupState: {},
    /**
     * 用户声明的组件 props
     */
    propsOptions: normalizePropsOptions(type.props),
    props: {},
    attrs: {},
    // 组件的插槽
    slots: {},
    refs: {},
    // 子树，就是 render 的返回值
    subTree: null,
    // 是否已经挂载
    isMounted: false,
    // 我要注入给子组件访问的属性
    provides: parent ? parent.provides : appContext.provides,
  }

  instance.ctx = { _: instance }
  // 处理事件的 emit
  // instance.emit = (event, ...args) => emit(instance, event, ...args)
  instance.emit = emit.bind(null, instance)
  // instance.emit('foo',1)
  // instance.$emit('foo',1)
  return instance
}

/**
 * 初始化组件
 */
export function setupComponent(instance) {
  /**
   * 初始化属性
   * 初始化插槽
   * 初始化状态
   */

  // 初始化属性
  initProps(instance)

  // 初始化插槽
  initSlots(instance)

  // 初始化状态
  setupStatefulComponent(instance)
}

const publicPropertiesMap = {
  $el: instance => instance.vnode.el,
  $attrs: instance => instance.attrs,
  $emit: instance => instance.emit,
  $slots: instance => instance.slots,
  $refs: instance => instance.refs,
  $nextTick: instance => {
    return nextTick.bind(instance)
  },
  $forceUpdate: instance => {
    return () => instance.update()
  },
}

const publicInstanceProxyHandlers = {
  get(target, key) {
    const { _: instance } = target

    const { setupState, props } = instance

    /**
     * 如果访问了某个属性，我先去 setupState 里面找
     * 如果没有，我再去 props 里面找
     */

    // 去 setupState 里面找
    if (hasOwn(setupState, key)) {
      return setupState[key]
    }

    // 去 props 里面找
    if (hasOwn(props, key)) {
      return props[key]
    }

    /**
     * $attrs
     * $slots
     * $refs
     */
    if (hasOwn(publicPropertiesMap, key)) {
      const publicGetter = publicPropertiesMap[key]
      return publicGetter(instance)
    }

    /**
     * 如果实在找不到，只能掀被窝了
     */
    return instance[key]
  },
  set(target, key, value) {
    const { _: instance } = target
    const { setupState } = instance

    if (hasOwn(setupState, key)) {
      /**
       * 修改 setupState
       */
      setupState[key] = value
    }

    return true
  },
}

function setupStatefulComponent(instance) {
  const { type } = instance

  /**
   * 创建代理对象，内部访问 setupState props $attrs $slots 这些
   */
  instance.proxy = new Proxy(instance.ctx, publicInstanceProxyHandlers)

  if (isFunction(type.setup)) {
    const setupContext = createSetupContext(instance)
    // 保存 setupContext
    instance.setupContext = setupContext
    /**
     * 设置当前组件的实例
     */

    setCurrentInstance(instance)
    // 执行 setup 函数
    const setupResult = type.setup(instance.props, setupContext)

    /**
     * 清除当前组件的实例
     */
    unsetCurrentInstance()

    handleSetupResult(instance, setupResult)
  }

  if (!instance.render) {
    // 如果上面处理完了，instance 还是 没有 render，那就取组件的配置里面拿
    instance.render = type.render
  }
}

function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    // 如果 setup 返回了函数，就认定为是 render
    instance.render = setupResult
  } else if (isObject(setupResult)) {
    // 如果返回了对象，就是状态
    instance.setupState = proxyRefs(setupResult)
  }
}

/**
 * 创建 setupContext
 */
function createSetupContext(instance) {
  return {
    // 除了 props 之外的属性
    get attrs() {
      return instance.attrs
    },
    // 处理事件
    emit(event, ...args) {
      emit(instance, event, ...args)
    },
    // 插槽
    slots: instance.slots,
    // 暴漏属性
    expose(exposed) {
      // 把用户传递的对象，保存到当前实例上
      instance.exposed = exposed
    },
  }
}

/**
 * 获取到组件公开的属性
 * @param instance
 */
export function getComponentPublicInstance(instance) {
  if (instance.exposed) {
    /**
     * 用户可以访问 exposed 和 publicPropertiesMap
     */
    // 如果有 exposedProxy 就直接返回
    if (instance.exposedProxy) return instance.exposedProxy

    // 创建一个代理对象
    instance.exposedProxy = new Proxy(proxyRefs(instance.exposed), {
      get(target, key) {
        if (key in target) {
          // 用户访问了 exposed 中的属性
          return target[key]
        }

        if (key in publicPropertiesMap) {
          // $el $props $attrs
          return publicPropertiesMap[key](instance)
        }
      },
    })

    return instance.exposedProxy
  } else {
    // 如果没有手动暴漏，返回 proxy
    return instance.proxy
  }
}

/**
 * 处理组件传递的事件
 */
function emit(instance, event, ...args) {
  /**
   * 把这个事件名转换一下
   * foo => onFoo
   * bar => onBar
   */
  const eventName = `on${event[0].toUpperCase() + event.slice(1)}`
  // 拿到事件处理函数
  const handler = instance.vnode.props[eventName]
  // 如果是一个函数，就调用它
  if (isFunction(handler)) {
    handler(...args)
  }
}

/**
 * 当前组件的实例
 */
let currentInstance = null

/**
 * 设置当前组件的实例
 */
export function setCurrentInstance(instance) {
  currentInstance = instance
}

/**
 * 获取当前的组件实例
 */
export function getCurrentInstance() {
  return currentInstance
}

export function unsetCurrentInstance() {
  currentInstance = null
}

/**
 * 当前正在渲染的组件实例
 */
let currentRenderingInstance = null

/**
 * 设置当前正在渲染的组件实例
 * @param instance
 */
export function setCurrentRenderingInstance(instance) {
  currentRenderingInstance = instance
}

/**
 * 清除当前正在渲染的组件实例
 */
export function unsetCurrentRenderingInstance() {
  currentRenderingInstance = null
}

/**
 * 获取当前正在渲染的组件实例
 */
export function getCurrentRenderingInstance() {
  return currentRenderingInstance
}
