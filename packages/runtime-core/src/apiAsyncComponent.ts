import { ref } from '@vue/reactivity'
import { h } from './h'
import { isFunction } from '@vue/shared'

export function defineAsyncComponent(options) {
  if (isFunction(options)) {
    // 如果传了一个函数，把它变成对象
    options = {
      loader: options,
    }
  }

  const defaultComponent = () => h('span', null, '')

  const {
    loader,
    loadingComponent = defaultComponent,
    errorComponent = defaultComponent,
    timeout,
  } = options
  return {
    setup(props, { attrs, slots }) {
      const component = ref(loadingComponent)

      function loadComponent() {
        return new Promise((resolve, reject) => {
          if (timeout && timeout > 0) {
            setTimeout(() => {
              /**
               * 包装一下 loader 函数，手动控制超时时间，如果超时了，手动调用 reject
               */
              // Promise 的状态是不可逆的
              reject('超时了')
            }, timeout)
          }
          // 如果请求回来了，调用 resolve，失败了 调用 reject
          loader().then(resolve, reject)
        })
      }
      /**
       * loader 返回一个 Promise，如果这个 Promise 在 5000 之内没完成，我就让他报错
       */
      loadComponent().then(
        comp => {
          if (comp && comp[Symbol.toStringTag] === 'Module') {
            // 处理 esModule
            // @ts-ignore
            comp = comp.default
          }
          // 组件加载成功了
          component.value = comp
        },
        err => {
          console.log(err)
          // 加载失败了，渲染 errorComponent
          component.value = errorComponent
        },
      )

      return () => {
        return h(
          component.value,
          {
            ...attrs,
            ...props,
          },
          slots,
        )
      }
    },
  }
}
